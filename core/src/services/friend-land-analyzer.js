const { PlantPhase, PHASE_NAMES } = require('../config/config');
const {
  getPlantName,
  getPlantById,
  getPlantGrowTime,
  getSeedImageBySeedId,
  getMutantDisplayPlantId,
  getMutantPlantImageByPhase,
  getItemImageById,
} = require('../config/gameConfig');
const {
  toNum,
  toTimeSec,
  getServerTimeSec,
  log,
  logWarn,
  randomDelay,
  sleep,
} = require('../utils/utils');
const { getGatewayHealth, getUserState } = require('../utils/network');
const { runWithRequestPriority } = require('../utils/request-priority');
const {
  getPlantBlacklist,
  getFriendBlacklist,
  getEffectiveFriendBlacklist,
  readFriendDogInfoCache,
  writeFriendDogInfoCache,
  getLocalDateKey,
} = require('../models/store');
const {
  enterFriendFarm,
  leaveFriendFarm,
  getDogName,
  handleFriendEnterError,
} = require('./friend-api');
const {
  getCurrentPhase,
  buildLandMap,
  getDisplayLandContext,
  isOccupiedSlaveLand,
  getQixiDewStatus,
  getPlantMutantConfigIds,
  getPlantCollectionMutations,
  buildMutantEffects,
} = require('./farm-land-analyzer');
const { classifyGatewayDefer, planNextSyncPacing } = require('./friend-dog-sync-pacing');

const GOLDEN_BUG_ITEM_ID = 301101;
const GOLDEN_BUG_SOCIAL_TYPE = 2;
/** 黄金变异（MutantEffect.json id=5，icon=golden）。 */
const GOLDEN_MUTANT_CONFIG_ID = 5;

// ===== Analyze friend lands =====

/**
 * Analyze a friend's lands and classify them into actionable categories.
 * Returns actionable ordinary-farm and golden-bug land groups.
 *
 * 偷菜筛选（三方合流）：
 * - plantFilterMode='whitelist'：只偷 plantWhitelist 内的作物；名单为空则非黄金批次一块不偷
 * - plantFilterMode='blacklist'：plantBlacklist 内的作物不偷
 * - onlyGoldenMutation：本批（全体可偷地块）存在黄金变异时整批全偷，忽略名单
 * - forceStealAll：好友白名单命中的好友，无视以上全部筛选，成熟可偷地块全偷
 */
