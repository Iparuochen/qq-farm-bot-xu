import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import api from '../src/api/index'
import { useAccountStore } from '../src/stores/account'
import { useRanchStore } from '../src/stores/ranch'
import { useSceneStore } from '../src/stores/scene'

function setup() {
  setActivePinia(createPinia())
  const account = useAccountStore()
  account.currentAccountId = 'a'
  return { account, ranch: useRanchStore(), scene: useSceneStore() }
}
const response = (config: any, data: any) => ({ config, data, status: 200, statusText: 'OK', headers: {} })

test('Web scene selection is account scoped and makes no request', () => {
  const { account, scene } = setup()
  api.defaults.adapter = () => { throw new Error('unexpected request') }
  scene.select('ranch')
  account.currentAccountId = 'b'
  assert.equal(scene.scene, 'farm')
  account.currentAccountId = 'a'
  assert.equal(scene.scene, 'ranch')
})

test('refresh deduplicates and account change drops late responses', async () => {
  const { account, ranch } = setup()
  let calls = 0
  let resolve!: (value: any) => void
  api.defaults.adapter = config => {
    calls++
    return new Promise(done => { resolve = data => done(response(config, data)) })
  }
  const pending = ranch.refresh()
  await new Promise(done => setTimeout(done, 0))
  await ranch.refresh()
  assert.equal(calls, 1)
  account.currentAccountId = 'b'
  resolve({ ok: true, data: { sceneReady: true } })
  await pending
  assert.equal(ranch.data, null)
  assert.equal(ranch.loading, false)
})

test('mutation rejects duplicate execution and preserves backend refusal after refresh', async () => {
  const { ranch } = setup()
  let actions = 0
  api.defaults.adapter = async config => {
    if (config.method === 'post') {
      actions++
      return response(config, { ok: false, error: '资源不足' })
    }
    return response(config, { ok: true, data: { sceneReady: true } })
  }
  await Promise.all([ranch.mutate('/api/ranch/action', { action: 'collect', ranchId: '1' }), ranch.mutate('/api/ranch/action', {})])
  assert.equal(actions, 1)
  assert.equal(ranch.error, '资源不足')
  assert.equal(ranch.busy, false)
})

test('feed quantity accepts only positive safe integers', async () => {
  const { positiveRanchCount } = await import('../src/utils/ranch-input')
  for (const value of ['', 0, -1, 1.5, 'abc', Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(positiveRanchCount(value), null)
  assert.equal(positiveRanchCount('2'), 2)
})

test('ranch navigation follows farm page hierarchy and nests internal tools', async () => {
  const { ranchMenu, ranchSection } = await import('../src/router/ranch-menu')
  assert.deepEqual(ranchMenu.filter(item => !item.adminOnly).map(item => item.label), ['概览', '个人', '好友', '活动', '商城', '图鉴', '分析', '设置'])
  assert.deepEqual(ranchMenu.filter(item => item.adminOnly).map(item => item.label), ['后台'])
  assert.equal(ranchSection('personal', ''), 'warehouse')
  assert.equal(ranchSection('personal', 'buildings'), 'buildings')
  assert.equal(ranchSection('overview', 'orders'), 'orders')
  assert.equal(ranchMenu.some(item => /warehouse|buildings|orders/.test(item.path)), false)
})

test('API failures preserve backend reasons and identify missing ranch routes', async () => {
  const { responseErrorMessage } = await import('../src/utils/api-error')
  assert.equal(responseErrorMessage({ response: { status: 409, data: { error: '请先连接牧场' } } }), '请先连接牧场')
  assert.equal(responseErrorMessage({ response: { status: 404, data: '<html>Not Found</html>' }, config: { method: 'get', url: '/api/ranch/shop' } }), '接口不存在（404）：GET /api/ranch/shop')
})

test('ranch display preserves instance items and scene-isolates legacy and shared logs', async () => {
  const { filterRanchItems, ranchLogBelongs, ranchDate } = await import('../src/utils/ranch-display')
  const items = [{ id: '1', uid: 'a', name: '鸡', tabIds: [6] }, { id: '1', uid: 'b', name: '鸡', tabIds: [6] }, { id: '2', name: '草', tabIds: [7] }]
  assert.equal(filterRanchItems(items, '6', '鸡').length, 2)
  assert.equal(filterRanchItems(items, '7', '鸡').length, 0)
  assert.equal(ranchLogBelongs({ module: 'ranch', source: 'business', meta: {} }, 'ranch'), true)
  assert.equal(ranchLogBelongs({ module: 'ranch', source: 'business', meta: {} }, 'farm'), false)
  assert.equal(ranchLogBelongs({ module: 'friend', source: 'business', meta: {} }, 'farm'), true)
  assert.equal(ranchLogBelongs({ module: 'friend', source: 'business', meta: { scene: 'ranch' } }, 'farm'), false)
  assert.equal(ranchLogBelongs({ module: 'system', source: 'system', meta: {} }, 'ranch'), true)
  assert.equal(ranchDate(null), '—')
  assert.match(ranchDate(Date.UTC(2026, 10, 15, 16, 0, 0)), /2026\/11\/16 00:00:00/)
})

test('ranch business failures keep error level even when business tag is ranch', async () => {
  const { normalizeRuntimeLog } = await import('../src/utils/runtime-log')
  assert.equal(normalizeRuntimeLog({ tag: '牧场', msg: '库存不足', meta: { module: 'ranch', result: 'error' } }).level, 'error')
})

test('actions preempt background refresh without accepting stale results or duplicate actions', async () => {
  const { ranch } = setup()
  ranch.data = { sceneReady: true, marker: 'cached' }
  let finishRead!: () => void
  let finishAction!: () => void
  let reads = 0
  let actions = 0
  api.defaults.adapter = config => {
    if (config.method === 'post') {
      actions++
      return new Promise(done => { finishAction = () => done(response(config, { ok: true })) })
    }
    reads++
    if (reads === 1)
      return new Promise(done => { finishRead = () => done(response(config, { ok: true, data: { marker: 'stale' } })) })
    return Promise.resolve(response(config, { ok: true, data: { sceneReady: true, marker: 'fresh' } }))
  }
  const read = ranch.refresh()
  await new Promise(done => setTimeout(done, 0))
  assert.equal(ranch.loading, true)
  const action = ranch.mutate('/api/ranch/action', { action: 'collect' })
  assert.equal(ranch.busy, true)
  assert.equal(ranch.loading, false)
  await ranch.mutate('/api/ranch/action', { action: 'collect' })
  assert.equal(actions, 1)
  finishRead()
  await read
  assert.equal(ranch.data.marker, 'cached')
  finishAction()
  await action
  assert.equal(ranch.data.marker, 'fresh')
  assert.equal(ranch.busy, false)
})
