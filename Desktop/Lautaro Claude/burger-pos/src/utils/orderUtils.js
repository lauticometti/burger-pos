import { SIZE_LABELS } from '../data/menu.js'

const MEAT_NAMES_FALLBACK = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

/**
 * Precio efectivo por unidad de un item.
 * Prioridad: manualPrice > unitPrice (incluye promo) > basePrice+extraMeat (items viejos)
 */
export function getItemUnitPrice(item) {
  if (item.manualPriceApplied && item.manualPrice != null) {
    const n = Number(item.manualPrice)
    if (Number.isFinite(n)) return n
  }
  if (item.unitPrice != null) {
    const n = Number(item.unitPrice)
    if (Number.isFinite(n)) return n
  }
  // fallback items viejos con basePrice/extraMeatPrice
  if (item.category === 'burger' || item.cartId) {
    const base = Number(item.basePrice ?? 0)
    const extra = Number(item.extraMeatPrice ?? 0)
    const meats = Number(item.meatCount ?? 1)
    const result = base + (Math.max(meats, 1) - 1) * extra
    return Number.isFinite(result) ? result : 0
  }
  const n = Number(item.price ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** lineTotal de un item — nunca devuelve NaN */
export function getItemLineTotal(item) {
  const result = getItemUnitPrice(item) * (item.qty || 1)
  return Number.isFinite(result) ? result : 0
}

/** Nombre display de un item para tickets, historial y carrito */
export function getItemDisplayName(item) {
  if (item.category === 'burger' || item.cartId) {
    const sizeLabel = item.size
      ? (SIZE_LABELS[item.size] ?? item.size)
      : (MEAT_NAMES_FALLBACK[item.meatCount] ?? '')
    return `${item.name ?? 'Burger'} ${sizeLabel}`.trim()
  }
  return item.name ?? ''
}

/**
 * Código display limpio para un pedido.
 * Formatos soportados: M1, M001, #001, 001, 2026-05-15-001, 2026-05-15-M001
 * Nunca retorna #00 ni #000 si el número es 0.
 */
export function getDisplayCode(order) {
  if (order.displayOrderCode) {
    const d = String(order.displayOrderCode)
    if (d.startsWith('M')) return d.replace(/^M0*(\d+)$/, 'M$1')
    if (d.startsWith('#')) return d
    if (/^\d+$/.test(d)) {
      const n = parseInt(d, 10)
      return n > 0 ? `#${String(n).padStart(3, '0')}` : '—'
    }
  }
  if (order.orderCode) {
    const parts = String(order.orderCode).split('-')
    if (parts.length >= 4) {
      const suffix = parts.slice(3).join('-')
      if (suffix.startsWith('M')) return suffix.replace(/^M0*(\d+)$/, 'M$1')
      const num = parseInt(suffix, 10)
      if (!isNaN(num) && num > 0) return `#${String(num).padStart(3, '0')}`
    }
  }
  if (order.orderNumber && Number(order.orderNumber) > 0)
    return `#${String(order.orderNumber).padStart(3, '0')}`
  if (order.internalOrderNumber && Number(order.internalOrderNumber) > 0)
    return `M${order.internalOrderNumber}`
  return '—'
}

/** grossTotal del carrito (suma de lineTotals, respetando precios efectivos) */
export function calcGrossTotal(cart) {
  return cart.reduce((sum, item) => sum + getItemLineTotal(item), 0)
}

/** Lee grossTotal desde objeto de orden guardado, con fallbacks legacy. Nunca devuelve NaN. */
export function getOrderGrossTotal(order) {
  const n = Number(order.grossTotal ?? order.subtotal ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Lee netRevenue desde objeto de orden guardado, con fallback seguro. Nunca devuelve NaN. */
export function getOrderNetRevenue(order) {
  if (order.netRevenue != null) {
    const n = Number(order.netRevenue)
    if (Number.isFinite(n)) return n
  }
  const total = Number(order.total ?? 0)
  const payout = Number(order.deliveryPayout ?? 0)
  return (Number.isFinite(total) ? total : 0) - (Number.isFinite(payout) ? payout : 0)
}

/** Retorna defaults explícitos para cualquier pedido nuevo. Pisar con spread después de llamar. */
export function buildOrderDefaults() {
  return {
    grossTotal: 0,
    subtotal: 0,
    discountAmount: 0,
    discountType: 'none',
    discountValue: 0,
    discountReason: '',
    deliverySurcharge: 0,
    deliveryPayout: 0,
    netRevenue: 0,
    kitchenNote: '',
    internalNote: '',
    notes: '',
    internalAmount: 0,
    saleValueAmount: 0,
    cashCollected: 0,
    chargeableInternalTotal: 0,
    staffMenuTotal: 0,
    staffCoveredAmount: 0,
    payrollDeductionAmount: 0,
    staffBalanceBefore: null,
    staffBalanceAfter: null,
    staffMenuItems: [],
    orderMode: 'sale',
    orderPurpose: '',
    countsAsRevenue: true,
    affectsCash: true,
    affectsPayroll: false,
    affectsInternalBalance: false,
    costResponsibility: '',
    relatedPerson: '',
    relatedPersonRole: '',
    assignedDeliveryType: 'unassigned',
    assignedDeliveryId: '',
    assignedDeliveryName: '',
    deliveryResponsibility: 'none',
    deliveryChargedTo: '',
    internalAllocations: [],
    barterItems: [],
    barterValueAmount: 0,
    internalCostItems: [],
    internalCostManualAdjustment: 0,
    internalCostManualReason: '',
    internalCostAmount: 0,
    internalProductCostAmount: 0,
    internalDeliveryCostAmount: 0,
    internalTotalCostAmount: 0,
    internalCoveredByCash: 0,
    internalPendingAmount: 0,
    internalSurplusCash: 0,
    internalResultAmount: 0,
    marketingCostItems: [],
    marketingCostManualAdjustment: 0,
    marketingCostManualReason: '',
    marketingProductCostAmount: 0,
    marketingDeliveryCostAmount: 0,
    marketingTotalCostAmount: 0,
  }
}

/** Sanitiza un objeto de pedido antes de guardarlo en Firestore. undefined→null, NaN/Infinity→0. Recursivo para arrays de objetos. */
export function sanitizeOrderData(data) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) {
      out[k] = null
    } else if (typeof v === 'number') {
      out[k] = Number.isFinite(v) ? v : 0
    } else if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item !== null && typeof item === 'object' ? sanitizeOrderData(item) : item
      )
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Calcula todos los totales del pedido a partir del carrito y formData.
 * Retorna: { grossTotal, discountAmount, totalProductos, deliverySurcharge, total, deliveryPayout, netRevenue }
 */
export function calcOrderTotals(cart, formData) {
  const grossTotal = calcGrossTotal(cart)
  const discountType  = formData.discountType  ?? 'none'
  const discountValue = Number(formData.discountValue ?? 0)
  let discountAmount = 0
  if (discountType === 'percent') discountAmount = Math.round(grossTotal * discountValue / 100)
  else if (discountType === 'amount') discountAmount = discountValue
  discountAmount = Math.min(discountAmount, grossTotal) // no puede ser mayor al subtotal

  const totalProductos   = grossTotal - discountAmount
  const deliverySurcharge = Number(formData.deliverySurcharge ?? 0)
  const total             = totalProductos + deliverySurcharge
  const deliveryPayout    = Number(formData.deliveryPayout ?? 0)
  const netRevenue        = total - deliveryPayout

  return { grossTotal, discountAmount, totalProductos, deliverySurcharge, total, deliveryPayout, netRevenue }
}
