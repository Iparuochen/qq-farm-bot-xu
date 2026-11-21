<script setup lang="ts">
import { useElementSize, useEventListener, useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { animalSlot, facilityCenter, panCamera, pointerPair, project, ranchCamera, zoomCamera } from '@/utils/ranch-world'
import RanchOfficialStatus from './RanchOfficialStatus.vue'
import RanchSceneList from './RanchSceneList.vue'

const props = defineProps<{ ranches: any[], facilities: any[], selectedId?: string, title?: string, world?: boolean, serverTime?: number, syncedAt?: number }>()
const emit = defineEmits<{ select: [id: string], feed: [facilityId: string], animal: [ranchId: string, animalId: string, anchor: HTMLElement] }>()
const viewport = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(viewport)
const focusedId = ref('')
const pan = ref({ x: 0, y: 0 })
const zoom = ref(1)
const pointers = new Map<number, { x: number, y: number }>()
const dragging = ref(false)
let gestureDistance = 0
let ignoreClicksUntil = 0
let lastPinchPair: { center: { x: number, y: number }, distance: number } | null = null
function stopGesture() {
  for (const id of pointers.keys()) {
    if (viewport.value?.hasPointerCapture(id))
      viewport.value.releasePointerCapture(id)
  }
  pointers.clear()
  dragging.value = false
  gestureDistance = 0
  lastPinchPair = null
}
useEventListener(window, 'blur', stopGesture)
useEventListener(document, 'visibilitychange', () => {
  if (document.hidden)
    stopGesture()
})
function reset() {
  stopGesture()
  focusedId.value = ''
  pan.value = { x: 0, y: 0 }
  zoom.value = 1
}
// Keep the camera across polling, but never across accounts or a changed facility set.
const account = useAccountStore()
watch(() => account.currentAccountId, reset, { flush: 'sync' })
watch(() => props.facilities.map(f => `${f.instId}:${f.state}`).join(','), reset)
const mobileViewport = useMediaQuery('(max-width: 639px)')
const baseCamera = computed(() => ranchCamera(props.facilities.some(f => f.facilityKind === 'MODULE_TYPE_RANCH_SHED' && f.state === 1)))
// Fill the available aspect ratio with one shared camera scale; never stretch only the background.
const defaultHalfHeight = computed(() => Math.min(baseCamera.value.halfHeight * (mobileViewport.value ? 0.78 : 1.25), 2391.5, width.value > 0 ? 2500 * height.value / width.value : 2391.5))
const halfHeight = computed(() => defaultHalfHeight.value * zoom.value)
const camera = computed(() => {
  const halfWidth = halfHeight.value * (width.value / Math.max(1, height.value))
  const limitX = Math.max(0, 2500 - halfWidth)
  const limitY = Math.max(0, 2391.5 - halfHeight.value)
  return { x: Math.max(-limitX, Math.min(limitX, baseCamera.value.x + pan.value.x)), y: -108.5 + Math.max(-limitY, Math.min(limitY, baseCamera.value.y + pan.value.y + 108.5)), halfHeight: Math.max(1, halfHeight.value) }
})
// Official BgSmallGround bounds. Background and subjects share the same camera,
// not a viewport-sized CSS cover image that remains still while subjects move.
const backgroundStyle = computed(() => {
  const p = project({ x: 0, y: -108.5 }, camera.value, width.value, height.value)
  return { left: `${p.x - 2500 * p.scale}px`, top: `${p.y - 4783 / 2 * p.scale}px`, width: `${5000 * p.scale}px`, height: `${4783 * p.scale}px` }
})
const positioned = computed(() => props.facilities.map((facility) => {
  const center = facilityCenter(facility)
  const ranch = props.ranches.find(r => String(r.ranchInstId) === String(facility.ranch?.ranchInstId))
  return { facility, center, ranch }
}).filter(entry => entry.center && entry.facility.visual?.layers?.length))
const missing = computed(() => props.facilities.length - positioned.value.length)
const animals = computed(() => positioned.value.flatMap(entry => (entry.ranch?.animals || []).map((animal: any) => {
  const local = animalSlot(animal.slotIndex, entry.ranch.capacity)
  return local ? { animal, ranchId: String(entry.ranch.ranchInstId), point: { x: entry.center!.x + local.x, y: entry.center!.y + local.y } } : null
}).filter(Boolean)).sort((a: any, b: any) => b.point.y - a.point.y))
const focused = computed(() => animals.value.find((entry: any) => `${entry.ranchId}:${entry.animal.animalInstId}` === focusedId.value))
watch(focused, (value) => {
  if (!value)
    focusedId.value = ''
})
const missingAnimals = computed(() => props.ranches.reduce((count, ranch) => count + (ranch.animals?.length || 0), 0) - animals.value.length)
function facilityArtScale(entry: any) {
  // Current grass machine is an 800x800 fallback icon, not the official Spine body.
  // Keep its display correction local; never change grid footprint or service data.
  return entry.facility.feedMachine ? 0.45 : 1
}
function signStyle(entry: any) {
  const sign = entry.facility.visual.layers.find((layer: any) => layer.image.endsWith('/chushi_wopeng_0.png'))
  if (!sign)
    return { display: 'none' }
  const p = project({ x: entry.center.x + sign.x, y: entry.center.y + sign.y + sign.height * sign.scaleY * 0.48 }, camera.value, width.value, height.value)
  return { left: `${p.x}px`, top: `${p.y}px`, width: `${sign.width * sign.scaleX * p.scale}px`, fontSize: `${28 * p.scale}px` }
}
function layerStyle(entry: any, layer: any) {
  const scale = facilityArtScale(entry)
  const p = project({ x: entry.center.x + layer.x * scale, y: entry.center.y + layer.y * scale }, camera.value, width.value, height.value)
  return { left: `${p.x - layer.width * scale * layer.scaleX * layer.anchorX * p.scale}px`, top: `${p.y - layer.height * scale * layer.scaleY * (1 - layer.anchorY) * p.scale}px`, width: `${layer.width * scale * layer.scaleX * p.scale}px`, height: `${layer.height * scale * layer.scaleY * p.scale}px` }
}
function markerStyle(point: { x: number, y: number }) {
  const p = project(point, camera.value, width.value, height.value)
  return { left: `${p.x}px`, top: `${p.y}px` }
}
function animalStyle(entry: any) {
  const p = project(entry.point, camera.value, width.value, height.value)
  // Existing exported idle images have no skeleton origin metadata yet: a presentation fallback.
  return { left: `${p.x}px`, top: `${p.y}px`, width: `${180 * p.scale * (entry.animal.visual?.scale || 1)}px` }
}
// 缩放范围：最近放大 2.2 倍；最远 PC 回到满景，手机可继续缩小到整图可见
const MIN_ZOOM = 0.4
const zoomOutLimit = computed(() => {
  if (!mobileViewport.value)
    return 1
  const fullMapHalfHeight = Math.min(2391.5, width.value > 0 ? 2500 * height.value / width.value : 2391.5)
  return Math.max(1, fullMapHalfHeight / defaultHalfHeight.value)
})
function applyZoom(nextHalfHeight: number, anchor: { x: number, y: number }) {
  const clamped = Math.max(defaultHalfHeight.value * MIN_ZOOM, Math.min(defaultHalfHeight.value * zoomOutLimit.value, nextHalfHeight))
  const next = zoomCamera({ ...camera.value }, clamped, anchor, width.value, height.value)
  if (next === camera.value)
    return
  zoom.value = next.halfHeight / defaultHalfHeight.value
  pan.value = { x: next.x - baseCamera.value.x, y: next.y - baseCamera.value.y }
}
function applyCamera(next: { x: number, y: number }) {
  pan.value = { x: Math.max(-1800, Math.min(1800, next.x - baseCamera.value.x)), y: Math.max(-1800, Math.min(1800, next.y - baseCamera.value.y)) }
}
function focusAnimal(entry: any) {
  emit('select', '')
  focusedId.value = `${entry.ranchId}:${entry.animal.animalInstId}`
  applyCamera(entry.point)
}
function openFocusedDetails() {
  const anchor = viewport.value?.querySelector('.official-status') as HTMLElement | null
  if (anchor)
    showDetails(anchor)
}
function showDetails(anchor: HTMLElement) {
  if (focused.value)
    emit('animal', focused.value.ranchId, String(focused.value.animal.animalInstId), anchor)
}
function localPoint(event: MouseEvent) {
  const rect = viewport.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}
function pointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0)
    return
  if (pointers.size === 0) {
    gestureDistance = 0
    dragging.value = false
    lastPinchPair = null
  }
  pointers.set(event.pointerId, localPoint(event))
  if (pointers.size >= 2) {
    dragging.value = true
    emit('select', '')
    focusedId.value = ''
    lastPinchPair = pointerPair([...pointers.values()])
  }
}
function pointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)
  if (!previous)
    return
  const point = localPoint(event)
  pointers.set(event.pointerId, point)
  if (pointers.size >= 2) {
    const pair = pointerPair([...pointers.values()])
    if (!pair)
      return
    if (lastPinchPair) {
      // 双指中点位移跟随平移，距离变化以中点为锚缩放
      applyCamera(panCamera(camera.value, { x: pair.center.x - lastPinchPair.center.x, y: pair.center.y - lastPinchPair.center.y }, height.value))
      if (lastPinchPair.distance > 0 && pair.distance > 0)
        applyZoom(camera.value.halfHeight * (lastPinchPair.distance / pair.distance), pair.center)
    }
    lastPinchPair = pair
    return
  }
  const dx = point.x - previous.x
  const dy = point.y - previous.y
  gestureDistance += Math.hypot(dx, dy)
  if (gestureDistance > 6 && !dragging.value) {
    dragging.value = true
    emit('select', '')
    focusedId.value = ''
  }
  if (!dragging.value)
    return
  if (!viewport.value?.hasPointerCapture(event.pointerId))
    viewport.value?.setPointerCapture(event.pointerId)
  applyCamera(panCamera(camera.value, { x: dx, y: dy }, height.value))
}
function pointerEnd(event: PointerEvent) {
  if (!pointers.has(event.pointerId))
    return
  if (dragging.value)
    ignoreClicksUntil = performance.now() + 350
  pointers.delete(event.pointerId)
  if (viewport.value?.hasPointerCapture(event.pointerId))
    viewport.value.releasePointerCapture(event.pointerId)
  if (pointers.size < 2)
    lastPinchPair = null
  if (!pointers.size) {
    dragging.value = false
    gestureDistance = 0
  }
}
// 滚轮/触控板捏合（ctrl+wheel）以指针为锚缩放；鼠标悬停场景内滚轮即缩放
function sceneWheel(event: WheelEvent) {
  if (!width.value || !height.value)
    return
  event.preventDefault()
  applyZoom(camera.value.halfHeight * Math.exp(event.deltaY * 0.0025), localPoint(event))
  dragging.value = false
}
function dismissOnBlank(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('button, .subject-card'))
    return
  focusedId.value = ''
  emit('select', '')
}
function captureClick(event: MouseEvent) {
  if (performance.now() < ignoreClicksUntil) {
    event.preventDefault()
    event.stopPropagation()
  }
}
useEventListener(window, 'pointerup', pointerEnd)
useEventListener(window, 'pointercancel', pointerEnd)
useEventListener(viewport, 'wheel', sceneWheel, { passive: false })
</script>