function analyzeFriendLands(lands, myGid, friendName = '', options = {}) {
  const {
    plantBlacklist = null,
    plantWhitelist = null,
    plantFilterMode = 'blacklist',
    onlyGoldenMutation = false,
    forceStealAll = false,
  } = options;
  const result = {
    stealable: [],
    stealableInfo: [],
    goldenStealableCount: 0,
    skippedByListCount: 0,
    goldenBatchAllSteal: false,
    forceStealAll: !!forceStealAll,
    needWater: [],
    needWeed: [],
    needBug: [],
    canPutWeed: [],
    canPutBug: [],
    canPutGoldenBug: [],
  };

  const landMap = buildLandMap(lands);

  for (const land of lands) {
    const landId = toNum(land.id);

    // Skip slave lands in merged planting
    if (isOccupiedSlaveLand(land, landMap)) continue;

    const plant = land.plant;
    if (!plant || !plant.phases || plant.phases.length === 0) continue;

    const currentPhase = getCurrentPhase(
      plant.phases,
      false,
      `[${friendName}]土地#${landId}`,
      plant.id
    );
    if (!currentPhase) continue;

    const phase = currentPhase.phase;
    const socialItems = Array.isArray(plant.social_items) ? plant.social_items : [];
    const alreadyHasGoldenBug = socialItems.some(item => (
      toNum(item && item.item_id) === GOLDEN_BUG_ITEM_ID &&
      toNum(item && item.type) === GOLDEN_BUG_SOCIAL_TYPE
    ));

    if (phase !== PlantPhase.MATURE && phase !== PlantPhase.DEAD && !alreadyHasGoldenBug) {
      result.canPutGoldenBug.push(landId);
    }

    // Mature & stealable
    if (phase === PlantPhase.MATURE) {
      if (plant.stealable) {
        const plantId = toNum(plant.id);
        const plantName = getPlantName(plantId) || plant.name || '未知';
        const plantInfo = getPlantById(plantId);
        const seedId = plantInfo ? toNum(plantInfo.seed_id) : 0;

        // 全部先登记，名单过滤与黄金批次裁决都在循环结束后统一做
        const mutantConfigIds = getPlantMutantConfigIds(plant, currentPhase);
        const isGolden = mutantConfigIds.includes(GOLDEN_MUTANT_CONFIG_ID);
        if (isGolden) result.goldenStealableCount += 1;

        result.stealable.push(landId);
        result.stealableInfo.push({ landId, plantId, seedId, name: plantName, mutantConfigIds, isGolden });
      }
      continue;
    }

    // Dead — skip
    if (phase === PlantPhase.DEAD) continue;

    // Dry / weeds / insects
    if (toNum(plant.dry_num) > 0) result.needWater.push(landId);
    if (plant.weed_owners && plant.weed_owners.length > 0) result.needWeed.push(landId);
    if (plant.insect_owners && plant.insect_owners.length > 0) result.needBug.push(landId);

    // Can put weed / bug (limit: max 2 owners, and we haven't put one yet)
    if (phase !== PlantPhase.MATURE) {
      const weedOwners = plant.weed_owners || [];
      const bugOwners = plant.insect_owners || [];
      const alreadyPutWeed = weedOwners.some(owner => toNum(owner) === myGid);
      const alreadyPutBug = bugOwners.some(owner => toNum(owner) === myGid);

      if (weedOwners.length < 2 && !alreadyPutWeed) result.canPutWeed.push(landId);
      if (bugOwners.length < 2 && !alreadyPutBug) result.canPutBug.push(landId);
    }
  }

  // ===== 偷菜批次裁决 =====
  // 0) 好友白名单命中的好友 → 无视名单与黄金判定，成熟可偷地块全偷
  // 1) 本批存在黄金变异且开启开关 → 整批全偷，名单不参与
  // 2) 否则按名单模式过滤：白名单只偷名单内（名单空则一块不偷）；黑名单排除名单内
  const goldenBatch = result.goldenStealableCount > 0;
  if (forceStealAll) {
    result.goldenBatchAllSteal = true;
  } else if (onlyGoldenMutation && goldenBatch) {
    result.goldenBatchAllSteal = true;
  } else {
    const whiteSet = Array.isArray(plantWhitelist) ? new Set(plantWhitelist.map(Number)) : null;
    const blackSet = plantFilterMode === 'whitelist'
      ? null
      : (Array.isArray(plantBlacklist) ? new Set(plantBlacklist.map(Number)) : null);
    const useWhitelist = plantFilterMode === 'whitelist';

    const kept = [];
    const keptInfo = [];
    let skippedByList = 0;
    for (let i = 0; i < result.stealable.length; i += 1) {
      const info = result.stealableInfo[i];
      const seedId = toNum(info && info.seedId);
      let pass = true;
      if (useWhitelist) {
        pass = !!(whiteSet && seedId > 0 && whiteSet.has(seedId));
      } else if (blackSet && seedId > 0 && blackSet.has(seedId)) {
        pass = false;
      }
      if (pass) {
        kept.push(result.stealable[i]);
        keptInfo.push(info);
      } else {
        skippedByList += 1;
      }
    }
    result.stealable = kept;
    result.stealableInfo = keptInfo;
    result.skippedByListCount = skippedByList;
  }

  return result;
}

// ===== Dog info =====

/**
 * Get a single friend's dog information by entering and leaving their farm.
 */
async function getFriendDogInfo(gid, friendName = '') {
  const numericGid = toNum(gid);
  const defaultResult = { dogId: 0, dogName: '无狗' };
  if (!numericGid) return defaultResult;

  const accountId = process.env.FARM_ACCOUNT_ID || '';
  const blacklist = new Set(getEffectiveFriendBlacklist(accountId));
  if (blacklist.has(numericGid)) {
    return { dogId: 0, dogName: '无狗', blacklisted: true };
  }

  try {
    const enterReply = await enterFriendFarm(numericGid);
    await leaveFriendFarm(numericGid);

    const dogInfo = enterReply.__briefDogInfo;
    if (dogInfo && dogInfo.dogId > 0) {
      const dogId = toNum(dogInfo.dogId);
      const dogName = getDogName(dogId);
      return { dogId, dogName: dogName || '无狗' };
    }

    return { dogId: 0, dogName: '无狗' };
  } catch (err) {
    const handled = handleFriendEnterError(numericGid, friendName, err);
    if (handled.handled && handled.kind === 'blacklist') {
      return { dogId: 0, dogName: '无狗', blacklisted: true };
    }
    logWarn('好友', `获取好友 ${numericGid} 狗信息失败: ${err.message}`, {
      module: 'friend',
      event: '获取好友狗信息',
      result: 'error',
      friendGid: numericGid,
      error: err.message,
    });
    return { dogId: 0, dogName: '无狗' };
  }
}

