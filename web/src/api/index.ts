import { useStorage } from '@vueuse/core'
import axios from 'axios'
import { useToastStore } from '@/stores/toast'
import { responseErrorMessage } from '@/utils/api-error'

const tokenRef = useStorage('admin_token', '')
const accountIdRef = useStorage('current_account_id', '')

const api = axios.create({
  baseURL: '/',
  timeout: 20000,
})

// ===== 读请求去抖合并 =====
// 同 key（method+url+账号+参数）短时间内重复触发时，只保留最后一次发出：
// 前面的待发请求直接取消，在途请求被 abort，避免网关被连续重复读打爆。
// 仅对 GET 生效；写请求与显式 skipDebounce / debounce:false 的请求不防抖。
const READ_DEBOUNCE_MS = 180
const READ_DEBOUNCE_MAX_MS = 700

interface DebounceEntry {
  controller: AbortController
  timer: ReturnType<typeof setTimeout> | null
  firstTriggerAt: number
  dispatched: boolean
  config: any
  resolve: (config: any) => void
  reject: (err: unknown) => void
}

const pendingReads = new Map<string, DebounceEntry>()

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    const parts: string[] = []
    value.forEach((v, k) => parts.push(`${k}=${typeof v === 'string' ? v : '[blob]'}`))
    return parts.sort().join('&')
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function buildReadKey(config: any): string {
  const method = String(config.method || 'get').toLowerCase()
  const url = config.url || ''
  const accountId = String(config.headers?.['x-account-id'] || '')
  const params = stableStringify(config.params)
  const data = config.data ? stableStringify(config.data) : ''
  return `${method}|${url}|${accountId}|${params}|${data}`
}

function debounceCancelError() {
  return Object.assign(new Error('duplicate read request coalesced'), { code: 'ERR_CANCELED', _debounced: true })
}

function cleanupReadEntry(config: any) {
  const key = config?._readKey
  if (!key) return
  const entry = pendingReads.get(key)
  // 只清理属于自己的 entry，避免误删后续新建的同 key entry
  if (entry && entry.config === config) pendingReads.delete(key)
}

/** 供调用方判断：该错误是否为读请求去抖合并产生的取消（通常应静默忽略） */
export function isDebounceCanceled(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as any).code === 'ERR_CANCELED' && (error as any)._debounced === true
}

let lastNetworkToastAt = 0
function showNetworkToast(message: string) {
  const now = Date.now()
  if (now - lastNetworkToastAt < 5000)
    return
  lastNetworkToastAt = now
  useToastStore().error(message)
}

api.interceptors.request.use((config) => {
  const token = tokenRef.value
  if (token) {
    config.headers['x-admin-token'] = token
  }
  const accountId = accountIdRef.value
  if (accountId && !config.headers['x-account-id']) {
    config.headers['x-account-id'] = accountId
  }

  // 读请求去抖：同 key 短时间内只保留最后一次发出（trailing），前面的取消/abort
  const method = String(config.method || 'get').toLowerCase()
  const skipDebounce = (config as any).skipDebounce === true || (config as any).debounce === false
  if (method !== 'get' || skipDebounce) return config

  const key = buildReadKey(config)
  const existing = pendingReads.get(key)
  if (existing) {
    if (existing.timer) { clearTimeout(existing.timer); existing.timer = null }
    existing.controller.abort()
    if (!existing.dispatched) existing.reject(debounceCancelError())
    pendingReads.delete(key)
  }

  ;(config as any)._readKey = key
  const controller = new AbortController()
  config.signal = controller.signal

  return new Promise<any>((resolve, reject) => {
    const now = Date.now()
    const firstTriggerAt = existing && !existing.dispatched ? existing.firstTriggerAt : now
    const entry: DebounceEntry = {
      controller,
      timer: null,
      firstTriggerAt,
      dispatched: false,
      config,
      resolve,
      reject,
    }
    pendingReads.set(key, entry)
    const elapsed = now - firstTriggerAt
    const delay = Math.max(0, Math.min(READ_DEBOUNCE_MS, READ_DEBOUNCE_MAX_MS - elapsed))
    entry.timer = setTimeout(() => {
      entry.timer = null
      entry.dispatched = true
      resolve(config)
    }, delay)
  })
}, error => Promise.reject(error))

api.interceptors.response.use((response) => {
  cleanupReadEntry(response.config)
  return response
}, (error) => {
  cleanupReadEntry(error?.config)
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
    return Promise.reject(error)
  }
  if (error?.config?.skipErrorToast === true)
    return Promise.reject(error)

  const toast = useToastStore()

  if (error.response) {
    if (error.response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        tokenRef.value = ''
        window.location.href = '/login'
        toast.warning('登录已过期，请重新登录')
      }
    }
    else if (error.response.status >= 500) {
      const backendError = String(error.response.data?.error || error.response.data?.message || '')
      if (backendError === '账号未运行' || backendError === 'API Timeout' || backendError === 'Request Timeout') {
        return Promise.reject(error)
      }
      toast.error(responseErrorMessage(error))
    }
    else {
      toast.error(responseErrorMessage(error))
    }
  }
  else if (error.request) {
    if (error.code === 'ECONNABORTED') {
      showNetworkToast('请求超时，请稍后重试')
    }
    else {
      showNetworkToast('网络错误，无法连接到服务器')
    }
  }
  else {
    toast.error(`错误: ${error.message}`)
  }

  return Promise.reject(error)
})

export default api
