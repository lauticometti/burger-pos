import { STAFF_PRICES, STAFF_ADDON_LABELS, STAFF_VEGETABLE_LABELS, STAFF_EXTRA_LABELS } from '../data/staffMenu'

export function createEmptyStaffBurger() {
  return {
    id: `staff_burger_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patties: 1,
    addons: [],
    vegetables: [],
    note: '',
  }
}

export function duplicateStaffBurger(burger) {
  return {
    ...burger,
    id: `staff_burger_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    addons: [...burger.addons],
    vegetables: [...burger.vegetables],
  }
}

export function getStaffBurgerSizeLabel(patties) {
  if (patties <= 1) return 'simple'
  if (patties === 2) return 'doble'
  if (patties === 3) return 'triple'
  return `x${patties} carnes`
}

export function calculateStaffBurgerTotal(burger) {
  const base = STAFF_PRICES.burger_base
  const extraMeat = Math.max(0, burger.patties - 1) * STAFF_PRICES.extra_carne
  const addonsTotal = burger.addons.reduce((s, id) => s + (STAFF_PRICES[id] ?? 0), 0)
  const vegCost = burger.vegetables.length > 0 ? STAFF_PRICES.american : 0
  return base + extraMeat + addonsTotal + vegCost
}

export function calculateStaffExtrasTotal(extras) {
  return Object.entries(extras).reduce((s, [id, qty]) => s + (STAFF_PRICES[id] ?? 0) * qty, 0)
}

export function calculateStaffOrderTotal(staffOrder) {
  const burgersTotal = (staffOrder.burgers ?? []).reduce((s, b) => s + calculateStaffBurgerTotal(b), 0)
  return burgersTotal + calculateStaffExtrasTotal(staffOrder.extras ?? {})
}

export function formatStaffOrderKitchenLines(staffOrder, generalKitchenNote = '') {
  const lines = []
  for (const burger of staffOrder.burgers ?? []) {
    const sizeLabel = getStaffBurgerSizeLabel(burger.patties)
    lines.push(`1x Burger Staff ${sizeLabel}`)
    for (const id of burger.addons ?? []) {
      lines.push(`   + ${STAFF_ADDON_LABELS[id] ?? id}`)
    }
    for (const id of burger.vegetables ?? []) {
      lines.push(`   + ${STAFF_VEGETABLE_LABELS[id] ?? id}`)
    }
    if (burger.note?.trim()) lines.push(`   Nota: ${burger.note.trim()}`)
  }
  const extras = staffOrder.extras ?? {}
  for (const [id, qty] of Object.entries(extras)) {
    if (qty > 0) lines.push(`${qty}x ${STAFF_EXTRA_LABELS[id] ?? id}`)
  }
  if (generalKitchenNote?.trim()) lines.push(`NOTA GENERAL: ${generalKitchenNote.trim()}`)
  return lines
}

export function formatStaffOrderKitchenHtml(staffOrder, generalKitchenNote = '') {
  return formatStaffOrderKitchenLines(staffOrder, generalKitchenNote)
    .map(line => {
      const isIndented = line.startsWith('   +') || line.startsWith('   Nota:')
      const isWarning = line.startsWith('NOTA GENERAL:')
      const style = isIndented
        ? ' style="padding-left:12px;color:#aaa;"'
        : isWarning
        ? ' style="color:#f59e0b;font-weight:bold;"'
        : ''
      return `<div class="row"${style}><span>${line.trim()}</span></div>`
    })
    .join('')
}

export function formatStaffOrderDisplayLines(staffOrder) {
  const lines = []
  for (const burger of staffOrder.burgers ?? []) {
    const sizeLabel = getStaffBurgerSizeLabel(burger.patties)
    lines.push(`Burger Staff ${sizeLabel}`)
    for (const id of burger.addons ?? []) lines.push(`+ ${STAFF_ADDON_LABELS[id] ?? id}`)
    for (const id of burger.vegetables ?? []) lines.push(`+ ${STAFF_VEGETABLE_LABELS[id] ?? id}`)
    if (burger.note?.trim()) lines.push(`Nota: ${burger.note.trim()}`)
  }
  const extras = staffOrder.extras ?? {}
  for (const [id, qty] of Object.entries(extras)) {
    if (qty > 0) lines.push(`${STAFF_EXTRA_LABELS[id] ?? id} x${qty}`)
  }
  return lines
}
