/* eslint test/no-import-node-test: off, test/consistent-test-it: off */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/components/ranch/RanchScene.vue', import.meta.url), 'utf8')
test('PC scene keeps drag and gains anchored pinch zoom, no directional toolbar', () => {
  assert.match(source, /panCamera\(camera.value/)
  assert.match(source, /applyZoom\(camera\.value\.halfHeight \* \(lastPinchPair\.distance \/ pair\.distance\)/)
  assert.match(source, /zoomCamera\(\{ \.\.\.camera\.value \}, clamped, anchor/)
  assert.match(source, /pinch|双指/)
  assert.doesNotMatch(source, /world-controls|onMouseWheel/)
  assert.match(source, /const halfHeight = computed/)
})
test('animal click focuses first; subject card opens existing detail handler', () => {
  assert.match(source, /@click="focusAnimal\(entry\)"/)
  assert.match(source, /applyCamera\(entry.point\)/)
  assert.match(source, /@details="openFocusedDetails"/)
  assert.match(source, /emit\('animal', focused.value.ranchId/)
  const card = readFileSync(new URL('../src/components/ranch/RanchOfficialStatus.vue', import.meta.url), 'utf8')
  assert.match(card, /@pointerdown.stop/)
})

test('background is projected through the same world camera, never viewport cover', () => {
  assert.match(source, /project\(\{ x: 0, y: -108.5 \}, camera.value/)
  assert.match(source, /:style="backgroundStyle"/)
  assert.doesNotMatch(source, /center \/ cover/)
})

test('personal scene is compact without extra title or list switch', () => {
  assert.doesNotMatch(source, /列表视图|场景视图|<header/)
  assert.doesNotMatch(source, /48dvh|78vh|height: clamp/)
  assert.match(source, /flex: 1;/)
})

test('farm removes redundant statistics and uses bounded remaining-height layout', () => {
  const panel = readFileSync(new URL('../src/components/ranch/RanchFarmPanel.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /const summary|v-for="stat in summary"/)
  assert.match(panel, /h-full min-h-0 flex flex-col/)
  assert.match(source, /2500 \* height.value \/ width.value/)
})

test('blank scene click dismisses subject status without swallowing subject buttons', () => {
  assert.match(source, /@click="dismissOnBlank"/)
  assert.match(source, /target.closest\('button, .subject-card'\)/)
  assert.match(source, /function dismissOnBlank[\s\S]*?focusedId.value = ''[\s\S]*?emit\('select', ''\)/)
})
