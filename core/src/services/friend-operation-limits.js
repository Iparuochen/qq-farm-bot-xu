const { toNum, log, sleep } = require('../utils/utils');
const { getUserState, sendMsgAsync, networkEvents } = require('../utils/network');
const { types } = require('../utils/proto');
const { toLong } = require('../utils/utils');
const statsService = require('./stats');

// ===== Operation limits state =====
const operationLimits = new Map();
let lastResetDate = '';
let canGetHelpExp = true;
let helpAutoDisabledByLimit = false;
const localBadOperationCounts = new Map();

// ===== 捣乱计数器（ID 语义见下方 OP_NAMES 官方定义） =====
// 实测服务器记账行为（2026-11-07 复核，与官方 ID 语义吻合）：
// - 10003 = 今日放草 + 放虫的合计已用次数（服务器把它当"使坏共享池"，日限 100）。
//   注意：官方表里 10003 叫"放草"，但服务器回包里它装的是草+虫的合计。
// - 10004 = 今日放虫专属计数（只累计放虫）。
// 因此：放虫 = 10004，放草 = 10003 - 10004。
// 例：实测回包 10003=100、10004=52 → 已用 100/100，其中虫 52、草 48。
// 注意：PUT_BUG_OPERATION_ID / PUT_WEED_OPERATION_ID 仅作为 recordBadOperationSuccess
// 的内部成功来源标记（区分放虫/放草两条调用路径），其取值 10005/10006 与官方语义
// （10005=除草、10006=除虫）无关，请勿按官方表解读这两个常量。
const BAD_SHARED_LIMIT_ID = 10003;  // 使坏共享池：放草 + 放虫合计
const PUT_BUG_LIMIT_ID = 10004;     // 放虫专属计数
const PUT_BUG_OPERATION_ID = 10005;
const PUT_WEED_OPERATION_ID = 10006;
const GOLDEN_BUG_OPERATION_ID = 10015;
const BAD_DAILY_LIMIT = 100;

// ===== Operation type names =====
// 官方定义来源：CDN 配置表 ItemInfo.json（type=4 交互道具，interaction_type 字段），
// 并由 Basic.json（使坏/吸引的 operation_self/operation_other）与
// ShareScene.json（prank_id_count 10003:5/10004:5）交叉验证。
// 10010-10014 为空号，官方表中无定义。
// 注意 Basic.json 的 self/other 语义：
//   operation_self  = 对自己农田的操作（清除类 10016/10018，实测只能清自己的田）；
//   operation_other = 对好友农田的操作（放置类 10015/10017）。
// 即黄金虫/足球的"清除"操作码只在自己农田有效，好友家的无法代清（实测确认）。
const OP_NAMES = {
  '10001': '收获',
  '10002': '铲除',
  '10003': '放草',
  '10004': '放虫',
  '10005': '除草',
  '10006': '除虫',
  '10007': '浇水',
  '10008': '摘菜（偷菜）',
  '10009': '务农（一键浇水/除草/除虫）',
  '10015': '放置使坏黄金虫道具',
  '10016': '清除使坏黄金虫道具',
  '10017': '放置使坏足球道具',
  '10018': '清除使坏足球道具',
  '10019': '未枯萎铲除',
  '10020': '放置鹊食',
};

// ===== Daily reset =====

/**
 * Check if a new day has started (China timezone UTC+8) and reset limits.
 */
function checkDailyReset() {
  const { getServerTimeSec } = require('../utils/utils');
  const serverSec = getServerTimeSec();
  const serverMs = serverSec > 0
    ? serverSec * 1000
    : Date.now();

  // UTC+8 timezone offset: 8 hours in milliseconds
  const UTC_PLUS_8_OFFSET_MS = 8 * 3600 * 1000;
  const chinaDate = new Date(serverMs + UTC_PLUS_8_OFFSET_MS);
  const year = chinaDate.getUTCFullYear();
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaDate.getUTCDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  if (lastResetDate !== today) {
    if (lastResetDate !== '') {
      log('系统', '跨日重置，清空操作限制缓存');
    }
    operationLimits.clear();
    localBadOperationCounts.clear();
    canGetHelpExp = true;

    if (helpAutoDisabledByLimit) {
      helpAutoDisabledByLimit = false;
      log('好友', '新的一天已开始，自动恢复帮忙操作功能', {
        module: 'friend',
        event: '好友巡查循环',
        result: 'ok',
      });
    }

    lastResetDate = today;
  }
}

/**
 * Disable help when daily experience limit is reached.
 * After this, only guard-dog (护主犬) friends will still be helped.
 */
