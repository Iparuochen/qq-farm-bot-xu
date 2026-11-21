export function feedDialogState(machine: any, items: any[], shop: any) {
  const capacity = Math.max(0, Math.floor(Number(machine?.capacity) || 0))
  const current = Math.max(0, Math.floor(Number(machine?.feedMachine?.feedCount) || 0))
  const space = Math.max(0, capacity - current)
  const owned = items.filter(i => String(i.id) === '7001' && !i.locked && !i.is_locked)
    .reduce((n, i) => n + Math.max(0, Number(i.count) || 0), 0)
  const buy = owned === 0
  const max = Math.min(2147483647, Math.floor(buy ? space : Math.min(owned, space)))
  const unitPrice = Number(shop?.unitPrice)
  const priceKnown = shop?.currencyId === 1007 && Number.isSafeInteger(unitPrice) && unitPrice > 0
  const balance = items.filter(i => String(i.id) === '1007' && !i.locked && !i.is_locked)
    .reduce((n, i) => n + Math.max(0, Number(i.count) || 0), 0)
  return { capacity, current, space, owned, buy, max, unitPrice, priceKnown, balance }
}
export function feedCount(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.max(1, Math.floor(Number(value) || 1))))
}
export function feedAmount(value: number) {
  return value >= 10000 ? `${Math.floor(value / 1000) / 10}万` : String(value)
}
