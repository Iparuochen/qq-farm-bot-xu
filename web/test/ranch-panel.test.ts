/* eslint test/no-import-node-test: off, test/consistent-test-it: off */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ranchPanelActions, runRanchPanelActions } from '../src/utils/ranch-panel.ts'

function fixture() {
  return { sceneReady: true, capabilities: { collect: true, produce: true, clean: true, harvest: true }, ranches: [
    { ranchInstId: 'nest', shelves: [{ canCollect: true }, { canCollect: true }], hazards: [{}], animals: [{ animalInstId: 'a', canTriggerProduce: true }, { animalInstId: 'b', canHarvest: true }] },
    { ranchInstId: 'shed', shelves: [], hazards: [], animals: [{ animalInstId: 'c', canTriggerProduce: true }] },
  ] }
}
test('toolbar builds only eligible actions and separates collection from animal harvest', () => {
  const data = fixture()
  assert.deepEqual(ranchPanelActions(data, 'collect'), [{ action: 'collect', ranchId: 'nest' }])
  assert.deepEqual(ranchPanelActions(data, 'harvest'), [{ action: 'harvest', ranchId: 'nest', animalInstId: 'b' }])
  assert.equal(ranchPanelActions(data, 'produce').length, 2)
  assert.equal(ranchPanelActions({ ...data, sceneReady: false }, 'produce').length, 0)
  assert.equal(ranchPanelActions({ ...data, capabilities: {} }, 'produce').length, 0)
})
test('toolbar queue revalidates updated state and stops on failure or account change', async () => {
  const data = fixture()
  const calls: any[] = []
  await runRanchPanelActions('produce', {
    data: () => data, active: () => true, failed: () => false,
    mutate: async payload => { calls.push(payload); data.ranches[1]!.animals[0]!.canTriggerProduce = false },
  })
  assert.equal(calls.length, 1)
  for (const mode of ['error', 'account']) {
    let active = true
    let failed = false
    let count = 0
    await runRanchPanelActions('produce', {
      data: fixture, active: () => active, failed: () => failed,
      mutate: async () => { count++; active = mode !== 'account'; failed = mode === 'error' },
    })
    assert.equal(count, 1)
  }
})
test('panel composes a selectable ranch scene and keeps animal details', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchFarmPanel.vue', import.meta.url), 'utf8')
  assert.match(source, /<RanchScene/);
  assert.match(source, /v-for="ranch in selectedRanches/);
  assert.match(source, /selectedRanchId.value = ''/)
  assert.match(source, /animal\.image/)
  assert.match(source, /牧场详情/)
})
test('empty toolbar actions never send mutation requests', async () => {
  for (const action of ['collect', 'produce', 'clean', 'harvest'] as const) {
    let requests = 0
    await runRanchPanelActions(action, {
      data: () => ({ ...fixture(), ranches: [] }), active: () => true, failed: () => false,
      mutate: async () => { requests++ },
    })
    assert.equal(requests, 0)
  }
})
test('toolbar remains clickable without targets and presents feedback', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchFarmPanel.vue', import.meta.url), 'utf8')
  assert.match(source, /:disabled="disabled" @click="requestOperation\(op.action\)"/)
  assert.match(source, /v-if="actionNotice" role="status"/)
  assert.match(source, /没有可收获的动物/)
})

test('animal detail uses an anchored bubble without a modal backdrop', () => {
  const panel = readFileSync(new URL('../src/components/ranch/RanchFarmPanel.vue', import.meta.url), 'utf8')
  const bubble = readFileSync(new URL('../src/components/ranch/RanchAnimalBubble.vue', import.meta.url), 'utf8')
  assert.match(panel, /<RanchAnimalBubble/)
  assert.match(bubble, /getBoundingClientRect/)
  assert.match(bubble, /pointerdown/)
  assert.doesNotMatch(bubble, /aria-modal|bg-black/)
})

test('ranch desktop stage is bounded and mobile layout stays single-column', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchSceneList.vue', import.meta.url), 'utf8')
  assert.match(source, /max-width: 1440px/)
  assert.match(source, /margin-inline: auto/)
  assert.match(source, /@media \(max-width: 600px\)/)
  assert.match(source, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.doesNotMatch(source, /repeat\(3,/)
})

test('official ranch background is local and matches its provenance hash', () => {
  const root = new URL('../public/ranch/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'))
  for (const item of manifest.files) {
    const bytes = readFileSync(new URL(item.file, root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256)
  }
})

test('ranch columns align at the top independent of status badges', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchSceneList.vue', import.meta.url), 'utf8')
  assert.match(source, /\.scene-paddocks\s*\{[^}]*align-items: start/s)
  assert.match(source, /\.paddock-status\s*\{[^}]*min-height: 32px/s)
})

test('ranch scene labels are display-only and omit the producing badge', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchSceneList.vue', import.meta.url), 'utf8')
  assert.match(source, /<div class="paddock-label w-full">/)
  assert.doesNotMatch(source, /<button[^>]*paddock-label/)
  assert.doesNotMatch(source, /生产中/)
  assert.match(source, /@animal=/)
})

test('background refresh does not toggle toolbar disabled state when data exists', () => {
  const source = readFileSync(new URL('../src/components/ranch/RanchFarmPanel.vue', import.meta.url), 'utf8')
  assert.match(source, /running.value \|\| store.busy \|\| \(store.loading && !store.data\)/)
})
