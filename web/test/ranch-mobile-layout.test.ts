/* eslint test/no-import-node-test: off, test/consistent-test-it: off */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('mobile overrides stay below desktop breakpoint and do not alter shared tabs', () => {
  for (const file of ['../src/views/RanchPersonal.vue', '../src/components/ranch/RanchFarmPanel.vue']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /@media \(max-width: 639px\)/)
  }
  const scene = readFileSync(new URL('../src/components/ranch/RanchScene.vue', import.meta.url), 'utf8')
  assert.match(scene, /useMediaQuery\('\(max-width: 639px\)'\)/)
  assert.match(scene, /mobileViewport.value \? 0.78 : 1.25/)
})
