/**
 * 好友号池 - 全账号共享的加好友链接库 + 按账号分开的申请状态
 *
 * 需求（用户 2026-11-21）：
 * - 链接库全账号共享：同一批分享卡片任何账号都能用，不用重复粘贴
 * - 申请时间/次数/是否不可加**按账号分开**：每个账号的每日次数与好友关系都不同
 * - 面板不展示具体是哪个 QQ/微信账号
 *
 * 存储：data/friend-pool.json（json-db 原子写）
 * {
 *   version: 2,
 *   items:   { [uid]: { uid, openid, shareSource, docId, shareKey, cardTime, name, level, firstSeenAt, updatedAt } },
 *   applies: { [accountId]: { [uid]: { status, lastApplyAt, applyCount, deadAt, deadReason, updatedAt } } },
 *   limits:  { [accountId]: { dateKey: 'YYYY-MM-DD', at: number, error: string } }
 * }
 *
 * limits 记录「该账号今天已经撞过好友申请上限（1005027）」。
 * 上限是账号级的自然日额度，撞一次后当天任何批次都不可能成功，
 * 记下来才能让后续批次（含重新点按钮、定时任务）直接跳过而不是白跑。
 *
 * 状态判定是惰性的：读取时按 lastApplyAt 推导 pending 是否超期（24h → dead），写回磁盘。
 */
const { getDataFile } = require('../config/runtime-paths');
const { readTextFile, writeTextFileAtomic } = require('./json-db');
const { log } = require('../utils/utils');
const fs = require('node:fs');

/** 申请后等待通过的窗口：超过则视为「不会通过」 */
const APPLY_PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

const POOL_VERSION = 2;

/** @type {{version:number, items:Object<string,Object>, applies:Object<string,Object>}|null} */
let poolCache = null;
/** 缓存对应的文件 mtime：worker 与主进程都会写同一文件，靠它感知对方改动 */
let poolCacheMtime = -1;

function getPoolFilePath() {
  return getDataFile('friend-pool.json');
}

function currentFileMtime() {
  try {
    return fs.statSync(getPoolFilePath()).mtimeMs;
  } catch {
    return -1;
  }
}

function emptyPool() {
  return { version: POOL_VERSION, items: {}, applies: {}, limits: {} };
}

/** 本地自然日 key（当日上限按本机时区的自然日重置） */
function dayKeyOf(ts = Date.now()) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function pickCardFields(raw) {
  return {
    openid: String(raw.openid || ''),
    shareSource: raw.shareSource != null ? String(raw.shareSource) : '',
    docId: raw.docId != null ? String(raw.docId) : '',
    shareKey: String(raw.shareKey || ''),
    cardTime: String(raw.cardTime || ''),
    name: raw.name || '',
    level: Number(raw.level) > 0 ? Number(raw.level) : null,
  };
}

function normalizeItem(raw) {
  const card = pickCardFields(raw);
  return {
    uid: String(raw.uid || ''),
    ...card,
    firstSeenAt: raw.firstSeenAt || Date.now(),
    updatedAt: raw.updatedAt || Date.now(),
  };
}

function savePool() {
  if (!poolCache) return;
  try {
    writeTextFileAtomic(getPoolFilePath(), JSON.stringify(poolCache, null, 2));
    poolCacheMtime = currentFileMtime();
  } catch (err) {
    log('号池', `号池写入失败: ${err.message}`, { module: 'friend-pool' });
  }
}

/**
 * 判断导入的卡片是否应覆盖号池里已有的卡片信息
 * - 两边都有卡片时间：按时间比较，更旧的不覆盖（时间相同视为同一张，允许刷新）
 * - 导入侧没有时间（txt 链接格式）：视为「刚粘贴进来的新卡片」，允许覆盖
 *   理由：链接是提取脚本按卡片时间取最新后导出的，粘贴即最新一次提取
 */
function shouldReplaceCard(existing, incoming) {
  const incomingTime = String((incoming && incoming.cardTime) || '');
  const existingTime = String((existing && existing.cardTime) || '');
  if (incomingTime && existingTime) return incomingTime >= existingTime;
  return true;
}

/**
 * 把 v1（每个账号各存一份完整条目）迁移成 v2（共享链接 + 按账号状态）
 * v1: { accounts: { [accountId]: { [uid]: entry } } }
 */
