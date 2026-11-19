<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import RuntimeLogPanel from '@/components/shared/RuntimeLogPanel.vue'
import { getPlatformClass, getPlatformLabel, useAccountStore } from '@/stores/account'
import { useBagStore } from '@/stores/bag'
import { useIllustratedStore } from '@/stores/illustrated'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'
import { formatCouponAmount, formatGoldAmount, formatGoldBeanAmount } from '@/utils/number-format'

const statusStore = useStatusStore()
const accountStore = useAccountStore()
const bagStore = useBagStore()
const illustratedStore = useIllustratedStore()
const userStore = useUserStore()

const {
  status,
  realtimeConnected,
  currentStatusReady,
} = storeToRefs(statusStore)
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { dashboardItems } = storeToRefs(bagStore)
const { levels: illustratedLevels } = storeToRefs(illustratedStore)
const { expireTimeText } = storeToRefs(userStore)

const lastBagFetchAt = ref(0)
const avatarFailed = ref(false)

/** 概览面板的缓存窗口：切回页面时命中就不发请求，避免来回切就反复打接口。 */
const panelMaxAgeMs = 15000
const levelsMaxAgeMs = 60000
/** 命中缓存时的静默补刷延迟：先让旧数据画出来，再挑空闲时机补一次。 */
const softRefreshDelayMs = 1500
let softRefreshTimer: ReturnType<typeof setTimeout> | null = null

const currentAccountDisconnected = computed(() =>
  currentStatusReady.value && !status.value?.connection?.connected,
)

const displayName = computed(() => {
  const account = accountStore.currentAccount
  const gameName = status.value?.status?.name

  if (gameName) {
    if (account?.name)
      return `${gameName} (${account.name})`
    return gameName
  }

  if (currentAccountDisconnected.value) {
    if (account) {
      if (account.name && account.nick)
        return `${account.nick} (${account.name})`
      return account.name || account.nick || '未登录'
    }
    return '未登录'
  }

  if (account) {
    if (account.name && account.nick)
      return `${account.nick} (${account.name})`
    return account.name || account.nick || '未命名'
  }

  return '未命名'
})

const platform = computed(() => getPlatformLabel(currentAccount.value?.platform))

// 面板里的头像取值规则与顶栏账号菜单保持一致：在线头像 > 账号头像 > QQ 头像 > 首字母
const avatarSrc = computed(() => {
  const acc = currentAccount.value
  if (!acc)
    return ''
  const live = currentStatusReady.value
    ? String(status.value?.status?.avatar || status.value?.status?.avatarUrl || status.value?.status?.avatar_url || '').trim()
    : ''
  const explicit = live || String(acc.avatar || '').trim()
  if (explicit)
    return explicit
  const qq = String(acc.uin || acc.qq || '').trim()
  if (qq && /^\d+$/.test(qq))
    return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  return ''
})

// 切换账号后重置头像加载失败标记，避免一直停在首字母兜底
watch(() => currentAccount.value?.id, () => {
  avatarFailed.value = false
})

const expRate = computed(() => {
  const gain = status.value?.sessionExpGained || 0
  const uptime = status.value?.uptime || 0
  if (!uptime)
    return '0/小时'
  const rate = gain / (uptime / 3600)
  return `${Math.floor(rate)}/小时`
})

const fertilizerNormal = computed(() => dashboardItems.value.find((item: any) => Number(item.id) === 1011))
const fertilizerOrganic = computed(() => dashboardItems.value.find((item: any) => Number(item.id) === 1012))

// 游戏化首页数据（移植自参考项目）
const resourceCards = computed(() => [
  {
    key: 'gold',
    label: '金币',
    icon: '/game-config/resource-icons/gold.png',
    amount: formatGoldAmount(status.value?.status?.gold || 0),
  },
  {
    key: 'bean',
    label: '金豆',
    icon: '/game-config/resource-icons/gold-bean.png',
    amount: formatGoldBeanAmount(status.value?.status?.goldBean || 0),
  },
  {
    key: 'coupon',
    label: '点券',
    icon: '/game-config/resource-icons/coupon.png',
    amount: formatCouponAmount(status.value?.status?.coupon || 0),
  },
  {
    key: 'diamond',
    label: '钻石',
    icon: '/game-config/resource-icons/diamond.png',
    amount: formatCouponAmount(status.value?.status?.diamond || 0),
  },
  // 化肥 / 图鉴（内容取自原统计区，与资源卡同网格展示）
  {
    key: 'fert-normal',
    label: '普通',
    icon: '/game-config/resource-icons/fertilizer-normal.png',
    amount: formatBucketTime(fertilizerNormal.value),
  },
  {
    key: 'fert-organic',
    label: '有机',
    icon: '/game-config/resource-icons/fertilizer-organic.png',
    amount: formatBucketTime(fertilizerOrganic.value),
  },
  {
    key: 'illus-crop',
    label: '作物图鉴',
    icon: '/game-config/resource-icons/illustrated-crop.png',
    amount: `Lv.${illustratedLevels.value.crop}`,
  },
  {
    key: 'illus-mutant',
    label: '超变图鉴',
    icon: '/game-config/resource-icons/illustrated-mutant.png',
    amount: `Lv.${illustratedLevels.value.mutant}`,
  },
])

