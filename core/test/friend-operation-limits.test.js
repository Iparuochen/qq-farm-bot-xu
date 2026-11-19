const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PUT_BUG_OPERATION_ID,
  PUT_WEED_OPERATION_ID,
  BAD_SHARED_LIMIT_ID,
  PUT_BUG_LIMIT_ID,
  canOperateBad,
  getBadRemainingTimes,
  getBadUsageSummary,
  updateOperationLimits,
} = require('../src/services/friend-operation-limits');

// 10003 = 放草+放虫合计（共享池），10004 = 放虫专属；放草 = 10003 - 10004
test('put-insect and put-weed share the daily counter 10003', () => {
  updateOperationLimits([
    { id: BAD_SHARED_LIMIT_ID, day_times: 80, day_times_lt: 100 },
    { id: PUT_BUG_LIMIT_ID, day_times: 30, day_times_lt: 100 },
  ]);

  assert.equal(getBadRemainingTimes(PUT_BUG_OPERATION_ID), 20);
  assert.equal(getBadRemainingTimes(PUT_WEED_OPERATION_ID), 20);
  assert.equal(getBadRemainingTimes(), 20);
  assert.equal(canOperateBad(), true);

  const summary = getBadUsageSummary();
  assert.equal(summary.used, 80);
  assert.equal(summary.bugUsed, 30);
  assert.equal(summary.weedUsed, 50); // 80 - 30
});

test('real packet: 10003=100 / 10004=52 means 48 weeds + 52 bugs', () => {
  updateOperationLimits([
    { id: BAD_SHARED_LIMIT_ID, day_times: 100, day_times_lt: 100 },
    { id: PUT_BUG_LIMIT_ID, day_times: 52, day_times_lt: 100 },
  ]);

  const summary = getBadUsageSummary();
  assert.equal(summary.used, 100);
  assert.equal(summary.limit, 100);
  assert.equal(summary.weedUsed, 48);
  assert.equal(summary.bugUsed, 52);
  assert.equal(summary.remaining, 0);
  assert.equal(canOperateBad(), false);
});
