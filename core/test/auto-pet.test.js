// 自动喂狗粮回归测试（2026-11-20 排查"开了自动喂狗粮却没喂"）：
// 1. 开关关闭时不得占用 12 小时检查窗口——否则打开开关后要白等最多 12 小时；
// 2. 巡查失败（断线/场景取消）后走短重试，而不是把下一次检查拖后 12 小时；
// 3. 正常路径：守护剩余 < 24h 且背包有粮时喂食，成功后按 12 小时节流。
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-farm-auto-pet-'));
process.env.FARM_DATA_DIR = dataDir;

const store = require('../src/models/store');
const pets = require('../src/services/pets');
const autoPet = require('../src/services/auto-pet');

const ACC = 'acc-pet-1';
let autoCfg = {};
let overviewResult = null;
let overviewError = null;
let feedCalls = 0;
let overviewCalls = 0;

store.getAutomation = (id) => autoCfg;
pets.getPetOverview = async () => {
  overviewCalls += 1;
  if (overviewError) throw overviewError;
  return overviewResult;
};
pets.feedDog = async () => {
  feedCalls += 1;
  return { ok: true };
};

function reset() {
  autoPet.resetPetPacing(ACC);
  feedCalls = 0;
  overviewCalls = 0;
  overviewError = null;
  overviewResult = null;
  autoCfg = {};
}

test('开关关闭时不占用检查窗口：打开开关后下一次调用立即生效', async () => {
  reset();
  autoCfg = {}; // 开关未开
  await autoPet.checkAndAutoPet(ACC);

  autoCfg = { auto_feed_dog: true };
  overviewResult = { deployedId: 90001, foodSeconds: 3600, foods: [{ id: 90004, count: 2, name: '1天狗粮' }] };
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(feedCalls, 1, '打开开关后应立即完成第一次喂食');
});

test('巡查失败后走短间隔重试（10 分钟），不再拖后 12 小时', async () => {
  reset();
  autoCfg = { auto_feed_dog: true };
  overviewError = new Error('账号连接已重置或场景事务已结束，旧请求已取消');
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(overviewCalls, 1);

  // 失败后立即重试：仍在 10 分钟重试窗口内，不巡查
  overviewError = null;
  overviewResult = { deployedId: 90001, foodSeconds: 3600, foods: [{ id: 90004, count: 2, name: '1天狗粮' }] };
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(feedCalls, 0, '10 分钟重试窗口内的立即调用应被挡住');

  // 时钟推进 11 分钟：重试放行并完成喂食（旧实现这里要等 12 小时）
  autoPet._setNowProvider(() => Date.now() + 11 * 60 * 1000);
  await autoPet.checkAndAutoPet(ACC);
  autoPet._setNowProvider(null);
  assert.strictEqual(feedCalls, 1, '超过重试窗口后应放行并喂食');
});

test('剩余守护 >= 24h 时正常跳过，且成功后按 12h 节流', async () => {
  reset();
  autoCfg = { auto_feed_dog: true };
  overviewResult = { deployedId: 90001, foodSeconds: 72 * 3600, foods: [{ id: 90004, count: 2, name: '1天狗粮' }] };
  await autoPet.checkAndAutoPet(ACC);
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(feedCalls, 0, '守护充足不喂食');
  assert.strictEqual(overviewCalls, 1, '成功检查后 12h 内不再巡查');
});

test('成功喂食后按 12h 节流，紧随的调用不再喂食', async () => {
  reset();
  autoCfg = { auto_feed_dog: true };
  overviewResult = { deployedId: 90001, foodSeconds: 3600, foods: [{ id: 90004, count: 2, name: '1天狗粮' }] };
  await autoPet.checkAndAutoPet(ACC);
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(feedCalls, 1, '第二次调用应被 12h 节流挡住');
});

test('未派出守护时记录成功检查，不反复巡查', async () => {
  reset();
  autoCfg = { auto_feed_dog: true };
  overviewResult = { deployedId: 0, foodSeconds: 0, foods: [] };
  await autoPet.checkAndAutoPet(ACC);
  await autoPet.checkAndAutoPet(ACC);
  assert.strictEqual(overviewCalls, 1, '未派出守护按正常完成计，12h 内不重复巡查');
});
