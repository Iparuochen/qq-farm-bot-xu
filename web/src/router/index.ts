import { useStorage } from '@vueuse/core'
import axios from 'axios'
import NProgress from 'nprogress'
import { createRouter, createWebHistory } from 'vue-router'
import { menuRoutes } from './menu'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false })

const adminToken = useStorage('admin_token', '')
const userInfo = useStorage('user_info', '')
let sessionPromise: Promise<boolean> | null = null
let sessionBootstrapAttempted = false

async function ensureAdminSession() {
  // 管理页面采用宽松鉴权：已有 token 时直接放行，不在导航时重复校验。
  if (adminToken.value || sessionBootstrapAttempted)
    return true

  if (!sessionPromise) {
    sessionBootstrapAttempted = true
    sessionPromise = axios.post('/api/auto-login', {}, { timeout: 6000 })
      .then(({ data }) => {
        if (!data?.ok)
          return false
        adminToken.value = data.data.token
        userInfo.value = JSON.stringify({
          username: 'admin',
          role: 'admin',
          card: null,
          accountLimit: data.data.accountLimit,
          mustChangePassword: false,
        })
        return true
      })
      .catch(() => false)
      .finally(() => { sessionPromise = null })
  }
  return sessionPromise
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      children: [
        ...menuRoutes.map(route => ({
          path: route.path,
          name: route.name,
          component: route.component,
        })),
        // 牧场是「场景」而非菜单项：左栏切到牧场后换成 ranchMenu 那套导航
        { path: 'ranch/warehouse', redirect: '/ranch/personal?view=warehouse' },
        { path: 'ranch/buildings', redirect: '/ranch/personal' },
        { path: 'ranch/orders', redirect: '/ranch/personal?view=orders' },
        {
          path: 'ranch/:section(overview|personal|friends|activity|shop|illustrated|analytics)?',
          name: 'ranch',
          component: () => import('@/views/Ranch.vue'),
        },
      ],
    },
    { path: '/admin', redirect: '/settings?tab=system' },
    { path: '/login', name: 'login', component: () => import('@/views/Login.vue') },
    { path: '/renewal', name: 'renewal', component: () => import('@/views/Renewal.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  NProgress.start()
  const ok = await ensureAdminSession()
  if (!ok && to.name !== 'login' && to.name !== 'renewal') {
    return { name: 'login' }
  }
  return true
})

router.afterEach(() => NProgress.done())

export default router
