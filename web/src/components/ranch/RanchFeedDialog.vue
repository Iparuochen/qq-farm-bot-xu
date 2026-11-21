<script setup lang="ts">
import { useEventListener, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { feedAmount, feedCount, feedDialogState } from '@/utils/ranch-feed'

const props = defineProps<{ machine: any, items: any[], shop: any, busy: boolean, error?: string, unavailable?: boolean }>()
const emit = defineEmits<{ close: [], submit: [count: number] }>()
const base = '/ranch/add-grass/'
const icons = { grass: '/game-config/seed_images_named/7001_牧草.png', gold: '/game-config/seed_images_named/1007_金券.png' }
const state = computed(() => feedDialogState(props.machine, props.items, props.shop))
const count = ref(0)
watch(() => [props.machine?.instId, state.value.max], () => {
  count.value = state.value.max
}, { immediate: true })
const cost = computed(() => state.value.buy ? count.value * state.value.unitPrice : 0)
const canSubmit = computed(() => !props.busy && !props.unavailable && count.value > 0 && (!state.value.buy || (state.value.priceKnown && cost.value <= state.value.balance)))
const { width, height } = useWindowSize()
const scale = computed(() => Math.max(0.1, Math.min(0.52, (width.value - 32) / 650, (height.value - 64) / 800)))
const closeButton = ref<HTMLButtonElement>()
let previousFocus: HTMLElement | null = null
onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement
  await nextTick()
  closeButton.value?.focus()
})
onUnmounted(() => previousFocus?.focus())
function close() {
  if (!props.busy)
    emit('close')
}
function change(value: number) {
  count.value = feedCount(value, state.value.max)
}
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape')
    close()
  if (event.key === 'Tab') {
    const controls = Array.from(document.querySelectorAll<HTMLElement>('.feed-dialog button:not(:disabled), .feed-dialog input:not(:disabled)'))
    const index = controls.indexOf(document.activeElement as HTMLElement)
    event.preventDefault()
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="feed-overlay" @click.self="close">
      <div class="feed-shell" :style="{ width: `${650 * scale}px`, height: `${800 * scale}px` }">
        <section class="feed-dialog" role="dialog" aria-modal="true" aria-labelledby="feed-title" :aria-busy="busy" :style="{ transform: `scale(${scale})` }">
          <h2 id="feed-title">
            添加牧草
          </h2>
          <button ref="closeButton" class="feed-close art-button" aria-label="关闭" :disabled="busy" @click="close">
            <img :src="`${base}close.png`" alt="">
          </button>
          <div class="machine-icon">
            <img :src="`${base}machine${Math.min(8, Math.max(1, Number(machine.level) || 1))}.png`" alt="牧草机">
          </div>
          <strong class="machine-title">{{ machine.level }}级&nbsp; 牧草机</strong>
          <div class="feed-capacity">
            <div :style="{ width: `${state.capacity ? Math.min(100, (state.current + count) / state.capacity * 100) : 0}%` }" /><span>牧草剩余 <b :class="{ empty: !state.current }">{{ state.current }}</b>/{{ state.capacity }}</span>
          </div>
          <div class="feed-divider">
            <img :src="`${base}line.png`" alt=""><span>添加牧草至牧草机</span><img :src="`${base}line.png`" alt="">
          </div>
          <div class="feed-item">
            <img :src="icons.grass" alt="牧草">
          </div>
          <p class="feed-tip" :class="{ shortage: state.buy && state.space > 0 }">
            {{ !state.space ? '无需添加牧草' : state.buy ? '牧草不足' : `本次添加${count}颗牧草` }}
          </p>
          <div class="feed-controls">
            <button class="art-button" aria-label="减少牧草" :disabled="busy || count <= 1" @click="change(count - 1)">
              <img :src="`${base}minus.png`" alt="">
            </button>
            <input :value="count" aria-label="添加牧草数量" type="range" :min="state.max ? 1 : 0" :max="state.max" :disabled="busy || !state.max" :style="{ '--fill': `${state.max <= 1 ? 100 : (count - 1) / (state.max - 1) * 100}%` }" @input="change(Number(($event.target as HTMLInputElement).value))">
            <button class="art-button" aria-label="增加牧草" :disabled="busy || count >= state.max" @click="change(count + 1)">
              <img :src="`${base}plus.png`" alt="">
            </button>
            <button class="art-button" aria-label="最大数量" :disabled="busy || count >= state.max" @click="change(state.max)">
              <img :src="`${base}max.png`" alt="">
            </button>
          </div>
          <div class="feed-cost">
            <template v-if="state.buy && state.space">
              购买数量:{{ count }} <img :src="icons.gold" alt="金券"><span :class="{ shortage: !state.priceKnown || cost > state.balance }">{{ state.priceKnown ? feedAmount(cost) : '—' }}</span>
            </template>
            <template v-else-if="state.space">
              添加数量:{{ count }}
            </template>
          </div>
          <button class="feed-submit art-button" :disabled="!canSubmit" @click="emit('submit', count)">
            {{ busy ? '添加中…' : state.buy && state.space ? '购买并添加' : '添加' }}
          </button>
          <p v-if="error || unavailable || (state.buy && state.space && (!state.priceKnown || cost > state.balance))" class="feed-error" role="alert">
            {{ error || (unavailable ? '库存数据读取失败，请刷新后重试' : !state.priceKnown ? '牧草价格读取失败' : '金券不足') }}
          </p>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.feed-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0009;
}
.feed-shell {
  position: relative;
  flex: none;
}
.feed-dialog {
  position: absolute;
  top: 0;
  left: 0;
  width: 650px;
  height: 800px;
  transform-origin: top left;
  color: #8b492e;
  font-family: Arial, 'Microsoft YaHei', sans-serif;
  font-weight: 700;
  border: solid transparent;
  border-width: 78px 40px 64px;
  background: url('/ranch/add-grass/dialog-background.png') center / 100% 100% no-repeat;
  background-origin: border-box;
  box-sizing: border-box;
}
.feed-dialog h2 {
  position: absolute;
  left: 0;
  right: 0;
  top: -62px;
  margin: 0;
  text-align: center;
  font-size: 36px;
  line-height: 48px;
  color: #fff8e5;
}
.art-button {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.art-button img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.art-button:disabled {
  filter: grayscale(1);
  cursor: default;
}
.art-button:focus-visible,
input:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}
.feed-close {
  position: absolute;
  right: -49px;
  top: -102px;
  width: 98px;
  height: 98px;
}
.machine-icon {
  position: absolute;
  left: 4px;
  top: 44px;
  width: 136px;
  height: 136px;
  background: url('/ranch/add-grass/machine-bg.png') center/100% 100%;
}
.machine-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 16px;
  box-sizing: border-box;
}
.machine-title {
  position: absolute;
  left: 170px;
  top: 54px;
  font-size: 30px;
  white-space: nowrap;
}
.feed-capacity {
  position: absolute;
  left: 170px;
  top: 116px;
  width: 395px;
  height: 32px;
  background: url('/ranch/add-grass/capacity-bg.png') center/100% 100%;
  border-radius: 20px;
  overflow: hidden;
  text-align: center;
  color: #fff;
  font-size: 22px;
  line-height: 32px;
  text-shadow:
    0 1px 2px #48632c,
    -1px 0 #48632c,
    1px 0 #48632c;
}
.feed-capacity > div {
  position: absolute;
  inset: 3px auto 3px 3px;
  max-width: calc(100% - 6px);
  background: url('/ranch/add-grass/capacity.png') center/100% 100%;
  border-radius: 20px;
  opacity: 0.7;
}
.feed-capacity span {
  position: relative;
}
.empty,
.shortage {
  color: #ff503d;
}
.feed-divider {
  position: absolute;
  top: 191px;
  left: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-size: 26px;
}
.feed-divider img {
  width: 168px;
  height: 3px;
  flex: 1;
}
.feed-divider img:last-child {
  transform: rotate(180deg);
}
.feed-item {
  position: absolute;
  top: 245px;
  left: 227px;
  width: 116px;
  height: 118px;
  border: solid transparent;
  border-width: 12px 12px 15px;
  border-image: url('/ranch/add-grass/item-bg.png') 12 12 15 12 fill stretch;
  box-sizing: border-box;
}
.feed-item img {
  width: 84px;
  height: 90px;
  object-fit: contain;
  position: absolute;
  left: 4px;
  top: 0;
}
.feed-tip {
  position: absolute;
  top: 363px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 26px;
  margin: 0;
  line-height: 36px;
}
.feed-controls {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 416px;
  height: 104px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: url('/ranch/add-grass/controls.png') center/100% 100%;
}
.feed-controls button {
  width: 71px;
  height: 73px;
  flex: none;
}
.feed-controls input {
  appearance: none;
  width: 190px;
  height: 30px;
  border: 0;
  border-radius: 20px;
  background:
    linear-gradient(to right, transparent var(--fill), #dcc38c var(--fill)),
    url('/ranch/add-grass/slider-bar.png') center/100% 100%;
  box-shadow: inset 0 2px 4px #a88a51;
  cursor: pointer;
}
.feed-controls input::-webkit-slider-thumb {
  appearance: none;
  width: 64px;
  height: 64px;
  background: url('/ranch/add-grass/handle.png') center/contain no-repeat;
}
.feed-controls input::-moz-range-thumb {
  width: 64px;
  height: 64px;
  border: 0;
  background: url('/ranch/add-grass/handle.png') center/contain no-repeat;
}
.feed-cost {
  position: absolute;
  top: 538px;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 24px;
  color: #875c4b;
}
.feed-cost img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.feed-cost span {
  color: #4ca33c;
}
.feed-cost span.shortage {
  color: #ff503d;
}
.feed-submit {
  position: absolute;
  left: 158px;
  top: 582px;
  width: 254px;
  height: 92px;
  background: url('/ranch/add-grass/submit.png') center/100% 100%;
  color: #fff8dd;
  font-size: 36px;
  text-shadow: 0 2px 2px #688c19;
  padding-bottom: 10px;
  white-space: nowrap;
}
.feed-error {
  position: absolute;
  top: 679px;
  left: 0;
  right: 0;
  text-align: center;
  color: #c53224;
  font-size: 20px;
  margin: 0;
}
</style>
