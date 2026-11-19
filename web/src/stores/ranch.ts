import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import api from '@/api'
import { dropRanchPanelCache } from '@/composables/useRanchResource'
import { useAccountStore } from './account'

/**
 * 牧场状态快照（/api/ranch/status）。
 *
 * 这份快照要打 AllCells + GetRanchDetail + GetBag + GetBagTab + GetOrderPanel + 任务，
 * 而且必须先进牧场场景，所以不能每次切页面都重读：store 常驻保留最近一份，
 * 60s 内直接复用，过期后由调用方决定是立刻读还是等空闲再补（见 useRanchSync）。
 */

const ttlMs = 60_000

export const useRanchStore = defineStore('ranch', () => {
  const account = useAccountStore()
  const data = ref<any>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const updatedAt = ref(0)
  let generation = 0
  let controller: AbortController | null = null

  const loaded = () => !!data.value
  // 用函数而不是 computed：时间流逝本身不会触发依赖更新，computed 会把旧结论一直缓存住。
  const isFresh = () => !!data.value && Date.now() - updatedAt.value < ttlMs
  const isStale = () => !isFresh()

  watch(() => account.currentAccountId, () => {
    generation++
    controller?.abort()
    data.value = null
    updatedAt.value = 0
    error.value = ''
    loading.value = false
    busy.value = false
  }, { flush: 'sync' })

  async function refresh(options: { force?: boolean } = {}) {
    if (!account.currentAccountId || loading.value || busy.value)
      return
    // 缓存还有效时直接复用，避免切回页面就重新进一次牧场场景。
    if (!options.force && isFresh())
      return
    const version = generation
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      // force（手动刷新）带 ?refresh=true 让后端绕过面板快照缓存走真实场景读；
      // 普通补刷不带——后端缓存命中时毫秒级返回，不进场景、不排队。
      const res = await api.get('/api/ranch/status', {
        timeout: 120000,
        signal: controller.signal,
        headers: { 'x-account-id': account.currentAccountId },
        params: options.force ? { refresh: true } : undefined,
      })
      if (!res.data.ok)
        throw new Error(res.data.error || '牧场读取失败')
      if (version === generation) {
        data.value = res.data.data
        updatedAt.value = Date.now()
      }
    }
    catch (e: any) {
      if (version === generation && e.code !== 'ERR_CANCELED')
        error.value = e.response?.data?.error || e.message || '牧场读取失败'
    }
    finally {
      if (version === generation)
        loading.value = false
    }
  }

  async function mutate(path: string, payload: any) {
    if (!account.currentAccountId || busy.value || loading.value)
      return
    const version = generation
    let actionError = ''
    let snapshotApplied = false
    busy.value = true
    error.value = ''
    try {
      const res = await api.post(path, payload, { timeout: 120000, headers: { 'x-account-id': account.currentAccountId } })
      if (!res.data.ok)
        throw new Error(res.data.error || '操作失败')
      if (version === generation && res.data.data?.status) {
        data.value = res.data.data.status
        updatedAt.value = Date.now()
        snapshotApplied = true
      }
      if (version === generation && account.currentAccountId)
        dropRanchPanelCache(String(account.currentAccountId))
    }
    catch (e: any) {
      actionError = e.response?.data?.error || e.message || '操作失败'
    }
    finally {
      if (version === generation) {
        busy.value = false
        // 回包里带了新快照就直接用；没带才回读，避免操作后多进一次牧场场景。
        if (!snapshotApplied)
          await refresh({ force: true })
        if (version === generation && actionError)
          error.value = actionError
      }
    }
  }

  return { data, loading, busy, error, updatedAt, loaded, isFresh, isStale, refresh, mutate }
})