/**
 * Batch get dog info for multiple friends.
 * Returns: { map: Map<gid, dogInfo>, failCount, blacklistCount }
 */
async function batchGetFriendDogInfo(friends) {
  const dogMap = new Map();
  const friendList = Array.isArray(friends) ? friends : [];
  let noDogCount = 0;
  let blacklistCount = 0;
  let cleanRounds = 0;
  let quota = 10;
  let roundCount = 0;
  const BATCH_LOG_INTERVAL = 30;
  const BATCH_SLEEP_MS = 1000;
  const accountId = process.env.FARM_ACCOUNT_ID || '';
  const blacklist = new Set(getEffectiveFriendBlacklist(accountId));

  // Normalize entries
  const entries = friendList
    .map(entry => {
      if (typeof entry === 'object' && entry !== null) {
        return { gid: toNum(entry.gid), name: entry.name || `GID:${toNum(entry.gid)}` };
      }
      return { gid: toNum(entry), name: `GID:${toNum(entry)}` };
    })
    .filter(e => e.gid > 0);

  for (let i = 0; i < entries.length; i++) {
    const health = getGatewayHealth();
    const deferredKind = classifyGatewayDefer(health);
    if (deferredKind) {
      return {
        map: dogMap,
        failCount: noDogCount,
        blacklistCount,
        deferredGids: entries.slice(i).map(entry => entry.gid),
        deferredKind,
        retryMs: planNextSyncPacing({ cleanRounds, deferredKind }).retryMs,
      };
    }
    const entry = entries[i];
    const gid = entry.gid;

    if (blacklist.has(gid)) {
      blacklistCount++;
      dogMap.set(gid, { dogId: 0, dogName: '无狗', blacklisted: true });
      continue;
    }

    const dogInfo = await getFriendDogInfo(gid, entry.name);
    if (dogInfo.dogId === 0) noDogCount++;
    if (dogInfo.blacklisted) {
      blacklistCount++;
      blacklist.add(gid);
    }
    dogMap.set(gid, dogInfo);
    roundCount++;

    if (i < entries.length - 1) {
      await randomDelay(500, 1500);
    }

    if (roundCount >= quota && i < entries.length - 1) {
      const pacing = planNextSyncPacing({ cleanRounds });
      cleanRounds = pacing.cleanRounds;
      quota = pacing.quota;
      roundCount = 0;
      await sleep(1000);
    } else if ((i + 1) % BATCH_LOG_INTERVAL === 0 && i < entries.length - 1) {
      await sleep(BATCH_SLEEP_MS);
    }
  }

  return { map: dogMap, failCount: noDogCount, blacklistCount, deferredGids: [], deferredKind: '', retryMs: 0 };
}

// ===== Friends list =====
let friendsListCache = null;
let friendsListRefreshAt = 0;
let friendsListPending = null;
const FRIEND_LIST_REFRESH_MS = 5 * 60 * 1000;

/**
 * Get a processed friends list with dog info from cache if available.
 * Filters out fake NPCs (name "小小农夫" with level 1).
 */
// 磁盘缓存：进程重启后仍可复用好友列表（按账号+玩家隔离）；forceRefresh 直接穿透
const displayFriendCache = require('./local-friend-cache').createLocalFriendCache({
  key: 'farm-display', scope: () => process.env.FARM_ACCOUNT_ID ? `farm-display:${process.env.FARM_ACCOUNT_ID}:${getUserState().gid}` : '',
});
async function getFriendsList(forceRefresh = false) {
  return displayFriendCache.get(() => loadFriendsList(forceRefresh), forceRefresh);
}
async function loadFriendsList(forceRefresh = false) {
  if (friendsListPending) return friendsListPending;
  if (!forceRefresh && Date.now() < friendsListRefreshAt) return friendsListCache || [];
  friendsListPending = fetchFriendsList();
  try {
    return await friendsListPending;
  } finally {
    friendsListPending = null;
  }
}

