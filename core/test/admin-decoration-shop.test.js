const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDecorationItem,
  getDecorationGoods,
  getOwnedDecorationIds,
} = require('../src/controllers/admin-decoration-shop-routes');

test('decoration shop treats positive bag inventory as owned', () => {
  const ownedIds = getOwnedDecorationIds({
    originalItems: [
      { id: 2130, count: 1, uid: 10 },
      { id: 2131, count: 0, uid: 11 },
    ],
  });

  assert.equal(ownedIds.has(2130), true);
  assert.equal(ownedIds.has(2131), false);
});

test('owned avatar frame cannot be purchased again', () => {
  const item = buildDecorationItem(2130, 10_000, new Set([2130]));

  assert.equal(item.owned, true);
  assert.equal(item.canBuy, false);
});

test('unowned avatar frame remains buyable when balance is sufficient', () => {
  const item = buildDecorationItem(2131, 980, new Set());

  assert.equal(item.owned, false);
  assert.equal(item.canBuy, true);
  assert.equal(item.currencyId, 1005);
  assert.equal(item.currencyLabel, '金豆豆');
});

test('decoration shop purchase limit marks a used avatar frame as owned', () => {
  const goods = getDecorationGoods({
    goods_list: [
      { id: 2130, item_id: 2130, item_count: 1, price: 980, limit_count: 1, bought_num: 1, unlocked: true },
      { id: 2131, item_id: 2131, item_count: 1, price: 980, limit_count: 1, bought_num: 0, unlocked: true },
    ],
  });
  const byItemId = new Map(goods.map((item) => [Number(item.item_id), item]));

  const owned = buildDecorationItem(2130, 10_000, new Set(), byItemId.get(2130));
  const available = buildDecorationItem(2131, 10_000, new Set(), byItemId.get(2131));

  assert.equal(owned.owned, true);
  assert.equal(owned.canBuy, false);
  assert.equal(owned.boughtNum, 1);
  assert.equal(available.owned, false);
  assert.equal(available.canBuy, true);
});

test('shop 4 goods are returned in server order without hard-coded filter', () => {
  const goods = getDecorationGoods({
    goods_list: [
      { id: 2129, item_id: 20040, price: 20, unlocked: true },
      { id: 2130, item_id: 2130, price: 980, unlocked: true },
      { id: 2131, item_id: 2131, price: 980, unlocked: true },
      { id: 20001, item_id: 201007, price: 5400, unlocked: true },
    ],
  });

  assert.deepEqual(goods.map((item) => Number(item.item_id)), [20040, 2130, 2131, 201007]);
});

test('pasture grass seed is a repeatable gold purchase', () => {
  const goods = { id: 2129, item_id: 20040, item_count: 1, price: 20, unlocked: true, conds: [{ type: 1, param: '1' }] };
  const item = buildDecorationItem(20040, 0, new Set(), goods, { userGold: 100, userLevel: 30 });

  assert.equal(item.owned, false);
  assert.equal(item.canBuy, true);
  assert.equal(item.currencyId, 1001);
  assert.equal(item.currencyLabel, '金币');
  assert.equal(item.price, 20);
  assert.equal(item.requiredLevel, 1);
  assert.equal(item.name, '牧草种子');
});

test('pasture grass seed is blocked when gold is insufficient', () => {
  const goods = { id: 2129, item_id: 20040, item_count: 1, price: 20, unlocked: true };
  const item = buildDecorationItem(20040, 10_000, new Set(), goods, { userGold: 5, userLevel: 30 });

  assert.equal(item.owned, false);
  assert.equal(item.canBuy, false);
  // 金豆豆余额再高也买不了金币商品
  assert.equal(item.currencyId, 1001);
});

test('shop 4 level conditions block purchases below required level', () => {
  const goods = { id: 2130, item_id: 2130, price: 980, unlocked: true, conds: [{ type: 1, param: '8' }] };
  const item = buildDecorationItem(2130, 10_000, new Set(), goods, { userGold: 0, userLevel: 5 });

  assert.equal(item.requiredLevel, 8);
  assert.equal(item.locked, true);
  assert.equal(item.canBuy, false);
});
