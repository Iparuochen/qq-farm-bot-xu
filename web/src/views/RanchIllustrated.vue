<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import RanchPageShell from '@/components/ranch/RanchPageShell.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useRanchResource } from '@/composables/useRanchResource'
import { useAccountStore } from '@/stores/account'

const page = ref('illustrated')
const resource = useRanchResource(page)
type BookTab = 'animals' | 'giant' | 'reward'
type FilterValue = 'all' | 'unlocked' | 'locked'
const bookTab = ref<BookTab>('animals')
const filter = ref<FilterValue>('all')
const bookTabs: Array<{ value: BookTab, label: string }> = [
  { value: 'animals', label: '动物图鉴' },
  { value: 'giant', label: '巨大化图鉴' },
  { value: 'reward', label: '图鉴奖励' },
]
const animalFilterTabs: Array<{ value: FilterValue, label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'unlocked', label: '已解锁' },
  { value: 'locked', label: '未解锁' },
]
const giantFilterTabs: Array<{ value: FilterValue, label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'unlocked', label: '已巨大化' },
  { value: 'locked', label: '未巨大化' },
]
const query = ref('')
const pending = ref<any>(null)
const account = useAccountStore()
watch(() => account.currentAccountId, () => {
  pending.value = null
})
async function claim() {
  const payload = pending.value
  pending.value = null
  if (payload)
    await resource.mutate(payload)
}

const rawList = computed<any[]>(() => resource.data.value?.list || [])

function matchesQuery(entry: any) {
  if (!query.value)
    return true
  const q = String(query.value).toLowerCase()
  return String(entry.fruitId).includes(q) || String(entry.name || '').toLowerCase().includes(q)
}

// 动物图鉴：按图鉴收录状态过滤
const animalsList = computed(() => rawList.value.filter((x: any) => {
  if (filter.value === 'unlocked' && !x.unlocked)
    return false
  if (filter.value === 'locked' && x.unlocked)
    return false
  return matchesQuery(x)
}))

// 巨大化图鉴：按巨大化个体状态过滤，已巨大化的排前面，再按最佳重量降序
const giantList = computed(() => rawList.value.filter((x: any) => {
  const giantUnlocked = !!x.giant?.unlocked
  if (filter.value === 'unlocked' && !giantUnlocked)
    return false
  if (filter.value === 'locked' && giantUnlocked)
    return false
  return matchesQuery(x)
}).slice().sort((a: any, b: any) => {
  const au = a.giant?.unlocked ? 1 : 0
  const bu = b.giant?.unlocked ? 1 : 0
  if (au !== bu)
    return bu - au
  return Number(b.giant?.bestWeightX10 || 0) - Number(a.giant?.bestWeightX10 || 0)
}))

const unlockedCount = computed(() => rawList.value.filter((x: any) => x.unlocked).length)
const giantUnlockedCount = computed(() => rawList.value.filter((x: any) => x.giant?.unlocked).length)

// 实机确认：best_weight_x10=1124 官方界面显示 11.24 kg，即 x10/100
function kg(x10: unknown) {
  return (Number(x10) / 100).toFixed(2)
}

function giantText(entry: any) {
  const g = entry.giant
  if (!g)
    return ''
  const tier = g.tierName || `T${g.tier}`
  const range = g.maxWeightX10 ? ` · 区间 ${kg(g.minWeightX10)}~${kg(g.maxWeightX10)} kg` : ''
  return `${tier} · 最佳 ${kg(g.bestWeightX10)} kg${range} · 收获 ${g.harvestCount ?? 0} 次`
}
</script>

