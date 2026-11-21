const {test} = require('node:test');
const assert = require('node:assert/strict');
const {drawAtlasRegion} = require('../scripts/lib/ranch-atlas-region.cjs');

test('rotated atlas region is restored clockwise, with swapped packed dimensions', () => {
  const calls = [];
  const ctx = Object.fromEntries(['translate', 'rotate', 'drawImage'].map(k => [k, (...args) => calls.push([k, ...args])]));
  drawAtlasRegion(ctx, 'page', {x: 442, y: 222, width: 144, height: 130, rotate: true});
  assert.deepEqual(calls, [
    ['translate', 144, 0], ['rotate', Math.PI / 2],
    ['drawImage', 'page', 442, 222, 130, 144, 0, 0, 130, 144],
  ]);
  // Packed top-left maps to upright top-right; packed bottom-right to bottom-left.
  const map = (x, y) => [144 - y, x];
  assert.deepEqual(map(0, 0), [144, 0]);
  assert.deepEqual(map(130, 144), [0, 130]);
});

test('unrotated atlas region keeps its original coordinates', () => {
  const calls = [];
  drawAtlasRegion({drawImage: (...args) => calls.push(args)}, 'page', {x: 2, y: 32, width: 211, height: 168, rotate: false});
  assert.deepEqual(calls, [['page', 2, 32, 211, 168, 0, 0, 211, 168]]);
});