function autoDisableHelpByExpLimit() {
  if (!canGetHelpExp) return;
  canGetHelpExp = false;
  helpAutoDisabledByLimit = true;
  log('好友', '今日帮助经验已达上限，自动停止普通帮忙，开启仅帮助护主犬好友模式', {
    module: 'friend',
    event: '好友巡查循环',
    result: 'ok',
  });
}

// ===== Operation limits =====

/**
 * Update operation limits from server response (after each RPC call).
 */
function updateOperationLimits(limits) {
  if (!limits || limits.length === 0) return;
  checkDailyReset();
  for (const limit of limits) {
    const id = toNum(limit.id);
    if (id > 0) {
      operationLimits.set(id, {
        dayTimes: toNum(limit.day_times),
        dayTimesLimit: toNum(limit.day_times_lt),
        dayExpTimes: toNum(limit.day_exp_times),
        dayExpTimesLimit: toNum(limit.day_ex_times_lt),
      });
    }
  }
  syncBadCountsToStats();
}

/**
 * 把服务器返回的使坏额度换算成"今日放草/放虫次数"写进统计面板。
 * 服务器记账口径（实测）：10003 = 草+虫合计（共享池），10004 = 放虫专属，
 * 故 放虫 = 10004、放草 = 10003 - 10004。
 * 用服务器值覆盖本地计数，重启 bot 后当日累计也不会归零。
 */
function syncBadCountsToStats() {
  const shared = operationLimits.get(BAD_SHARED_LIMIT_ID);
  const bugLimit = operationLimits.get(PUT_BUG_LIMIT_ID);
  if (!shared && !bugLimit) return;
  // 与捣乱日志同源（formatBadUsageSummary），保证面板数字和日志"虫X 草Y"完全一致
  const summary = getBadUsageSummary();
  statsService.setOperation('putBug', summary.bugUsed);
  statsService.setOperation('putWeed', summary.weedUsed);
}

/**
 * Check if we can still gain experience from a specific operation.
 */
function canGetExp(operationId) {
  const limit = operationLimits.get(operationId);
  if (!limit) return true;
  // No experience limit set -> can get exp
  if (limit.dayExpTimesLimit <= 0) return true;
  return limit.dayExpTimes < limit.dayExpTimesLimit;
}

/**
 * Check if we can gain experience from any of the given operation candidates.
 */
function canGetExpByCandidates(expIds = []) {
  const ids = Array.isArray(expIds) ? expIds : [expIds];
  for (const id of ids) {
    if (canGetExp(toNum(id))) return true;
  }
  return false;
}

/**
 * Check if an operation can still be performed (by operation count limit).
 */
function canOperate(operationId, fallbackLimit = 0) {
  const limit = operationLimits.get(operationId);
  const fallback = Math.max(0, Number(fallbackLimit) || 0);
  if (!limit) return true; // No limit known -> assume allowed
  const dayTimesLimit = limit.dayTimesLimit > 0 ? limit.dayTimesLimit : fallback;
  if (dayTimesLimit <= 0) return true; // No limit set
  return limit.dayTimes < dayTimesLimit;
}

/**
 * Get remaining times for an operation. Returns 999 if unlimited.
 */
function getRemainingTimes(operationId, fallbackLimit = 0) {
  const limit = operationLimits.get(operationId);
  const fallback = Math.max(0, Number(fallbackLimit) || 0);
  if (!limit) return fallback > 0 ? fallback : 999;
  const dayTimesLimit = limit.dayTimesLimit > 0 ? limit.dayTimesLimit : fallback;
  if (dayTimesLimit <= 0) return 999;
  return Math.max(0, dayTimesLimit - limit.dayTimes);
}

function getOperationDayTimes(operationId) {
  const limit = operationLimits.get(operationId);
  return limit ? Math.max(0, toNum(limit.dayTimes)) : 0;
}

function getBadOperationUsedCount(operationId) {
  return Math.max(
    getOperationDayTimes(operationId),
    Math.max(0, toNum(localBadOperationCounts.get(operationId)))
  );
}

