<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ranchSnapshotNow } from '@/utils/ranch-animal-progress'
import { officialAnimalStatus } from '@/utils/ranch-official-status'

const props = defineProps<{ animal: any, anchor: HTMLElement, ranchName: string, serverTime?: number, syncedAt?: number }>()
const emit = defineEmits<{ close: [] }>()
const localNow = ref(Date.now())
useIntervalFn(() => {
  if (!document.hidden)
    localNow.value = Date.now()
}, 1000)
const state = computed(() => officialAnimalStatus(props.animal, ranchSnapshotNow(props, localNow.value)))
const income = computed(() => (props.animal.expectedHarvestSells || []).find((item: any) => String(item.id) === '1007')?.count)
const bubble = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({ visibility: 'hidden' })
const below = ref(false)
async function position() {
  await nextTick()
  if (!bubble.value || !props.anchor.isConnected)
    return
  const rect = props.anchor.getBoundingClientRect()
  const width = bubble.value.getBoundingClientRect().width
  const height = bubble.value.getBoundingClientRect().height
  below.value = rect.top < height + 18 && window.innerHeight - rect.bottom > rect.top
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))
  const top = Math.max(8, Math.min(window.innerHeight - height - 8, below.value ? rect.bottom + 12 : rect.top - height - 12))
  style.value = { 'left': `${left}px`, 'top': `${top}px`, '--arrow-left': `${Math.max(20, Math.min(width - 20, rect.left + rect.width / 2 - left))}px` }
}
function outside(event: PointerEvent) {
  if (!bubble.value?.contains(event.target as Node) && !props.anchor.contains(event.target as Node))
    emit('close')
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    props.anchor.focus()
  }
}
function scroll(event: Event) {
  if (!bubble.value?.contains(event.target as Node))
    void position()
}
watch(() => [props.anchor, props.animal.animalInstId], position, { flush: 'post' })
onMounted(() => {
  void position()
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', keydown)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', scroll, true)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', keydown)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', scroll, true)
})
</script>

<template>
  <Teleport to="body">
    <aside ref="bubble" role="dialog" :aria-label="`${animal.name}详情`" class="official-details" :style="style" @click.stop>
      <header>
        <strong>{{ animal.name }}</strong><span v-if="state.quality">{{ state.quality }}品</span><button type="button" aria-label="关闭详情" @click="$emit('close')">
          ×
        </button>
      </header>
      <div class="animal-summary">
        <div class="portrait">
          <img :src="animal.statusConfig?.icon || animal.image" :alt="animal.name"><b v-if="state.count">{{ state.count }}</b>
        </div>
        <dl>
          <div v-if="animal.expectedHarvestExp != null">
            <dt>经验</dt><dd>{{ animal.expectedHarvestExp }}</dd>
          </div>
          <div v-if="income != null">
            <dt>收入</dt><dd>{{ income }}</dd>
          </div>
          <div v-if="state.weight">
            <dt>重量</dt><dd>{{ state.weight }}</dd>
          </div>
        </dl>
      </div>
      <div class="official-stages">
        <span v-for="(label, i) in ['幼崽', '成长', '生产', '成熟']" :key="label" :class="{ active: (animal.stage === 5 ? 4 : animal.stage) === i + 1 }">{{ label }}</span>
      </div>
      <p class="yield-text">
        {{ state.yieldText }}
      </p>
      <p class="time-text">
        {{ state.allTime }}
      </p>
    </aside>
  </Teleport>
</template>

<style scoped>
.official-details {
  transform: scale(0.8);
  transform-origin: top left;
  position: fixed;
  z-index: 100;
  width: 288px;
  max-width: calc(100vw - 16px);
  padding: 16px;
  box-sizing: border-box;
  color: #99512f;
  background: url('/ranch/animal-status/img_plantinteractive_bg.png') center / 100% 100% no-repeat;
  font-size: 17px;
  font-weight: 700;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
}
header strong {
  flex: 1;
}
header > span {
  min-width: 45px;
  text-align: center;
  background: url('/ranch/animal-status/level_bg.png') center / 100% 100%;
  color: white;
}
header button {
  border: 0;
  background: transparent;
  color: #99512f;
}
.animal-summary {
  display: flex;
  gap: 12px;
  margin: 10px 0 18px;
}
.portrait {
  width: 64px;
  height: 64px;
  position: relative;
  flex-shrink: 0;
  background: url('/ranch/animal-status/seed_bg_1_1.png') center / contain no-repeat;
}
.portrait img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.portrait b {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  text-align: center;
  text-shadow: 1px 1px white;
}
dl {
  flex: 1;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
dt {
  color: #bba579;
}
dd {
  margin: 0;
}
.official-stages {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #dedab1;
  padding-top: 10px;
  color: #b3a684;
}
.official-stages span {
  border-radius: 12px;
  padding: 0 5px;
}
.official-stages .active {
  color: #916031;
  background: #f3e29e;
}
p {
  margin: 4px 0;
}
.yield-text {
  color: #65b72c;
}
.time-text {
  font-size: 15px;
}
</style>
