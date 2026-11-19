const assert = require('node:assert/strict');
const test = require('node:test');

const { getPlantByFruitId } = require('../src/config/gameConfig');
const { isAutoSellReservedItemId } = require('../src/services/warehouse');

test('牧草 7001 确实会被当成果实（否则无需排除）', () => {
  const plant = getPlantByFruitId(7001);
  assert.ok(plant, '牧草应存在于植物表的果实物映射中');
  assert.equal(plant.name, '牧草');
});

test('自动出售时保留牧草', () => {
  assert.equal(isAutoSellReservedItemId(7001), true);
  assert.equal(isAutoSellReservedItemId('7001'), true);
});

test('普通果实与种子不受保留规则影响', () => {
  assert.equal(isAutoSellReservedItemId(1026), false);
  assert.equal(isAutoSellReservedItemId(20040), false);
  assert.equal(isAutoSellReservedItemId(0), false);
  assert.equal(isAutoSellReservedItemId(undefined), false);
});