function getBadRemainingTimes(operationId = 0) {
  const sharedLimit = operationLimits.get(BAD_SHARED_LIMIT_ID);
  const sharedDailyLimit = sharedLimit?.dayTimesLimit > 0 ? sharedLimit.dayTimesLimit : BAD_DAILY_LIMIT;
  const sharedRemaining = Math.max(
    0,
    sharedDailyLimit - getBadOperationUsedCount(BAD_SHARED_LIMIT_ID)
  );
  if (operationId !== PUT_BUG_OPERATION_ID) return sharedRemaining;

  const bugLimit = operationLimits.get(PUT_BUG_LIMIT_ID);
  if (!bugLimit?.dayTimesLimit) return sharedRemaining;
  return Math.min(
    sharedRemaining,
    Math.max(0, bugLimit.dayTimesLimit - getBadOperationUsedCount(PUT_BUG_LIMIT_ID))
  );
}

function canOperateBad() {
  return getBadRemainingTimes() > 0;
}

/**
 * 今日捣乱额度使用摘要：10003 = 放草+放虫合计（共享池），10004 = 放虫专属。
 * 放虫同时累计 10004 与共享池 10003，放草只累计共享池，因此 放草 = 池 - 虫。
 */
function getBadUsageSummary() {
  const sharedUsed = getBadOperationUsedCount(BAD_SHARED_LIMIT_ID);
  const sharedLimitEntry = operationLimits.get(BAD_SHARED_LIMIT_ID);
  const sharedLimit = sharedLimitEntry && sharedLimitEntry.dayTimesLimit > 0
    ? sharedLimitEntry.dayTimesLimit
    : BAD_DAILY_LIMIT;
  const bugUsed = getBadOperationUsedCount(PUT_BUG_LIMIT_ID);
  const weedUsed = Math.max(0, sharedUsed - bugUsed);
  return {
    used: Math.min(sharedUsed, sharedLimit),
    limit: sharedLimit,
    bugUsed,
    weedUsed,
    remaining: getBadRemainingTimes(),
  };
}

/**
 * 额度摘要的可读形式，供捣乱日志展示：'已用 100/100（虫52 草48），剩余 0 次'。
 */
function formatBadUsageSummary() {
  const summary = getBadUsageSummary();
  return `已用 ${summary.used}/${summary.limit}（虫${summary.bugUsed} 草${summary.weedUsed}），剩余 ${summary.remaining} 次`;
}

function recordBadOperationSuccess(operationId, count) {
  const delta = Math.max(0, Number(count) || 0);
  // 放草、放虫都累计共享池 10003；放虫额外累计专属计数 10004
  const sharedLocal = Math.max(0, toNum(localBadOperationCounts.get(BAD_SHARED_LIMIT_ID)));
  localBadOperationCounts.set(
    BAD_SHARED_LIMIT_ID,
    Math.max(getOperationDayTimes(BAD_SHARED_LIMIT_ID), sharedLocal + delta)
  );
  if (operationId === PUT_BUG_OPERATION_ID) {
    const bugLocal = Math.max(0, toNum(localBadOperationCounts.get(PUT_BUG_LIMIT_ID)));
    localBadOperationCounts.set(
      PUT_BUG_LIMIT_ID,
      Math.max(getOperationDayTimes(PUT_BUG_LIMIT_ID), bugLocal + delta)
    );
  }
}

/**
 * 是否已持有某计数器的服务器限额数据（用于判断内存限额表是否被回包填充过，
 * 例如重启后尚未成功巡田时，捣乱流程可据此决定是否先主动拉取一次）。
 */
function hasOperationLimitData(operationId) {
  return operationLimits.has(toNum(operationId));
}

/**
 * Get all operation limits as a key-value map with names.
 */
function getOperationLimits() {
  const result = {};
  const allIds = [
    10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009,
    10015, 10016, 10017, 10018, 10019, 10020,
  ];
  for (const id of allIds) {
    const limit = operationLimits.get(id);
    if (limit) {
      result[id] = {
        name: OP_NAMES[id] || `#${id}`,
        ...limit,
        remaining: getRemainingTimes(id),
      };
    }
  }
  return result;
}

// ===== Help exp limit state =====

function getCanGetHelpExp() {
  return canGetHelpExp;
}

function setCanGetHelpExp(value) {
  canGetHelpExp = !!value;
}

function getHelpAutoDisabledByLimit() {
  return helpAutoDisabledByLimit;
}

// ===== Friend operation RPC calls =====

/**
 * Help water a friend's lands.
 * If `checkExpLimit` is true, sleeps 200ms after the call and checks if exp increased
 * to determine if the help exp limit is reached.
 */