const nextFarmCheck = ref('--:--:--')
const nextHelpCheck = ref('--:--:--')
const nextStealCheck = ref('--:--:--')
const localUptime = ref(0)

let localNextFarmRemainSec = 0
let localNextHelpRemainSec = 0
let localNextStealRemainSec = 0
const localInQuietHours = ref(false)
const localQuietHoursRemainSec = ref(0)
const farmCountdownTotal = ref(1)
const helpCountdownTotal = ref(1)
const stealCountdownTotal = ref(1)

function resetDashboardState() {
  lastBagFetchAt.value = 0
  localUptime.value = 0
  localNextFarmRemainSec = 0
  localNextHelpRemainSec = 0
  localNextStealRemainSec = 0
  localInQuietHours.value = false
  localQuietHoursRemainSec.value = 0
  farmCountdownTotal.value = 1
  helpCountdownTotal.value = 1
  stealCountdownTotal.value = 1
  nextFarmCheck.value = '--:--:--'
  nextHelpCheck.value = '--:--:--'
  nextStealCheck.value = '--:--:--'
}

function syncCountdownTotal(total: typeof farmCountdownTotal, remain: number, previousRemain: number) {
  if (remain > previousRemain || total.value <= 1)
    total.value = Math.max(1, remain)
}

function getCountdownProgress(remain: number, total: number) {
  return Math.max(0, Math.min(100, (remain / Math.max(1, total)) * 100))
}

function getCountdownRingStyle(remain: number, total: number, color: string) {
  const progress = getCountdownProgress(remain, total)
  return {
    background: `conic-gradient(${color} ${progress}%, color-mix(in srgb, ${color} 14%, transparent) 0)`,
  }
}

const OP_META: Record<string, { label: string, icon: string, color: string }> = {
  harvest: { label: '收获', icon: 'i-carbon-crop-growth', color: 'text-green-500' },
  farming: { label: '一键务农', icon: 'i-carbon-clean', color: 'text-teal-500' },
  fertilize: { label: '施肥', icon: 'i-carbon-chemistry', color: 'text-emerald-500' },
  plant: { label: '种植', icon: 'i-carbon-tree', color: 'text-lime-500' },
  steal: { label: '偷菜', icon: 'i-carbon-run', color: 'text-orange-500' },
  helpWater: { label: '帮浇水', icon: 'i-carbon-rain-drop', color: 'text-blue-300' },
  goldenBugClear: { label: '清黄金虫', icon: 'i-carbon-clean', color: 'text-amber-500' },
  goldenBugPut: { label: '放黄金虫', icon: 'i-carbon-pest', color: 'text-yellow-500' },
  helpWeed: { label: '帮除草', icon: 'i-carbon-cut', color: 'text-yellow-400' },
  helpBug: { label: '帮除虫', icon: 'i-carbon-pest', color: 'text-red-300' },
  putWeed: { label: '放草', icon: 'i-carbon-sprout', color: 'text-lime-400' },
  putBug: { label: '放虫', icon: 'i-carbon-debug', color: 'text-red-500' },
  taskClaim: { label: '任务', icon: 'i-carbon-task-complete', color: 'text-indigo-500' },
  sell: { label: '出售', icon: 'i-carbon-shopping-cart', color: 'text-pink-500' },
  tongQiGift: { label: '同气礼包', icon: 'i-carbon-gift', color: 'text-rose-500' },
}

const filteredOperations = computed(() => {
  const operations = status.value?.operations || {}
  const result: Record<string, number> = {}

  for (const key of Object.keys(operations)) {
    if (key !== 'upgrade' && key !== 'levelUp')
      result[key] = operations[key]
  }

  return result
})

function formatBucketTime(item: any) {
  if (!item)
    return '0.0h'
  if (item.hoursText)
    return item.hoursText.replace('小时', 'h')
  return `${(Number(item.count || 0) / 3600).toFixed(1)}h`
}

