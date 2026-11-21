/* eslint test/no-import-node-test: off, test/consistent-test-it: off */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animalLayout, animalSlot, facilityCenter, project, ranchCamera, yardContains } from '../src/utils/ranch-world.ts'

test('official tile centers and occupied area midpoint', () => {
  assert.deepEqual(facilityCenter({ positionX: 0, positionY: 0, width: 1, height: 1 }), { x: 0, y: 1536 })
  assert.deepEqual(facilityCenter({ positionX: 24, positionY: 24, width: 1, height: 1 }), { x: 0, y: -1536 })
  assert.deepEqual(facilityCenter({ positionX: 2, positionY: 3, width: 3, height: 2 }), { x: -64, y: 1120 })
  for (const bad of [{}, { positionX: 0, positionY: 0, width: 0, height: 1 }, { positionX: 24, positionY: 24, width: 5, height: 5 }, { positionX: 1, positionY: 1, width: 2, height: 2, rotation: 1 }])
    assert.equal(facilityCenter(bad), null)
})
test('camera projects focus to center at mobile and desktop sizes', () => {
  for (const shed of [false, true]) {
    const camera = ranchCamera(shed)
    for (const [w, h] of [[375, 700], [1200, 900]]) {
      const p = project(camera, camera, w!, h!)
      assert.equal(p.x, w! / 2)
      assert.equal(p.y, h! / 2)
    }
  }
})
test('Lloyd layout uses capacity and stable slots rather than current animal count', () => {
  for (const capacity of [1, 3, 5, 10, 20]) {
    const points = animalLayout(capacity)
    assert.equal(points.length, capacity)
    assert.deepEqual(points, animalLayout(capacity))
    for (const point of points) {
      assert.equal(yardContains(point), true)
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y))
    }
    assert.deepEqual(animalSlot(1, capacity), points[0])
    assert.deepEqual(animalSlot(capacity + 1, capacity), points[0])
  }
  assert.equal(animalSlot(1, 0), null)
  assert.equal(animalSlot(Number.NaN, 5), null)
})

test('pan camera follows screen-space direction at each viewport scale', async () => {
  const { panCamera } = await import('../src/utils/ranch-world.ts')
  const camera = { x: 30, y: 40, halfHeight: 1000 }
  assert.deepEqual(panCamera(camera, { x: 10, y: 20 }, 500), { x: -10, y: 120, halfHeight: 1000 })
  assert.deepEqual(panCamera(camera, { x: 10, y: 20 }, 0), camera)
})
test('focal zoom preserves the world point under the pointer', async () => {
  const { zoomCamera } = await import('../src/utils/ranch-world.ts')
  for (const [width, height] of [[375, 700], [1200, 900]]) {
    const camera = { x: 133, y: 90, halfHeight: 1289.6 }
    const world = { x: -200, y: 440 }
    const anchor = project(world, camera, width!, height!)
    const next = zoomCamera(camera, 900, anchor, width!, height!)
    const after = project(world, next, width!, height!)
    assert.ok(Math.abs(anchor.x - after.x) < 1e-9)
    assert.ok(Math.abs(anchor.y - after.y) < 1e-9)
    assert.deepEqual(zoomCamera(camera, 900, anchor, width!, 0), camera)
  }
})
test('pinch pair supports translation, distance, and missing pointers', async () => {
  const { pointerPair } = await import('../src/utils/ranch-world.ts')
  assert.equal(pointerPair([]), null)
  assert.equal(pointerPair([{ x: 1, y: 1 }]), null)
  assert.deepEqual(pointerPair([{ x: 0, y: 0 }, { x: 6, y: 8 }]), { center: { x: 3, y: 4 }, distance: 10 })
})