function migrateLegacyPool(raw) {
  const pool = emptyPool();
  const accounts = (raw && raw.accounts) || {};
  for (const accountId of Object.keys(accounts)) {
    const entries = accounts[accountId] || {};
    const stateMap = {};
    for (const uid of Object.keys(entries)) {
      const entry = entries[uid] || {};
      const incoming = {
        openid: entry.openid,
        shareSource: entry.shareSource,
        docId: entry.docId,
        shareKey: entry.shareKey,
        cardTime: entry.cardTime,
        name: entry.name,
        level: entry.level,
        firstSeenAt: entry.firstSeenAt || entry.updatedAt || Date.now(),
      };
      const existing = pool.items[uid];
      if (!existing) {
        pool.items[uid] = normalizeItem({ uid, ...incoming });
      }
      else if (shouldReplaceCard(existing, incoming)) {
        // 只覆盖有值的字段，避免另一个账号的空昵称/等级把已有信息抹掉
        const card = pickCardFields(incoming);
        if (card.shareKey) existing.shareKey = card.shareKey;
        if (card.openid) existing.openid = card.openid;
        if (card.shareSource) existing.shareSource = card.shareSource;
        if (card.docId) existing.docId = card.docId;
        if (card.cardTime) existing.cardTime = card.cardTime;
        if (card.name) existing.name = card.name;
        if (card.level) existing.level = card.level;
        existing.updatedAt = Date.now();
      }
      stateMap[uid] = {
        status: entry.status || 'new',
        lastApplyAt: entry.lastApplyAt || null,
        applyCount: Number(entry.applyCount) || 0,
        deadAt: entry.deadAt || null,
        deadReason: entry.deadReason || '',
        updatedAt: entry.updatedAt || Date.now(),
      };
    }
    pool.applies[String(accountId)] = stateMap;
  }
  log('号池', `号池已迁移到共享格式：链接 ${Object.keys(pool.items).length} 条，账号 ${Object.keys(pool.applies).length} 个`, { module: 'friend-pool' });
  return pool;
}

function loadPool() {
  const mtime = currentFileMtime();
  if (poolCache && mtime === poolCacheMtime) return poolCache;

  let parsed = null;
  try {
    const raw = readTextFile(getPoolFilePath(), '');
    parsed = raw ? JSON.parse(raw) : null;
  } catch (err) {
    log('号池', `号池文件损坏，已重置: ${err.message}`, { module: 'friend-pool' });
    parsed = null;
  }

  if (parsed && parsed.version === POOL_VERSION && parsed.items && parsed.applies) {
    poolCache = parsed;
  }
  else if (parsed && parsed.accounts) {
    poolCache = migrateLegacyPool(parsed);
    poolCacheMtime = mtime;
    savePool();
    return poolCache;
  }
  else {
    poolCache = emptyPool();
  }

  if (!poolCache.items || typeof poolCache.items !== 'object') poolCache.items = {};
  if (!poolCache.applies || typeof poolCache.applies !== 'object') poolCache.applies = {};
  // 老文件没有 limits：补一个空表，不打乱已有数据
  if (!poolCache.limits || typeof poolCache.limits !== 'object') poolCache.limits = {};
  poolCacheMtime = mtime;
  return poolCache;
}

/** 某个账号的申请状态表（懒创建） */
function getAccountApplies(accountId) {
  const pool = loadPool();
  const key = String(accountId || 'default');
  if (!pool.applies[key] || typeof pool.applies[key] !== 'object') {
    pool.applies[key] = {};
  }
  return pool.applies[key];
}

/**
 * 推导某个「账号-链接」的申请状态
 * - friend：已在好友列表
 * - dead：上次申请超过 24h 仍未通过
 * - pending：已申请、等待通过中
 * - new：从未申请过
 */
function computeStatus(state, now = Date.now()) {
  if (!state) return 'new';
  if (state.status === 'friend') return 'friend';
  if (state.status === 'dead') return 'dead';
  if (state.lastApplyAt && now - state.lastApplyAt >= APPLY_PENDING_WINDOW_MS) {
    return 'dead';
  }
  if (state.lastApplyAt) return 'pending';
  return 'new';
}

/**
 * 合并导入的链接到**共享链接库**（与账号无关）。同一 uid 只保留一条：
 * - 卡片信息（share_key/openid/share_source/card_time）以卡片实际时间为准更新；
 *   无卡片时间的导入（txt 链接）视为最新卡片直接覆盖
 * - 申请历史属于各账号，这里完全不碰
 *
 * @param {Array<{uid:string, openid:string, shareSource?:string, docId?:string, shareKey?:string, cardTime?:string}>} items
 * @returns {{added:number, updated:number}}
 */
