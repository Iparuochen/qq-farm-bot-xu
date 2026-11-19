<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import RuntimeLogPanel from '@/components/shared/RuntimeLogPanel.vue'
import { useRanchResource } from '@/composables/useRanchResource'
import { useRanchSync } from '@/composables/useRanchSync'
import { getPlatformClass, getPlatformLabel, useAccountStore } from '@/stores/account'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'
import { formatCouponAmount } from '@/utils/number-format'
import { ranchActionLabels, ranchTodayOperations } from '@/utils/ranch-display'

const ranch = useRanchSync()
const account = useAccountStore()
const status = useStatusStore()
const userStore = useUserStore()
const { expireTimeText } = storeToRefs(userStore)
const profile = useRanchResource(ref('profile'))
const illustrated = useRanchResource(ref('illustrated'))
const clock = ref(Date.now())
useIntervalFn(() => {
  clock.value = Date.now()
}, 1000)
const currentAccountDisconnected = computed(() => status.currentStatusReady && !status.status?.connection?.connected)
const checks = computed(() => [
  { key: 'farm', label: '牧场', icon: 'i-fas-paw', color: '#22c55e', text: 'text-green-500' },
  { key: 'help', label: '帮助', icon: 'i-carbon-user-multiple', color: '#3b82f6', text: 'text-blue-500' },
  { key: 'steal', label: '偷取', icon: 'i-carbon-run', color: '#f97316', text: 'text-orange-500' },
].map((item) => {
  const queue = (status.currentStatusReady ? status.status?.ranchNextChecks?.[item.key] : null) || ranch.data?.nextChecks?.[item.key]
  const remain = Math.max(0, Math.ceil(((queue?.nextAt || 0) - clock.value) / 1000))
  return { ...item, value: currentAccountDisconnected.value ? '账号未登录' : !queue ? '读取中' : !queue.enabled ? '未开启' : queue.running || remain === 0 ? '检查中…' : formatDuration(remain), progress: queue?.enabled ? Math.min(100, remain / Math.max(1, queue.intervalSec || remain) * 100) : 0 }
}))
const displayName = computed(() => {
  const name = status.status?.status?.name || profile.data.value?.name || account.currentAccount?.nick
  return name ? `${name}${account.currentAccount?.name ? ` (${account.currentAccount.name})` : ''}` : account.currentAccount?.name || '未登录'
})

// 面板头像取值与农场首页一致：在线头像 > 账号头像 > QQ 头像 > 首字母
const avatarFailed = ref(false)
const avatarSrc = computed(() => {
  const acc = account.currentAccount
  if (!acc)
    return ''
  const live = status.currentStatusReady
    ? String(status.status?.status?.avatar || status.status?.status?.avatarUrl || '').trim()
    : ''
  const explicit = live || String(acc.avatar || '').trim()
  if (explicit)
    return explicit
  const qq = String(acc.uin || acc.qq || '').trim()
  if (qq && /^\d+$/.test(qq))
    return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  return ''
})
watch(() => account.currentAccountId, () => {
  avatarFailed.value = false
})

const platform = computed(() => getPlatformLabel(account.currentAccount?.platform))
const levelText = computed(() => profile.data.value?.level ?? status.status?.status?.level ?? '—')
const expProgress = computed(() => profile.data.value?.levelProgress ?? status.status?.levelProgress ?? null)
const expRate = computed(() => {
  const gain = Number(status.status?.sessionExpGained || 0)
  const uptime = Number(status.status?.uptime || 0)
  if (!uptime)
    return '0/小时'
  return `${Math.floor(gain / (uptime / 3600))}/小时`
})
function getExpPercent(progress: any) {
  return progress?.needed ? Math.max(0, Math.min(100, progress.current / progress.needed * 100)) : 0
}
function itemCount(id: number) {
  if (!ranch.data || ranch.data.sectionErrors?.warehouse)
    return null
  return (ranch.data.items || []).filter((item: any) => Number(item.id) === id).reduce((sum: bigint, item: any) => sum + BigInt(item.count || 0), 0n).toString()
}
function fmt(value: string | null) {
  return value == null ? '—' : formatCouponAmount(value)
}
function canHours(id: number) {
  const value = itemCount(id)
  return value == null ? '—' : `${(Number(value) / 3600).toFixed(1)}h`
}
function illustratedLevel(level: unknown) {
  return level == null ? '—' : `Lv.${level}`
}

