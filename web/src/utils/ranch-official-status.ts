// Static port of AnimalDetailsTipsUI buildTimeline/buildSingleProgress (2026-11-18 audit).
export function officialAnimalStatus(a: any, now: number) {
  const c = a.statusConfig
  const remain = (time: unknown) => Math.max(0, Number(time || 0) - now)
  const clock = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000))
    return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':')
  }
  const infant = Number(c?.infantSec || 0) * 1000
  const growth = infant + Number(c?.growSec || 0) * 1000
  const round = Number(c?.roundSec || 0) * 1000
  const max = Number(c?.maxProduceCount || 0)
  const end = growth + round * Math.max(0, max - 1)
  const total = end + Number(c?.matureSec || 0) * 1000
  let elapsed = 0
  let stage = ''
  let time = ''
  const deliver = Number(a.deliveringUntilMs) > 0
  const canDeliver = a.canDeliver === true
  switch (a.stage) {
    case 1:
      stage = '幼崽期：'
      time = clock(remain(a.infantReadyAtMs))
      elapsed = Number(a.infantReadyAtMs) > 0 ? infant - remain(a.infantReadyAtMs) : 0
      break
    case 2:
      stage = '成长期：'
      time = clock(remain(a.growReadyAtMs))
      elapsed = Number(a.growReadyAtMs) > 0 ? growth - remain(a.growReadyAtMs) : infant
      break
    case 3:
      stage = deliver ? '生产中：' : '生产期：'
      time = deliver ? clock(remain(a.deliveringUntilMs)) : canDeliver ? '可生产' : a.producing && a.produceReadyAtMs > 0 ? clock(remain(a.produceReadyAtMs)) : a.grassBlocked ? '缺草' : '等待生产'
      elapsed = a.produceCount >= max
        ? end
        : a.producing && a.produceReadyAtMs > 0
          ? Math.min(end, growth + Math.max(0, a.produceCount - 1) * round + Math.max(0, round - remain(a.produceReadyAtMs)))
          : canDeliver || deliver ? Math.min(end, growth + a.produceCount * round) : growth + Math.max(0, a.produceCount - 1) * round
      break
    case 4:
      stage = '成熟期：'
      time = clock(remain(a.matureReadyAtMs))
      elapsed = end + Math.max(0, a.matureReadyAtMs > 0 ? total - end - remain(a.matureReadyAtMs) : 0)
      break
    case 5:
      stage = '成熟期：'
      time = '可收获'
      elapsed = total
      break
    default: stage = '未知阶段：'
  }
  if (a.grassBlocked && !deliver && !canDeliver)
    time = '缺草'
  const drop = Number(c?.dropSec || 0) * 1000
  const percent = c && total > 0 ? Math.max(0, Math.min(1, deliver ? drop > 0 ? (drop - remain(a.deliveringUntilMs)) / drop : 0 : elapsed / total)) * 100 : null
  const marks = c && total > 0 && !deliver ? [...new Set([infant, growth, ...Array.from({ length: Math.min(100, Math.max(0, max - 1)) }, (_, i) => growth + round * (i + 1)), total])].filter(v => v > 0).map(v => v / total * 100) : []
  const count = a.stage === 3 && max > 0 ? `${Math.max(1, Math.min(max, Number(a.produceCount || 0) + 1))}/${max}` : ''
  const weight = a.mutation?.mutationType === 1 ? Number((a.stage >= 4 && a.mutation.weightFinalX10 > 0) ? a.mutation.weightFinalX10 : a.mutation.weightDisplayX10) : 0
  const shelf = a.statusShelf
  const shelfRemain = Number(shelf?.totalRemain || 0)
  let yieldText = ''
  let allTime = ''
  if (a.grassBlocked) {
    yieldText = '缺草'
    allTime = '缺草'
  }
  else if (a.stage === 1 || a.stage === 2) {
    yieldText = `${a.stage === 1 && Number(c?.growSec) > 0 ? '成长' : '生产'}：${time}`
    const eta = Number(a.growReadyAtMs) > 0 ? a.growReadyAtMs : Number(a.infantReadyAtMs) > 0 ? Number(a.infantReadyAtMs) + Number(c?.growSec || 0) * 1000 : 0
    allTime = eta > 0 ? `${clock(remain(eta))} 后到达生产期` : ''
  }
  else if (a.stage === 5 || a.canHarvest) {
    if (c?.productCount != null)
      yieldText = `剩余成熟产物：${c.productCount}/${c.productCount}`
    allTime = '可收获'
  }
  else if (shelf?.canCollect || shelfRemain > 0) {
    yieldText = `剩余产物：${shelfRemain}/${Math.max(shelfRemain, Number(c?.byproductCount || 0))}`
    allTime = shelf?.canCollect ? '产物可收获' : ''
  }
  else if (a.stage === 4) {
    yieldText = `可收获：${time}`
    allTime = `${time} 后可收获`
  }
  else if (canDeliver) {
    yieldText = '可生产'
    allTime = '可生产'
  }
  else if (a.producing && Number(a.produceReadyAtMs) > 0) {
    yieldText = `下次可生产：${time}`
    allTime = `${time} 后可生产`
  }
  else if (deliver) {
    yieldText = `剩余产物：${shelfRemain}/${Math.max(1, Number(c?.byproductCount || 0))}`
    allTime = `生产中 ${time}`
  }
  return { yieldText, allTime, stage, time, percent, marks, count, quality: c?.quality, weight: weight > 0 ? `${(weight / 10).toFixed(2)}KG` : '', clock }
}
