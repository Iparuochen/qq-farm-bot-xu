const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');

const { loadProto, types } = require('../src/utils/proto');

const LOCKED_SEED_UID = 1001;
const UNLOCKED_SEED_UID = 1002;
const TOOL_UID = 1003;
const LOCKED_FRUIT_UID = 1004;
const UNLOCKED_FRUIT_UID = 1005;
const TOWER_FRUIT_UID = 1006;

const BAG_ITEMS = [
  { id: 20129, count: 5, uid: LOCKED_SEED_UID, locked: true },
  { id: 20129, count: 3, uid: UNLOCKED_SEED_UID, locked: false },
  { id: 6001, count: 1, uid: TOOL_UID, locked: false },
  { id: 40001, count: 4, uid: LOCKED_FRUIT_UID, locked: true },
  { id: 40001, count: 2, uid: UNLOCKED_FRUIT_UID, locked: false },
  { id: 204002, count: 1, uid: TOWER_FRUIT_UID, locked: false },
];

function encodeBagReply(items) {
  const payload = types.BagReply.create({
    item_bag: {
      items: items.map(item => ({
        id: item.id,
        count: item.count,
        uid: item.uid,
        locked: item.locked === true,
      })),
    },
  });
  return types.BagReply.encode(payload).finish();
}

async function withWarehouseMock(run) {
  await loadProto();

  const networkPath = require.resolve('../src/utils/network');
  const warehousePath = require.resolve('../src/services/warehouse');
  const originalNetwork = require.cache[networkPath];
  const originalWarehouse = require.cache[warehousePath];
  const calls = [];

  require.cache[networkPath] = {
    id: networkPath,
    filename: networkPath,
    loaded: true,
    exports: {
      networkEvents: new EventEmitter(),
      getUserState: () => ({ gid: 123 }),
      sendMsgAsync: async (service, method, payload) => {
        calls.push({ service, method, payload });
        return { body: method === 'Bag' ? encodeBagReply(BAG_ITEMS) : Buffer.alloc(0) };
      },
    },
  };
  delete require.cache[warehousePath];

  try {
    const warehouse = require(warehousePath);
    return await run(warehouse, calls);
  }
  finally {
    if (originalNetwork)
      require.cache[networkPath] = originalNetwork;
    else
      delete require.cache[networkPath];
    if (originalWarehouse)
      require.cache[warehousePath] = originalWarehouse;
    else
      delete require.cache[warehousePath];
  }
}

test('locked seed stacks are excluded from automatic planting seeds', async () => {
  await withWarehouseMock(async (warehouse) => {
    const seeds = await warehouse.getBagSeeds();
    const seed = seeds.find(entry => entry.seedId === 20129);
    assert.ok(seed, 'unlocked stack should remain selectable');
    assert.equal(seed.count, 3);
  });
});

test('bag detail exposes locked and partially locked rows', async () => {
  await withWarehouseMock(async (warehouse) => {
    const detail = await warehouse.getBagDetail();
    const seedRow = detail.items.find(entry => entry.id === 20129);

    assert.equal(seedRow.count, 8);
    assert.equal(seedRow.lockable, true);
    assert.equal(seedRow.locked, false);
    assert.equal(seedRow.partiallyLocked, true);
    assert.equal(seedRow.lockedCount, 5);
    assert.equal(seedRow.unlockedCount, 3);

    const toolRow = detail.items.find(entry => entry.id === 6001);
    assert.equal(toolRow.lockable, false);
    assert.equal(toolRow.locked, false);

    // 作物塔果实（type 18）虽属植物果实，但不支持锁定
    const towerRow = detail.items.find(entry => entry.id === 204002);
    assert.equal(towerRow.itemType, 18);
    assert.equal(towerRow.lockable, false);
  });
});

test('sale rejects locked stacks by uid and by merged count', async () => {
  await withWarehouseMock(async (warehouse) => {
    await assert.rejects(
      warehouse.sellItems([{ id: 40001, count: 1, uid: LOCKED_FRUIT_UID }]),
      /已锁定，不能出售/,
    );
    await assert.rejects(
      warehouse.sellItems([{ id: 40001, count: 6 }]),
      /可售数量不足/,
    );
  });
});

test('sale rejects seeds regardless of lock state', async () => {
  await withWarehouseMock(async (warehouse) => {
    await assert.rejects(
      warehouse.sellItems([{ id: 20129, count: 1, uid: LOCKED_SEED_UID }]),
      /是种子，不能出售/,
    );
    await assert.rejects(
      warehouse.sellItems([{ id: 20129, count: 1, uid: UNLOCKED_SEED_UID }]),
      /是种子，不能出售/,
    );
    await assert.rejects(
      warehouse.sellItems([{ id: 20129, count: 1 }]),
      /是种子，不能出售/,
    );
  });
});

test('locking sends official LockItems request and skips already locked uids', async () => {
  await withWarehouseMock(async (warehouse, calls) => {
    const result = await warehouse.setItemsLocked([UNLOCKED_SEED_UID, LOCKED_SEED_UID], true);
    assert.equal(result.locked, true);
    assert.equal(result.changed, 1);

    const lockCall = calls.find(call => call.method === 'LockItems');
    assert.ok(lockCall, 'LockItems request must be sent');
    const decoded = types.LockItemsRequest.decode(lockCall.payload);
    assert.deepEqual(decoded.item_uids.map(Number), [UNLOCKED_SEED_UID]);

    calls.length = 0;
    const skipped = await warehouse.setItemsLocked([LOCKED_SEED_UID], true);
    assert.equal(skipped.changed, 0);
    assert.equal(calls.filter(call => call.method === 'LockItems').length, 0);
  });
});

test('unlocking uses UnlockItems and rejects non lockable item types', async () => {
  await withWarehouseMock(async (warehouse, calls) => {
    await assert.rejects(
      warehouse.setItemsLocked([TOOL_UID], true),
      /不支持锁定/,
    );
    assert.equal(calls.filter(call => call.method === 'LockItems').length, 0);

    const result = await warehouse.setItemsLocked([LOCKED_SEED_UID], false);
    assert.equal(result.locked, false);
    assert.equal(result.changed, 1);

    const unlockCall = calls.find(call => call.method === 'UnlockItems');
    assert.ok(unlockCall, 'UnlockItems request must be sent');
    const decoded = types.UnlockItemsRequest.decode(unlockCall.payload);
    assert.deepEqual(decoded.item_uids.map(Number), [LOCKED_SEED_UID]);
  });
});
