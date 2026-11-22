<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import api from '@/api'
import AnnouncementPopup from '@/components/AnnouncementPopup.vue'
import NavMenuButton from '@/components/game/NavMenuButton.vue'
import MysteryMerchantBanner from '@/components/shop/MysteryMerchantBanner.vue'
import Sidebar from '@/components/Sidebar.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import TopAccountMenu from '@/components/TopAccountMenu.vue'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'
import { useSceneStore } from '@/stores/scene'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const sceneStore = useSceneStore()

// 农场 / 牧场是两个场景：切换后路径跟着走，避免一个场景里渲染另一个场景的页面
watch([() => sceneStore.scene, () => route.path], ([scene, path]) => {
  if (path === '/settings' || path.startsWith('/admin'))
    return
  if (scene === 'ranch' && !path.startsWith('/ranch'))
    router.replace('/ranch')
  if (scene === 'farm' && path.startsWith('/ranch'))
    router.replace('/')
}, { immediate: true })

const accountStore = useAccountStore()
const statusStore = useStatusStore()
const userStore = useUserStore()
const { currentAccount } = storeToRefs(accountStore)
const { status, realtimeConnected, currentStatusReady } = storeToRefs(statusStore)

// 调度器当前运行场景：取自 worker 的 ranchSession 快照（status.sceneScheduler.scene），
// 实时反映 worker 此刻占用连接在跑农场还是牧场。与用户手动选择的浏览场景（sceneStore）
// 是两套概念——这里只做只读展示，不影响导航与路由。
const sceneIndicator = computed(() => {
  const hasAccount = !!currentAccount.value
  const connected = !!status.value?.connection?.connected
  if (!hasAccount)
    return { text: '未连接', dot: 'bg-gray-400', title: '未选择账号' }
  if (!currentStatusReady.value || !connected)
    return { text: '离线', dot: 'bg-gray-400', title: '调度器未连接' }
  const scene = status.value?.sceneScheduler?.scene
  if (scene === 'farm')
    return { text: '调度·农场', dot: 'bg-green-500', title: '调度器当前运行场景：农场' }
  if (scene === 'ranch')
    return { text: '调度·牧场', dot: 'bg-teal-500', title: '调度器当前运行场景：牧场' }
  return { text: '待命', dot: 'bg-gray-400', title: '调度器空闲，无任务执行' }
})

// 概览页的面板里已有头像，其他页面才在右上角账号菜单显示当前账号头像（农场/牧场概览一致）
const showAccountAvatar = computed(() => route.name !== 'dashboard' && !(route.name === 'ranch' && !route.params.section))

// 原侧边栏的系统保活逻辑：ping、账号轮询、实时状态连接
const wsErrorNotifiedAt = ref<Record<string, number>>({})

async function checkConnection() {
  try {
    const res = await api.get('/api/ping')
    if (res.data?.ok) {
      const accountRef = currentAccount.value?.id || currentAccount.value?.uin
      if (accountRef)
        statusStore.connectRealtime(String(accountRef))
    }
  }
  catch {
    // 网络异常时静默，等待下轮重试
  }
}

async function refreshStatusFallback() {
  if (realtimeConnected.value)
    return
  const accountRef = currentAccount.value?.id || currentAccount.value?.uin
  if (accountRef)
    await statusStore.fetchStatus(String(accountRef))
}

onMounted(() => {
  appStore.fetchLoginPageConfig()
  accountStore.fetchAccounts()
  checkConnection()
  userStore.fetchUserInfo()
})

onBeforeUnmount(() => {
  statusStore.disconnectRealtime()
})

useIntervalFn(checkConnection, 30000)
useIntervalFn(() => {
  refreshStatusFallback()
  accountStore.fetchAccounts({ silent: true })
}, 10000)

watch(() => currentAccount.value?.id || currentAccount.value?.uin || '', () => {
  const accountRef = currentAccount.value?.id || currentAccount.value?.uin
  statusStore.connectRealtime(String(accountRef || ''))
  refreshStatusFallback()
}, { immediate: true })

watch(() => status.value?.wsError, (wsError: any) => {
  if (!wsError || Number(wsError.code) !== 400 || !currentAccount.value)
    return
  const errAt = Number(wsError.at) || 0
  const accId = String(currentAccount.value.id || currentAccount.value.uin || '')
  const lastNotified = wsErrorNotifiedAt.value[accId] || 0
  if (errAt <= lastNotified)
    return

  wsErrorNotifiedAt.value[accId] = errAt
  router.push('/settings')
}, { deep: true })
</script>

