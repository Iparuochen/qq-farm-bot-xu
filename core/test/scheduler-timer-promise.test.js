/**
 * 回归：场景租约定时任务必须持有租约到业务真正结束。
 *
 * 背景：定时器回调若写成 fire-and-forget（不返回业务 promise），
 * 场景租约会在回调同步返回后立刻关闭，业务后续 RPC 全部被判定
 * SCENE_CANCELLED（"账号连接已重置或场景事务已结束"）——活动插件的
 * 自动领取（兴牧庆典/节令答题）就是这样失败的。
 * 修复：所有 scene 定时器回调必须返回业务 promise（worker.js / task.js /
 * friend-orchestrator.js 等已改），本文件验证修复后的行为。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { ranchSession } = require('../src/services/ranch-session');
const { createScheduler } = require('../src/services/scheduler');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(5);
  }
  throw new Error('等待条件超时');
}

function makeSend(calls) {
  return (service, method) => {
    calls.push(method);
    return ranchSession.run(service, method, async () => {
      await sleep(5);
      return `${method}-reply`;
    });
  };
}

test('interval 回调返回 promise：整轮业务 RPC 都在同一租约内成功', async () => {
  ranchSession.resume();
  ranchSession.reset();
  ranchSession.configure({ transition: async () => {} });
  ranchSession.adoptScene('farm');

  const scheduler = createScheduler('regress-star', { scene: 'farm' });
  const calls = [];
  const send = makeSend(calls);
  const errors = [];

  // 模拟 onReady 租约内注册活动心跳（真实注册点）
  await ranchSession.inFarm(async () => {
    scheduler.setIntervalTask('star_claim', 100, () => {
      // 修复后的写法：返回业务 promise（catch 兜底仍返回 fulfilled promise）
      return (async () => {
        await send('gamepb.activitypb.ActivityService', 'GetGroup');
        await sleep(20);
        await send('gamepb.activitypb.ActivityService', 'Operate');
        await sleep(20);
        await send('gamepb.activitypb.ActivityService', 'Operate');
      })().catch(e => errors.push(e.message));
    });
  });

  // 并发牧场事务抢占场景
  const ranchTimer = setInterval(() => {
    ranchSession.inRanch(() => send('gamepb.ranchpb.RanchService', 'AddFeed')).catch(() => {});
  }, 150);

  await sleep(900);
  clearInterval(ranchTimer);
  scheduler.dispose();

  assert.ok(calls.length >= 9, `RPC 次数异常: ${calls.length}`);
  assert.equal(errors.filter(e => e.includes('场景事务已结束')).length, 0, errors.join(' | '));
});

test('onReady 租约内注册 timeout（配置保存后的 after_save 场景）', async () => {
  ranchSession.resume();
  ranchSession.reset();
  ranchSession.configure({ transition: async () => {} });
  ranchSession.adoptScene('farm');

  const scheduler = createScheduler('regress-save', { scene: 'farm' });
  const calls = [];
  const send = makeSend(calls);
  const errors = [];
  let done = false;

  await ranchSession.inFarm(async () => {
    scheduler.setTimeoutTask('after_save', 50, () => {
      return (async () => {
        await send('gamepb.activitypb.ActivityService', 'GetGroup');
        await sleep(30);
        await send('gamepb.activitypb.ActivityService', 'Operate');
        done = true;
      })().catch(e => errors.push(e.message));
    });
  });

  await waitFor(() => done);
  scheduler.dispose();

  assert.equal(errors.length, 0, errors.join(' | '));
  assert.deepEqual(calls, ['GetGroup', 'Operate']);
});