function updateCountdowns() {
  if (currentAccountDisconnected.value) {
    nextFarmCheck.value = '账号未登录'
    nextHelpCheck.value = '账号未登录'
    nextStealCheck.value = '账号未登录'
    return
  }

  localUptime.value++

  const auto = status.value?.automation || {}
  const inQuietHours = localInQuietHours.value
  const quietRemain = localQuietHoursRemainSec.value

  if (localNextFarmRemainSec > 0) {
    localNextFarmRemainSec--
    nextFarmCheck.value = formatDuration(localNextFarmRemainSec)
  }
  else if (!auto.farm) {
    nextFarmCheck.value = '未开启'
  }
  else {
    nextFarmCheck.value = '检查中...'
  }

  if (inQuietHours && (auto.friend_help || auto.friend_golden_bug)) {
    nextHelpCheck.value = quietRemain > 0 ? `静默期 ${formatDuration(quietRemain)}` : '静默期'
  }
  else if (localNextHelpRemainSec > 0) {
    localNextHelpRemainSec--
    nextHelpCheck.value = formatDuration(localNextHelpRemainSec)
  }
  else if (!auto.friend_help && !auto.friend_golden_bug) {
    nextHelpCheck.value = '未开启'
  }
  else {
    nextHelpCheck.value = '检查中...'
  }

  if (inQuietHours && auto.friend_steal) {
    nextStealCheck.value = quietRemain > 0 ? `静默期 ${formatDuration(quietRemain)}` : '静默期'
  }
  else if (localNextStealRemainSec > 0) {
    localNextStealRemainSec--
    nextStealCheck.value = formatDuration(localNextStealRemainSec)
  }
  else if (!auto.friend_steal) {
    nextStealCheck.value = '未开启'
  }
  else {
    nextStealCheck.value = '检查中...'
  }
}

watch(status, (newVal) => {
  if (newVal?.nextChecks) {
    const farmRemainSec = newVal.nextChecks.farmRemainSec || 0
    const helpRemainSec = newVal.nextChecks.helpRemainSec || 0
    const stealRemainSec = newVal.nextChecks.stealRemainSec || 0
    localInQuietHours.value = !!newVal.nextChecks.inQuietHours
    localQuietHoursRemainSec.value = newVal.nextChecks.quietHoursRemainSec || 0
    syncCountdownTotal(farmCountdownTotal, farmRemainSec, localNextFarmRemainSec)
    syncCountdownTotal(helpCountdownTotal, helpRemainSec, localNextHelpRemainSec)
    syncCountdownTotal(stealCountdownTotal, stealRemainSec, localNextStealRemainSec)
    localNextFarmRemainSec = farmRemainSec
    localNextHelpRemainSec = helpRemainSec
    localNextStealRemainSec = stealRemainSec
    updateCountdowns()
  }

  if (newVal?.uptime !== undefined)
    localUptime.value = newVal.uptime
}, { deep: true })

function formatDuration(seconds: number) {
  if (seconds <= 0)
    return '00:00:00'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainSeconds = Math.floor(seconds % 60)
  const pad = (value: number) => value.toString().padStart(2, '0')

  if (days > 0)
    return `${days}天 ${pad(hours)}:${pad(minutes)}:${pad(remainSeconds)}`
  return `${pad(hours)}:${pad(minutes)}:${pad(remainSeconds)}`
}

function getOpName(key: string | number) {
  return OP_META[String(key)]?.label || String(key)
}

function getOpIcon(key: string | number) {
  return OP_META[String(key)]?.icon || 'i-carbon-circle-dash'
}

function getOpColor(key: string | number) {
  return OP_META[String(key)]?.color || 'text-gray-400'
}

function getExpPercent(progress: any) {
  if (!progress || !progress.needed)
    return 0
  return Math.min(100, Math.max(0, (progress.current / progress.needed) * 100))
}

/**
 * 拉背包。
 * force=true 走操作后的即时回读；否则按面板缓存窗口判定，命中就不发请求。
 */
async function refreshBag(force = false) {
  if (!currentAccountId.value || !currentAccount.value?.running || !currentStatusReady.value || !status.value?.connection?.connected)
    return

  const now = Date.now()
  if (!force && now - lastBagFetchAt.value < 2500)
    return

  lastBagFetchAt.value = now
  await bagStore.fetchBag(currentAccountId.value, { maxAgeMs: force ? 0 : panelMaxAgeMs })
}

async function refreshIllustratedLevels(force = false) {
  if (!currentAccountId.value || !status.value?.connection?.connected)
    return
  await illustratedStore.fetchLevels(currentAccountId.value, { maxAgeMs: force ? 0 : levelsMaxAgeMs })
}

/**
 * 概览页的统一取数入口。
 * 默认按缓存窗口判定（切回页面命中即不发请求），force 时全部强制重读。
 */