async function fetchFriendsList() {
  try {
    log('好友', '开始获取好友列表', {
      module: 'friend',
      event: '获取好友列表',
    });

    const { getAllFriends } = require('./friend-api');
    const allFriendsReply = await getAllFriends(true);
    const rawFriends = allFriendsReply.game_friends || [];
    const userState = getUserState();
    const accountId = process.env.FARM_ACCOUNT_ID || '';
    const dogInfoCache = accountId ? readFriendDogInfoCache(accountId) : null;

    const friends = rawFriends
      .filter(friend => {
        // Exclude self
        if (toNum(friend.gid) === userState.gid) return false;
        // Exclude fake NPC
        if (
          (friend.name === '小小农夫' || friend.remark === '小小农夫') &&
          toNum(friend.level) === 1
        ) {
          return false;
        }
        return true;
      })
      .map(friend => {
        const gid = toNum(friend.gid);
        const cachedDog = dogInfoCache && dogInfoCache[gid] ? dogInfoCache[gid] : null;
        return {
          gid,
          name: friend.remark || friend.name || `GID:${gid}`,
          avatarUrl: String(friend.avatar_url || '').trim(),
          level: toNum(friend.level),
          gold: toNum(friend.gold),
          dogId: cachedDog ? cachedDog.dogId : 0,
          dogName: cachedDog ? cachedDog.dogName : '',
          dogImage: cachedDog ? (cachedDog.dogImage || '') : '',
          plant: friend.plant
            ? {
                stealNum: toNum(friend.plant.steal_plant_num),
                dryNum: toNum(friend.plant.dry_num),
                weedNum: toNum(friend.plant.weed_num),
                insectNum: toNum(friend.plant.insect_num),
              }
            : null,
        };
      })
      .sort((a, b) => {
        const cmp = (a.name || '').localeCompare(b.name || '', 'zh-CN');
        if (cmp !== 0) return cmp;
        return (a.gid || 0) - (b.gid || 0);
      });

    friendsListCache = friends;
    // 刷新时间只在成功时推进，失败不该让空结果占据一个刷新窗口
    friendsListRefreshAt = Date.now() + FRIEND_LIST_REFRESH_MS;

    const cachedDogCount = dogInfoCache ? Object.keys(dogInfoCache).length : 0;
    log('好友',
      `获取好友列表成功，共 ${friends.length} 位好友${ 
        cachedDogCount > 0 ? `，已从缓存加载 ${cachedDogCount} 个狗信息` : ''}`,
      {
        module: 'friend',
        event: '获取好友列表',
        result: 'ok',
        count: friends.length,
        cachedDogInfoCount: cachedDogCount,
      }
    );

    return friends;
  } catch (err) {
    log('好友', `获取好友列表失败: ${err.message}`, {
      module: 'friend',
      event: '获取好友列表',
      result: 'error',
      error: err.message,
    });
    // 不能把读取失败伪装成「没有好友」：调用方要能区分空列表与失败
    throw err;
  }
}

/**
 * Fetch dog info for all friends in the list.
 * Caches guard dog (护主犬, id=90021) info locally.
 */