function upsertInviteItems(items) {
  const pool = loadPool();
  const shared = pool.items;
  let added = 0;
  let updated = 0;

  for (const item of Array.isArray(items) ? items : []) {
    const uid = String((item && item.uid) || '').trim();
    if (!uid) continue;

    const incoming = {
      openid: String((item && (item.openid || item.openId)) || '').trim(),
      shareSource: item && item.shareSource != null ? String(item.shareSource) : '',
      docId: item && item.docId != null ? String(item.docId) : '',
      shareKey: String((item && (item.shareKey || item.share_key)) || '').trim(),
      cardTime: item && item.cardTime != null ? String(item.cardTime) : '',
    };

    const existing = shared[uid];
    if (!existing) {
      shared[uid] = normalizeItem({ uid, ...incoming });
      added++;
      continue;
    }

    updated++;
    if (!shouldReplaceCard(existing, incoming)) continue;

    if (incoming.shareKey && incoming.shareKey !== existing.shareKey) existing.shareKey = incoming.shareKey;
    if (incoming.openid) existing.openid = incoming.openid;
    if (incoming.shareSource) existing.shareSource = incoming.shareSource;
    if (incoming.docId) existing.docId = incoming.docId;
    if (incoming.cardTime && incoming.cardTime !== existing.cardTime) existing.cardTime = incoming.cardTime;
    existing.updatedAt = Date.now();
  }

  savePool();
  return { added, updated };
}

/** 发出申请后记录（只影响该账号） */
function markApplied(accountId, uid, extra = {}) {
  const pool = loadPool();
  const key = String(uid);
  const shared = pool.items[key];
  if (shared) {
    if (extra.shareKey) shared.shareKey = String(extra.shareKey);
    if (extra.cardTime && String(extra.cardTime) > (shared.cardTime || '')) shared.cardTime = String(extra.cardTime);
    if (extra.name) shared.name = String(extra.name);
    if (Number(extra.level) > 0) shared.level = Number(extra.level);
    shared.updatedAt = Date.now();
  }

  const applies = getAccountApplies(accountId);
  const state = applies[key] || { status: 'new', applyCount: 0, lastApplyAt: null };
  state.lastApplyAt = Date.now();
  state.applyCount = (state.applyCount || 0) + 1;
  state.status = 'pending';
  state.deadAt = null;
  state.deadReason = '';
  state.updatedAt = Date.now();
  applies[key] = state;
  savePool();
}

/** 已在好友列表（只影响该账号） */
function markFriend(accountId, uid, extra = {}) {
  const pool = loadPool();
  const key = String(uid);
  if (!pool.items[key]) return false;
  const applies = getAccountApplies(accountId);
  const state = applies[key] || { applyCount: 0, lastApplyAt: null };
  state.status = 'friend';
  state.updatedAt = Date.now();
  applies[key] = state;
  if (extra && extra.name) pool.items[key].name = String(extra.name);
  savePool();
  return true;
}

/** 批量标记好友（好友列表比对后调用，只影响该账号） */
function markFriends(accountId, uids) {
  const pool = loadPool();
  const applies = getAccountApplies(accountId);
  let count = 0;
  for (const uid of Array.isArray(uids) ? uids : []) {
    const key = String(uid);
    if (!pool.items[key]) continue;
    const state = applies[key];
    if (state && state.status === 'friend') continue;
    applies[key] = { ...(state || { applyCount: 0, lastApplyAt: null }), status: 'friend', updatedAt: Date.now() };
    count++;
  }
  if (count > 0) savePool();
  return count;
}

/** 标记不可加（超时未通过，只影响该账号） */
function markDead(accountId, uid, reason) {
  const pool = loadPool();
  const key = String(uid);
  if (!pool.items[key]) return false;
  const applies = getAccountApplies(accountId);
  const state = applies[key] || { applyCount: 0, lastApplyAt: null };
  state.status = 'dead';
  state.deadAt = Date.now();
  state.deadReason = String(reason || '申请超过 24 小时未通过');
  state.updatedAt = Date.now();
  applies[key] = state;
  savePool();
  return true;
}

/** 恢复为可申请（人工解除误判，只影响该账号） */
function resetEntry(accountId, uid) {
  const pool = loadPool();
  const key = String(uid);
  if (!pool.items[key]) return false;
  const applies = getAccountApplies(accountId);
  if (!applies[key]) return false;
  applies[key] = {
    status: 'new',
    lastApplyAt: null,
    applyCount: 0,
    deadAt: null,
    deadReason: '',
    updatedAt: Date.now(),
  };
  savePool();
  return true;
}

/** 从共享链接库删除一条（同时清掉所有账号对它的申请状态） */
function removeEntry(uid) {
  const pool = loadPool();
  const key = String(uid);
  if (!pool.items[key]) return false;
  delete pool.items[key];
  for (const accountId of Object.keys(pool.applies)) {
    if (pool.applies[accountId]) delete pool.applies[accountId][key];
  }
  savePool();
  return true;
}

