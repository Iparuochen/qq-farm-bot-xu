import assert from 'node:assert/strict'
import { test } from 'node:test'
import { feedAmount, feedCount, feedDialogState } from '../src/utils/ranch-feed.ts'
const machine = { capacity: 560, feedMachine: { feedCount: 0 } }
const shop = { currencyId: 1007, unitPrice: 60 }
test('inventory mode limits additions to unlocked grass and free space', () => {
  const state = feedDialogState(machine, [{ id: 7001, count: '23' }, { id: 7001, count: '999', locked: true }], shop)
  assert.equal(state.buy, false)
  assert.equal(state.max, 23)
  assert.equal(feedDialogState({ ...machine, feedMachine: { feedCount: 550 } }, [{ id: 7001, count: 23 }], shop).max, 10)
})
test('empty inventory uses official purchase price and guards unknown prices', () => {
  const state = feedDialogState(machine, [{ id: 1007, count: '999999' }], shop)
  assert.equal(state.buy, true)
  assert.equal(state.max, 560)
  assert.equal(state.unitPrice * state.max, 33600)
  assert.equal(feedAmount(33600), '3.3万')
  assert.equal(state.priceKnown, true)
  assert.equal(feedDialogState(machine, [], null).priceKnown, false)
})
test('full machines and count limits', () => {
  assert.equal(feedDialogState({ capacity: 560, feedMachine: { feedCount: 560 } }, [], shop).max, 0)
  assert.equal(feedCount(999, 23), 23)
  assert.equal(feedCount(-1, 23), 1)
  assert.equal(feedCount(2, 0), 0)
  assert.equal(feedDialogState({ capacity: 9e12 }, [], shop).max, 2147483647)
})