async function fetchFriendsDogInfo() {
  const accountId = process.env.FARM_ACCOUNT_ID || '';
  let friends = friendsListCache;

  if (!friends || friends.length === 0) {
    friends = await getFriendsList(true);
  }

  if (!friends || friends.length === 0) {
    return { ok: false, error: '好友列表为空，请先获取好友列表' };
  }

  const dogTargets = friends.map(f => ({
    gid: toNum(f.gid),
    name: f.name || `GID:${toNum(f.gid)}`,
  }));

  const syncResult = await runWithRequestPriority('background', () => batchGetFriendDogInfo(dogTargets));
  const { map: dogMap, failCount, blacklistCount } = syncResult;

  const allDogFriends = {};
  const probedAt = Date.now();
  for (const friend of friends) {
    const dogInfo = dogMap.get(friend.gid);
    if (dogInfo) {
      friend.dogId = dogInfo.dogId;
      friend.dogName = dogInfo.dogName;
      friend.dogImage = friend.dogId > 0 ? (getItemImageById(friend.dogId) || '') : '';
      friend.blacklisted = dogInfo.blacklisted || false;
      // 无狗（dogId=0）也写入：checkedAt 标记「今天已确认过」，避免每日同步反复重探
      allDogFriends[friend.gid] = {
        dogId: friend.dogId,
        dogName: friend.dogName,
        dogImage: friend.dogImage,
        checkedAt: probedAt,
      };
    }
  }

  friendsListCache = friends;

  // Persist all dog info to disk cache
  if (accountId && syncResult.deferredGids.length === 0) {
    writeFriendDogInfoCache(accountId, allDogFriends);
  }

  const guardDogCount = friends.filter(f => f.dogId === 90021).length;
  const otherDogCount = friends.filter(f => f.dogId > 0 && f.dogId !== 90021).length;
  const totalDogCount = guardDogCount + otherDogCount;

  log('好友',
    `获取狗信息完成：共 ${friends.length} 位好友，其中养狗 ${totalDogCount} 位 (护主犬 ${guardDogCount} / 其他宠物犬 ${otherDogCount})，无狗 ${failCount} 位，黑名单 ${blacklistCount} 位`,
    {
      module: 'friend',
      event: '狗信息',
      result: 'ok',
      count: friends.length,
      totalDogCount,
      guardDogCount,
      otherDogCount,
      failCount,
      blacklistCount,
    }
  );

  return {
    ok: syncResult.deferredGids.length === 0,
    complete: syncResult.deferredGids.length === 0,
    friends,
    failCount,
    blacklistCount,
    guardDogCount,
    deferredGids: syncResult.deferredGids,
    deferredKind: syncResult.deferredKind,
    retryMs: syncResult.retryMs,
  };
}

// ===== 每日狗信息渐进同步 =====

// 狗缓存按天失效（store 的 cacheDate 语义）：跨天后 readFriendDogInfoCache 直接返回 null，
// 而「经验满仅帮助护主犬」完全依赖这份缓存。之前只有前端手动按钮能重建缓存，
// 跨天缓存清空后护主犬模式会静默失效（巡查日志里显示开启模式，实际一个目标都找不到）。
// 这里参考上游 pet-sync 的每日补齐思路：复用既有 batchGetFriendDogInfo 的探针与网关让路，
// 把「今天还没确认过」的好友按小批次渐进补齐，每轮只探一小撮，避免长时间占住场景。
function isDogEntryCheckedToday(entry) {
  if (!entry) return false;
  // 缓存文件整体带 cacheDate（跨日 normalize 直接返回 null），所以文件里的条目
  // 必然是今天写入的；checkedAt 只是便于排查，缺省（旧格式）也视为已确认。
  const checkedAt = Number(entry.checkedAt) || 0;
  if (!checkedAt) return true;
  return getLocalDateKey(checkedAt) === getLocalDateKey(Date.now());
}