async function helpWater(gid, landIds, checkExpLimit = false) {
  const expBefore = toNum((getUserState() || {}).exp);
  const payload = types.WaterLandRequest.encode(
    types.WaterLandRequest.create({
      land_ids: landIds,
      host_gid: toLong(gid),
    })
  ).finish();
  const { body } = await sendMsgAsync(
    'gamepb.plantpb.PlantService',
    'WaterLand',
    payload
  );
  const reply = types.WaterLandReply.decode(body);
  updateOperationLimits(reply.operation_limits);

  if (checkExpLimit) {
    await sleep(200);
    const expAfter = toNum((getUserState() || {}).exp);
    if (expAfter <= expBefore) autoDisableHelpByExpLimit();
  }

  return reply;
}

/**
 * Help weed a friend's lands.
 */
async function helpWeed(gid, landIds, checkExpLimit = false) {
  const expBefore = toNum((getUserState() || {}).exp);
  const payload = types.WeedOutRequest.encode(
    types.WeedOutRequest.create({
      land_ids: landIds,
      host_gid: toLong(gid),
    })
  ).finish();
  const { body } = await sendMsgAsync(
    'gamepb.plantpb.PlantService',
    'WeedOut',
    payload
  );
  const reply = types.WeedOutReply.decode(body);
  updateOperationLimits(reply.operation_limits);

  if (checkExpLimit) {
    await sleep(200);
    const expAfter = toNum((getUserState() || {}).exp);
    if (expAfter <= expBefore) autoDisableHelpByExpLimit();
  }

  return reply;
}

/**
 * Help insecticide a friend's lands.
 */
async function helpInsecticide(gid, landIds, checkExpLimit = false) {
  const expBefore = toNum((getUserState() || {}).exp);
  const payload = types.InsecticideRequest.encode(
    types.InsecticideRequest.create({
      land_ids: landIds,
      host_gid: toLong(gid),
    })
  ).finish();
  const { body } = await sendMsgAsync(
    'gamepb.plantpb.PlantService',
    'Insecticide',
    payload
  );
  const reply = types.InsecticideReply.decode(body);
  updateOperationLimits(reply.operation_limits);

  if (checkExpLimit) {
    await sleep(200);
    const expAfter = toNum((getUserState() || {}).exp);
    if (expAfter <= expBefore) autoDisableHelpByExpLimit();
  }

  return reply;
}

/**
 * Steal harvest from a friend's lands (bulk or single).
 */
async function stealHarvest(gid, landIds) {
  const payload = types.HarvestRequest.encode(
    types.HarvestRequest.create({
      land_ids: landIds,
      host_gid: toLong(gid),
      is_all: true,
    })
  ).finish();
  const { body } = await sendMsgAsync(
    'gamepb.plantpb.PlantService',
    'Harvest',
    payload
  );
  const reply = types.HarvestReply.decode(body);
  updateOperationLimits(reply.operation_limits);
  if (Array.isArray(reply.land) && reply.land.length > 0) {
    networkEvents.emit('friendLandsObserved', {
      gid: toNum(gid),
      lands: reply.land,
      source: 'harvest_reply',
    });
  }
  return reply;
}

/**
 * Generic helper to put items (weeds/insects) on friend's lands one by one.
 * Returns the number of successful operations.
 */
async function putPlantItems(gid, landIds, RequestType, ReplyType, rpcMethod) {
  let ok = 0;
  const ids = Array.isArray(landIds) ? landIds : [];

  for (const landId of ids) {
    try {
      const payload = RequestType.encode(
        RequestType.create({
          land_ids: [toLong(landId)],
          host_gid: toLong(gid),
        })
      ).finish();
      const { body } = await sendMsgAsync(
        'gamepb.plantpb.PlantService',
        rpcMethod,
        payload
      );
      const reply = ReplyType.decode(body);
      updateOperationLimits(reply.operation_limits);
      ok++;
    } catch (err) {
      // 连接已断时继续逐块重试没有意义，直接上抛让上层走重连
      if (err?.code === 'CONNECTION_CLOSED') throw err;
      const msg = (err && err.message) ? err.message : '未知错误';
      if (msg.includes('1001046')) {
        // Already done - silently skip
      } else {
        log('好友', `放虫/放草失败: landId=${landId}, 错误: ${msg}`, {
          module: 'friend',
          event: '放虫放草失败',
          landId,
          error: msg,
        });
      }
      await require('../utils/utils').randomDelay(500, 1500);
    }

    if (ok > 0) {
      await require('../utils/utils').randomDelay(500, 1000);
    }
  }

  return ok;
}

/**
 * Detailed version of putPlantItems that returns failure details.
 * Returns: { ok: number, failed: [{landId, reason}] }
 * options.shouldContinue: 每块放置后调用一次，返回 false 则立即停止后续地块。
 */
