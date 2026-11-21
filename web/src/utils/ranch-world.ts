// Official TileMap/test2 + TileHelper, audited in core/docs/ranch-scene-plan-20261118.
export interface Point { x: number, y: number }
export interface FacilityPosition { positionX?: number, positionY?: number, width?: number, height?: number, rotation?: number }
export function facilityCenter(f: FacilityPosition): Point | null {
  const { positionX: x, positionY: y, width: w, height: h } = f
  // Unknown rotations must not silently invent a placement.
  if (![x, y, w, h].every(v => typeof v === 'number' && Number.isInteger(v))
    || x! < 0 || y! < 0 || w! < 1 || h! < 1 || x! + w! > 25 || y! + h! > 25 || (f.rotation ?? 0) !== 0) {
    return null
  }
  return { x: 128 * (x! - y! + (w! - h!) / 2), y: 1536 - 64 * (x! + y! + (w! + h! - 2) / 2) }
}
export function ranchCamera(shed: boolean) {
  return shed ? { x: -193, y: -40, halfHeight: 640 * 2.78 } : { x: 133, y: 90, halfHeight: 640 * 2.015 }
}
export function project(point: Point, camera: Point & { halfHeight: number }, width: number, height: number) {
  const scale = height / (2 * camera.halfHeight)
  return { x: width / 2 + (point.x - camera.x) * scale, y: height / 2 - (point.y - camera.y) * scale, scale }
}
export function yardContains(p: Point) {
  return (p.x / 360) ** 2 + ((p.y + 10) / 170) ** 2 <= 1 && !(p.y >= 44 && p.x >= 70 && p.x <= 310)
}
const layouts = new Map<number, Point[]>()
// Official Lloyd: sample every 8 units, deterministic initialization, 24 passes, Y-weight=2.
export function animalLayout(capacity: number): readonly Point[] {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)
    return []
  const cached = layouts.get(capacity)
  if (cached)
    return cached
  const samples: Point[] = []
  for (let y = 160; y >= -180; y -= 8) {
    const radius = 360 * Math.sqrt(Math.max(0, 1 - ((y + 10) / 170) ** 2))
    for (let x = -radius; x <= radius; x += 8) {
      if (yardContains({ x, y }))
        samples.push({ x, y })
    }
  }
  const points = Array.from({ length: capacity }, (_, index) => {
    const p = samples[Math.floor((index + 0.5) * samples.length / capacity)]!
    const random = Math.sin(127.1 * (index + 31 * capacity) + 20260910) * 43758.5453
    const offset = 2 * (random - Math.floor(random) - 0.5)
    return { x: p.x + offset, y: p.y + offset }
  })
  for (let pass = 0; pass < 24; pass++) {
    const sums = points.map(() => ({ x: 0, y: 0, count: 0 }))
    for (const sample of samples) {
      let nearest = 0
      let distance = Infinity
      points.forEach((p, index) => {
        const d = (sample.x - p.x) ** 2 + (2 * (sample.y - p.y)) ** 2
        if (d < distance) {
          distance = d
          nearest = index
        }
      })
      const sum = sums[nearest]!
      sum.x += sample.x
      sum.y += sample.y
      sum.count++
    }
    sums.forEach((sum, index) => {
      if (sum.count)
        points[index] = { x: sum.x / sum.count, y: sum.y / sum.count }
    })
  }
  points.sort((a, b) => Math.abs(a.y - b.y) > 1 ? b.y - a.y : a.x - b.x)
  layouts.set(capacity, points)
  return points
}
export function animalSlot(slotIndex: number, capacity: number): Point | null {
  const points = animalLayout(capacity)
  if (!points.length || !Number.isFinite(slotIndex))
    return null
  return points[((Math.floor(slotIndex) - 1) % capacity + capacity) % capacity] || null
}

export interface WorldCamera extends Point { halfHeight: number }
export function panCamera(camera: WorldCamera, delta: Point, viewportHeight: number): WorldCamera {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0)
    return camera
  const unitsPerPixel = 2 * camera.halfHeight / viewportHeight
  return { ...camera, x: camera.x - delta.x * unitsPerPixel, y: camera.y + delta.y * unitsPerPixel }
}
// Keep the world point under the cursor/fingers fixed when changing the camera zoom.
export function zoomCamera(camera: WorldCamera, halfHeight: number, anchor: Point, width: number, height: number): WorldCamera {
  if (![halfHeight, width, height, anchor.x, anchor.y].every(Number.isFinite) || halfHeight <= 0 || width <= 0 || height <= 0)
    return camera
  const difference = 2 * (camera.halfHeight - halfHeight) / height
  return { x: camera.x + (anchor.x - width / 2) * difference, y: camera.y - (anchor.y - height / 2) * difference, halfHeight }
}
export function pointerPair(points: readonly Point[]) {
  const [a, b] = points
  if (!a || !b)
    return null
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) }
}