// 与农场首页同构的资源卡：一行 4 个，共 2 行 + 牧草/便便补充行
const resourceCards = computed(() => [
  { key: 'gold-coupon', label: '金券', icon: '/game-config/seed_images_named/1007_金券.png', amount: fmt(itemCount(1007)) },
  { key: 'pine', label: '松果', icon: '/game-config/seed_images_named/1008.png', amount: fmt(itemCount(1008)) },
  { key: 'coupon', label: '点券', icon: '/game-config/resource-icons/coupon.png', amount: status.currentStatusReady ? formatCouponAmount(status.status?.status?.coupon ?? 0) : '—' },
  { key: 'diamond', label: '钻石', icon: '/game-config/resource-icons/diamond.png', amount: status.currentStatusReady ? formatCouponAmount(status.status?.status?.diamond ?? 0) : '—' },
  { key: 'can-normal', label: '普通', icon: '/game-config/ranch-icons/can-normal.png', amount: canHours(7003) },
  { key: 'can-organic', label: '有机', icon: '/game-config/ranch-icons/can-organic.png', amount: canHours(7004) },
  { key: 'illus-normal', label: '普通图鉴', icon: '/game-config/ranch-icons/illustrated-normal.png', amount: illustratedLevel(illustrated.data.value?.currentLevel), illustrated: true },
  { key: 'illus-giant', label: '巨大图鉴', icon: '/game-config/ranch-icons/illustrated-giant.png', amount: illustratedLevel(illustrated.data.value?.weightScore?.currentId), illustrated: true },
  { key: 'grass', label: '牧草', icon: '/game-config/seed_images_named/7001_牧草.png', amount: fmt(itemCount(7001)) },
  { key: 'poop', label: '便便', icon: '/game-config/ranch-icons/poop.png', amount: fmt(itemCount(7002)) },
])

const operationIcons: Record<string, { icon: string, color?: string }> = {
  collect: { icon: 'i-carbon-shopping-bag' },
  harvest: { icon: 'i-carbon-crop-growth' },
  clean: { icon: 'i-carbon-clean' },
  place: { icon: 'i-fas-paw' },
  produce: { icon: 'i-carbon-play' },
  addFeed: { icon: 'i-carbon-sprout' },
  submitOrder: { icon: 'i-carbon-task-complete' },
  refreshOrder: { icon: 'i-carbon-renew' },
  claimIllustrated: { icon: 'i-carbon-gift' },
  claimWeight: { icon: 'i-carbon-trophy' },
  claimTask: { icon: 'i-carbon-task-complete' },
  claimDailyShare: { icon: 'i-carbon-share' },
  claimFreeGift: { icon: 'i-carbon-gift' },
  friendProduce: { icon: 'i-carbon-tools' },
  friendFeed: { icon: 'i-carbon-sprout' },
  activateFacility: { icon: 'i-carbon-unlocked' },
  steal: { icon: 'i-carbon-run' },
  help: { icon: 'i-carbon-user-multiple' },
  stroke: { icon: 'i-carbon-favorite' },
  sell: { icon: 'i-carbon-shopping-cart' },
  buy: { icon: 'i-carbon-shopping-cart' },
  useCan: { icon: 'i-carbon-chemistry', color: 'text-green-500' },
}
const filteredOperations = computed(() => ranchTodayOperations(ranch.data?.operations, ranch.data?.operationsDate, clock.value))
function formatDuration(seconds: number) {
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
  return `${pad(seconds / 3600)}:${pad(seconds % 3600 / 60)}:${pad(seconds % 60)}`
}
</script>