async function syncFriendDogInfoRound({ maxPerRound = 25 } = {}) {
  const accountId = process.env.FARM_ACCOUNT_ID || '';
  if (!accountId) return { pending: 0, checked: 0, skipped: 'no_account' };

  // 优先用内存/磁盘好友列表缓存，通常零 RPC；确实没有才现拉
  let friends = friendsListCache;
  if (!friends || friends.length === 0) {
    friends = await getFriendsList();
  }
  if (!friends || friends.length === 0) {
    return { pending: 0, checked: 0, skipped: 'no_friends' };
  }

  const cache = readFriendDogInfoCache(accountId) || {};
  const userGid = toNum(getUserState().gid);
  const pendingTargets = friends
    .filter(f => {
      const gid = toNum(f.gid);
      return gid > 0 && gid !== userGid && !isDogEntryCheckedToday(cache[gid]);
    })
    .map(f => ({ gid: toNum(f.gid), name: f.name || `GID:${toNum(f.gid)}` }));

  if (pendingTargets.length === 0) {
    return { pending: 0, checked: 0, complete: true };
  }

  // 网关不健康时整轮让路，由调用方按 retryMs 择机再试（batch 内部也有逐条让路兜底）
  const deferredKind = classifyGatewayDefer(getGatewayHealth());
  if (deferredKind) {
    return {
      pending: pendingTargets.length,
      checked: 0,
      deferred: deferredKind,
      retryMs: planNextSyncPacing({ deferredKind }).retryMs,
    };
  }

  const targets = pendingTargets.slice(0, Math.max(1, Number(maxPerRound) || 25));
  const syncResult = await runWithRequestPriority('background', () => batchGetFriendDogInfo(targets));

  // 合并进缓存：探过的结论（含无狗 dogId=0）带 checkedAt 落盘，今天不再重复探
  const probedAt = Date.now();
  const merged = { ...cache };
  for (const [gid, dogInfo] of syncResult.map) {
    const dogId = toNum(dogInfo && dogInfo.dogId);
    merged[gid] = {
      dogId,
      dogName: dogId > 0 ? (dogInfo.dogName || getDogName(dogId) || '') : '',
      dogImage: dogId > 0 ? (getItemImageById(dogId) || '') : '',
      checkedAt: probedAt,
    };
  }
  // 让路的条目不标记，留给下一轮
  for (const gid of syncResult.deferredGids) delete merged[gid];
  writeFriendDogInfoCache(accountId, merged);

  const remaining = pendingTargets.length - targets.length + syncResult.deferredGids.length;
  return {
    pending: remaining,
    checked: targets.length - syncResult.deferredGids.length,
    complete: remaining === 0,
    deferredKind: syncResult.deferredKind,
    retryMs: syncResult.retryMs,
  };
}

// ===== Friend lands detail =====

/**
 * Get a friend's lands in detail (for frontend display).
 */
