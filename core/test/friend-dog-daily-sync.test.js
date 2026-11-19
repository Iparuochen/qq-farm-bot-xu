const assert = require('node:assert/strict');
const test = require('node:test');

// 在加载被测模块之前打桩：network（网关健康可切换）与 friend-api（Enter/Leave 探针不能真发 RPC）。
// 注意这些模块在 friend-land-analyzer 加载时就被解构引用，所以桩必须是「加载前」的可变单例。
const enterCalls = [];
let gatewayHealthy = true;
const networkPath = require.resolve('../src/utils/network');
const friendApiPath = require.resolve('../src/services/friend-api');
require.cache[networkPath] = {
  id: networkPath,
  filename: networkPath,
  loaded: true,
  exports: {
    getGatewayHealth: () => ({ healthy: gatewayHealthy, reason: gatewayHealthy ? '' : 'request_stuck' }),
    getUserState: () => ({ gid: 111, accountId: 'test-dog-sync' }),
    networkEvents: new (require('node:events').EventEmitter)(),
  },
};
require.cache[friendApiPath] = {
  id: friendApiPath,
  filename: friendApiPath,
  loaded: true,
  exports: {
    getAllFriends: async () => ({ game_friends: [] }),
    enterFriendFarm: async (gid) => {
      enterCalls.push(gid);
      if (gid === 1) return { __briefDogInfo: { dogId: 90021, dogName: '护主犬' } };
      return { __briefDogInfo: null };
    },
    leaveFriendFarm: async () => {},
    getDogName: (dogId) => (dogId === 90021 ? '护主犬' : ''),
    handleFriendEnterError: () => ({ handled: false }),
  },
};

const { _test, deleteFriendDogInfoCache, readFriendDogInfoCache } = require('../src/models/store');
const {
  setFriendsListCache,
  getFriendsListCache,
  syncFriendDogInfoRound,
} = require('../src/services/friend-land-analyzer');

const ACCOUNT_ID = 'test-dog-sync';

test('dog info daily sync fills pending friends in small rounds and skips confirmed ones', async () => {
  process.env.FARM_ACCOUNT_ID = ACCOUNT_ID;
  gatewayHealthy = true;
  deleteFriendDogInfoCache(ACCOUNT_ID);
  setFriendsListCache([
    { gid: 1, name: '甲' },
    { gid: 2, name: '乙' },
    { gid: 3, name: '丙' },
  ]);
  enterCalls.length = 0;

  // 第一轮：限额 2 位，好友 1 有护主犬、好友 2 无狗（dogId 0 也是结论）
  const round1 = await syncFriendDogInfoRound({ maxPerRound: 2 });
  assert.equal(round1.checked, 2);
  assert.equal(round1.pending, 1);
  assert.equal(round1.complete, false);
  assert.deepEqual(enterCalls, [1, 2]);

  const cache = readFriendDogInfoCache(ACCOUNT_ID) || {};
  assert.equal(cache[1].dogId, 90021);
  assert.equal(cache[1].checkedAt > 0, true);
  assert.equal(cache[2].dogId, 0, '无狗结论也要落盘，避免重复探测');

  // 第二轮：只剩好友 3
  const round2 = await syncFriendDogInfoRound({ maxPerRound: 2 });
  assert.equal(round2.checked, 1);
  assert.equal(round2.pending, 0);
  assert.equal(round2.complete, true);
  assert.deepEqual(enterCalls, [1, 2, 3]);

  // 第三轮：全部确认过，不再发探针
  const round3 = await syncFriendDogInfoRound({ maxPerRound: 2 });
  assert.equal(round3.checked, 0);
  assert.equal(round3.pending, 0);
  assert.equal(round3.complete, true);
  assert.deepEqual(enterCalls, [1, 2, 3], '已确认的好友不应再次探测');

  deleteFriendDogInfoCache(ACCOUNT_ID);
  setFriendsListCache(null);
  assert.equal(getFriendsListCache(), null);
});

test('dog info daily sync defers the whole round when gateway is unhealthy', async () => {
  process.env.FARM_ACCOUNT_ID = ACCOUNT_ID;
  gatewayHealthy = false;
  deleteFriendDogInfoCache(ACCOUNT_ID);
  setFriendsListCache([{ gid: 9, name: '丁' }]);
  enterCalls.length = 0;

  try {
    const result = await syncFriendDogInfoRound({ maxPerRound: 5 });
    assert.equal(result.checked, 0);
    assert.equal(result.pending, 1);
    assert.equal(result.deferred, 'gateway_unhealthy');
    assert.equal(result.retryMs, 30 * 60 * 1000);
    assert.equal(readFriendDogInfoCache(ACCOUNT_ID), null, '让路时不应写入缓存');
    assert.deepEqual(enterCalls, [], '让路时不应发探针');
  } finally {
    gatewayHealthy = true;
    deleteFriendDogInfoCache(ACCOUNT_ID);
    setFriendsListCache(null);
  }
});

test('normalize friend dog cache entries still reject cross-day files', () => {
  const now = new Date(2026, 10, 18, 12).getTime();
  const yesterday = new Date(2026, 10, 17, 20).getTime();
  const dogInfo = { 123: { dogId: 90021, dogName: '护主犬', checkedAt: now } };
  assert.deepEqual(_test.normalizeFriendDogInfoCache({ dogInfo, updatedAt: now }, now), dogInfo);
  assert.equal(_test.normalizeFriendDogInfoCache({ dogInfo, updatedAt: yesterday }, now), null);
});
