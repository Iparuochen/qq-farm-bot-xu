/**
 * 牧歌初启活动服务（插件版）。
 *
 * 协议全部来自 2026-11-17 官方客户端实机抓包（gate-obt.nqf.qq.com），
 * 证据样本见 backend/proto/muge.proto 顶部注释。
 *
 * 读取：ActivityService.GetGroup(子活动 id) —— 纯查询，无副作用；
 *        兴牧庆典 / 牧友同行 / 成长手册的 body 都随 GetGroup 回包下发。
 * 领取：ActivityService.Operate，cmd 82/83/84/85 对应四个领取入口，
 *        action 槽位 = 100 + cmd，请求体恒为 { id: 0 }（交给服务端按可领取清单处理）。
 *
 * 牧场人格（2026111705）：GetGroup 回包 body 在 field 127；操作 cmd 86/87/89
 * 分别对应保存答案、结算人格、领取首次分享奖励（请求槽位 186/187/189）。
 */

const PERSONALITY = require('./data/personality.json');


const ACTIVITY_IDS = {
  main: 2026111700,
  celebration: 2026111702,
  friend: 2026111703,
  manual: 2026111704,
  personality: 2026111705,
};

const WORKFLOW = {
  celebration: { cmd: 85, field: 'celebration', label: '兴牧庆典奖励', body: 'celebration' },
  friend: { cmd: 84, field: 'friend', label: '牧友同行奖励', body: 'friend' },
  manualTask: { cmd: 82, field: 'manual_task', label: '成长手册任务奖励', body: 'manual' },
  manualStage: { cmd: 83, field: 'manual_stage', label: '成长手册阶段奖励', body: 'manual' },
};

// 牧场人格操作：cmd 86 保存答案、87 结算、89 领取首次分享奖励
const SURVEY_WORKFLOW = {
  saveAnswers: { cmd: 86, field: 'survey_save', label: '保存人格答案' },
  settle: { cmd: 87, field: 'settle', label: '结算牧场人格' },
  claimShare: { cmd: 89, field: 'claim_share', label: '领取人格分享奖励' },
};

const PERSONALITY_IMAGE_PREFIX = '/activity/muge-ranch/personality-';
const PERSONALITY_QUESTIONS = list(PERSONALITY.questions);


// 任务状态：1=未达成 2=可领取 3=已领取 4=未解锁
// 与官方后台/上游实现一致：只有 2 才是可领取，1（进行中）领取会被服务端拒绝（1034164）。
const TASK_CLAIMABLE = 2;
// 档位状态：1=未达成 2=可领取 3=已领取（cmd 83 回包实测 2→3）
const TIER_CLAIMABLE = 2;