async function refresh(forceReloadLogs = false, options: { force?: boolean } = {}) {
  if (!currentAccountId.value)
    return

  const account = currentAccount.value
  if (!account)
    return

  const force = options.force === true
  const maxAgeMs = force ? 0 : panelMaxAgeMs

  // 首次加载、断线回退时走 HTTP；实时连接正常时优先依赖 WS 推送。
  if (!realtimeConnected.value) {
    await statusStore.fetchStatus(currentAccountId.value, { maxAgeMs })
    await statusStore.fetchAccountLogs(currentAccountId.value)
  }

  if (forceReloadLogs || !realtimeConnected.value)
    await statusStore.fetchLogs(currentAccountId.value, { limit: 300 })

  // 仅在账号运行且连接稳定后再拉背包，避免启动阶段出现 500。
  await refreshBag(force)
  await refreshIllustratedLevels(force)
}

/** 有缓存就先渲染，等界面画完再静默补一次；页面不可见时直接跳过。 */
function scheduleSoftRefresh(delayMs = softRefreshDelayMs) {
  if (softRefreshTimer)
    clearTimeout(softRefreshTimer)
  softRefreshTimer = setTimeout(() => {
    softRefreshTimer = null
    if (!document.hidden)
      void refresh()
  }, Math.max(0, delayMs))
}

function cancelSoftRefresh() {
  if (softRefreshTimer) {
    clearTimeout(softRefreshTimer)
    softRefreshTimer = null
  }
}

function syncRealtimeAccount() {
  if (currentAccountId.value)
    statusStore.connectRealtime(currentAccountId.value)
}

watch(currentAccountId, async (newId, oldId) => {
  if (oldId !== undefined && newId !== oldId) {
    statusStore.clearAccountScopedData()
    bagStore.clearBag()
    resetDashboardState()
  }
  syncRealtimeAccount()
  // 切账号必须拿新账号的数据，不能沿用刚被清掉的缓存窗口。
  cancelSoftRefresh()
  await refresh(true, { force: true })
})

watch(() => status.value?.connection?.connected, (connected) => {
  if (connected) {
    refreshBag(true)
    refreshIllustratedLevels()
  }
})

watch(() => JSON.stringify(status.value?.operations || {}), (next, prev) => {
  if (!realtimeConnected.value || next === prev)
    return
  // 操作计数变化说明背包可能刚变过，这里绕过缓存窗口，但仍然有 2.5s 节流兜底。
  refreshBag(true)
})

onMounted(async () => {
  statusStore.setRealtimeLogsEnabled(true)
  syncRealtimeAccount()
  // 已经有可用数据（store 里有上一位留下的面板数据）就先渲染，稍后再静默补齐；
  // 完全没数据才立刻拉，避免首屏空着。
  if (currentStatusReady.value || bagStore.allItems.length || illustratedLevels.value.crop)
    scheduleSoftRefresh()
  else
    await refresh()
})

// 兜底刷新：降频到 30s，且按缓存窗口过滤，WS 正常时基本只剩背包/图鉴的定期校准。
useIntervalFn(() => {
  if (!document.hidden)
    void refresh()
}, 30000)
// Countdown timer (every 1s)
useIntervalFn(updateCountdowns, 1000)

onUnmounted(cancelSoftRefresh)
</script>

