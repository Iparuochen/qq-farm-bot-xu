import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import api from '@/api'
import { useAccountStore } from '@/stores/account'
import { createPanelCache, scheduleBackgroundRefresh } from '@/utils/panel-cache'

/**
 * 牧场分区数据的读取与缓存。
 *
 * 每次读 /api/ranch/* 都要临时切进牧场场景，占着账号的场景锁（农场自动化得排队），
 * 所以这里不再定时轮询：切回页面时先用会话缓存里的旧数据渲染，只有过期了才在
 * 渲染之后延迟补一次。手动刷新按钮、切账号、以及写操作之后仍然强制重读。
 */

const RESOURCE_TTL_MS: Record<string, number> = {
  friends: 30_000,
  shop: 30_000,
  profile: 60_000,
  illustrated: 120_000,
  activity: 180_000,
  analytics: 300_000,
}
const defaultTtlMs = 60_000
/** 命中缓存后等一会儿再补刷，别和首屏渲染抢同一个 tick。 */
const revalidateDelayMs = 1500

// 按账号 + 分区共享，切页面回来（组件重新挂载）照样命中。
const panelCache = createPanelCache<any>(defaultTtlMs)

const ttlOf = (page: string) => RESOURCE_TTL_MS[page] ?? defaultTtlMs

/**
 * 牧场写操作会同时改掉背包、货币和库存，所有分区缓存一起作废。
 * 写操作走 store（不走本 composable）的页面靠这个函数保持一致。
 */
export function dropRanchPanelCache(accountId: string) {
  if (accountId)
    panelCache.drop(String(accountId))
}

export function useRanchResource(page: Ref<string>) {
  const account = useAccountStore()
  const data = ref<any>(null)
  const actionResult = ref<any>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const updatedAt = ref(0)
  const stale = ref(true)
  let sequence = 0
  let controller: AbortController | null = null
  const supported = new Set(['friends', 'activity', 'shop', 'illustrated', 'analytics', 'profile'])
  let pendingRefresh: Promise<void> | null = null
  let cancelPending: (() => void) | null = null

  function cancelScheduled() {
    if (cancelPending) {
      cancelPending()
      cancelPending = null
    }
  }

  function applyCache() {
    const accountId = account.currentAccountId
    const cached = accountId ? panelCache.get(accountId, page.value, ttlOf(page.value)) : null
    if (cached) {
      data.value = cached.data
      updatedAt.value = cached.updatedAt
      stale.value = !cached.fresh
      return true
    }
    data.value = null
    updatedAt.value = 0
    stale.value = true
    return false
  }

  /** 手动刷新：无条件重读并绕过后端快照缓存（页面上的「刷新」按钮走这里）。 */
  function refresh(options: { background?: boolean } = {}) {
    if (pendingRefresh)
      return pendingRefresh
    cancelScheduled()
    const pending = performRefresh(!options.background)
    pendingRefresh = pending
    void pending.finally(() => {
      if (pendingRefresh === pending)
        pendingRefresh = null
    })
    return pending
  }

  /** 后台补刷：允许后端用快照缓存直接回（不进场景），只有缓存真的没有/过期才真实读。 */
  function revalidate() {
    if (data.value && !stale.value)
      return pendingRefresh ?? Promise.resolve()
    return refresh({ background: true })
  }

  async function performRefresh(force = false) {
    if (!supported.has(page.value) || !account.currentAccountId || loading.value || busy.value || document.hidden)
      return
    const version = sequence
    const accountId = account.currentAccountId
    const resourcePage = page.value
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true
    error.value = ''
    try {
      const res = await api.get(`/api/ranch/${resourcePage}`, { signal, headers: { 'x-account-id': accountId }, timeout: 120000, params: force ? { refresh: true } : undefined })
      if (!res.data.ok)
        throw new Error(res.data.error || '牧场数据读取失败')
      if (version === sequence) {
        data.value = res.data.data
        updatedAt.value = Date.now()
        stale.value = false
        panelCache.set(accountId, resourcePage, data.value)
      }
    }
    catch (e: any) {
      if (version === sequence && e.code !== 'ERR_CANCELED')
        error.value = e.response?.data?.error || e.message
    }
    finally {
      if (version === sequence)
        loading.value = false
    }
  }

  watch([page, () => account.currentAccountId], () => {
    sequence++
    controller?.abort()
    pendingRefresh = null
    cancelScheduled()
    actionResult.value = null
    error.value = ''
    loading.value = false
    busy.value = false
    const hit = applyCache()
    if (!hit) {
      // 首次进入：允许后端快照缓存直接回（命中毫秒级）；缓存也没有才排队做真实读。
      void refresh({ background: true })
      return
    }
    // 命中缓存：先渲染，过期了再找个空闲时机补一次。
    if (stale.value)
      cancelPending = scheduleBackgroundRefresh(() => void revalidate(), revalidateDelayMs)
  }, { immediate: true, flush: 'sync' })

  const onVisibilityChange = () => {
    if (document.hidden)
      return
    if (stale.value || !data.value)
      void revalidate()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onUnmounted(() => {
    sequence++
    controller?.abort()
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  async function mutate(payload: Record<string, unknown>) {
    if (!account.currentAccountId || busy.value)
      return false
    const version = sequence
    const refreshToWait = pendingRefresh
    busy.value = true
    if (refreshToWait)
      await refreshToWait
    if (version !== sequence)
      return false
    cancelScheduled()
    // 写操作会改动背包、库存和货币，同账号下所有分区都可能过期，直接整片作废。
    panelCache.drop(account.currentAccountId)
    busy.value = true
    actionResult.value = null
    error.value = ''
    let actionError = ''
    try {
      const result = await api.post('/api/ranch/action', payload, { headers: { 'x-account-id': account.currentAccountId }, timeout: 120000 })
      if (!result.data.ok)
        throw new Error(result.data.error || '操作失败')
      if (version === sequence)
        actionResult.value = result.data.data
    }
    catch (e: any) { actionError = e.response?.data?.error || e.message || '操作失败' }
    finally {
      if (version === sequence) {
        busy.value = false
        // 操作回包没带新数据时回读；不带 force——后端在写操作后已刷新快照缓存，命中直接回。
        await refresh({ background: true })
        if (version === sequence && actionError)
          error.value = actionError
      }
    }
    return version === sequence && !actionError
  }

  return { data, result: actionResult, loading, busy, error, updatedAt, stale, refresh, revalidate, mutate }
}