<template>
  <div class="flex flex-col gap-5 pt-1 md:pt-2">
    <div v-if="!account.currentAccountId" class="ui-card rounded-lg p-8 text-center text-gray-500">
      请先选择账号
    </div>
    <p v-else-if="ranch.error && ranch.error !== '账号未运行'" class="text-sm text-red-500" role="alert">
      {{ ranch.error }}
    </p>

    <!-- 与农场首页同款毛玻璃面板：用户信息 + 资源卡 + 下次检查倒计时 -->
    <div class="game-home">
      <div class="glass-panel home-panel">
        <div class="user-info-row">
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
                <span class="user-level">Lv.{{ levelText }}</span>
              </div>
              <div class="user-line">
                <span
                  v-if="platform"
                  class="user-platform"
                  :class="getPlatformClass(account.currentAccount?.platform)"
                >{{ platform }}</span>
                <span class="user-expire">到期：{{ expireTimeText }}</span>
              </div>
            </div>
          </div>

          <div class="home-status">
            <div class="status-indicator">
              <span class="status-dot" :class="status.status?.connection?.connected ? 'online' : 'offline'" />
              <span class="status-text">{{ status.status?.connection?.connected ? '在线' : status.currentStatusReady ? '离线' : '检查中' }}</span>
            </div>
            <div class="home-status-uptime">
              <span class="i-carbon-time" />
              <span>已运行 {{ formatDuration(status.status?.uptime || 0) }}</span>
            </div>
          </div>
        </div>

        <div class="exp-section">
          <div class="exp-meta">
            <span class="exp-rate">
              <span class="exp-bolt i-fas-bolt" />
              EXP 效率：{{ expRate }}
            </span>
            <span class="exp-total">{{ expProgress?.current ?? 0 }} / {{ expProgress?.needed ?? 0 }}</span>
          </div>
          <div class="exp-bar-row">
            <div class="exp-progress-bar">
              <div class="exp-progress-fill" :style="{ width: `${getExpPercent(expProgress)}%` }" />
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
              <img :src="res.icon" :alt="res.label" class="resource-icon" :class="{ 'ranch-illustrated-icon': res.illustrated }">
            </div>
            <div class="resource-info">
              <div class="resource-label">{{ res.label }}</div>
              <div class="resource-amount">{{ res.amount }}</div>
            </div>
          </div>
        </div>

        <div class="home-countdown-divider" />
        <div class="home-countdowns">
          <div v-for="check in checks" :key="check.key" class="min-w-0 flex flex-col items-center text-center">
            <div
              class="h-18 w-18 flex items-center justify-center rounded-full p-1"
              :style="{ background: `conic-gradient(${check.color} ${check.progress}%, color-mix(in srgb, ${check.color} 14%, transparent) 0)` }"
            >
              <div class="h-full w-full flex flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800">
                <div class="text-xl" :class="[check.icon, check.text]" /><span class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ check.label }}</span>
              </div>
            </div>
            <div class="mt-1.5 w-full truncate text-sm font-bold font-mono 2xl:text-base" :title="check.value">
              {{ check.value }}
            </div>
          </div>
        </div>
        <p v-if="ranch.data?.sectionErrors?.warehouse" class="text-xs text-red-500">
          库存读取失败
        </p>
      </div>
    </div>

    <div class="flex flex-1 flex-col items-stretch gap-5 md:min-h-0 md:flex-row">
      <div class="ranch-log-panel flex flex-1 flex-col gap-5 md:min-h-0 md:w-3/4">
        <RuntimeLogPanel scene="ranch" />
      </div>

      <div class="flex flex-col gap-4 md:min-h-0 md:w-1/4 md:overflow-hidden">
        <div class="glass-card-lg min-h-0 flex flex-1 flex-col overflow-hidden p-4">
          <h3 class="mb-3 flex items-center gap-2 text-base font-medium 2xl:text-lg">
            <div class="i-carbon-chart-column" />
            <span>今日统计</span>
          </h3>
          <p class="mb-2 text-[10px] text-gray-400">
            今日请求完成数（不含启动前历史）
          </p>
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
          <div v-else class="grid auto-rows-fr grid-cols-2 min-h-0 flex-1 gap-1.5 2xl:gap-2">
            <div
              v-for="(val, key) in filteredOperations"
              :key="key"
              class="ui-subtle-panel min-w-0 flex items-center justify-between rounded-lg px-2 py-1.5"
            >
              <div class="min-w-0 flex items-center gap-1.5">
                <div class="text-base text-green-500 2xl:text-lg" :class="[operationIcons[key]?.icon || 'i-carbon-chart-column']" />
                <div class="truncate text-xs text-gray-500 2xl:text-sm" :title="ranchActionLabels[key] || String(key)">
                  {{ ranchActionLabels[key] || key }}
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
  </div>