async function getFriendLandsDetail(gid) {
  try {
    const enterReply = await enterFriendFarm(gid);
    const lands = enterReply.lands || [];
    const userState = getUserState();
    const plantBlacklist = getPlantBlacklist(userState.accountId);
    const analysis = analyzeFriendLands(lands, userState.gid, '', { plantBlacklist });
    await leaveFriendFarm(gid);

    const detailLands = [];
    const serverTimeSec = getServerTimeSec();
    const landMap = buildLandMap(lands);

    for (const land of lands) {
      const landId = toNum(land.id);
      const landLevel = toNum(land.level);
      const isUnlocked = !!land.unlocked;
      const { sourceLand, occupiedByMaster, masterLandId, occupiedLandIds } =
        getDisplayLandContext(land, landMap);

      // Locked land
      if (!isUnlocked) {
        detailLands.push({
          id: landId,
          unlocked: false,
          status: 'locked',
          plantName: '',
          phaseName: '未解锁',
          level: landLevel,
          needWater: false,
          needWeed: false,
          needBug: false,
          occupiedByMaster: false,
          masterLandId: 0,
          occupiedLandIds: [],
          plantSize: 1,
        });
        continue;
      }

      const targetPlant = (sourceLand && sourceLand.plant) || land.plant;

      // Empty land
      if (!targetPlant || !targetPlant.phases || targetPlant.phases.length === 0) {
        detailLands.push({
          id: landId,
          unlocked: true,
          status: 'empty',
          plantName: '',
          phaseName: '空地',
          level: landLevel,
          occupiedByMaster,
          masterLandId,
          occupiedLandIds,
          plantSize: 1,
        });
        continue;
      }

      const currentPhase = getCurrentPhase(targetPlant.phases, false, '', targetPlant.id);
      if (!currentPhase) {
        detailLands.push({
          id: landId,
          unlocked: true,
          status: 'empty',
          plantName: '',
          phaseName: '',
          level: landLevel,
          occupiedByMaster,
          masterLandId,
          occupiedLandIds,
          plantSize: 1,
        });
        continue;
      }

      const phase = currentPhase.phase;
      const plantId = toNum(targetPlant.id);
      const mutantConfigIds = getPlantMutantConfigIds(targetPlant, currentPhase);
      const displayPlantId = getMutantDisplayPlantId(plantId, mutantConfigIds);
      const plantName = getPlantName(displayPlantId) || getPlantName(plantId) || targetPlant.name || '未知';
      const plantInfo = getPlantById(plantId);
      const seedId = toNum(plantInfo && plantInfo.seed_id);
      const seedImage = seedId > 0 ? getSeedImageBySeedId(seedId) : '';
      // 藏品变异（id=18）：官方客户端把地块作物图标换成对应藏品图，这里同步替换。
      const collectionPlantImage = getPlantCollectionMutations(targetPlant, currentPhase)
        .map(item => toNum(item.collectionItemId))
        .filter(id => id > 0)
        .map(id => getItemImageById(id))
        .find(url => !!url) || '';
      const plantImage = collectionPlantImage
        || getMutantPlantImageByPhase(plantId, mutantConfigIds, toNum(currentPhase.image_phase));
      const plantSize = Math.max(1, toNum(plantInfo && plantInfo.size) || 1);
      const totalSeasons = Math.max(1, toNum(plantInfo && plantInfo.seasons) || 1);
      const currentSeasonRaw = toNum(targetPlant.season);
      const currentSeason =
        currentSeasonRaw > 0 ? Math.min(currentSeasonRaw, totalSeasons) : 1;
      const phaseName = currentPhase.phaseName || PHASE_NAMES[phase] || '';

      // Compute maturity time
      const maturePhase = Array.isArray(targetPlant.phases)
        ? targetPlant.phases
          .filter(p => p && toTimeSec(p.begin_time) > 0)
          .sort((left, right) => toTimeSec(right.begin_time) - toTimeSec(left.begin_time))[0]
        : null;
      const matureTimeSec = maturePhase ? toTimeSec(maturePhase.begin_time) : 0;
      const matureInSec = matureTimeSec > serverTimeSec ? matureTimeSec - serverTimeSec : 0;
      const phaseStartTime = toTimeSec(currentPhase.begin_time);
      const nextPhaseData = Array.isArray(targetPlant.phases)
        ? targetPlant.phases
          .filter(item => item && toTimeSec(item.begin_time) > phaseStartTime)
          .sort((left, right) => toTimeSec(left.begin_time) - toTimeSec(right.begin_time))[0]
        : null;
      const phaseEndTime = nextPhaseData ? toTimeSec(nextPhaseData.begin_time) : 0;
      const totalGrowTime = getPlantGrowTime(plantId);

      // Determine status
      let status = 'growing';
      if (phase === PlantPhase.MATURE) {
        status = targetPlant.stealable ? 'stealable' : 'harvested';
      } else if (phase === PlantPhase.DEAD) {
        status = 'dead';
      }

      // Mutant effects
      const mutantEffects = buildMutantEffects(mutantConfigIds, targetPlant, currentPhase, plantId);
      const qixiDew = getQixiDewStatus(targetPlant);

      detailLands.push({
        id: landId,
        unlocked: true,
        status,
        plantName,
        plantId,
        displayPlantId,
        seedId,
        seedImage,
        plantImage,
        phase,
        imagePhase: toNum(currentPhase.image_phase),
        phaseName,
        currentSeason,
        totalSeason: totalSeasons,
        level: landLevel,
        matureInSec,
        phaseStartTime,
        phaseEndTime,
        totalGrowTime,
        needWater: toNum(targetPlant.dry_num) > 0,
        needWeed: targetPlant.weed_owners && targetPlant.weed_owners.length > 0,
        needBug: targetPlant.insect_owners && targetPlant.insect_owners.length > 0,
        occupiedByMaster,
        masterLandId,
        occupiedLandIds,
        plantSize,
        mutantEffects,
        qixiDew,
      });
    }

    return { lands: detailLands, summary: analysis };
  } catch (err) {
    logWarn('好友', `获取好友土地详情失败: ${err.message}`, {
      module: 'friend',
      event: '好友土地详情',
      result: 'error',
      friendGid: toNum(gid),
      error: err.message,
      stack: err.stack,
    });
    return { lands: [], summary: {} };
  }
}

// ===== Cache accessors =====

function getFriendsListCache() {
  return friendsListCache;
}

function setFriendsListCache(cache) {
  // 置空代表主动失效：磁盘缓存也要一起清，否则重启后又读到旧列表
  if (!cache) displayFriendCache.clear();
  friendsListCache = cache;
  friendsListRefreshAt = cache ? Date.now() + FRIEND_LIST_REFRESH_MS : 0;
}

// ===== Exports =====
module.exports = {
  analyzeFriendLands,
  getFriendDogInfo,
  batchGetFriendDogInfo,
  getFriendsList,
  fetchFriendsDogInfo,
  syncFriendDogInfoRound,
  getFriendLandsDetail,
  getFriendsListCache,
  setFriendsListCache,
};