const CACHE_TTL_MS = 20 * 1000;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function createMugeService({ types, util, send, itemDto, now = () => Math.floor(Date.now() / 1000), log = () => {} }) {
  let cache = null;
  let cacheAt = 0;
  let inflight = null;
  // 记录「同一批可领取项」领取失败的签名，避免状态未刷新时每个心跳重复请求、重复报错。
  const failedClaims = new Map();

  async function rpc(method, requestType, replyType, input) {
    const body = Buffer.from(requestType.encode(requestType.fromObject(input)).finish());
    const reply = await send('gamepb.activitypb.ActivityService', method, body);
    return replyType.toObject(replyType.decode(reply.body), { longs: String, defaults: true, arrays: true });
  }

  function groupOf(reply) {
    return reply?.group || null;
  }

  function item(row) {
    if (!row || !num(row.id)) return null;
    return itemDto({ id: num(row.id), count: num(row.count) });
  }

  function tierDto(row) {
    return {
      id: num(row.id),
      threshold: num(row.threshold),
      state: num(row.state),
      claimable: num(row.state) === TIER_CLAIMABLE,
      reward: item(row.reward),
    };
  }

  function taskDto(row) {
    return {
      id: num(row.id),
      progress: num(row.progress),
      target: num(row.target),
      state: num(row.state),
      stage: num(row.stage),
      claimable: num(row.state) === TASK_CLAIMABLE,
      title: String(row.title || ''),
      reward: item(row.reward),
    };
  }

  function activityInfo(node) {
    const info = node?.activity || {};
    return {
      id: num(info.id),
      title: String(info.title || '牧歌初启'),
      startTime: num(info.start_time),
      endTime: num(info.end_time),
    };
  }

  function phaseOf(startTime, endTime, current) {
    if (!startTime || !endTime) return 'unknown';
    if (current < startTime) return 'upcoming';
    if (current >= endTime) return 'ended';
    return 'active';
  }

  function normalizeGroup(group) {
    const info = activityInfo(group);
    // GetGroup 把 body 挂在 group.children[0]，Operate 直接挂在 group 上，两种都要兼容
    const hasBody = node => Boolean(node && (node.celebration || node.friend || node.manual));
    const owner = hasBody(group) ? group : list(group?.children).find(hasBody) || group;
    const celebration = owner?.celebration ? {
      id: info.id,
      total: num(owner.celebration.total),
      tiers: list(owner.celebration.tiers).map(tierDto).filter(tier => tier.id > 0),
    } : null;
    const friend = owner?.friend ? {
      id: info.id,
      tiers: list(owner.friend.tiers).map(tierDto).filter(tier => tier.id > 0),
      friends: list(owner.friend.friends).map(row => ({
        gid: num(row.gid),
        nickname: String(row.nickname || ''),
        avatar: String(row.avatar || ''),
        level: num(row.level),
      })).filter(row => row.gid > 0),
    } : null;
    const manual = owner?.manual ? {
      id: info.id,
      extra: num(owner.manual.extra),
      tasks: list(owner.manual.tasks).map(taskDto).filter(task => task.id > 0),
      stages: list(owner.manual.stages).map(tierDto).filter(tier => tier.id > 0),
    } : null;
    return { info, celebration, friend, manual };
  }

  // protobufjs 的 map<int64, ...> 键在 toObject 后是 8 字节 hash 字符串，
  // 需要经 longFromHash 还原成题号；纯数字键直接使用。
  function answerKey(key) {
    const text = String(key);
    if (/^\d+$/.test(text)) return String(Number(text));
    try {
      const long = util?.longFromHash ? util.longFromHash(text) : null;
      return long ? String(long) : text;
    } catch {
      return text;
    }
  }

  function answersDto(answers) {
    const out = {};
    for (const [key, value] of Object.entries(answers || {})) out[answerKey(key)] = num(value);
    return out;
  }

  // GetGroup 的人格 body 可能挂在 group 或 group.children[0]
  function surveyNodeOf(group) {
    const nodes = [group, ...list(group?.children)];
    return nodes.find(node => node && node.survey) || null;
  }

  function normalizePersonality(group) {
    const survey = surveyNodeOf(group)?.survey || null;
    const answers = answersDto(survey?.answers);
    const personalityId = num(survey?.personality_id);
    const answered = PERSONALITY_QUESTIONS.filter(question => answers[String(question.id)] > 0).length;
    const total = PERSONALITY_QUESTIONS.length;
    return {
      id: ACTIVITY_IDS.personality,
      available: Boolean(survey),
      answers,
      personalityId,
      settleCount: num(survey?.settle_count),
      shareRewardClaimed: Boolean(survey?.share_reward_claimed),
      image: personalityId ? `${PERSONALITY_IMAGE_PREFIX}${personalityId}.png` : '',
      answered,
      total,
      canSettle: total > 0 && answered >= total,
      questions: PERSONALITY_QUESTIONS,
      reason: survey ? '' : '牧场人格模块读取失败',
    };
  }

  async function readGroup(id) {
    const reply = await rpc('GetGroup', types.MugeGetGroupRequest, types.MugeGetGroupReply, { id });
    return groupOf(reply);
  }

  /**
   * 与上游一致：优先用 ActivityService.List 一次读取所有活动节点。
   * List 回包里子活动节点直接携带 body（124/125/126/127）。
   */
  async function readListGroups() {
    const reply = await rpc('List', types.MugeListRequest, types.MugeListReply, {});
    return list(reply.groups);
  }

  async function readPersonalityNode() {
    try {
      const groups = await readListGroups();
      const root = groups.find(group => num(group?.activity?.id) === ACTIVITY_IDS.main) || groups[0] || null;
      const child = list(root?.children).find(node => num(node?.activity?.id) === ACTIVITY_IDS.personality);
      if (child) return child;
    } catch {
      // List 不可用时回退到 GetGroup
    }
    return readGroup(ACTIVITY_IDS.personality);
  }

  async function readPersonalityState() {
    return normalizePersonality(await readPersonalityNode());
  }

  function summarize(celebration, friend, manual) {
    const nextCelebration = celebration?.tiers?.find(tier => tier.claimable);
    const nextFriend = friend?.tiers?.find(tier => tier.claimable);
    const claimableTasks = (manual?.tasks || []).filter(task => task.claimable);
    const claimableStages = (manual?.stages || []).filter(tier => tier.claimable);
    return {
      celebration: {
        claimable: Boolean(nextCelebration),
        claimableCount: (celebration?.tiers || []).filter(tier => tier.claimable).length,
        nextThreshold: nextCelebration?.threshold || 0,
      },
      friend: {
        claimable: Boolean(nextFriend),
        claimableCount: (friend?.tiers || []).filter(tier => tier.claimable).length,
      },
      manual: {
        claimableTaskCount: claimableTasks.length,
        claimableStageCount: claimableStages.length,
        claimable: claimableTasks.length > 0 || claimableStages.length > 0,
      },
    };
  }

  async function load() {
    const current = now();
    const results = await Promise.allSettled([
      readGroup(ACTIVITY_IDS.celebration),
      readGroup(ACTIVITY_IDS.friend),
      readGroup(ACTIVITY_IDS.manual),
      readPersonalityNode(),
    ]);
    const warnings = [];
    const groups = results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const names = ['兴牧庆典', '牧友同行', '成长手册', '牧场人格'];
      warnings.push(`${names[index]}读取失败：${result.reason?.message || result.reason}`);
      return null;
    });
    const celebration = normalizeGroup(groups[0]).celebration;
    const friend = normalizeGroup(groups[1]).friend;
    const manual = normalizeGroup(groups[2]).manual;
    const personalityGroup = groups[3];
    const main = activityInfo(groups[0] || groups[1] || groups[2] || personalityGroup);
    return {
      activity: {
        id: ACTIVITY_IDS.main,
        title: main.title || '牧歌初启',
        startTime: main.startTime,
        endTime: main.endTime,
        phase: phaseOf(main.startTime, main.endTime, current),
        serverTime: current,
      },
      celebration,
      friend,
      manual,
      personality: normalizePersonality(personalityGroup),
      summary: summarize(celebration, friend, manual),
      warnings,
    };
  }

  async function getOverview(force = false) {
    const current = Date.now();
    if (!force && cache && current - cacheAt < CACHE_TTL_MS) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        cache = await load();
        cacheAt = Date.now();
        return cache;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  function invalidate() {
    cache = null;
    cacheAt = 0;
  }

  function assertAction(action) {
    const workflow = WORKFLOW[action];
    if (!workflow) {
      const error = new Error(`不支持的牧歌初启操作：${action}`);
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    return workflow;
  }

  function claimableIds(state, action) {
    if (action === 'celebration') return (state?.celebration?.tiers || []).filter(tier => tier.claimable).map(tier => tier.id);
    if (action === 'friend') return (state?.friend?.tiers || []).filter(tier => tier.claimable).map(tier => tier.id);
    if (action === 'manualTask') return (state?.manual?.tasks || []).filter(task => task.claimable).map(task => task.id);
    if (action === 'manualStage') return (state?.manual?.stages || []).filter(tier => tier.claimable).map(tier => tier.id);
    return [];
  }

  async function operate(action) {
    const workflow = assertAction(action);
    const target = action === 'celebration' ? ACTIVITY_IDS.celebration
      : action === 'friend' ? ACTIVITY_IDS.friend
        : ACTIVITY_IDS.manual;
    const request = { id: target, cmd: workflow.cmd };
    request[workflow.field] = { id: 0 };
    const reply = await rpc('Operate', types.MugeOperateRequest, types.MugeOperateReply, request);
    if (num(reply.id) !== target || num(reply.cmd) !== workflow.cmd) {
      const error = new Error('活动响应与请求不匹配，请刷新后查看');
      error.code = 'MUGE_RESULT_UNKNOWN';
      throw error;
    }
    const result = reply[workflow.field] || {};
    const ids = list(result.ids).map(num);
    const rewards = list(result.rewards).map(item).filter(Boolean);
    invalidate();
    return { action, label: workflow.label, ids, rewards, repliedAt: now() };
  }

  /**
   * 自动化入口：按开关依次领取，只对「确实存在可领取项」的动作发送请求。
   * 返回本次实际执行的动作，便于 runner 决定是否立即复查。
   */
  async function claimEnabled(enabled = {}) {
    const state = await getOverview(true);
    const done = [];
    const tasks = [
      ['muge_celebration_claim', 'celebration', state.celebration?.tiers],
      ['muge_friend_claim', 'friend', state.friend?.tiers],
      ['muge_manual_task_claim', 'manualTask', state.manual?.tasks],
      ['muge_manual_stage_claim', 'manualStage', state.manual?.stages],
    ];
    for (const [key, action, rows] of tasks) {
      if (enabled[key] !== true) continue;
      const pending = claimableIds(state, action);
      if (!pending.length) continue;
      const signature = pending.slice().sort().join(',');
      // 上一次同一批可领取项已被服务端拒绝（如 1034164 已领取），状态没变化前不再重试。
      if (failedClaims.get(action) === signature) continue;
      if (typeof enabled.canProceed === 'function' && !enabled.canProceed()) break;
      try {
        const result = await operate(action);
        failedClaims.delete(action);
        done.push(result);
        if (rows && result.ids.length) {
          log?.('活动', `自动领取${result.label}完成：${result.ids.length} 项`, {
            module: 'activity', event: '牧歌初启自动领取', result: 'success', action, ids: result.ids,
          });
        }
      } catch (error) {
        failedClaims.set(action, signature);
        // 领不到（已领完/时间窗变化）不视为故障：下一个心跳会重新读状态
        log?.('活动', `自动领取${WORKFLOW[action].label}失败：${error.message}`, {
          module: 'activity', event: '牧歌初启自动领取', result: 'error', action,
        });
      }
    }
    return done;
  }

  function surveyError(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function assertSurveyAction(action) {
    const workflow = SURVEY_WORKFLOW[action];
    if (!workflow) surveyError('INVALID_ARGUMENT', `不支持的牧场人格操作：${action}`);
    return workflow;
  }

  function normalizeSurveyAnswers(input) {
    const answers = input?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      surveyError('INVALID_MUGE_ANSWERS', '请选择题目答案');
    }
    if (input.clear !== undefined && typeof input.clear !== 'boolean') {
      surveyError('INVALID_MUGE_ANSWERS', '重答标记无效');
    }
    const clear = input.clear === true;
    const keys = Object.keys(answers);
    if (clear && keys.length) surveyError('INVALID_MUGE_ANSWERS', '清空进度和保存答案需要分开提交，请刷新页面重新测试');
    if (!clear && !keys.length) surveyError('INVALID_MUGE_ANSWERS', '请选择题目答案');
    const normalized = {};
    for (const [questionId, value] of Object.entries(answers)) {
      const question = PERSONALITY_QUESTIONS.find(row => String(row.id) === String(questionId));
      if (!question || !question.options.some(option => num(option.value) === num(value))) {
        surveyError('INVALID_MUGE_ANSWERS', '题目或答案无效');
      }
      normalized[String(questionId)] = num(value);
    }
    return { answers: normalized, clear };
  }

  /**
   * 牧场人格操作：cmd 86 保存答案 / 87 结算 / 89 领取首次分享奖励。
   * 手工入口使用；不做自动化，避免替用户生成随机人格结果。
   *
   * Operate 回包结构可能因服务端版本不同而缺少 survey，因此操作后重新读取一次
   * 人格节点（优先 ActivityService.List）作为唯一确认依据，避免回包字段差异导致
   * 「实际成功却提示失败」。
   */
  async function personality(action, input = {}) {
    const workflow = assertSurveyAction(action);
    // 与上游一致：只读取牧场人格节点，避免整页 4 个子活动重复刷新
    const personalityState = await readPersonalityState();
    if (!personalityState?.available) surveyError('MUGE_UNAVAILABLE', '牧场人格数据暂不可用');
    let params = {};
    if (action === 'saveAnswers') {
      params = normalizeSurveyAnswers(input);
    } else if (action === 'settle') {
      if (!personalityState.canSettle) surveyError('MUGE_ANSWERS_INCOMPLETE', '请先完成全部题目');
    } else if (!personalityState.personalityId || personalityState.shareRewardClaimed) {
      surveyError('MUGE_NOT_CLAIMABLE', '请先完成人格测试，首次分享奖励仅可领取一次');
    }
    const request = { id: ACTIVITY_IDS.personality, cmd: workflow.cmd };
    request[workflow.field] = params;
    const reply = await rpc('Operate', types.MugeOperateRequest, types.MugeOperateReply, request);
    if (num(reply.id) !== ACTIVITY_IDS.personality || num(reply.cmd) !== workflow.cmd) {
      surveyError('MUGE_RESULT_UNKNOWN', '活动响应与请求不匹配，请刷新后查看');
    }
    const result = reply[workflow.field] || {};
    const after = await readPersonalityState();
    let confirmed = true;
    if (action === 'saveAnswers') {
      const nextAnswers = after.answers || {};
      confirmed = params.clear
        ? !Object.values(nextAnswers).some(value => value > 0)
        : Object.entries(params.answers).every(([key, value]) => nextAnswers[key] === num(value));
    } else if (action === 'settle') {
      confirmed = num(after.personalityId) > 0;
    } else {
      confirmed = Boolean(after.shareRewardClaimed);
    }
    if (!confirmed) surveyError('MUGE_RESULT_UNKNOWN', '操作状态未能确认，请刷新核对，勿重复提交');
    const rewards = list(result.rewards || result.awards).map(item).filter(Boolean);
    // 用最新人格状态合并进概览缓存，避免前端操作后再整页重读
    if (cache) cache = { ...cache, personality: after, activity: { ...cache.activity, serverTime: now() } };
    else invalidate();
    log?.('活动', `牧场人格${workflow.label}完成`, {
      module: 'activity', event: '牧场人格操作', result: 'success', action,
    });
    return { action, label: workflow.label, rewards, repliedAt: now() };
  }

  return { getOverview, claim: async action => operate(action), claimEnabled, personality, invalidate, ACTIVITY_IDS, WORKFLOW };
}

module.exports = { createMugeService, ACTIVITY_IDS, WORKFLOW };
