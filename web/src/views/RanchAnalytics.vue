<script setup lang="ts">
import { computed, ref } from 'vue'
import RanchPageShell from '@/components/ranch/RanchPageShell.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useRanchResource } from '@/composables/useRanchResource'

const page = ref('analytics')
const resource = useRanchResource(page)
const query = ref('')
const sort = ref('id')
const direction = ref('asc')
const animals = computed(() => {
  const rows = (resource.data.value?.animals || []).filter((a: any) => !query.value || String(a.name || '').includes(query.value) || String(a.id).includes(query.value))
  return rows.slice().sort((a: any, b: any) => (Number(a[sort.value] || 0) - Number(b[sort.value] || 0)) * (direction.value === 'asc' ? 1 : -1))
})
function duration(s: any) {
  const n = Number(s)
  return Number.isFinite(n) ? n >= 3600 ? `${(n / 3600).toFixed(2)} 小时` : `${n} 秒` : '—'
}
</script>

<template>
  <RanchPageShell title="分析" :loading="resource.loading.value" :busy="resource.busy.value" :error="resource.error.value" :has-data="!!resource.data.value" @refresh="resource.refresh">
    <p class="ui-card rounded-lg p-4 text-sm text-gray-500">
      {{ resource.data.value?.assumptions }}
    </p><div class="glass-panel flex flex-wrap items-center gap-3 rounded-lg p-3">
      <b>动物 {{ resource.data.value?.summary?.animalCount ?? animals.length }} 种</b><input v-model="query" class="rounded-lg border border-[var(--surface-border)] bg-white/70 px-3 py-2 outline-none transition-colors focus:border-[var(--theme-primary)] dark:bg-white/10" placeholder="搜索动物"><BaseSelect v-model="sort" :options="[{ label: '动物 ID', value: 'id' }, { label: '基础周期', value: 'cycleSeconds' }, { label: '收获经验/小时（基础）', value: 'harvestExpPerHour' }]" class="w-48" /><BaseSelect v-model="direction" :options="[{ label: '升序', value: 'asc' }, { label: '降序', value: 'desc' }]" class="w-24" />
    </div><div class="glass-panel overflow-x-auto rounded-lg">
      <table class="w-full whitespace-nowrap text-left text-sm">
        <thead class="bg-white/60 text-xs text-gray-500 uppercase backdrop-blur-sm dark:bg-white/5 dark:text-gray-400">
          <tr>
            <th class="p-3">
              动物
            </th><th class="p-3">
              窝/棚
            </th><th class="p-3">
              幼年/成长
            </th><th class="p-3">
              基础周期
            </th><th class="p-3">
              理论收获经验/小时
            </th><th class="p-3">
              生产周期
            </th><th class="p-3">
              生产轮数
            </th><th class="p-3">
              每轮产物
            </th><th class="p-3">
              副产物
            </th>
          </tr>
        </thead><tbody>
          <tr v-for="animal in animals" :key="animal.id" class="border-t border-gray-200 transition-colors hover:bg-white/50 dark:border-gray-700 dark:hover:bg-white/5">
            <td class="p-3 font-medium">
              {{ animal.name }}
            </td><td class="p-3">
              {{ animal.husbandryType }}
            </td><td class="p-3">
              {{ duration(animal.infantSec) }} / {{ duration(animal.growSec) }}
            </td><td class="p-3">
              {{ duration(animal.cycleSeconds) }}
            </td><td class="p-3">
              {{ animal.harvestExpPerHour == null ? '待确认' : Number(animal.harvestExpPerHour).toFixed(2) }}
            </td><td class="p-3">
              {{ duration(animal.productRoundSec) }}
            </td><td class="p-3">
              {{ animal.maxProduceCount ?? '—' }}
            </td><td class="p-3">
              {{ animal.productItem?.name || '—' }} × {{ animal.productItem?.count ?? '—' }}
            </td><td class="p-3">
              {{ animal.byproductItem?.name || '—' }} × {{ animal.byproductItem?.count ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </RanchPageShell>
</template>
