<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useAccountStore } from '@/stores/account'
import {
  allowUnknownLevel,
  cancelled,
  delayMs,
  minLevel,
  poolDailyLimit,
  progress,
  rawText,
  results,
  running,
  selectedAccountIds,
} from '@/stores/friend-import'
import { useToastStore } from '@/stores/toast'

interface InviteItem {
  uid: string
  openid: string
  shareSource: string
  shareKey: string
}

interface PoolEntry {
  uid: string
  openid?: string
  name?: string
  level?: number | null
  status: 'new' | 'pending' | 'friend' | 'dead' | string
  shareKey?: string
  shareSource?: string
  docId?: string
  cardTime?: string
  lastApplyAt?: number | null
  hoursSinceApply?: number | null
  applyCount?: number
  deadReason?: string
}

// 单次请求条数：worker 内每条间隔默认 2s，10 条约 20s，避免 HTTP 超时
const CHUNK_SIZE = 10
// 号池导入单次条数：主进程 express.json 限 256kb，200 条约 30kb，远低于上限
const POOL_IMPORT_CHUNK_SIZE = 200

const accountStore = useAccountStore()
const toast = useToastStore()

const delayOptions = [
  { label: '1 秒', value: 1000 },
  { label: '2 秒（推荐）', value: 2000 },
  { label: '3 秒', value: 3000 },
  { label: '5 秒', value: 5000 },
]

const wxAccounts = computed(() =>
  accountStore.visibleAccounts.filter(acc => ['wx', 'wechat'].includes(String(acc.platform || '').toLowerCase())),
)

function cleanLine(line: string) {
  return line
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .trim()
}

/** 支持三种粘贴形式：完整 URL / `?uid=..&..` / 纯参数串 */
function parseLine(line: string): InviteItem | null {
  const text = cleanLine(line)
  if (!text)
    return null
  const queryIndex = text.indexOf('?')
  const query = queryIndex >= 0 ? text.slice(queryIndex + 1) : text
  if (!query.includes('uid=') || !query.includes('openid='))
    return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(query)
  }
  catch {
    return null
  }
  const uid = (params.get('uid') || '').trim()
  const openid = (params.get('openid') || '').trim()
  if (!uid || !openid)
    return null
  return {
    uid,
    openid,
    shareSource: (params.get('share_source') || '').trim(),
    shareKey: (params.get('share_key') || '').trim(),
  }
}

const parseSummary = computed(() => {
  const seen = new Set<string>()
  const items: InviteItem[] = []
  let invalid = 0
  let duplicated = 0

  for (const line of rawText.value.split(/\r?\n/)) {
    if (!cleanLine(line))
      continue
    const item = parseLine(line)
    if (!item) {
      invalid++
      continue
    }
    if (seen.has(item.uid)) {
      duplicated++
      continue
    }
    seen.add(item.uid)
    items.push(item)
  }
  return { items, invalid, duplicated }
})

const parsedItems = computed(() => parseSummary.value.items)

const itemsWithoutKey = computed(() => parsedItems.value.filter(item => !item.shareKey).length)

const summary = computed(() => ({
  success: results.value.filter(r => r.ok).length,
  skipped: results.value.filter(r => r.skipped).length,
  existing: results.value.filter(r => r.existing).length,
  poolSkipped: results.value.filter(r => r.poolSkipped).length,
  failed: results.value.filter(r => !r.ok && !r.skipped).length,
}))

// ===== 好友号池 =====
const poolSummary = ref({ total: 0, new: 0, pending: 0, friend: 0, dead: 0 })
const poolEntries = ref<PoolEntry[]>([])
const poolLoading = ref(false)
const poolError = ref('')
const poolOpen = ref(false)
const poolFilter = ref<'all' | 'dead' | 'pending' | 'friend'>('all')

/** 号池按账号隔离：优先用本次勾选的第一个账号，否则用当前账号 */
const poolAccountId = computed(() => {
  if (selectedAccountIds.value.length > 0)
    return selectedAccountIds.value[0]
  if (accountStore.currentAccountId)
    return String(accountStore.currentAccountId)
  return wxAccounts.value[0] ? String(wxAccounts.value[0].id) : ''
})

const filteredPoolEntries = computed(() => {
  if (poolFilter.value === 'all')
    return poolEntries.value
  return poolEntries.value.filter(item => item.status === poolFilter.value)
})

