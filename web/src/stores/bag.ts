import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api'
import { useAccountStore } from '@/stores/account'

export const useBagStore = defineStore('bag', () => {
  const allItems = ref<any[]>([])
  const originalItems = ref<any[]>([])
  const loading = ref(false)
  const pendingFetches = new Map<string, Promise<void>>()
  /** 每个账号最近一次成功读到背包的时间，供概览页做「切回来不重复拉」的判定。 */
  const fetchedAt = new Map<string, number>()

  function clearBag() {
    allItems.value = []
    originalItems.value = []
    fetchedAt.clear()
  }

  const items = computed(() => {
    const hiddenIds = new Set([1, 1001, 1002, 1101, 1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => !hiddenIds.has(Number(it.id || 0)))
  })

  const dashboardItems = computed(() => {
    const targetIds = new Set([1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => targetIds.has(Number(it.id || 0)))
  })

  /**
   * 读背包。`maxAgeMs` 给了就按缓存判定：该账号在窗口内读到过就不再请求。
   * 不传表示原来的语义（总是读），背包页、操作后的回读都不受影响。
   */
  async function fetchBag(accountId: string, options: { maxAgeMs?: number } = {}) {
    if (!accountId)
      return

    const maxAgeMs = Number(options.maxAgeMs) || 0
    const last = fetchedAt.get(accountId) || 0
    if (maxAgeMs > 0 && last > 0 && Date.now() - last < maxAgeMs)
      return

    const pending = pendingFetches.get(accountId)
    if (pending)
      return pending

    const request = fetchBagOnce(accountId).finally(() => {
      if (pendingFetches.get(accountId) === request)
        pendingFetches.delete(accountId)
      loading.value = pendingFetches.size > 0
    })
    pendingFetches.set(accountId, request)
    loading.value = true
    return request
  }

  async function fetchBagOnce(accountId: string) {
    const requestedId = accountId
    try {
      const res = await api.get('/api/bag', {
        headers: { 'x-account-id': accountId },
      })
      const acc = useAccountStore()
      const curId = String((acc.currentAccountId as { value?: string })?.value ?? acc.currentAccountId ?? '')
      if (curId !== requestedId)
        return
      if (res.data.ok && res.data.data) {
        allItems.value = Array.isArray(res.data.data.items) ? res.data.data.items : []
        originalItems.value = Array.isArray(res.data.data.originalItems) ? res.data.data.originalItems : []
        fetchedAt.set(accountId, Date.now())
      }
      else if (res.data && res.data.ok === false && res.data.error) {
        allItems.value = []
        originalItems.value = []
      }
    }
    catch (e) {
      const acc = useAccountStore()
      const curId = String((acc.currentAccountId as { value?: string })?.value ?? acc.currentAccountId ?? '')
      if (curId === requestedId) {
        allItems.value = []
        originalItems.value = []
      }
      console.error(e)
    }
  }

  async function useItem(accountId: string, itemId: number, count = 1, uid = 0) {
    const res = await api.post('/api/bag/use', { itemId, count, uid }, {
      headers: { 'x-account-id': accountId },
    })
    return res.data
  }

  async function sellItems(accountId: string, items: Array<{ id: number, count: number, uid?: number }>) {
    const res = await api.post('/api/bag/sell', { items }, {
      headers: { 'x-account-id': accountId },
    })
    return res.data
  }

  async function setItemsLocked(accountId: string, itemUids: number[], locked: boolean) {
    const res = await api.post('/api/bag/lock', { itemUids, locked }, {
      headers: { 'x-account-id': accountId },
    })
    return res.data
  }

  return { items, allItems, originalItems, dashboardItems, loading, fetchBag, clearBag, useItem, sellItems, setItemsLocked }
})