<template>
  <div class="flex flex-col gap-5 pt-1 md:pt-2">
    <!-- 游戏化首页（移植自参考项目） -->
    <div class="game-home">
      <!-- 用户信息 + 资源 / 化肥 / 图鉴（合并为同一个毛玻璃面板；卡片一行 4 个，共 2 行） -->
      <div class="glass-panel home-panel">
        <div class="user-info-row">
          <!-- 左：头像占两行高度；名字 + 等级 在上，平台 + 到期时间 在下 -->
          <div class="user-identity">
            <span class="user-avatar">
              <img
                v-if="avatarSrc && !avatarFailed"
                class="user-avatar-img"
                :src="avatarSrc"
                :alt="displayName"
                @error="avatarFailed = true"
              >
              <span v-else class="user-avatar-initial">{{ (displayName || '?').charAt(0) }}</span>
            </span>
            <div class="user-identity-text">
              <div class="user-line">
                <span class="user-name">{{ displayName }}</span>
                <span class="user-level">Lv.{{ status?.status?.level || 0 }}</span>
              </div>
              <div class="user-line">
                <span
                  v-if="platform"
                  class="user-platform"
                  :class="getPlatformClass(currentAccount?.platform)"
                >{{ platform }}</span>
                <span class="user-expire">到期：{{ expireTimeText }}</span>
              </div>
            </div>
          </div>

          <!-- 原「在线」卡片内容，已并入本面板右上角 -->
          <div class="home-status">
            <div class="status-indicator">
              <span class="status-dot" :class="status?.connection?.connected ? 'online' : 'offline'" />
              <span class="status-text">{{ status?.connection?.connected ? '在线' : '离线' }}</span>
            </div>
            <div class="home-status-uptime">
              <span class="i-carbon-time" />
              <span>已运行 {{ formatDuration(localUptime) }}</span>
            </div>
          </div>
        </div>

        <!-- EXP 效率 与 当前/所需经验 一行；下面经验条比面板略窄（同组内紧凑） -->
        <div class="exp-section">
          <div class="exp-meta">
            <span class="exp-rate">
              <span class="exp-bolt i-fas-bolt" />
              EXP 效率：{{ expRate }}
            </span>
            <span class="exp-total">{{ status?.levelProgress?.current || 0 }} / {{ status?.levelProgress?.needed || 0 }}</span>
          </div>

          <div class="exp-bar-row">
            <div class="exp-progress-bar">
              <div class="exp-progress-fill" :style="{ width: `${getExpPercent(status?.levelProgress)}%` }" />
            </div>
          </div>
        </div>

        <div class="resource-cards">
          <div
            v-for="res in resourceCards"
            :key="res.key"
            class="game-card resource-card"
            :class="`res-${res.key}`"
          >
            <div class="resource-icon-zone">
              <img :src="res.icon" :alt="res.label" class="resource-icon">
            </div>
            <div class="resource-info">
              <div class="resource-label">{{ res.label }}</div>
              <div class="resource-amount">{{ res.amount }}</div>
            </div>
          </div>
        </div>

        <!-- 下次检查倒计时：与化肥等资源卡同面板，横线隔开，一行三个 -->
        <div class="home-countdown-divider" />
        <div class="home-countdowns">
          <div class="min-w-0 flex flex-col items-center text-center">
            <div
              class="h-18 w-18 flex items-center justify-center rounded-full p-1"
              :style="getCountdownRingStyle(localNextFarmRemainSec, farmCountdownTotal, '#22c55e')"
            >
              <div class="h-full w-full flex flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800">
                <div class="i-carbon-sprout text-xl text-green-500" />
                <span class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">农场</span>
              </div>
            </div>
            <div class="mt-1.5 w-full truncate text-sm font-bold font-mono 2xl:text-base" :title="nextFarmCheck">
              {{ nextFarmCheck }}
            </div>
          </div>
          <div class="min-w-0 flex flex-col items-center text-center">
            <div
              class="h-18 w-18 flex items-center justify-center rounded-full p-1"
              :style="getCountdownRingStyle(localNextHelpRemainSec, helpCountdownTotal, '#3b82f6')"
            >
              <div class="h-full w-full flex flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800">
                <div class="i-carbon-user-multiple text-xl text-blue-500" />
                <span class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">帮助</span>
              </div>
            </div>
            <div class="mt-1.5 w-full truncate text-sm font-bold font-mono 2xl:text-base" :title="nextHelpCheck">
              {{ nextHelpCheck }}
            </div>
          </div>
          <div class="min-w-0 flex flex-col items-center text-center">
            <div
              class="h-18 w-18 flex items-center justify-center rounded-full p-1"
              :style="getCountdownRingStyle(localNextStealRemainSec, stealCountdownTotal, '#f97316')"
            >
              <div class="h-full w-full flex flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800">
                <div class="i-carbon-run text-xl text-orange-500" />
                <span class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">偷菜</span>
              </div>
            </div>
            <div class="mt-1.5 w-full truncate text-sm font-bold font-mono 2xl:text-base" :title="nextStealCheck">
              {{ nextStealCheck }}
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="legacy-section">

    <div class="flex flex-1 flex-col items-stretch gap-5 md:min-h-0 md:flex-row">
      <div class="farm-log-panel flex flex-1 flex-col gap-5 md:min-h-0 md:w-3/4">
        <RuntimeLogPanel scene="farm" />
      </div>

      <div class="flex flex-col gap-4 md:min-h-0 md:w-1/4 md:overflow-hidden">
        <div class="glass-card-lg min-h-0 flex flex-1 flex-col overflow-hidden p-4">
          <h3 class="mb-3 flex items-center gap-2 text-base font-medium 2xl:text-lg">
            <div class="i-carbon-chart-column" />
            <span>今日统计</span>
          </h3>
          <div v-if="currentAccountDisconnected" class="ui-subtle-panel flex flex-col items-center justify-center gap-3 rounded-lg p-5 text-center text-gray-500">
            <div class="i-carbon-connection-signal-off text-4xl text-gray-400" />
            <div class="flex flex-col">
              <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
                账号未登录
              </div>
              <div class="mt-1 text-sm text-gray-400">
                请先运行账号或检查网络连接。
              </div>
            </div>
          </div>
          <div v-else-if="!Object.keys(filteredOperations).length" class="ui-subtle-panel flex flex-col items-center justify-center gap-2 rounded-lg p-5 text-center">
            <div class="i-carbon-chart-column text-3xl text-gray-300" />
            <div class="text-sm text-gray-600 font-medium dark:text-gray-300">
              暂无主动作统计
            </div>
            <div class="text-xs text-gray-400">
              通常是刚启动、刚切换账号，或本轮巡查尚未完成。
            </div>
          </div>
          <div v-else class="grid auto-rows-fr grid-cols-2 min-h-0 flex-1 gap-1.5 2xl:gap-2">
            <div
              v-for="(val, key) in filteredOperations"
              :key="key"
              class="ui-subtle-panel min-w-0 flex items-center justify-between rounded-lg px-2 py-1.5"
            >
              <div class="min-w-0 flex items-center gap-1.5">
                <div class="text-base 2xl:text-lg" :class="[getOpIcon(key), getOpColor(key)]" />
                <div class="truncate text-xs text-gray-500 2xl:text-sm" :title="getOpName(key)">
                  {{ getOpName(key) }}
                </div>
              </div>
              <div class="text-sm font-bold 2xl:text-base">
                {{ val }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div><!-- /.legacy-section -->
  </div>
</template>

<style scoped>
.dashboard-container {
  display: flex;
  width: 100%;
  min-height: 100%;
}

/* 游戏风格内容列 */
.game-home {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 14px;
}

/* 果冻玻璃卡片基础样式：半透明毛玻璃，透出背景 */
.game-card {
  position: relative;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.28) 100%);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

