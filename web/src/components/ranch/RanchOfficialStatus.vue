<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { ranchSnapshotNow } from '@/utils/ranch-animal-progress'
import { officialAnimalStatus } from '@/utils/ranch-official-status'

const props = defineProps<{ animal: any, serverTime?: number, syncedAt?: number }>()
defineEmits<{ details: [] }>()
const now = ref(Date.now())
useIntervalFn(() => {
  if (!document.hidden)
    now.value = Date.now()
}, 1000)
const state = computed(() => officialAnimalStatus(props.animal, ranchSnapshotNow(props, now.value)))
</script>

<template>
  <button type="button" class="official-status" :aria-label="`${animal.name}，${state.stage}${state.time}，点击查看详情`" @pointerdown.stop @click.stop="$emit('details')">
    <img class="animal-icon" :src="animal.statusConfig?.icon || animal.image" :alt="animal.name" draggable="false">
    <span v-if="state.count" class="round-count">{{ state.count }}</span>
    <span class="official-progress">
      <span v-if="state.percent !== null" class="progress-fill" :style="{ width: `${state.percent}%` }" />
      <img v-for="mark in state.marks" :key="mark" class="stage-mark" src="/ranch/animal-status/animalstatedsfenge.png" alt="" :style="{ left: `${Math.max(4, Math.min(96, mark))}%` }">
    </span>
    <span class="stage-text">{{ state.stage }}<strong>{{ state.time }}</strong></span>
  </button>
</template>

<style scoped>
.official-status {
  transform: scale(0.8);
  transform-origin: top left;
  position: relative;
  display: block;
  width: 282px;
  height: 87px;
  border: 0;
  padding: 0;
  background: url('/ranch/animal-status/tuditanchuang.png') 0 0 / 100% 100% no-repeat;
  color: #8e4d2c;
  text-align: left;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}
.animal-icon {
  position: absolute;
  left: 9px;
  top: 10px;
  width: 58px;
  height: 58px;
  object-fit: contain;
}
.round-count {
  position: absolute;
  left: 12px;
  top: 51px;
  width: 54px;
  text-align: center;
  color: #70452d;
  text-shadow:
    1px 1px #fff,
    -1px -1px #fff;
}
.official-progress {
  position: absolute;
  left: 85px;
  top: 18px;
  width: 167px;
  height: 16px;
  background: url('/ranch/animal-status/animalstatebg.png') center / 100% 100%;
}
.progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: url('/ranch/animal-status/animalstateprocess.png') left / 167px 16px;
}
.stage-mark {
  position: absolute;
  width: 11px;
  height: 6px;
  top: -6px;
  transform: translateX(-50%);
}
.stage-text {
  position: absolute;
  left: 85px;
  top: 40px;
  white-space: nowrap;
  font-size: 16px;
}
.stage-text strong {
  color: #75b431;
}
button:focus-visible {
  outline: 3px solid #80b736;
  outline-offset: 2px;
}
</style>