/**
 * 一次性取出该账号下所有条目的状态（批量流程用，避免逐条读文件/逐条 stat）
 * @returns {Map<string, 'new'|'pending'|'dead'|'friend'>}
 */
function getStatusMap(accountId) {
  const pool = loadPool();
  const applies = getAccountApplies(accountId);
  const now = Date.now();
  const map = new Map();
  for (const uid of Object.keys(pool.items)) {
    map.set(uid, computeStatus(applies[uid], now));
  }
  return map;
}

/**
 * 查询条目在该账号下的状态（不落盘，供流程内快速判定）
 * @returns {'new'|'pending'|'dead'|'friend'|null} 不在共享链接库中返回 null
 */
function peekStatus(accountId, uid) {
  const pool = loadPool();
  const key = String(uid);
  if (!pool.items[key]) return null;
  const applies = getAccountApplies(accountId);
  return computeStatus(applies[key]);
}

/**
 * 该账号今天是否已撞过好友申请上限（1005027）
 *
 * 上限是游戏按账号、按自然日给的额度：撞一次后当天再发只会继续被拒。
 * 记录在号池里，跨天（日期 key 变了）自动失效，不需要额外清理。
 *
 * @returns {{blocked:boolean, dateKey:string, at:number|null, error:string}}
 */
function getDailyLimitState(accountId, now = Date.now()) {
  const pool = loadPool();
  const key = String(accountId || 'default');
  const rec = pool.limits[key];
  if (!rec || !rec.dateKey) return { blocked: false, dateKey: '', at: null, error: '' };
  if (rec.dateKey !== dayKeyOf(now)) return { blocked: false, dateKey: '', at: null, error: '' };
  return {
    blocked: true,
    dateKey: rec.dateKey,
    at: Number(rec.at) || null,
    error: String(rec.error || ''),
  };
}

function isDailyLimitBlocked(accountId, now = Date.now()) {
  return getDailyLimitState(accountId, now).blocked;
}

/** 记录「该账号今天已达好友申请上限」 */
function markDailyLimit(accountId, error) {
  const pool = loadPool();
  const key = String(accountId || 'default');
  pool.limits[key] = { dateKey: dayKeyOf(), at: Date.now(), error: String(error || '') };
  savePool();
}

/** 手动解除当日上限记录（一般不需要：跨天会自动失效） */
function clearDailyLimit(accountId) {
  const pool = loadPool();
  const key = String(accountId || 'default');
  if (!pool.limits[key]) return false;
  delete pool.limits[key];
  savePool();
  return true;
}

/**
 * 共享链接库 + 该账号的申请状态（惰性把超期 pending 落盘为 dead）
 * @returns {{summary:{total:number,new:number,pending:number,friend:number,dead:number}, entries:Array}}
 */
function getPoolSnapshot(accountId) {
  const pool = loadPool();
  const applies = getAccountApplies(accountId);
  const now = Date.now();
  const summary = { total: 0, new: 0, pending: 0, friend: 0, dead: 0 };
  const list = [];

  let dirty = false;
  for (const uid of Object.keys(pool.items)) {
    const item = pool.items[uid];
    const state = applies[uid];
    const status = computeStatus(state, now);
    if (state && status !== state.status) {
      // pending 超期 → 惰性落盘为 dead
      state.status = status;
      if (status === 'dead') {
        state.deadAt = state.deadAt || now;
        state.deadReason = state.deadReason || '申请超过 24 小时未通过';
      }
      state.updatedAt = now;
      dirty = true;
    }
    summary.total++;
    summary[status] = (summary[status] || 0) + 1;
    list.push({
      ...item,
      status,
      lastApplyAt: state ? state.lastApplyAt || null : null,
      applyCount: state ? state.applyCount || 0 : 0,
      deadAt: state ? state.deadAt || null : null,
      deadReason: state ? state.deadReason || '' : '',
      hoursSinceApply: state && state.lastApplyAt
        ? Math.round(((now - state.lastApplyAt) / 3600000) * 10) / 10
        : null,
    });
  }
  if (dirty) savePool();

  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { summary, entries: list };
}

module.exports = {
  APPLY_PENDING_WINDOW_MS,
  upsertInviteItems,
  markApplied,
  markFriend,
  markFriends,
  markDead,
  resetEntry,
  removeEntry,
  peekStatus,
  getStatusMap,
  getPoolSnapshot,
  computeStatus,
  dayKeyOf,
  getDailyLimitState,
  isDailyLimitBlocked,
  markDailyLimit,
  clearDailyLimit,
};