/* 用户信息与资源/化肥/图鉴卡片同处一个毛玻璃面板 */
.home-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 原「在线」卡片已并入面板右上角（单行：状态灯 + 在线 · 已运行时长） */
.home-status {
  margin-left: auto;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.home-status-uptime {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  font-family: 'DM Mono', 'Courier New', monospace;
  white-space: nowrap;
}

/* 窄屏：状态行保持与昵称同一行（右上角），仅压缩字号与间距，避免挤压昵称 */
@media (max-width: 480px) {
  .home-status {
    gap: 8px;
  }

  .home-status-uptime {
    gap: 4px;
    font-size: 10px;
  }
}

.user-info-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(31, 38, 80, 0.18);
  flex-shrink: 0;
}

/* 头像占两行高度；右侧两行文字：上行 名字 + 等级，下行 平台 + 到期时间 */
.user-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.user-identity-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.user-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.user-name {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-expire {
  min-width: 0;
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-level {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 面板内头像：占两行高度，圆角方形 */
.user-avatar {
  display: flex;
  height: 44px;
  width: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 6px rgba(31, 38, 80, 0.18);
}

.user-avatar-img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.user-avatar-initial {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
}

.user-platform {
  flex-shrink: 0;
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
}

/* EXP 文字行与经验条视为一组，组内间距压紧 */
.exp-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.exp-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 92%;
  margin: 0 auto;
}

.exp-progress-bar {
  flex: 1;
  height: 12px;
  border-radius: 999px;
  background: rgba(31, 38, 80, 0.08);
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(31, 38, 80, 0.08);
}

.exp-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4ade80, #22c55e);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  transition: width 0.5s ease;
}

.exp-total {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
}

.exp-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}

.exp-rate {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}

.exp-bolt {
  color: #3b82f6;
}

.level-up-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #16a34a;
  font-weight: 600;
  white-space: nowrap;
}

/* 资源卡片网格 */
.resource-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.resource-card {
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 84px;
  overflow: hidden;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.resource-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 32px rgba(31, 38, 80, 0.16);
}

/* 各资源的柔和底色（半透明玻璃着色） */
.res-gold {
  background: linear-gradient(165deg, rgba(255, 224, 145, 0.6) 0%, rgba(255, 248, 228, 0.24) 100%);
}

.res-coupon {
  background: linear-gradient(165deg, rgba(178, 240, 205, 0.6) 0%, rgba(240, 252, 244, 0.24) 100%);
}

.res-diamond {
  background: linear-gradient(165deg, rgba(183, 222, 252, 0.6) 0%, rgba(238, 248, 255, 0.24) 100%);
}

.res-bean {
  background: linear-gradient(165deg, rgba(255, 216, 160, 0.6) 0%, rgba(255, 246, 232, 0.24) 100%);
}