/** 号池里当前账号还没申请过的条目：不粘贴链接也能直接发起 */
const poolQueueItems = computed<InviteItem[]>(() =>
  poolEntries.value
    .filter(item => item.status === 'new' && item.uid && item.openid)
    .map(item => ({
      uid: String(item.uid),
      openid: String(item.openid || ''),
      shareSource: String(item.shareSource || ''),
      shareKey: String(item.shareKey || ''),
    })),
)

/** 本次执行的条目：粘贴优先；没粘贴就用号池里未申请的 */
const queueItems = computed<InviteItem[]>(() =>
  parsedItems.value.length > 0 ? parsedItems.value : poolQueueItems.value,
)
const usingPoolQueue = computed(() => parsedItems.value.length === 0 && poolQueueItems.value.length > 0)

const poolTabs = computed<Array<{ key: 'all' | 'pending' | 'friend' | 'dead', label: string, count: number, cls: string }>>(() => [
  { key: 'all', label: '全部', count: poolSummary.value.total, cls: 'text-gray-600 dark:text-gray-300' },
  { key: 'pending', label: '待通过', count: poolSummary.value.pending, cls: 'text-amber-600 dark:text-amber-400' },
  { key: 'friend', label: '已成好友', count: poolSummary.value.friend, cls: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'dead', label: '不可加', count: poolSummary.value.dead, cls: 'text-red-600 dark:text-red-400' },
])

function togglePool() {
  poolOpen.value = !poolOpen.value
  if (poolOpen.value)
    fetchPool()
}

