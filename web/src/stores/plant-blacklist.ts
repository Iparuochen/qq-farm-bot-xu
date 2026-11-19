import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api'
import { useAccountStore } from './account'

export interface PlantBlacklistItem {
  seedId: number
  name: string
}

export type PlantListMode = 'blacklist' | 'whitelist'

/**
 * 偷菜名单：白名单（只偷名单内）/ 黑名单（排除名单内）共用一套勾选交互，
 * 具体语义由 plantFilterMode 决定。
 */
export const usePlantBlacklistStore = defineStore('plant-blacklist', () => {
  const blacklist = ref<number[]>([])
  const whitelist = ref<number[]>([])
  const mode = ref<PlantListMode>('blacklist')
  const loading = ref(false)
  let fetchRequestId = 0

  /** 当前模式下生效的名单 */
  const activeList = computed<number[]>(() => (mode.value === 'whitelist' ? whitelist.value : blacklist.value))
  const isWhitelistMode = computed(() => mode.value === 'whitelist')

  function clearBlacklistData() {
    blacklist.value = []
    whitelist.value = []
    mode.value = 'blacklist'
    loading.value = false
  }

  function isCurrentAccount(accountId: string) {
    const accountStore = useAccountStore()
    const currentId = String((accountStore.currentAccountId as { value?: string })?.value ?? accountStore.currentAccountId ?? '')
    return currentId === String(accountId)
  }

  function listPath(m: PlantListMode) {
    return m === 'whitelist' ? '/api/plant-whitelist' : '/api/plant-blacklist'
  }

  function applyList(m: PlantListMode, data: number[]) {
    if (m === 'whitelist')
      whitelist.value = data || []
    else
      blacklist.value = data || []
  }

  async function fetchBlacklist() {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId)
      return
    const requestedId = String(accountId)
    const requestId = ++fetchRequestId
    loading.value = true
    try {
      const headers = { 'x-account-id': accountId }
      const [bRes, wRes, mRes] = await Promise.all([
        api.get('/api/plant-blacklist', { headers }),
        api.get('/api/plant-whitelist', { headers }),
        api.get('/api/plant-filter-mode', { headers }),
      ])
      if (requestId !== fetchRequestId || !isCurrentAccount(requestedId))
        return
      if (bRes.data.ok)
        blacklist.value = bRes.data.data || []
      if (wRes.data.ok)
        whitelist.value = wRes.data.data || []
      if (mRes.data.ok)
        mode.value = mRes.data.data === 'whitelist' ? 'whitelist' : 'blacklist'
    }
    catch { /* ignore */ }
    finally {
      if (requestId === fetchRequestId)
        loading.value = false
    }
  }

  async function addToList(seedId: number) {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId)
      return
    const requestedId = String(accountId)
    const m = mode.value
    const res = await api.post(listPath(m), { seedId }, {
      headers: { 'x-account-id': accountId },
    })
    if (isCurrentAccount(requestedId) && res.data.ok)
      applyList(m, res.data.data)
  }

  async function removeFromList(seedId: number) {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId)
      return
    const requestedId = String(accountId)
    const m = mode.value
    const res = await api.delete(`${listPath(m)}/${seedId}`, {
      headers: { 'x-account-id': accountId },
    })
    if (isCurrentAccount(requestedId) && res.data.ok)
      applyList(m, res.data.data)
  }

  async function toggleBlacklist(seedId: number) {
    if (activeList.value.includes(seedId))
      await removeFromList(seedId)
    else
      await addToList(seedId)
  }

  /** 是否在当前生效名单内 */
  function isBlacklisted(seedId: number) {
    return activeList.value.includes(seedId)
  }

  async function addAllToBlacklist(seedIds: number[]) {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId)
      return
    const requestedId = String(accountId)
    const m = mode.value
    const res = await api.post(`${listPath(m)}/batch`, { seedIds }, {
      headers: { 'x-account-id': accountId },
    })
    if (isCurrentAccount(requestedId) && res.data.ok)
      applyList(m, res.data.data)
  }

  async function clearBlacklist() {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId)
      return
    const requestedId = String(accountId)
    const m = mode.value
    const res = await api.delete(listPath(m), {
      headers: { 'x-account-id': accountId },
    })
    if (isCurrentAccount(requestedId) && res.data.ok)
      applyList(m, [])
  }

  async function setMode(next: PlantListMode) {
    const accountStore = useAccountStore()
    const accountId = accountStore.currentAccountId
    if (!accountId) {
      mode.value = next
      return
    }
    const requestedId = String(accountId)
    const res = await api.post('/api/plant-filter-mode', { mode: next }, {
      headers: { 'x-account-id': accountId },
    })
    if (isCurrentAccount(requestedId) && res.data.ok)
      mode.value = res.data.data === 'whitelist' ? 'whitelist' : 'blacklist'
  }

  return {
    blacklist,
    whitelist,
    mode,
    activeList,
    isWhitelistMode,
    loading,
    clearBlacklistData,
    fetchBlacklist,
    addToList,
    removeFromList,
    toggleBlacklist,
    isBlacklisted,
    addAllToBlacklist,
    clearBlacklist,
    setMode,
  }
})
