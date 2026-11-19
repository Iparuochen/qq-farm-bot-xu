import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAccountStore } from './account'

export const useSceneStore = defineStore('scene', () => {
  const account = useAccountStore()
  const selections = useStorage<Record<string, 'farm' | 'ranch'>>('account_web_scenes', {})
  const scene = computed(() => selections.value[account.currentAccountId || '_default'] === 'ranch' ? 'ranch' : 'farm')
  function select(value: 'farm' | 'ranch') {
    selections.value = { ...selections.value, [account.currentAccountId || '_default']: value }
  }
  return { scene, select }
})