<template>
  <RanchPageShell title="图鉴" :loading="resource.loading.value" :busy="resource.busy.value" :error="resource.error.value" :has-data="!!resource.data.value" @refresh="resource.refresh">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="ui-card rounded-lg p-4">
        牧场图鉴等级 {{ resource.data.value?.currentLevel ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        进度 {{ resource.data.value?.totalProgress ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        重量积分 {{ resource.data.value?.weightScore?.totalScore ?? '—' }}
      </div><div class="ui-card rounded-lg p-4">
        {{ resource.data.value?.hasClaimableReward ? '有可领奖励' : '暂无待领奖励' }}
      </div>
    </div><BaseButton :disabled="!resource.data.value?.hasClaimableReward || resource.busy.value || resource.loading.value" :loading="resource.busy.value" @click="pending = { action: 'claimIllustrated' }">
      领取图鉴奖励
    </BaseButton>

    <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
      <button
        v-for="row in bookTabs"
        :key="row.value"
        class="min-w-24 rounded-md px-3 text-sm font-medium transition"
        :class="bookTab === row.value ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'"
        :style="bookTab === row.value ? { backgroundColor: 'var(--theme-primary)' } : {}"
        @click="bookTab = row.value"
      >
        {{ row.label }}
      </button>
    </div>

    <template v-if="bookTab === 'animals'">
      <div class="flex flex-wrap items-center gap-2">
        <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            v-for="row in animalFilterTabs"
            :key="row.value"
            class="rounded-md px-3 text-sm transition"
            :class="filter === row.value ? 'bg-gray-100 text-gray-900 font-medium dark:bg-gray-700 dark:text-gray-100' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'"
            @click="filter = row.value"
          >
            {{ row.label }}
          </button>
        </div>
        <span class="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
          已收录 {{ unlockedCount }} / {{ rawList.length }} 种
        </span>
        <input v-model="query" class="rounded-lg border border-[var(--surface-border)] bg-white/70 px-3 py-2 outline-none transition-colors focus:border-[var(--theme-primary)] dark:bg-white/10" placeholder="搜索动物或 ID">
      </div>

      <div v-if="!animalsList.length" class="ui-card rounded-lg p-8 text-center text-gray-500">
        暂无图鉴记录
      </div>
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article
          v-for="entry in animalsList"
          :key="`${entry.fruitId}-${entry.rarity}`"
          class="ui-card rounded-lg p-4 transition"
          :class="entry.unlocked ? '' : 'grayscale opacity-60'"
        >
          <img v-if="entry.image" :src="entry.image" :alt="entry.name" class="mx-auto mb-3 h-16 w-16 object-contain">
          <h2 class="font-semibold">
            {{ entry.name || `动物/产物 ${entry.fruitId}` }}
          </h2>
          <p class="mt-2 text-sm">
            <span
              class="rounded px-1.5 py-0.5 text-xs"
              :class="entry.unlocked ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ entry.unlocked ? '已解锁' : '未解锁' }}
            </span>
            · 进度 {{ entry.progress ?? '—' }}
          </p>
        </article>
      </div>
    </template>

    <template v-else-if="bookTab === 'giant'">
      <div class="flex flex-wrap items-center gap-2">
        <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            v-for="row in giantFilterTabs"
            :key="row.value"
            class="rounded-md px-3 text-sm transition"
            :class="filter === row.value ? 'bg-gray-100 text-gray-900 font-medium dark:bg-gray-700 dark:text-gray-100' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'"
            @click="filter = row.value"
          >
            {{ row.label }}
          </button>
        </div>
        <span class="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
          已巨大化 {{ giantUnlockedCount }} / {{ rawList.length }} 种
        </span>
        <input v-model="query" class="rounded-lg border border-[var(--surface-border)] bg-white/70 px-3 py-2 outline-none transition-colors focus:border-[var(--theme-primary)] dark:bg-white/10" placeholder="搜索动物或 ID">
      </div>

      <div v-if="!giantList.length" class="ui-card rounded-lg p-8 text-center text-gray-500">
        暂无巨大化记录
      </div>
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article
          v-for="entry in giantList"
          :key="`${entry.fruitId}-${entry.rarity}`"
          class="ui-card rounded-lg p-4 transition"
          :class="entry.giant?.unlocked ? '' : 'grayscale opacity-60'"
        >
          <div class="relative">
            <img v-if="entry.image" :src="entry.image" :alt="entry.name" class="mx-auto mb-3 h-16 w-16 object-contain">
            <span
              v-if="entry.giant?.isNew"
              class="absolute right-0 top-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
            >
              NEW
            </span>
          </div>
          <h2 class="font-semibold">
            {{ entry.name || `动物/产物 ${entry.fruitId}` }}
          </h2>
          <p class="mt-2 text-xs">
            <span
              class="rounded px-1.5 py-0.5"
              :class="entry.giant?.unlocked ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ entry.giant?.unlocked ? `巨大化 ${entry.giant.tierName || `T${entry.giant.tier}`}` : '巨大化未解锁' }}
            </span>
          </p>
          <p class="mt-1.5 text-xs text-gray-500">
            {{ entry.giant?.unlocked ? giantText(entry) : `已收录 ${entry.unlocked ? '是' : '否'} · 尚未获得巨大化个体` }}
          </p>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-2">
        <article class="ui-card rounded-lg p-4">
          <h2 class="font-semibold">
            图鉴等级奖励
          </h2><div v-for="level in resource.data.value?.levels?.levelList || []" :key="level.level" class="mt-3 border-t pt-3 text-sm">
            <p>Lv.{{ level.level }} · 所需进度 {{ level.pointCondition }} · {{ level.claimed ? '已领取' : level.canClaim ? '可领取' : '未达到' }}</p><p v-for="reward in level.rewards || []" :key="reward.id" class="mt-1 text-gray-500">
              {{ reward.name || `物品 ${reward.id}` }} × {{ reward.count }}
            </p>
          </div>
        </article><article class="ui-card rounded-lg p-4">
          <h2 class="font-semibold">
            重量积分奖励
          </h2><div v-for="level in resource.data.value?.weightScore?.levels || []" :key="level.id" class="mt-3 border-t pt-3 text-sm">
            <p>积分 {{ level.scoreCondition }} · {{ level.claimed ? '已领取' : level.canClaim ? '可领取' : '未达到' }}</p><p v-for="reward in level.rewards || []" :key="reward.id" class="mt-1 text-gray-500">
              {{ reward.name || `物品 ${reward.id}` }} × {{ reward.count }}
            </p><BaseButton class="mt-2" size="sm" :disabled="!level.canClaim || level.claimed || resource.busy.value || resource.loading.value" @click="pending = { action: 'claimWeight', id: level.id }">
              领取奖励
            </BaseButton>
          </div>
        </article>
      </div>
    </template>

    <div v-if="resource.data.value?.errors && Object.keys(resource.data.value.errors).length" class="text-sm text-amber-600">
      部分图鉴分区读取失败：{{ Object.values(resource.data.value.errors).join('；') }}
    </div><ConfirmModal :show="!!pending" title="领取牧场奖励" message="确认领取当前满足条件的奖励？" :loading="resource.busy.value" @confirm="claim" @cancel="pending = null" @close="pending = null" />
  </RanchPageShell>
</template>