<template>
  <RanchSceneList v-if="!world" v-bind="props" @select="emit('select', $event)" @animal="(r, a, anchor) => emit('animal', r, a, anchor)" />
  <section v-else class="min-h-0 flex flex-1 flex-col overflow-hidden bg-green-50 text-green-950" aria-label="牧场场景">
    <div ref="viewport" class="world-viewport" :class="{ 'is-dragging': dragging }" role="group" aria-label="牧场建筑和动物，可拖动平移，双指或触控板捏合可缩放" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @click.capture="captureClick" @click="dismissOnBlank">
      <img class="world-background" src="/ranch/pasture-background.webp" alt="" draggable="false" :style="backgroundStyle">
      <template v-for="entry in positioned" :key="entry.facility.instId">
        <img v-for="layer in entry.facility.visual.layers.filter((l: any) => !l.front)" :key="layer.image" draggable="false" :src="layer.image" alt="" class="world-layer" :style="layerStyle(entry, layer)">
      </template>
      <template v-for="entry in positioned.filter(e => e.facility.feedMachine)" :key="`feed:${entry.facility.instId}`">
        <button v-if="entry.facility.visual.layers[0]" type="button" class="feed-machine-hit" :style="layerStyle(entry, entry.facility.visual.layers[0])" aria-label="添加牧草" @click="emit('feed', String(entry.facility.instId))" />
      </template>
      <button v-for="entry in animals" :key="`${entry.ranchId}:${entry.animal.animalInstId}`" type="button" class="world-animal" :style="animalStyle(entry)" :aria-label="`${entry.animal.name} · ${entry.animal.stageLabel}，查看详情`" @click="focusAnimal(entry)">
        <img v-if="entry.animal.visual?.image || entry.animal.image" draggable="false" :src="entry.animal.visual?.image || entry.animal.image" alt="">
        <span v-else>{{ entry.animal.name }}</span>
      </button>
      <template v-for="entry in positioned" :key="`front:${entry.facility.instId}`">
        <img v-for="layer in entry.facility.visual.layers.filter((l: any) => l.front)" :key="layer.image" draggable="false" :src="layer.image" alt="" class="world-layer world-front" :style="layerStyle(entry, layer)">
        <button v-if="entry.ranch" type="button" class="world-sign" :style="signStyle(entry)" :aria-label="`${entry.facility.name}，查看窝棚详情`" @click="emit('select', String(entry.ranch.ranchInstId))">
          <span>{{ entry.facility.name }}({{ entry.ranch.animalCount ?? entry.ranch.animals?.length ?? 0 }}/{{ entry.ranch.capacity ?? '—' }})</span>
          <span>{{ entry.facility.level ?? '—' }}级</span>
        </button>
      </template>
      <p v-if="!positioned.length" class="absolute inset-x-4 top-1/2 rounded bg-white/90 p-4 text-center text-sm" role="status">
        {{ facilities.length ? '场景坐标或素材尚未就绪，暂无法展示' : '当前没有设施数据' }}
      </p>
      <div v-if="focused" class="subject-card" :style="markerStyle({ x: focused.point.x, y: focused.point.y + 200 })">
        <RanchOfficialStatus :animal="focused.animal" :server-time="serverTime" :synced-at="syncedAt" @details="openFocusedDetails" />
      </div>
    </div>
    <p v-if="missingAnimals" role="status" class="px-3 py-2 text-sm text-amber-800">
      {{ missingAnimals }} 只动物缺少可用栏位或场景数据，暂无法定位。
    </p>
    <p v-if="missing" role="status" class="px-3 py-2 text-sm text-amber-800">
      {{ missing }} 个设施缺少可用坐标、素材或旋转支持。
    </p>
  </section>
