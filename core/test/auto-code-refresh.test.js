const test = require('node:test');
const assert = require('node:assert/strict');

const { createAutoCodeRefreshService } = require('../src/runtime/auto-code-refresh');

function createService(account, logs) {
  return createAutoCodeRefreshService({
    store: {
      getAutoCodeRefresh: () => ({ enabled: false, intervalMinutes: 60 }),
    },
    getAccounts: () => ({ accounts: [account] }),
    addOrUpdateAccount: () => {},
    resolveWorkerControls: () => ({}),
    log: (...args) => logs.push(args),
    addAccountLog: () => {},
  });
}

test('QQ accounts do not emit a missing wxid warning during Code refresh scheduling', () => {
  const logs = [];
  const service = createService({ id: 'qq-1', name: 'QQ account', platform: 'qq' }, logs);

  service.scheduleAccount('qq-1');

  assert.deepEqual(logs, []);
});

test('WeChat accounts still report a missing wxid during Code refresh scheduling', () => {
  const logs = [];
  const service = createService({ id: 'wx-1', name: 'WeChat account', platform: 'wx' }, logs);

  service.scheduleAccount('wx-1');

  assert.equal(logs.length, 1);
  assert.equal(logs[0][1], '自动刷新 Code 未启动: 账号缺少 wxid');
});

test('QQ handshake recovery never enters WeChat credential validation, even with leftover wx fields', async () => {
  for (const account of [
    { id: 'qq', platform: 'qq' },
    { id: 'qq', platform: 'qq', wxid: 'leftover', loginBuffer: 'leftover' },
  ]) {
    const logs = [];
    const service = createService(account, logs);
    assert.equal(await service.refreshAccountCode('qq', 'ws_400'), false);
    assert.equal(await service.refreshAccountCode('qq', 'manual'), false);
    assert.equal(service.scheduleRelogin('qq', 'ws_400'), false);
    assert.deepEqual(logs, []);
  }
});

test('disabled WeChat auto recovery does not attempt credential refresh', async () => {
  const logs = [];
  const service = createService({ id: 'wx', platform: 'wx' }, logs);
  assert.equal(await service.refreshAccountCode('wx', 'ws_400'), false);
  assert.deepEqual(logs, []);
  assert.equal(await service.refreshAccountCode('wx', 'manual'), false);
  assert.match(logs[0][1], /缺少 wxid/);
});