.res-fert-normal {
  background: linear-gradient(165deg, rgba(214, 240, 178, 0.6) 0%, rgba(246, 252, 236, 0.24) 100%);
}

.res-fert-organic {
  background: linear-gradient(165deg, rgba(178, 240, 205, 0.6) 0%, rgba(240, 252, 244, 0.24) 100%);
}

.res-illus-crop {
  background: linear-gradient(165deg, rgba(196, 226, 252, 0.6) 0%, rgba(243, 249, 255, 0.24) 100%);
}

.res-illus-mutant {
  background: linear-gradient(165deg, rgba(226, 212, 252, 0.6) 0%, rgba(248, 244, 255, 0.24) 100%);
}

/* 资源数值：按资源着色并放大 */
.res-gold .resource-amount {
  color: #d97706;
}

.res-coupon .resource-amount {
  color: #059669;
}

.res-diamond .resource-amount {
  color: #0284c7;
}

.res-bean .resource-amount {
  color: #c2620a;
}

.res-fert-normal .resource-amount {
  color: #4d7c0f;
}

.res-fert-organic .resource-amount {
  color: #059669;
}

.res-illus-crop .resource-amount {
  color: #0284c7;
}

.res-illus-mutant .resource-amount {
  color: #7c3aed;
}

.resource-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(31, 38, 80, 0.15));
}

/* 图标单独占一列，并在该列内右对齐；文字独占剩余一列并居中 */
.resource-icon-zone {
  flex: 0 0 30%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.resource-info {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.resource-label {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resource-amount {
  font-size: 20px;
  font-weight: 800;
  color: #374151;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-arrow {
  margin-left: auto;
  font-size: 14px;
  color: rgba(55, 65, 81, 0.35);
  flex-shrink: 0;
}

/* 资源卡与倒计时之间的分隔线 */
.home-countdown-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(31, 38, 80, 0.14) 15%, rgba(31, 38, 80, 0.14) 85%, transparent);
}

/* 倒计时一行三个 */
.home-countdowns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 767px) {
  .home-countdowns {
    gap: 8px;
  }
}

/* 农场状态卡片 */
.farm-status-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  min-height: 128px;
  overflow: hidden;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.farm-status-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 14px 32px rgba(31, 38, 80, 0.16),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.95);
}

.farm-status-left {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.farm-status-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
}

.status-dot.offline {
  background: #ef4444;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.status-text {
  color: #374151;
  font-weight: 700;
  font-size: 12px;
  white-space: nowrap;
}

/* 窄屏再降一档（须写在基础规则之后才生效） */
@media (max-width: 480px) {
  .status-text {
    font-size: 11px;
  }

  .user-name {
    font-size: 13px;
  }

  .user-avatar {
    height: 38px;
    width: 38px;
  }
}

.farm-status-label {
  color: #16a34a;
  border: 1.5px solid rgba(34, 197, 94, 0.55);
  background: rgba(34, 197, 94, 0.08);
  border-radius: 999px;
  padding: 2px 12px;
  font-size: 12px;
  font-weight: 600;
}

.farm-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #333;
}

.farm-clock {
  display: flex;
  height: 40px;
  width: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 5px 12px rgba(16, 185, 129, 0.4);
  flex-shrink: 0;
}

.farm-preview-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.farm-time {
  font-size: 28px;
  font-weight: 800;
  font-family: 'DM Mono', 'Courier New', monospace;
  color: #1f2937;
  white-space: nowrap;
}

.farm-progress-label {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

/* 农场插画：左侧渐隐融入毛玻璃卡片，贴齐卡片右缘，避免“贴图”感 */
.farm-scene {
  position: relative;
  display: flex;
  width: 46%;
  max-width: 320px;
  flex-shrink: 0;
  margin: -16px -18px -16px 0;
  border-radius: 0 18px 18px 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 34%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 34%);
}

.farm-scene img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.92;
}

.farm-scene-arrow {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  height: 26px;
  width: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  color: #4b5563;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(31, 38, 80, 0.18);
}

/* 功能网格 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* 毛玻璃分组面板：整组功能卡片的透明衬底 */
.glass-panel {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  padding: 12px;
}

/* 功能卡片各自的柔和渐变底色（半透明玻璃着色） */
.feat-crop {
  background: linear-gradient(165deg, rgba(196, 242, 214, 0.6) 0%, rgba(245, 253, 247, 0.26) 100%);
}

.feat-pet {
  background: linear-gradient(165deg, rgba(255, 228, 196, 0.6) 0%, rgba(255, 250, 240, 0.26) 100%);
}

