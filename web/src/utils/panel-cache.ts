/**
 * 概览面板的会话级缓存。
 *
 * 面板数据（概览 / 个人 / 商城这类只读快照）在协议上每次都要临时切场景或全量重读，
 * 切一次页签就重新拉一次既浪费又不安全：牧场还要排队抢场景锁。这里统一成一个
 * 「按账号 + 分区」的内存缓存，配合 TTL 做 stale-while-revalidate：
 * 命中就立即渲染旧数据，过期了再挑个空闲时机静默补一次，不让用户看到白屏。
 *
 * 只在内存里，刷新页面即失效，不写 localStorage——避免把上一个会话的旧快照当成真数据。
 */

export interface CachedPanel<T = any> {
  data: T
  updatedAt: number
  /** 距上次写入的毫秒数。 */
  ageMs: number
  /** 是否仍在 TTL 内；false 表示可以先用旧数据渲染，但要补刷。 */
  fresh: boolean
}

export function createPanelCache<T = any>(defaultTtlMs = 60_000) {
  const entries = new Map<string, { data: T, updatedAt: number }>()
  const keyOf = (accountId: string, page: string) => `${String(accountId || '')}\u0000${page}`

  return {
    ttl: defaultTtlMs,
    get(accountId: string, page: string, ttlMs = defaultTtlMs): CachedPanel<T> | null {
      if (!accountId)
        return null
      const entry = entries.get(keyOf(accountId, page))
      if (!entry)
        return null
      const ageMs = Date.now() - entry.updatedAt
      return { data: entry.data, updatedAt: entry.updatedAt, ageMs, fresh: ageMs < Math.max(0, ttlMs) }
    },
    set(accountId: string, page: string, data: T) {
      if (!accountId)
        return
      entries.set(keyOf(accountId, page), { data, updatedAt: Date.now() })
    },
    /** 省略 page 时清掉该账号的全部分区（账号内的写操作通常会影响多个分区）。 */
    drop(accountId: string, page?: string) {
      if (!accountId)
        return
      if (page) {
        entries.delete(keyOf(accountId, page))
        return
      }
      const prefix = `${String(accountId)}\u0000`
      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix))
          entries.delete(key)
      }
    },
    clear() {
      entries.clear()
    },
  }
}

/**
 * 把补刷推迟到「不挡渲染」的时候：先让命中缓存的那一帧画出来，再发请求。
 * 页面不可见时直接放弃——回来时 visibilitychange 会再判一次是否过期。
 */
export function scheduleBackgroundRefresh(task: () => void, delayMs = 1500): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  timer = setTimeout(() => {
    timer = null
    if (!document.hidden)
      task()
  }, Math.max(0, delayMs))
  return cancel
}
