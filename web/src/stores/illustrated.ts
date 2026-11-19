import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'
import { useAccountStore } from '@/stores/account'

export interface IllustratedItem {
  seedId: number
  illustratedTier?: number
  name: string
  image?: string
  level: number
  layer?: number
  unlocked: boolean
  plantedCount?: number
  harvestCount?: number
  wishProgress?: {
    type: number
    current: number
    total: number
  } | null
  canBuy?: boolean
  goodsId?: number
  price?: number
}

export interface IllustratedSummary {
  total: number
  unlocked: number
  locked: number
  canBuy: number
}

export const useIllustratedStore = defineStore('illustrated', () => {
  const items = ref<IllustratedItem[]>([])
  const summary = ref<IllustratedSummary>({
    total: 0,
    unlocked: 0,
    locked: 0,
    canBuy: 0,
  })
  const userLevel = ref(0)
  const loading = ref(false)
  const buying = ref(false)
  const error = ref('')
  let fetchRequestId = 0

  /** 概览卡只要一个等级数字，单独缓存，避免每次切回概览页都打两次图鉴接口。 */
  const levels = ref({ crop: 0, mutant: 0 })
  const levelsUpdatedAt = ref(0)
  /** 等级缓存属于哪个账号：切账号后即使时间窗口没到也不能沿用。 */
  const levelsAccountId = ref('')
  let levelsRequestId = 0

  function clearIllustratedData() {
    items.value = []
    summary.value = {
      total: 0,
      unlocked: 0,
      locked: 0,
      canBuy: 0,
    }
    userLevel.value = 0
    loading.value = false
    buying.value = false
    error.value = ''
    levels.value = { crop: 0, mutant: 0 }
    levelsUpdatedAt.value = 0
    levelsAccountId.value = ''
  }

  function isCurrentAccount(accountId: string) {
    const accountStore = useAccountStore()
    const currentId = String((accountStore.currentAccountId as { value?: string })?.value ?? accountStore.currentAccountId ?? '')
    return currentId === String(accountId)
  }

  async function fetchList(accountId: string, refresh = false, illustratedType = 1) {
    if (!accountId)
      return
    const requestedId = String(accountId)
    const requestId = ++fetchRequestId
    loading.value = true
    error.value = ''
    try {
      const { data } = await api.get('/api/illustrated', {
        params: { refresh, illustrated_type: illustratedType },
        headers: { 'x-account-id': accountId },
      })
      if (requestId !== fetchRequestId || !isCurrentAccount(requestedId))
        return
      if (data.ok) {
        // 图鉴按所需等级升序展示，同等级按种子 ID 稳定排序
        items.value = (data.data?.items || []).slice().sort(
          (a: IllustratedItem, b: IllustratedItem) =>
            (Number(a.level) || 0) - (Number(b.level) || 0)
            || (Number(a.seedId) || 0) - (Number(b.seedId) || 0),
        )
        summary.value = data.data?.summary || summary.value
        userLevel.value = data.data?.userLevel || 0
      }
      else {
        error.value = data.error || '获取图鉴失败'
      }
    }
    catch (err: any) {
      if (requestId === fetchRequestId && isCurrentAccount(requestedId))
        error.value = err.message || '获取图鉴失败'
    }
    finally {
      if (requestId === fetchRequestId)
        loading.value = false
    }
  }

  /**
   * 读图鉴等级（概览卡片用）。
   * `maxAgeMs` 给了就按缓存判定：同一账号窗口内读到过就不再请求。
   */
  async function fetchLevels(accountId: string, options: { maxAgeMs?: number, force?: boolean } = {}) {
    if (!accountId)
      return
    const requestedId = String(accountId)
    const maxAgeMs = Number(options.maxAgeMs) || 0
    const cached = !options.force && maxAgeMs > 0 && levelsUpdatedAt.value > 0
      && levelsAccountId.value === requestedId
      && Date.now() - levelsUpdatedAt.value < maxAgeMs
      && (levels.value.crop || levels.value.mutant)
    if (cached)
      return
    const requestId = ++levelsRequestId
    const headers = { 'x-account-id': requestedId }
    try {
      const [crop, mutant] = await Promise.all([
        api.get('/api/illustrated', { params: { illustrated_type: 1 }, headers }),
        api.get('/api/illustrated', { params: { illustrated_type: 2 }, headers }),
      ])
      if (requestId !== levelsRequestId || !isCurrentAccount(requestedId))
        return
      levels.value = {
        crop: Number(crop.data?.data?.level) || 0,
        mutant: Number(mutant.data?.data?.level) || 0,
      }
      levelsUpdatedAt.value = Date.now()
      levelsAccountId.value = requestedId
    }
    catch {
      if (requestId === levelsRequestId && isCurrentAccount(requestedId) && levelsAccountId.value !== requestedId)
        levels.value = { crop: 0, mutant: 0 }
    }
  }

  async function buySeed(accountId: string, goodsId: number, price: number) {
    buying.value = true
    try {
      const { data } = await api.post('/api/illustrated/buy', {
        goodsId,
        price,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return data
    }
    finally {
      buying.value = false
    }
  }

  async function buyAllSeeds(accountId: string, illustratedType = 1) {
    buying.value = true
    try {
      const { data } = await api.post('/api/illustrated/buy-all', {
        illustrated_type: illustratedType,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return data
    }
    finally {
      buying.value = false
    }
  }

  return {
    items,
    summary,
    userLevel,
    levels,
    levelsUpdatedAt,
    loading,
    buying,
    error,
    clearIllustratedData,
    fetchList,
    fetchLevels,
    buySeed,
    buyAllSeeds,
  }
})