.feat-book {
  background: linear-gradient(165deg, rgba(200, 226, 252, 0.6) 0%, rgba(243, 249, 255, 0.26) 100%);
}

.feat-shop {
  background: linear-gradient(165deg, rgba(255, 214, 168, 0.6) 0%, rgba(255, 247, 235, 0.26) 100%);
}

.feat-gift {
  background: linear-gradient(165deg, rgba(250, 210, 232, 0.6) 0%, rgba(253, 245, 250, 0.26) 100%);
}

.feat-chart {
  background: linear-gradient(165deg, rgba(193, 240, 235, 0.6) 0%, rgba(242, 252, 251, 0.26) 100%);
}

.feature-card {
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 14px 32px rgba(31, 38, 80, 0.16),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.95);
}

.feature-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  object-fit: cover;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(31, 38, 80, 0.15));
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feature-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 每日签到横幅 */
.daily-checkin-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 20px;
  padding: 12px 16px 12px 0;
  min-height: 88px;
  background:
    linear-gradient(180deg, rgba(186, 226, 248, 0.35) 0%, rgba(255, 255, 255, 0.08) 45%, rgba(134, 214, 152, 0.4) 100%),
    linear-gradient(165deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.26) 100%);
  border: 1.5px solid rgba(255, 255, 255, 0.65);
  box-shadow:
    0 10px 28px rgba(31, 38, 80, 0.12),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(1.35);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
  overflow: hidden;
}

.banner-cow {
  height: 100%;
  width: 108px;
  object-fit: cover;
  object-position: center;
  flex-shrink: 0;
  border-radius: 14px 0 0 14px;
  margin: -12px 0 -12px -16px;
  margin-left: -1.5px;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-text h3 {
  font-size: 19px;
  font-weight: 800;
  color: #166534;
  margin: 0;
  letter-spacing: 1px;
}

.banner-text p {
  font-size: 12px;
  color: #4d7c5f;
  margin: 3px 0 0;
}

.checkin-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 9px 18px;
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  box-shadow:
    0 5px 14px rgba(16, 185, 129, 0.45),
    inset 0 0 0 2px rgba(255, 255, 255, 0.55);
  transition: all 0.2s ease;
}

.checkin-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 18px rgba(16, 185, 129, 0.5),
    inset 0 0 0 2px rgba(255, 255, 255, 0.55);
}

/* 原有区域 */
/* 原首页的「运行日志」「下次检查倒计时」「今日统计」，沿用首页大框的圆角磨砂玻璃样式 */
.legacy-section {
  width: 100%;
}

/* 与首页大毛玻璃框（.glass-panel）完全同一套视觉参数，仅不设 padding */
.glass-card-lg {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .resource-cards {
    gap: 8px;
  }

  .resource-card {
    padding: 8px;
    gap: 6px;
    min-height: 66px;
  }

  .resource-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .resource-label {
    font-size: 12px;
  }

  .resource-amount {
    font-size: 14px;
  }

  .user-avatar-large {
    width: 54px;
    height: 54px;
  }

  .user-name {
    font-size: 16px;
  }

  .farm-time {
    font-size: 23px;
  }

  .farm-scene {
    width: 40%;
  }

  .banner-cow {
    width: 88px;
  }

  .checkin-btn {
    padding: 8px 14px;
    font-size: 13px;
  }
}

@media (max-width: 560px) {
  .glass-panel {
    padding: 8px;
  }

  /* 窄屏功能卡改两列，避免标题截断 */
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .resource-cards {
    gap: 6px;
  }

  .resource-card {
    padding: 6px;
    gap: 4px;
    min-height: 56px;
    border-radius: 14px;
  }

  .resource-label {
    font-size: 10px;
  }

  .resource-amount {
    font-size: 12px;
  }

  .resource-icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
  }

  .card-arrow {
    font-size: 11px;
  }

  .feature-grid {
    gap: 6px;
  }

  .feature-card {
    padding: 10px;
    border-radius: 16px;
  }

  .feature-icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .feature-title {
    font-size: 12px;
  }

  .feature-subtitle {
    font-size: 10px;
  }

  .game-card {
    border-radius: 16px;
  }

  .daily-checkin-banner {
    min-height: 68px;
    border-radius: 16px;
  }

  .banner-cow {
    width: 72px;
  }

  .banner-text h3 {
    font-size: 15px;
  }

  .banner-text p {
    font-size: 10px;
  }
}

/* 日志列表：桌面端限高 50vh 内部滚动（与牧场概览一致），页面本身交给外层滚动 */
@media (min-width: 768px) {
  .farm-log-panel :deep(.ui-subtle-panel) {
    max-height: 50vh;
  }
}
</style>
