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
 * 2026111705（type 31 牧场人格）没有任何操作样本，只做存在性展示，不发请求。
 */

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

// 任务状态：1=可领取 3=已领取 4=未解锁（阶段 1 内 1→3 已实证）
const TASK_CLAIMABLE = new Set([1, 2]);
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

function createMugeService({ types, send, itemDto, now = () => Math.floor(Date.now() / 1000), log = () => {} }) {
  let cache = null;
  let cacheAt = 0;
  let inflight = null;

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
      claimable: TASK_CLAIMABLE.has(num(row.state)),
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

  async function readGroup(id) {
    const reply = await rpc('GetGroup', types.MugeGetGroupRequest, types.MugeGetGroupReply, { id });
    return groupOf(reply);
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
      readGroup(ACTIVITY_IDS.personality),
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
      personality: {
        id: ACTIVITY_IDS.personality,
        available: Boolean(personalityGroup),
        // 没有 1705 的 Operate/body 样本，面板只展示入口，不提供任何操作。
        supported: false,
        reason: personalityGroup ? '尚未取得牧场人格的协议样本，暂仅展示活动入口' : '牧场人格模块读取失败',
      },
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
      if (typeof enabled.canProceed === 'function' && !enabled.canProceed()) break;
      try {
        const result = await operate(action);
        done.push(result);
        if (rows && result.ids.length) {
          log?.('活动', `自动领取${result.label}完成：${result.ids.length} 项`, {
            module: 'activity', event: '牧歌初启自动领取', result: 'success', action, ids: result.ids,
          });
        }
      } catch (error) {
        // 领不到（已领完/时间窗变化）不视为故障：下一个心跳会重新读状态
        log?.('活动', `自动领取${WORKFLOW[action].label}失败：${error.message}`, {
          module: 'activity', event: '牧歌初启自动领取', result: 'error', action,
        });
      }
    }
    return done;
  }

  return { getOverview, claim: async action => operate(action), claimEnabled, invalidate, ACTIVITY_IDS, WORKFLOW };
}

module.exports = { createMugeService, ACTIVITY_IDS, WORKFLOW };
