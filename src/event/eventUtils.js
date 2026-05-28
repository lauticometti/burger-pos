import { SIZE_LABELS } from './eventMenu'

// Fixed display order for cart, tickets, and detail views
const ITEM_SORT_ORDER = {
  // burgers by id
  salsa: [1, 1], american: [1, 2], bbqueen: [1, 3], smoklahoma: [1, 4],
  // extras burger_ya
  papas: [2, 1], dip: [3, 1], coca_600: [4, 1], coca_225: [4, 2],
  // drinks_t6
  fernet: [5, 1], caipiroska: [5, 2], tropicana: [5, 3],
  cherry: [5, 4], gin_tonic: [5, 5], gin_frutos: [5, 6],
}

function getItemSortKey(item) {
  const order = ITEM_SORT_ORDER[item.id]
  if (!order) return [9, 9]
  return order
}

export function sortCartItems(items) {
  return [...items].sort((a, b) => {
    const [ca, ia] = getItemSortKey(a)
    const [cb, ib] = getItemSortKey(b)
    return ca !== cb ? ca - cb : ia - ib
  })
}

export function calcEventSubtotals(cart) {
  let burgerYaSubtotal = 0
  let drinksT6Subtotal = 0
  for (const item of cart) {
    if (item.area === 'burger_ya') burgerYaSubtotal += item.totalPrice
    else if (item.area === 'drinks_t6') drinksT6Subtotal += item.totalPrice
  }
  return { burgerYaSubtotal, drinksT6Subtotal, total: burgerYaSubtotal + drinksT6Subtotal }
}

export function determineStatuses(cart) {
  const hasBurgerYa = cart.some(i => i.area === 'burger_ya')
  const hasDrinksT6 = cart.some(i => i.area === 'drinks_t6')
  return {
    kitchenStatus: hasBurgerYa ? 'pending' : 'not_applicable',
    barStatus: hasDrinksT6 ? 'pending' : 'not_applicable',
  }
}

// Groups burgers that are exactly identical for ticket/cart display
export function groupBurgersForPrint(items) {
  const groups = []
  for (const item of items) {
    if (item.category !== 'burger') {
      // For drinks/extras, group by id and accumulate real quantity
      const existing = groups.find(g => g.id === item.id && g.category !== 'burger')
      if (existing) {
        existing.displayQty = (existing.displayQty ?? item.quantity ?? 1) + (item.quantity ?? 1)
        existing.totalPrice = (existing.totalPrice ?? 0) + item.totalPrice
      } else {
        groups.push({ ...item, displayQty: item.quantity ?? 1 })
      }
      continue
    }
    const key = JSON.stringify({
      id: item.id,
      size: item.size,
      extras: (item.customizations?.extras ?? []).map(e => e.id).sort(),
      removed: [...(item.customizations?.removedIngredients ?? [])].sort(),
    })
    const existing = groups.find(g => g._groupKey === key)
    if (existing) {
      existing.displayQty = (existing.displayQty ?? 1) + 1
    } else {
      groups.push({ ...item, displayQty: 1, _groupKey: key })
    }
  }
  return groups
}

export function calcBurgerItemPrice(burger, size, customizations) {
  const basePrice = burger.prices[size]
  const extrasTotal = (customizations?.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0)
  return basePrice + extrasTotal
}

export function buildCartItem(product, size, customizations = null) {
  const cartItemId = `${product.id}_${size ?? ''}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  if (product.category === 'burger') {
    const totalPrice = calcBurgerItemPrice(product, size, customizations)
    return {
      cartItemId,
      id: product.id,
      name: product.name,
      area: product.area,
      category: product.category,
      size,
      sizeLabel: SIZE_LABELS[size],
      unitPrice: product.prices[size],
      totalPrice,
      quantity: 1,
      customizations: customizations ?? { extras: [], removedIngredients: [] },
    }
  }
  // drink or extra
  const qty = product.qty ?? 1
  return {
    cartItemId,
    id: product.id,
    name: product.name,
    btnLabel: product.btnLabel ?? product.name,
    area: product.area,
    category: product.category,
    size: null,
    sizeLabel: null,
    unitPrice: product.price,
    totalPrice: product.price,
    quantity: qty,
    customizations: null,
  }
}

// Returns display name: "Burger de la salsa simple" (strips "c/ papas", appends sizeLabel lowercase)
// For drinks/extras, returns just the product name (not btnLabel which may include qty prefix like "2 Fernet")
export function getDisplayName(item) {
  const baseName = item.name.replace(' c/ papas', '')
  if (item.sizeLabel) return `${baseName} ${item.sizeLabel.toLowerCase()}`
  return baseName
}

// Grouping key for cart display. forceUngroup = item is displayed individually
export function getCartGroupKey(item) {
  if (item.forceUngroup) return `_ungrouped_${item.cartItemId}`
  if (item.category !== 'burger') return item.id
  return JSON.stringify({
    id: item.id, size: item.size,
    extras: (item.customizations?.extras ?? []).map(e => e.id).sort(),
    removed: [...(item.customizations?.removedIngredients ?? [])].sort(),
  })
}

// Groups cart items for display. Each group has: key, cartItemIds, quantity, totalPrice, representative
export function groupCartForDisplay(cart) {
  const groups = []
  for (const item of cart) {
    const key = getCartGroupKey(item)
    const existing = groups.find(g => g.key === key)
    if (existing) {
      existing.cartItemIds.push(item.cartItemId)
      existing.quantity += (item.quantity ?? 1)
      existing.totalPrice += item.totalPrice
    } else {
      groups.push({
        key,
        cartItemIds: [item.cartItemId],
        quantity: item.quantity ?? 1,
        totalPrice: item.totalPrice,
        representative: item,
      })
    }
  }
  return groups
}

// Called at save time against live orders to minimize race condition duplicates
export function getNextOrderNumber(eventOrders, shift) {
  const shiftOrders = eventOrders.filter(o => o.eventShift === shift)
  const maxNum = shiftOrders.reduce((m, o) => Math.max(m, o.eventOrderNumber ?? 0), 0)
  return maxNum + 1
}

export function sanitizeEventValue(v) {
  if (v === undefined) return null
  if (typeof v === 'number' && !isFinite(v)) return 0
  if (Array.isArray(v)) return v.map(sanitizeEventValue)
  if (v !== null && typeof v === 'object' && typeof v.toDate !== 'function') {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, sanitizeEventValue(val)]))
  }
  return v
}

export function sanitizeEventOrder(data) {
  return sanitizeEventValue(data)
}

export function fmt(n) {
  return '$' + Number(n ?? 0).toLocaleString('es-AR')
}
