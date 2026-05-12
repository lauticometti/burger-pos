function getDateFromCreatedAt(createdAt) {
  if (!createdAt) return null
  if (typeof createdAt.toDate === 'function') return createdAt.toDate()
  if (createdAt instanceof Date) return createdAt
  const parsed = new Date(createdAt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function flattenOrderItems(orders) {
  const items = []
  for (const order of orders) {
    if (!Array.isArray(order.items)) continue
    for (const item of order.items) {
      const qty = Number(item.qty ?? 0)
      const price = Number(item.price ?? 0)
      const lineTotal = Number(item.lineTotal ?? (price * qty))
      items.push({ ...item, qty, price, lineTotal, _orderId: order.id, _orderCode: order.orderCode })
    }
  }
  return items
}

export function calculateDailyMetrics(orders) {
  const ventasTotales = orders.reduce((s, o) => s + Number(o.total ?? 0), 0)
  const pedidosTotales = orders.length
  const ticketPromedio = pedidosTotales > 0 ? ventasTotales / pedidosTotales : 0
  const descuentosTotales = orders.reduce((s, o) => s + Number(o.discountAmount ?? 0), 0)

  let burgersVendidas = 0
  let carnesVendidas = 0
  let papasVendidas = 0
  let bebidasVendidas = 0
  let dipsVendidos = 0

  const items = flattenOrderItems(orders)
  for (const item of items) {
    const qty = item.qty
    const cat = item.category ?? ''
    if (cat === 'burger') {
      const meatCount = Number(item.meatCount ?? 1)
      burgersVendidas += qty
      carnesVendidas += meatCount * qty
    } else if (cat === 'papas') {
      papasVendidas += qty
    } else if (cat === 'bebidas') {
      bebidasVendidas += qty
    } else if (cat === 'dips') {
      dipsVendidos += qty
    }
  }

  return {
    ventasTotales,
    pedidosTotales,
    ticketPromedio,
    descuentosTotales,
    burgersVendidas,
    carnesVendidas,
    papasVendidas,
    bebidasVendidas,
    dipsVendidos,
  }
}

export function groupSalesByPaymentMethod(orders) {
  const map = new Map()
  for (const order of orders) {
    const method = order.paymentMethod ?? 'desconocido'
    const total = Number(order.total ?? 0)
    const entry = map.get(method) ?? { method, total: 0, count: 0 }
    entry.total += total
    entry.count += 1
    map.set(method, entry)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export function groupSalesByHour(orders) {
  const map = new Map()
  for (const order of orders) {
    const date = getDateFromCreatedAt(order.createdAt)
    if (!date) continue
    const hour = date.getHours()
    const total = Number(order.total ?? 0)
    const entry = map.get(hour) ?? { hour, label: `${String(hour).padStart(2, '0')}:00`, total: 0, count: 0 }
    entry.total += total
    entry.count += 1
    map.set(hour, entry)
  }
  return Array.from(map.values()).sort((a, b) => a.hour - b.hour)
}

export function groupProductsSold(orders) {
  const map = new Map()
  const items = flattenOrderItems(orders)
  for (const item of items) {
    const key = item.id ?? item.name ?? 'desconocido'
    const entry = map.get(key) ?? {
      id: item.id ?? '',
      name: item.name ?? key,
      category: item.category ?? '',
      qty: 0,
      revenue: 0,
    }
    entry.qty += item.qty
    entry.revenue += item.lineTotal
    map.set(key, entry)
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}