function formatPoolTime(ts?: number | null) {
  if (!ts)
    return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function poolStatusText(status: string) {
  if (status === 'friend')
    return '已成好友'
  if (status === 'dead')
    return '不可加'
  if (status === 'pending')
    return '待通过'
  return '未申请'
}

function poolStatusClass(status: string) {
  if (status === 'friend')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (status === 'dead')
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (status === 'pending')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

async function fetchPool() {
  const accountId = poolAccountId.value
  if (!accountId || poolLoading.value)
    return
  poolLoading.value = true
  poolError.value = ''
  try {
    const res = await api.get('/api/friends/pool', {
      headers: { 'x-account-id': accountId },
      skipErrorToast: true,
    } as any)
    const data = res.data?.data || {}
    poolSummary.value = data.summary || { total: 0, new: 0, pending: 0, friend: 0, dead: 0 }
    poolEntries.value = Array.isArray(data.entries) ? data.entries : []
    const limit = data.dailyLimit || {}
    poolDailyLimit.value = {
      blocked: limit.blocked === true,
      dateKey: String(limit.dateKey || ''),
      at: limit.at == null ? null : Number(limit.at),
    }
  }
  catch (error: any) {
    poolError.value = error?.response?.data?.error || error?.message || '读取号池失败'
  }
  finally {
    poolLoading.value = false
  }
}

/**
 * 号池导出：一行一条 `?uid=..&openid=..&share_source=..&doc_id=..&share_key=..`
 * 与「粘贴添加好友」支持的格式完全一致，导出的文件可以直接粘回去用
 */
function buildPoolExportText() {
  return poolEntries.value
    .filter(item => item.uid && item.openid)
    .map((item) => {
      const params = new URLSearchParams()
      params.set('uid', String(item.uid))
      params.set('openid', String(item.openid))
      if (item.shareSource)
        params.set('share_source', String(item.shareSource))
      if (item.docId)
        params.set('doc_id', String(item.docId))
      if (item.shareKey)
        params.set('share_key', String(item.shareKey))
      return `?${params.toString()}`
    })
    .join('\n')
}

async function exportPool() {
  // 先刷新一次，避免导出上次打开面板时的旧数据
  await fetchPool()
  const text = buildPoolExportText()
  const count = text ? text.split('\n').length : 0
  if (count === 0) {
    toast.error('号池里没有可导出的链接（缺 uid / openid 的条目会被跳过）')
    return
  }
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const blob = new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `friend-pool-${stamp}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success(`已导出 ${count} 条链接，格式与粘贴添加好友一致`)
}

async function resetPoolEntry(uid: string) {
  const accountId = poolAccountId.value
  if (!accountId)
    return
  try {
    const res = await api.post('/api/friends/pool/reset', { uid }, {
      headers: { 'x-account-id': accountId },
      skipErrorToast: true,
    } as any)
    const data = res.data?.data || {}
    if (data.summary)
      poolSummary.value = data.summary
    if (Array.isArray(data.entries))
      poolEntries.value = data.entries
    toast.success(`已恢复 uid=${uid}，下次可以重新申请`)
  }
  catch (error: any) {
    toast.error(error?.response?.data?.error || error?.message || '恢复失败')
  }
}

async function removePoolEntry(uid: string) {
  const accountId = poolAccountId.value
  if (!accountId)
    return
  // 号池链接是全账号共享的，删除会从所有账号的号池里移除
  if (typeof window !== 'undefined' && !window.confirm(`从共享号池删除 uid=${uid}？删除后所有账号都不再使用这条链接。`))
    return
  try {
    const res = await api.post('/api/friends/pool/remove', { uid }, {
      headers: { 'x-account-id': accountId },
      skipErrorToast: true,
    } as any)
    const data = res.data?.data || {}
    if (data.summary)
      poolSummary.value = data.summary
    if (Array.isArray(data.entries))
      poolEntries.value = data.entries
  }
  catch (error: any) {
    toast.error(error?.response?.data?.error || error?.message || '删除失败')
  }
}

const progressPercent = computed(() => {
  if (progress.value.total <= 0)
    return 0
  return Math.min(100, Math.round((progress.value.done / progress.value.total) * 100))
})

/** 执行账号为单选：点击即选中该账号（再次点击不取消，保持有且仅有一个选中） */
function toggleAccount(id: string) {
  if (running.value)
    return
  selectedAccountIds.value = [id]
}

function resetResults() {
  results.value = []
  progress.value = { done: 0, total: 0 }
}

async function start() {
  if (running.value)
    return
  const hasPasted = parsedItems.value.length > 0
  const items = queueItems.value
  if (items.length === 0) {
    toast.error('没有可添加的链接：粘贴内容为空，号池里也没有「未申请」的条目')
    return
  }
  const accounts = wxAccounts.value.filter(acc => selectedAccountIds.value.includes(String(acc.id)))
  if (accounts.length === 0) {
    toast.error('请先选择要执行的微信账号')
    return
  }

  running.value = true
  cancelled.value = false
  resetResults()

  // 先把粘贴的链接整批并入号池（只落库，不发申请）。
  // 这样之后任何中断（中止 / 断网 / 撞上限 / 关页面）都不会让后面的链接丢失，
  // 下次点「开始添加」可直接从号池继续。号池全账号共享，用首个待执行账号鉴权即可。
  if (hasPasted) {
    const importAccountId = String(accounts[0]?.id ?? '')
    let failedChunks = 0
    for (let offset = 0; offset < items.length; offset += POOL_IMPORT_CHUNK_SIZE) {
      try {
        await api.post('/api/friends/pool/import', {
          items: items.slice(offset, offset + POOL_IMPORT_CHUNK_SIZE),
        }, {
          headers: { 'x-account-id': importAccountId },
          skipErrorToast: true,
        } as any)
      }
      catch {
        failedChunks++
      }
    }
    if (failedChunks > 0)
      toast.error(`${failedChunks} 批链接并入号池失败，本次仍会继续尝试发送申请`)
  }

  // 今天已撞过上限：链接已并入号池，直接拦住不再发请求，明天从号池继续即可
  if (poolDailyLimit.value.blocked) {
    running.value = false
    toast.error(`本账号今日好友申请已达上限（${poolDailyLimit.value.dateKey}），明天再试；链接已保存到号池`)
    fetchPool()
    return
  }

  progress.value = { done: 0, total: items.length * accounts.length }
  if (!hasPasted)
    toast.info(`未粘贴链接，改用号池里 ${items.length} 条「未申请」的条目`)

  // 每日申请上限：后端返回 limitReached 后，本账号及后续账号都停止提交
  let limitReached = false
  // 拜访好友开关：后端会自动打开；自动打开失败才返回 switchBlocked，此时整批停止
  let switchBlocked = false
  let stopAt = { accIndex: 0, offset: 0 }

  try {
    for (const [ai, acc] of accounts.entries()) {
      for (let offset = 0; offset < items.length; offset += CHUNK_SIZE) {
        if (cancelled.value)
          break
        const chunk = items.slice(offset, offset + CHUNK_SIZE)
        try {
          const res = await api.post('/api/friends/apply-invites', {
            items: chunk,
            delayMs: delayMs.value,
            minLevel: Number(minLevel.value) || 0,
            allowUnknownLevel: allowUnknownLevel.value,
          }, {
            headers: { 'x-account-id': String(acc.id) },
            timeout: 180000,
            skipErrorToast: true,
          } as any)

          const data = res.data?.data || {}
          const list = Array.isArray(data.results) ? data.results : []
          if (list.length === 0) {
            // 后端未返回明细时按整块成功处理
            for (const item of chunk)
              results.value.push({ accountId: String(acc.id), accountName: acc.name, uid: item.uid, ok: true })
          }
          else {
            for (const row of list) {
              results.value.push({
                accountId: String(acc.id),
                accountName: acc.name,
                uid: String(row.uid || ''),
                ok: row.ok === true,
                skipped: row.skipped === true,
                existing: row.existing === true,
                poolSkipped: row.poolSkipped === true,
                limitReached: row.limitReached === true,
                switchBlocked: row.switchBlocked === true,
                level: row.level == null ? null : Number(row.level),
                name: row.name || '',
                error: row.ok === true ? undefined : (row.error || '未知错误'),
              })
            }
          }
          if (data.limitReached === true) {
            limitReached = true
            stopAt = { accIndex: ai, offset: offset + chunk.length }
            // break 会跳过下面的累加，本块已处理完，先补上进度
            progress.value.done += chunk.length
            break
          }
          if (data.switchBlocked === true) {
            switchBlocked = true
            stopAt = { accIndex: ai, offset: offset + chunk.length }
            progress.value.done += chunk.length
            break
          }
        }
        catch (error: any) {
          const message = error?.response?.data?.error || error?.message || '请求失败'
          for (const item of chunk) {
            results.value.push({
              accountId: String(acc.id),
              accountName: acc.name,
              uid: item.uid,
              ok: false,
              error: message,
            })
          }
        }
        progress.value.done += chunk.length
      }
      if (cancelled.value || limitReached || switchBlocked)
        break
    }

    if (limitReached || switchBlocked) {
      // 把没提交到的条目补成「已跳过」，让结果表完整
      for (let ai = stopAt.accIndex; ai < accounts.length; ai++) {
        const acc = accounts[ai]
        if (!acc)
          continue
        const from = ai === stopAt.accIndex ? stopAt.offset : 0
        for (const item of items.slice(from)) {
          results.value.push({
            accountId: String(acc.id),
            accountName: acc.name,
            uid: item.uid,
            ok: false,
            skipped: true,
            ...(limitReached
              ? { limitReached: true, error: '今日申请已达上限，未提交' }
              : { switchBlocked: true, error: '拜访好友开关未开启，未提交' }),
          })
        }
        progress.value.done += items.length - from
      }
    }
  }
  finally {
    running.value = false
    if (switchBlocked) {
      toast.error('未开启「好友功能 · 点击分享链接可拜访好友」，自动打开失败；请在游戏 设置 → 好友功能 里打开后重试')
      fetchPool()
    }
    else if (limitReached) {
      toast.warning('今日好友申请已达上限，已停止后续批次；明天可继续使用同一批链接')
      fetchPool()
    }
    else if (cancelled.value)
      toast.warning('已中止，剩余链接未提交')
    else if (summary.value.skipped > 0) {
      const existingTip = summary.value.existing > 0 ? `（其中已是好友 ${summary.value.existing}）` : ''
      const poolTip = summary.value.poolSkipped > 0 ? `（其中号池跳过 ${summary.value.poolSkipped}）` : ''
      toast.success(`处理完成：成功 ${summary.value.success}，跳过 ${summary.value.skipped}${existingTip}${poolTip}，失败 ${summary.value.failed}`)
    }
    else
      toast.success(`处理完成：成功 ${summary.value.success}，失败 ${summary.value.failed}`)
    if (!limitReached && !switchBlocked)
      fetchPool()
  }
}

function stop() {
  if (!running.value)
    return
  cancelled.value = true
}

function clearAll() {
  if (running.value)
    return
  rawText.value = ''
  resetResults()
}

onMounted(async () => {
  if (accountStore.visibleAccounts.length === 0)
    await accountStore.fetchAccounts()
  if (selectedAccountIds.value.length === 0) {
    const current = String(accountStore.currentAccountId || '')
    const currentAccount = wxAccounts.value.find(acc => String(acc.id) === current)
    if (currentAccount)
      selectedAccountIds.value = [String(currentAccount.id)]
    else if (wxAccounts.value[0])
      selectedAccountIds.value = [String(wxAccounts.value[0].id)]
  }
  fetchPool()
})

// 切换执行账号时刷新号池（申请状态按账号隔离；号池队列也依赖这份数据，所以始终刷新）
watch(poolAccountId, () => {
  poolEntries.value = []
  poolSummary.value = { total: 0, new: 0, pending: 0, friend: 0, dead: 0 }
  // 当日上限是按账号记的，切账号先清掉上一个账号的状态，等 fetchPool 回填
  poolDailyLimit.value = { blocked: false, dateKey: '', at: null }
  fetchPool()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-lg text-gray-900 font-bold dark:text-gray-100">
          批量加好友
        </h3>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          粘贴微信群里的分享链接（一行一条），自动解析 uid / openid / share_source / share_key，按账号批量发送好友申请；可按对方农场等级过滤。
          不粘贴也可以直接点「开始添加」，会用号池里当前账号还没申请过的链接。
          开始前会自动检测并打开游戏里的「点击分享链接可拜访好友」开关（没开时服务端会返回 1002007，加不了好友）。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="secondary" size="sm" :disabled="running" @click="clearAll">
          清空
        </BaseButton>
        <BaseButton
          v-if="running"
          variant="danger"
          size="sm"
          @click="stop"
        >
          中止
        </BaseButton>
        <BaseButton
          v-else
          size="sm"
          :loading="false"
          :disabled="queueItems.length === 0 || selectedAccountIds.length === 0"
          @click="start"
        >
          开始添加（{{ queueItems.length }} 条）
        </BaseButton>
      </div>
    </div>

    <p v-if="usingPoolQueue" class="text-xs text-[var(--theme-primary)]">
      未粘贴链接，将直接使用号池里 {{ poolQueueItems.length }} 条「未申请」的条目（待通过 / 已成好友 / 不可加 的不会重复提交）。
    </p>

    <!-- 链接输入 -->
    <div class="border border-gray-200 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="mb-2 flex items-center justify-between">
        <h4 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-link" />
          分享链接
        </h4>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          支持整条链接或 <code class="rounded bg-gray-100 px-1 dark:bg-gray-700">?uid=..&openid=..&share_key=..</code>
        </span>
      </div>
      <BaseTextarea
        v-model="rawText"
        :rows="7"
        :disabled="running"
        placeholder="一行一条，例如：&#10;?uid=1234567890&openid=oAbCdEfGhIjKlMnOpQrStUvWx_123&share_source=8&doc_id=0&share_key=0123456789abcdef0123456789abcdef"
      />
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>有效 <b class="text-emerald-600 dark:text-emerald-400">{{ parsedItems.length }}</b> 条</span>
        <span v-if="parseSummary.duplicated > 0">重复已去重 {{ parseSummary.duplicated }} 条</span>
        <span v-if="parseSummary.invalid > 0" class="text-amber-600 dark:text-amber-400">
          无法解析 {{ parseSummary.invalid }} 条
        </span>
      </div>
    </div>

    <!-- 账号与节奏 -->
    <div class="border border-gray-200 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="mb-3 flex items-center justify-between">
        <h4 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-user-multiple" />
          执行账号
          <span class="text-[11px] font-normal text-gray-400">单选，每次只给一个账号加好友</span>
        </h4>
      </div>

      <div v-if="wxAccounts.length === 0" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        没有可用的微信账号。该功能仅微信账号支持（通过分享链接调 ReportArkClick 加好友）。
      </div>
      <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="acc in wxAccounts"
          :key="acc.id"
          type="button"
          class="flex items-center gap-2 border rounded-lg px-3 py-2 text-left text-sm transition-colors"
          :class="selectedAccountIds.includes(String(acc.id))
            ? 'border-transparent'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
          :style="selectedAccountIds.includes(String(acc.id))
            ? { borderColor: 'var(--theme-primary)', backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }
            : {}"
          :disabled="running"
          @click="toggleAccount(String(acc.id))"
        >
          <span
            class="flex h-3.5 w-3.5 shrink-0 items-center justify-center border rounded-full"
            :style="selectedAccountIds.includes(String(acc.id))
              ? { borderColor: 'var(--theme-primary)' }
              : { borderColor: 'currentColor', opacity: 0.5 }"
          >
            <span
              v-if="selectedAccountIds.includes(String(acc.id))"
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: 'var(--theme-primary)' }"
            />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ acc.name || acc.nick || acc.id }}</span>
          <span v-if="acc.running === false" class="shrink-0 text-[10px] text-gray-400">未运行</span>
        </button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <span class="text-sm text-gray-700 font-medium dark:text-gray-300">每条间隔</span>
        <div class="w-40">
          <BaseSelect v-model="delayMs" :options="delayOptions" :disabled="running" />
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          间隔太短可能被服务端限流，建议 2 秒
        </span>
      </div>

      <div class="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700/60">
        <div class="flex flex-wrap items-end gap-3">
          <div class="w-44">
            <BaseInput
              v-model.number="minLevel"
              label="农场等级下限"
              type="number"
              min="0"
              max="200"
              :disabled="running"
            />
          </div>
          <span class="pb-2 text-xs text-gray-500 dark:text-gray-400">
            0 = 不筛选；&gt;0 时先读对方农场等级，低于该值不发送申请
          </span>
        </div>
        <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            v-model="allowUnknownLevel"
            type="checkbox"
            class="accent-[var(--theme-primary)]"
            :disabled="running || !(Number(minLevel) > 0)"
          >
          等级查不到时仍然添加（比如 share_key 已过期）
        </label>
        <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          执行前会先与当前账号的好友列表比对，已是好友的直接跳过；执行期间农场 / 牧场自动化任务会暂停，全部提交完成后自动恢复。
        </p>
        <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          筛选会在对方农场做一次「进入 → 退出」以读取等级，不偷取、不操作任何地块。
          <span v-if="Number(minLevel) > 0 && itemsWithoutKey > 0" class="text-amber-600 dark:text-amber-400">
            当前有 {{ itemsWithoutKey }} 条链接缺少 share_key，筛选时会读取不到等级。
          </span>
        </p>
      </div>
    </div>

    <!-- 进度与结果 -->
    <div
      v-if="progress.total > 0"
      class="border border-gray-200 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-chart-line" />
          执行结果
        </h4>
        <div class="flex items-center gap-3 text-xs">
          <span class="text-emerald-600 dark:text-emerald-400">成功 {{ summary.success }}</span>
          <span v-if="summary.skipped > 0" class="text-amber-600 dark:text-amber-400">跳过 {{ summary.skipped }}</span>
          <span v-if="summary.existing > 0" class="text-gray-600 dark:text-gray-300">已是好友 {{ summary.existing }}</span>
          <span v-if="summary.poolSkipped > 0" class="text-gray-600 dark:text-gray-300">号池跳过 {{ summary.poolSkipped }}</span>
          <span class="text-red-600 dark:text-red-400">失败 {{ summary.failed }}</span>
          <span class="text-gray-500 dark:text-gray-400">{{ progress.done }} / {{ progress.total }}</span>
        </div>
      </div>

      <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{ width: `${progressPercent}%`, background: 'var(--theme-gradient)' }"
        />
      </div>

      <div class="mt-3 max-h-80 overflow-auto">
        <table class="w-full text-left text-xs">
          <thead class="sticky top-0 bg-white text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th class="py-1.5 pr-2 font-medium">账号</th>
              <th class="py-1.5 pr-2 font-medium">uid</th>
              <th class="py-1.5 pr-2 font-medium">等级</th>
              <th class="py-1.5 pr-2 font-medium">结果</th>
              <th class="py-1.5 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in results"
              :key="`${row.accountId}-${row.uid}-${index}`"
              class="border-t border-gray-100 dark:border-gray-700/60"
            >
              <td class="py-1.5 pr-2 text-gray-600 dark:text-gray-300">{{ row.accountName }}</td>
              <td class="py-1.5 pr-2 font-mono text-gray-800 dark:text-gray-200">
                {{ row.uid }}
                <span v-if="row.name" class="ml-1 font-sans text-gray-400">{{ row.name }}</span>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 dark:text-gray-300">
                {{ row.level == null || row.level === 0 ? '—' : row.level }}
              </td>
              <td class="py-1.5 pr-2">
                <span
                  class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  :class="row.ok
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : row.skipped
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'"
                >
                  {{ row.ok ? '已申请' : (row.skipped ? '已跳过' : '失败') }}
                </span>
              </td>
              <td class="py-1.5 text-gray-500 dark:text-gray-400">{{ row.error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 好友号池 -->
    <div class="border border-gray-200 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-data-base" />
          好友号池
          <span class="text-[11px] font-normal text-gray-400">全账号共享 · 共 {{ poolSummary.total }} 条</span>
        </h4>
        <div class="flex items-center gap-2">
          <BaseButton variant="secondary" size="sm" :disabled="poolLoading || poolEntries.length === 0" @click="exportPool">
            导出
          </BaseButton>
          <BaseButton variant="secondary" size="sm" :disabled="poolLoading" @click="fetchPool">
            刷新
          </BaseButton>
          <button
            type="button"
            class="text-xs text-[var(--theme-primary)] hover:underline"
            @click="togglePool"
          >
            {{ poolOpen ? '收起明细' : '展开明细' }}
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span class="text-gray-400 dark:text-gray-500">当前账号状态：</span>
        <button
          v-for="tab in poolTabs"
          :key="tab.key"
          type="button"
          class="border rounded-full px-2.5 py-1 transition-colors"
          :class="[tab.cls, poolFilter === tab.key ? 'border-transparent' : 'border-gray-200 dark:border-gray-700']"
          :style="poolFilter === tab.key
            ? { borderColor: 'var(--theme-primary)', backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }
            : {}"
          @click="poolFilter = tab.key"
        >
          {{ tab.label }} {{ tab.count }}
        </button>
      </div>

      <p v-if="poolError" class="mt-2 text-xs text-red-600 dark:text-red-400">
        {{ poolError }}
      </p>

      <p
        v-if="poolDailyLimit.blocked"
        class="mt-2 border border-amber-200 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      >
        本账号今日好友申请已达上限（{{ poolDailyLimit.dateKey }}），明天才能继续；链接已保留在号池，不用重新粘贴。
      </p>

      <div v-if="poolOpen" class="mt-3 max-h-72 overflow-auto">
        <table class="w-full text-left text-xs">
          <thead class="sticky top-0 bg-white text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th class="py-1.5 pr-2 font-medium">uid</th>
              <th class="py-1.5 pr-2 font-medium">等级</th>
              <th class="py-1.5 pr-2 font-medium">状态</th>
              <th class="py-1.5 pr-2 font-medium">最近申请</th>
              <th class="py-1.5 pr-2 font-medium">说明</th>
              <th class="py-1.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredPoolEntries.length === 0">
              <td colspan="6" class="py-3 text-center text-gray-400">
                {{ poolLoading ? '加载中…' : '暂无记录' }}
              </td>
            </tr>
            <tr
              v-for="row in filteredPoolEntries"
              :key="row.uid"
              class="border-t border-gray-100 dark:border-gray-700/60"
            >
              <td class="py-1.5 pr-2 font-mono text-gray-800 dark:text-gray-200">
                {{ row.uid }}
                <span v-if="row.name" class="ml-1 font-sans text-gray-400">{{ row.name }}</span>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 dark:text-gray-300">
                {{ row.level == null ? '—' : row.level }}
              </td>
              <td class="py-1.5 pr-2">
                <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" :class="poolStatusClass(row.status)">
                  {{ poolStatusText(row.status) }}
                </span>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 dark:text-gray-300">
                {{ formatPoolTime(row.lastApplyAt) }}
                <span v-if="row.hoursSinceApply != null" class="ml-1 text-[10px] text-gray-400">
                  {{ row.hoursSinceApply }}h 前
                </span>
              </td>
              <td class="py-1.5 pr-2 text-gray-500 dark:text-gray-400">
                {{ row.status === 'dead' ? (row.deadReason || '超 24 小时未通过') : (row.cardTime || '—') }}
              </td>
              <td class="py-1.5">
                <div class="flex items-center gap-2">
                  <button
                    v-if="row.status === 'dead'"
                    type="button"
                    class="text-[var(--theme-primary)] hover:underline"
                    @click="resetPoolEntry(row.uid)"
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-red-500 hover:underline"
                    @click="removePoolEntry(row.uid)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        链接库全账号共享：粘贴过一次的链接，其他账号也能直接用，不用重复粘贴。
        下面的申请状态（待通过 / 已成好友 / 不可加）和申请时间是<strong>按当前账号单独记录</strong>的：
        发出申请后 24 小时仍未通过会自动标记「不可加」，之后该账号不再重复申请，避免浪费每天的申请次数。
        同一分享人有多张卡片时，以卡片时间最新的为准（share_key 会过期）。
      </p>
    </div>
  </div>
</template>