</template>

<style scoped>
.feed-machine-hit {
  position: absolute;
  z-index: 3;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.feed-machine-hit:focus-visible {
  outline: 2px solid white;
}
.world-viewport {
  touch-action: none;
  user-select: none;
  /* 禁用 iOS Safari 对小字号的自动放大，保证木牌文字随镜头同步缩小 */
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  cursor: grab;
  position: relative;
  isolation: isolate;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #bddb8d;
}
.world-viewport.is-dragging,
.world-viewport.is-dragging button {
  cursor: grabbing;
}
.world-background {
  position: absolute;
  max-width: none;
  pointer-events: none;
  z-index: 0;
}
.world-layer {
  position: absolute;
  pointer-events: none;
  max-width: none;
  z-index: 1;
}
.world-front {
  z-index: 3;
}
.world-animal {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -85%);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  /* 覆盖 style.css 触屏端的 44px 触达规则：动物随镜头同步缩放，不能有最小尺寸 */
  min-width: 0;
  min-height: 0;
}
.world-animal img {
  display: block;
  width: 100%;
}
.world-marker {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, 0);
  max-width: 160px;
  border-radius: 10px;
  padding: 4px 8px;
  background: #fff6dcf0;
  color: #704b27;
  font-size: 12px;
  text-align: center;
  overflow-wrap: anywhere;
}
.subject-card {
  position: absolute;
  z-index: 6;
  width: 225.6px;
  height: 69.6px;
  transform: translate(-50%, -100%);
}
</style>

<style scoped>
.feed-machine-hit {
  position: absolute;
  z-index: 3;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.feed-machine-hit:focus-visible {
  outline: 2px solid white;
}
.world-sign {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, -50%);
  background: transparent;
  border: 0;
  padding: 0;
  color: #573315;
  text-align: center;
  font-weight: 700;
  line-height: 1.25;
}
.world-sign span {
  display: block;
  white-space: nowrap;
}
</style>
