/* eslint test/no-import-node-test: off, test/consistent-test-it: off */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { officialAnimalStatus } from '../src/utils/ranch-official-status.ts'

const statusConfig = { infantSec: 10, growSec: 20, matureSec: 10, roundSec: 30, maxProduceCount: 2, dropSec: 2 }
test('official status uses entire lifetime rather than current phase percent', () => {
  const state = officialAnimalStatus({ stage: 1, infantReadyAtMs: 15000, statusConfig }, 10000)
  assert.equal(state.time, '00:00:05')
  assert.equal(state.percent, 5 / 70 * 100)
  assert.deepEqual(state.marks, [10 / 70 * 100, 30 / 70 * 100, 60 / 70 * 100, 100])
})
test('producing, delivery, hunger and mature use official display branches', () => {
  assert.equal(officialAnimalStatus({ stage: 3, canDeliver: true, statusConfig }, 0).time, '可生产')
  assert.equal(officialAnimalStatus({ stage: 3, grassBlocked: true, statusConfig }, 0).time, '缺草')
  assert.equal(officialAnimalStatus({ stage: 3, deliveringUntilMs: 11000, statusConfig }, 10000).percent, 50)
  assert.equal(officialAnimalStatus({ stage: 5, statusConfig }, 0).percent, 100)
  assert.equal(officialAnimalStatus({ stage: 1 }, 0).percent, null)
})
test('all extracted official assets exist and match recorded hashes', () => {
  const base = new URL('../public/ranch/animal-status/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('sources.json', base), 'utf8'))
  assert.equal(manifest.files.length, 11)
  for (const asset of manifest.files)
    assert.equal(createHash('sha256').update(readFileSync(new URL(asset.file, base))).digest('hex'), asset.sha256)
})
