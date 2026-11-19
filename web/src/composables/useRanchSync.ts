import { onMounted, onUnmounted, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useRanchStore } from '@/stores/ranch'
import { scheduleBackgroundRefresh } from '@/utils/panel-cache'

/**
 * 牧场快照的取数时机。
 *
 * 不再定时轮询：每次 /api/ranch/status 都要进一次牧场场景、把农场自动化挡在场景锁后面。
 * 现在只有「缓存有效期过了」才读——挂载时若缓存已过期，先渲染旧数据、延迟补一次；
 * 切账号、页面重新可见、以及写操作之后仍然立即读。要最新数据点页面上的「刷新」。
 */
const revalidateDelayMs = 1200

export function useRanchSync() {
  const store = useRanchStore()
  const account = useAccountStore()
  let cancelPending: (() => void) | null = null

  function cancelScheduled() {
    if (cancelPending) {
      cancelPending()
      cancelPending = null
    }
  }

  /** 首次进入（还没有数据）立刻读；已有数据但过期则等页面画完再补。 */
  function load() {
    if (document.hidden)
      return
    cancelScheduled()
    if (!store.loaded() || !store.isFresh()) {
      if (!store.loaded()) {
        void store.refresh()
        return
      }
      cancelPending = scheduleBackgroundRefresh(() => {
        cancelPending = null
        if (!document.hidden && store.isStale())
          void store.refresh()
      }, revalidateDelayMs)
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden)
      return
    if (store.isStale())
      void store.refresh()
  }

  watch(() => account.currentAccountId, () => load(), { flush: 'post' })
  onMounted(() => {
    load()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onUnmounted(() => {
    cancelScheduled()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
  return store
}