async function putPlantItemsDetailed(gid, landIds, RequestType, ReplyType, rpcMethod, options = {}) {
  let ok = 0;
  const failed = [];
  const ids = Array.isArray(landIds) ? landIds : [];
  const shouldContinue = typeof options.shouldContinue === 'function' ? options.shouldContinue : null;

  for (let index = 0; index < ids.length; index += 1) {
    const landId = ids[index];
    try {
      const payload = RequestType.encode(
        RequestType.create({
          land_ids: [toLong(landId)],
          host_gid: toLong(gid),
        })
      ).finish();
      const { body } = await sendMsgAsync(
        'gamepb.plantpb.PlantService',
        rpcMethod,
        payload
      );
      const reply = ReplyType.decode(body);
      updateOperationLimits(reply.operation_limits);
      ok++;
    } catch (err) {
      // 连接已断时继续逐块重试没有意义，直接上抛让上层走重连
      if (err?.code === 'CONNECTION_CLOSED') throw err;
      const msg = (err && err.message) ? err.message : '未知错误';
      failed.push({
        landId,
        reason: msg,
      });
      if (!msg.includes('1001046')) {
        log('好友', `放虫/放草失败: landId=${landId}, 错误: ${msg}`, {
          module: 'friend',
          event: '放虫放草失败',
          landId,
          error: msg,
          detailed: true,
        });
      }
    }
    // 官方客户端用回包 operation_limits 本地拦截耗尽的捣乱请求；这里对齐该行为：
    // 每块放置后检查放草/放虫合计额度是否已用完（成功回包会实时刷新计数），用完立即跳出，
    // 避免额度已尽仍对剩余地块继续发送无效请求。
    if (shouldContinue && index < ids.length - 1 && !shouldContinue()) {
      log('好友', `捣乱次数已用完，跳过剩余地块（已放置 ${ok}/${ids.length} 块）`, {
        module: 'friend',
        event: '放虫放草次数用完',
        ok,
        total: ids.length,
      });
      break;
    }
    // 每个地块捣乱后固定间隔 0.5~1s（无论成功还是失败都等待）
    await require('../utils/utils').randomDelay(500, 1000);
  }

  return { ok, failed };
}

// ===== Specific put operations =====

async function putInsects(gid, landIds) {
  const ok = await putPlantItems(gid, landIds, types.PutInsectsRequest, types.PutInsectsReply, 'PutInsects');
  recordBadOperationSuccess(PUT_BUG_OPERATION_ID, ok);
  return ok;
}

async function putWeeds(gid, landIds) {
  const ok = await putPlantItems(gid, landIds, types.PutWeedsRequest, types.PutWeedsReply, 'PutWeeds');
  recordBadOperationSuccess(PUT_WEED_OPERATION_ID, ok);
  return ok;
}

async function putInsectsDetailed(gid, landIds) {
  const result = await putPlantItemsDetailed(
    gid, landIds, types.PutInsectsRequest, types.PutInsectsReply, 'PutInsects',
    { shouldContinue: canOperateBad }
  );
  recordBadOperationSuccess(PUT_BUG_OPERATION_ID, result.ok);
  return result;
}

async function putWeedsDetailed(gid, landIds) {
  const result = await putPlantItemsDetailed(
    gid, landIds, types.PutWeedsRequest, types.PutWeedsReply, 'PutWeeds',
    { shouldContinue: canOperateBad }
  );
  recordBadOperationSuccess(PUT_WEED_OPERATION_ID, result.ok);
  return result;
}

// ===== Exports =====
module.exports = {
  OP_NAMES,
  PUT_BUG_OPERATION_ID,
  PUT_WEED_OPERATION_ID,
  BAD_SHARED_LIMIT_ID,
  PUT_BUG_LIMIT_ID,
  GOLDEN_BUG_OPERATION_ID,
  BAD_DAILY_LIMIT,
  checkDailyReset,
  autoDisableHelpByExpLimit,
  updateOperationLimits,
  canGetExp,
  canGetExpByCandidates,
  canOperate,
  canOperateBad,
  getRemainingTimes,
  getBadRemainingTimes,
  getBadUsageSummary,
  formatBadUsageSummary,
  hasOperationLimitData,
  getOperationLimits,
  getCanGetHelpExp,
  setCanGetHelpExp,
  getHelpAutoDisabledByLimit,
  helpWater,
  helpWeed,
  helpInsecticide,
  stealHarvest,
  putPlantItems,
  putPlantItemsDetailed,
  putInsects,
  putWeeds,
  putInsectsDetailed,
  putWeedsDetailed,
};
