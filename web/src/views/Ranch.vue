<script setup lang="ts">
/**
 * 牧场场景容器：分区由左侧 ranchMenu 决定，这里只按路由参数换视图。
 * 数据走 /api/ranch/* 快照接口。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import RanchActivity from './RanchActivity.vue'
import RanchAnalytics from './RanchAnalytics.vue'
import RanchDashboard from './RanchDashboard.vue'
import RanchFriends from './RanchFriends.vue'
import RanchIllustrated from './RanchIllustrated.vue'
import RanchPersonal from './RanchPersonal.vue'
import RanchShop from './RanchShop.vue'

const route = useRoute()
const component = computed(() => ({ overview: RanchDashboard, personal: RanchPersonal, friends: RanchFriends, activity: RanchActivity, shop: RanchShop, illustrated: RanchIllustrated, analytics: RanchAnalytics }[String(!route.params.section && route.query.view === 'orders' ? 'personal' : route.params.section || 'overview')] || RanchDashboard))
</script>

<template>
  <component :is="component" />
</template>