</template>

<style scoped>
/* 与农场首页 Dashboard.vue 同一套游戏化样式（scoped，故整组复制） */
.game-home {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 14px;
}

.game-card {
  position: relative;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.28) 100%);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.glass-panel {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  padding: 12px;
}

/* 今日统计卡：与农场 Dashboard 同款毛玻璃卡片（scoped，需在本页声明） */
.glass-card-lg {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.home-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

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

/* 牧场各资源的柔和底色（半透明玻璃着色） */
.res-gold-coupon {
  background: linear-gradient(165deg, rgba(255, 224, 145, 0.6) 0%, rgba(255, 248, 228, 0.24) 100%);
}

.res-pine {
  background: linear-gradient(165deg, rgba(252, 211, 77, 0.55) 0%, rgba(255, 251, 235, 0.24) 100%);
}

.res-coupon {
  background: linear-gradient(165deg, rgba(178, 240, 205, 0.6) 0%, rgba(240, 252, 244, 0.24) 100%);
}

.res-diamond {
  background: linear-gradient(165deg, rgba(183, 222, 252, 0.6) 0%, rgba(238, 248, 255, 0.24) 100%);
}

.res-can-normal {
  background: linear-gradient(165deg, rgba(214, 240, 178, 0.6) 0%, rgba(246, 252, 236, 0.24) 100%);
}

.res-can-organic {
  background: linear-gradient(165deg, rgba(178, 240, 205, 0.6) 0%, rgba(240, 252, 244, 0.24) 100%);
}

.res-illus-normal {
  background: linear-gradient(165deg, rgba(196, 226, 252, 0.6) 0%, rgba(243, 249, 255, 0.24) 100%);
}

.res-illus-giant {
  background: linear-gradient(165deg, rgba(226, 212, 252, 0.6) 0%, rgba(248, 244, 255, 0.24) 100%);
}

.res-grass {
  background: linear-gradient(165deg, rgba(190, 242, 160, 0.55) 0%, rgba(247, 254, 238, 0.24) 100%);
}

.res-poop {
  background: linear-gradient(165deg, rgba(222, 205, 176, 0.6) 0%, rgba(252, 248, 240, 0.24) 100%);
}

/* 资源数值：按资源着色并放大 */
.res-gold-coupon .resource-amount {
  color: #d97706;
}

.res-pine .resource-amount {
  color: #b45309;
}

.res-coupon .resource-amount {
  color: #059669;
}

.res-diamond .resource-amount {
  color: #0284c7;
}

.res-can-normal .resource-amount {
  color: #4d7c0f;
}

.res-can-organic .resource-amount {
  color: #059669;
}

.res-illus-normal .resource-amount {
  color: #0284c7;
}

.res-illus-giant .resource-amount {
  color: #7c3aed;
}

.res-grass .resource-amount {
  color: #65a30d;
}

.res-poop .resource-amount {
  color: #92400e;
}

.resource-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(31, 38, 80, 0.15));
}

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

.home-countdown-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(31, 38, 80, 0.14) 15%, rgba(31, 38, 80, 0.14) 85%, transparent);
}

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

/* 移动端断点与农场首页保持同一档位（640 → 560 → 480） */
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
}

@media (max-width: 560px) {
  .glass-panel {
    padding: 8px;
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

  .game-card {
    border-radius: 16px;
  }

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

/* 日志列表：桌面端与农场首页一致，限高 50vh 内部滚动，页面本身交给外层滚动 */
@media (min-width: 768px) {
  .ranch-log-panel :deep(.ui-subtle-panel) {
    max-height: 50vh;
  }
}

/* 官方淡黄底图需要更强分隔 */
.ranch-illustrated-icon {
  filter: brightness(0.82) saturate(1.3);
}
</style>