<template>
  <div class="dashboard-layout w-screen flex overflow-hidden" style="height: 100dvh;">
    <!-- Dashboard Background Image（PC / 移动端分别在 style.css 内切换） -->
    <div class="dashboard-bg" />

    <!-- PC 端常驻侧边栏（移动端默认隐藏，不影响左上角按钮） -->
    <Sidebar />

    <main class="relative h-full min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
      <!-- 顶栏：左侧导航菜单按钮（仅移动端），右侧主题 / 账号 -->
      <header class="relative z-30 flex shrink-0 items-center justify-between gap-4 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-5">
        <NavMenuButton class="lg:hidden" />

        <!-- 调度器当前运行场景指示器（全局常驻，PC/移动端均可见） -->
        <div class="scene-indicator" :title="sceneIndicator.title">
          <span class="scene-indicator-dot" :class="sceneIndicator.dot" />
          <span class="scene-indicator-text">{{ sceneIndicator.text }}</span>
        </div>

        <!-- 移动端：农牧场场景切换，顶部居中（绝对定位保证视觉正中，不受两侧按钮宽度影响） -->
        <div
          class="scene-pill absolute left-1/2 top-4 flex -translate-x-1/2 items-center lg:hidden"
          role="group"
          aria-label="农牧场切换"
        >
          <button
            v-for="option in (['farm', 'ranch'] as const)"
            :key="option"
            class="h-8 rounded-full px-3 text-[13px] font-medium transition-colors"
            :aria-pressed="sceneStore.scene === option"
            :style="sceneStore.scene === option
              ? { background: 'var(--theme-gradient)', color: '#fff' }
              : { color: 'var(--theme-text)' }"
            @click="sceneStore.select(option)"
          >
            {{ option === 'farm' ? '农场' : '牧场' }}
          </button>
        </div>

        <div class="ml-auto flex items-center gap-2 sm:gap-4">
          <ThemeToggle />

          <TopAccountMenu :show-avatar="showAccountAvatar" />
        </div>
      </header>

      <!-- Main Content Area -->
      <div class="custom-scrollbar min-h-0 flex flex-1 flex-col overflow-y-auto p-3 pb-6 sm:p-4 sm:pb-6 md:p-6 md:pb-8 lg:p-7 lg:pt-4 lg:pb-8">
        <MysteryMerchantBanner v-if="sceneStore.scene === 'farm'" />
        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition name="slide-fade" mode="out-in">
            <component
              :is="Component"
              v-if="viewRoute.path === '/settings' || viewRoute.path.startsWith('/admin') || (sceneStore.scene === 'ranch' ? viewRoute.path.startsWith('/ranch') : !viewRoute.path.startsWith('/ranch'))"
              :key="viewRoute.path"
            />
            <div v-else key="scene-switching" class="page-stack">
              <div class="ui-card rounded-lg p-6 text-sm opacity-70" role="status">
                正在切换页面…
              </div>
            </div>
          </Transition>
        </RouterView>
      </div>
    </main>

    <AnnouncementPopup />
  </div>
</template>

<style scoped>
/* 移动端农牧场切换：与顶栏圆形图标按钮同一套毛玻璃视觉 */
.scene-pill {
  height: 40px;
  padding: 4px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.dark .scene-pill {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(31, 41, 55, 0.6);
}

/* 顶栏左侧：调度器当前运行场景指示器，与顶栏毛玻璃按钮同一套视觉 */
.scene-indicator {
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.dark .scene-indicator {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(31, 41, 55, 0.6);
  color: #e5e7eb;
}

.scene-indicator-dot {
  height: 8px;
  width: 8px;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
}

.scene-indicator-text {
  line-height: 1;
}

/* Dashboard Layout */
.dashboard-layout {
  position: relative;
}

/* 顶栏圆形图标按钮（主题 / 活动）：与首页毛玻璃框同一套视觉，圆角保持圆形 */
header :deep(.icon-btn) {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 30px rgba(31, 38, 80, 0.1);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

header :deep(.icon-btn:hover) {
  background: rgba(255, 255, 255, 0.55);
}

/* Slide Fade Transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease-out;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
}

.custom-scrollbar {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
</style>
