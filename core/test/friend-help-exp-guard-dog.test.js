const assert = require('node:assert/strict');
const test = require('node:test');

const { shouldSkipHelpForExp } = require('../src/services/friend-visit');

/**
 * 「经验满只帮护主犬」与「经验满也停止帮护主犬」的互斥判定
 *
 * - 经验上限没开：一直帮，不看经验
 * - 经验没满：正常帮
 * - 经验满了：护主犬破例继续帮；开启互斥开关后连护主犬也停
 */
test('经验上限开关关闭时不按经验跳过帮助', () => {
  assert.equal(shouldSkipHelpForExp({
    checkExpLimit: false,
    expReached: true,
    hasGuardDog: false,
    stopAllAtExpFull: false,
  }), false);
});

test('经验没满时正常帮助（护主犬与否都一样）', () => {
  for (const hasGuardDog of [true, false]) {
    assert.equal(shouldSkipHelpForExp({
      checkExpLimit: true,
      expReached: false,
      hasGuardDog,
      stopAllAtExpFull: false,
    }), false);
  }
});

test('经验满：普通好友跳过', () => {
  assert.equal(shouldSkipHelpForExp({
    checkExpLimit: true,
    expReached: true,
    hasGuardDog: false,
    stopAllAtExpFull: false,
  }), true);
});

test('经验满：默认仍帮护主犬好友（互斥开关关闭）', () => {
  assert.equal(shouldSkipHelpForExp({
    checkExpLimit: true,
    expReached: true,
    hasGuardDog: true,
    stopAllAtExpFull: false,
  }), false);
});

test('经验满 + 互斥开关开启：护主犬好友也停止帮助', () => {
  assert.equal(shouldSkipHelpForExp({
    checkExpLimit: true,
    expReached: true,
    hasGuardDog: true,
    stopAllAtExpFull: true,
  }), true);
});
