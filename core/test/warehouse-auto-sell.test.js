const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the actual auto-sale transaction with offline bag/RPC fixtures.
const source = fs.readFileSync(require.resolve('../src/services/warehouse'), 'utf8');
const transaction = source.slice(source.indexOf('async function sellAllFruits()'), source.indexOf('// ----', source.indexOf('async function sellAllFruits()')));
async function run(items, failBatch = false) {
  const calls = [];
  let gold = 0;
  const context = {
    // 本地实现比上游多了几层保护（插件保留谓词、物品锁定），切片执行时要一并补桩。
    RANCH_GRASS_ITEM_ID: 7001,
    AUTO_SELL_RESERVED_ITEM_IDS: new Set([7001]),
    isAutoSellReservedItemId: id => Number(id) === 7001,
    require: () => ({ reserveFruit: () => false }),
    getAutomation: () => ({}),
    getServerTimeSec: () => 0,
    isItemLocked: () => false,
    SELL_BATCH_SIZE: 15,
    isAutomationOn: () => true, getBag: async () => ({ items }),
    getBagItems: bag => bag.items, toNum: Number,
    isFruitItemId: () => true, // Even when grass is classified as a crop fruit.
    getCurrentTotals: () => ({ gold, exp: 0 }), getUserState: () => ({ gold }),
    sellItems: async batch => {
      calls.push(Array.from(batch, item => Number(item.id)));
      if (failBatch && batch.length > 1) throw new Error('fixture batch failure');
      gold += 10;
      return {};
    },
    deriveGoldGainFromSellReply: () => ({ gain: 10, nextKnownGold: gold }),
    getFruitName: String, log: () => {}, logWarn: () => {}, sleep: async () => {},
    updateStatusGold: () => {},
  };
  vm.createContext(context);
  vm.runInContext(`${transaction}\nthis.run = sellAllFruits;`, context);
  await context.run();
  return calls;
}

test('automatic farm sale retains all grass and sells other fruit', async () => {
  assert.deepEqual(await run([{ id: 7001, count: 999 }, { id: 40001, count: 3 }]), [[40001]]);
});
test('grass-only inventory issues no sale RPC', async () => {
  assert.deepEqual(await run([{ id: '7001', count: 10 }]), []);
});
test('batch fallback also excludes grass', async () => {
  assert.deepEqual(await run([{ id: 7001, count: 99 }, { id: 40001, count: 3 }, { id: 40002, count: 2 }], true), [[40001, 40002], [40001], [40002]]);
});
