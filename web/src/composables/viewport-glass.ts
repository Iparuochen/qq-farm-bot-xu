/**
 * 视口感知的毛玻璃。
 *
 * 背景问题：backdrop-filter 要求元素实时读取下层像素并做离屏模糊，每个
 * 带该属性的元素都是一个独立的 backdrop root。页面里这类卡片动辄二三十个，
 * 又都活在滚动容器内，滚动时下层坐标每帧变化、快照无法复用，只能反复做
 * 全屏采样。GPU 纹理缓存被挤爆后，合成器仍引用已被淘汰的 tile，就会在
 * tile 边界露出黑底 —— 也就是久开后出现的黑色横线/竖线。
 *
 * 思路：只让「当前可能被看到的卡片」持有模糊。视口外的卡片一律退回普通
 * 半透明，backdrop root 数量从「全页卡片数」降到「一屏卡片数」，通常能少
 * 六到八成。屏幕外的东西本来也看不见，视觉上没有变化。
 *
 * rootMargin 留了 320px 余量，滚动时卡片进入视口前就已经挂上模糊，
 * 不会出现「先清晰后变糊」的跳变。
 */

const GLASS_TARGETS
  = '.bg-white, .ui-card, .ui-card-elevated, .ui-subtle-panel, .glass-panel, .glass-card'

const MARGIN = 320

let observer: IntersectionObserver | null = null
let mutationObserver: MutationObserver | null = null
const tracked = new WeakSet<Element>()
let pending = false
const queued = new Set<Element>()

function attach(el: Element) {
  if (tracked.has(el) || !observer)
    return
  tracked.add(el)
  // 先同步判断一次：IntersectionObserver 的回调是异步的，只靠它的话首屏会先
  // 以「清晰」状态画一帧再变糊，视觉上会闪。
  const rect = el.getBoundingClientRect()
  if (rect.bottom > -MARGIN && rect.top < window.innerHeight + MARGIN)
    el.classList.add('glass-on')
  observer.observe(el)
}

function scanWithin(root: ParentNode) {
  root.querySelectorAll?.(GLASS_TARGETS).forEach(attach)
}

/** DOM 大批量更新时合并到下一帧，避免每个节点都跑一次查询 */
function scheduleScan(roots: Element[]) {
  roots.forEach(r => queued.add(r))
  if (pending)
    return
  pending = true
  requestAnimationFrame(() => {
    pending = false
    queued.forEach((r) => {
      if (r.isConnected) {
        if (r.matches(GLASS_TARGETS))
          attach(r)
        scanWithin(r)
      }
    })
    queued.clear()
  })
}

function start() {
  if (!('IntersectionObserver' in window))
    return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle('glass-on', entry.isIntersecting)
      }
    },
    { rootMargin: `${MARGIN}px 0px` },
  )

  scanWithin(document)

  mutationObserver = new MutationObserver((records) => {
    const roots: Element[] = []
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1)
          roots.push(node as Element)
      })
    }
    if (roots.length)
      scheduleScan(roots)
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true })
}

function stop() {
  observer?.disconnect()
  mutationObserver?.disconnect()
  observer = null
  mutationObserver = null
  document.querySelectorAll('.glass-on').forEach(el => el.classList.remove('glass-on'))
}

/** 在 App 根组件调用一次即可；glass-flat 模式下整体不启用 */
export function startViewportGlass() {
  if (document.documentElement.classList.contains('glass-flat'))
    return
  start()
}

export function stopViewportGlass() {
  stop()
}
