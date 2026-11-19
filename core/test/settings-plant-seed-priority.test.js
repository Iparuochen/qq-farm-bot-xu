const test = require('node:test');
const assert = require('node:assert/strict');

const { createDataProvider } = require('../src/runtime/data-provider');

/**
 * 优先种植种子（plantSeedPriority）必须能落盘并回读。
 * 历史问题：saveSettings 构造 patch 时漏了该字段，选完牧草种子保存后配置仍然是空数组，
 * 前端因此显示"未设置优先种子，将回退等级策略"。
 */
function createStore(initialConfig = {}) {
  const config = { plantSeedPriority: [], ...initialConfig };
  const patches = [];
  const store = new Proxy({}, {
    get(_target, key) {
      if (key === 'applyConfigSnapshot')
        return (patch) => {
          patches.push(patch);
          // 与 store.applyConfigSnapshot 一致：undefined 视为未提供
          for (const [field, value] of Object.entries(patch)) {
            if (value !== undefined && value !== null) config[field] = value;
          }
        };
      if (key === 'getConfigSnapshot')
        return () => config;
      return () => undefined;
    },
  });
  return { store, patches, config };
}

function createProvider(store) {
  return createDataProvider({
    workers: {},
    globalLogs: [],
    accountLogs: [],
    store,
    getAccounts: () => ({ accounts: [{ id: 'account-1' }] }),
    callWorkerApi: async () => ({}),
    filterLogs: logs => logs,
    nextConfigRevision: () => 1,
    broadcastConfigToWorkers: () => {},
  });
}

test('saveSettings 将 plantSeedPriority 写入账号配置', async () => {
  const { store, patches, config } = createStore();
  const provider = createProvider(store);

  const result = await provider.saveSettings('account-1', {
    plantingStrategy: 'seed_priority',
    plantSeedPriority: [20040],
  });

  assert.deepEqual(patches[0].plantSeedPriority, [20040]);
  assert.deepEqual(config.plantSeedPriority, [20040]);
  assert.deepEqual(result.plantSeedPriority, [20040]);
});

test('saveSettings 未携带 plantSeedPriority 时不清空已有配置', async () => {
  const { store, patches, config } = createStore({ plantSeedPriority: [20040] });
  const provider = createProvider(store);

  await provider.saveSettings('account-1', { plantingStrategy: 'level' });

  assert.equal('plantSeedPriority' in patches[0], true);
  assert.equal(patches[0].plantSeedPriority, undefined);
  assert.deepEqual(config.plantSeedPriority, [20040]);
});

test('saveSettings 空数组表示清空优先种子', async () => {
  const { store, patches, config } = createStore({ plantSeedPriority: [20040] });
  const provider = createProvider(store);

  await provider.saveSettings('account-1', { plantSeedPriority: [] });

  assert.deepEqual(patches[0].plantSeedPriority, []);
  assert.deepEqual(config.plantSeedPriority, []);
});
