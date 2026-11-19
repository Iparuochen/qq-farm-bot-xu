const test = require('node:test');
const assert = require('node:assert/strict');

const { createScheduler } = require('../src/services/scheduler');
const { ranchSession } = require('../src/services/ranch-session');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(5);
  }
  throw new Error('等待条件超时');
}

test('定时器回调不继承创建者已关闭的场景租约', async () => {
  const scheduler = createScheduler(`lease-detach-${Date.now()}`);
  let pending = null;

  // 在农场租约内注册定时器：租约在回调触发前就已关闭，
  // 若回调继承该上下文，任何 RPC 都会被判为 SCENE_CANCELLED。
  await ranchSession.inFarm(async () => {
    scheduler.setTimeoutTask('detached_task', 0, () => {
      pending = ranchSession.inRanch(() => 'ranch-ok');
    });
  });

  await waitFor(() => pending !== null);
  assert.equal(await pending, 'ranch-ok');
  scheduler.dispose();
});

test('声明 scene 的定时器在对应场景租约内执行', async () => {
  const scheduler = createScheduler(`lease-scene-${Date.now()}`, { scene: 'farm' });
  let nestedRejected = false;
  let done = false;

  scheduler.setTimeoutTask('scene_task', 0, async () => {
    // 已持有农场租约，此时再切牧场必须被拒绝，否则说明没有包在租约里。
    await assert.rejects(() => ranchSession.inRanch(() => 'ranch'), /嵌套/);
    nestedRejected = true;
    done = true;
  });

  await waitFor(() => done);
  assert.equal(nestedRejected, true);
  scheduler.dispose();
});

test('scene: null 覆盖默认场景，回调不占用场景租约', async () => {
  const scheduler = createScheduler(`lease-null-${Date.now()}`, { scene: 'farm' });
  let pending = null;

  scheduler.setTimeoutTask('null_scene_task', 0, () => {
    pending = ranchSession.inRanch(() => 'ranch-ok');
  }, { scene: null });

  await waitFor(() => pending !== null);
  assert.equal(await pending, 'ranch-ok');
  scheduler.dispose();
});
