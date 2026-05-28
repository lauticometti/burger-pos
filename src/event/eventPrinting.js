import { groupBurgersForPrint } from './eventUtils'

const CSS_TICKET = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0 !important; padding: 0 !important;
    width: 302px !important; max-width: 302px !important;
    height: auto !important; min-height: 0 !important;
    overflow: visible !important;
    font-family: 'Courier New', monospace;
    font-size: 11px; line-height: 1.2; color: #000; background: white !important;
  }
  .ticket {
    width: 272px !important; max-width: 272px !important;
    margin: 0 auto !important; padding: 4px 4px 0 4px !important;
    height: auto !important; min-height: 0 !important;
    font-family: monospace; font-size: 11px; line-height: 1.2;
    color: black; background: white;
  }
  .center { text-align: center; }
  .title { font-size: 18px; font-weight: bold; text-align: center; margin: 4px 0; letter-spacing: 2px; }
  .subtitle { font-size: 13px; font-weight: bold; text-align: center; margin: 2px 0; }
  .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .sep-solid { border: none; border-top: 2px solid #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
  .label { color: #555; font-size: 11px; }
  .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .tag { font-size: 11px; font-weight: bold; text-align: center; margin: 3px 0; }
  .section-title { font-size: 20px; font-weight: bold; text-align: center; letter-spacing: 3px; margin: 4px 0; }
  .mod-line { font-size: 10px; padding-left: 12px; margin: 1px 0; color: #333; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`

function printViaIframe(html) {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:0;width:302px;height:auto;border:none;visibility:hidden;'
    document.body.appendChild(iframe)
    const blob = new Blob([html], { type: 'text/html' })
    iframe.src = URL.createObjectURL(blob)
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument
        const win = iframe.contentWindow
        const bodyHeight = doc.body.scrollHeight
        const PX_PER_MM = 96 / 25.4
        const heightMm = Math.ceil(bodyHeight / PX_PER_MM) + 4
        const finalHeightMm = Math.min(Math.max(heightMm, 45), 200)
        const style = doc.createElement('style')
        style.textContent = `@page { size: 80mm ${finalHeightMm}mm portrait; margin: 0; } html, body { height: ${finalHeightMm}mm !important; overflow: hidden !important; }`
        doc.head.appendChild(style)
        win.focus()
        win.print()
      } catch (e) {
        console.warn('printViaIframe error:', e)
      }
      setTimeout(() => {
        document.body.removeChild(iframe)
        resolve()
      }, 1500)
    }
  })
}

function fmtPrice(n) {
  return '$' + Number(n ?? 0).toLocaleString('es-AR')
}

function getTimestamp(order) {
  const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date()
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const fecha = d.toLocaleDateString('es-AR')
  return { hora, fecha }
}

function fmtPayment(m) {
  return m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transferencia' : m
}

// Renders grouped burger items with their customizations
function renderBurgerItemLines(items, showPrices) {
  const grouped = groupBurgersForPrint(items.filter(i => i.category === 'burger'))
  return grouped.map(item => {
    const qty = item.displayQty ?? 1
    const label = `${item.sizeLabel ?? ''} ${item.name}`.trim()
    const priceStr = showPrices ? fmtPrice(item.unitPrice * qty + (item.customizations?.extras ?? []).reduce((s, e) => s + e.price, 0) * qty) : ''
    const line = showPrices
      ? `<div class="row"><span>${qty}x ${label}</span><span>${priceStr}</span></div>`
      : `<div class="row"><span>${qty}x ${label}</span></div>`
    const extras = (item.customizations?.extras ?? []).map(e =>
      showPrices
        ? `<div class="mod-line">+ ${e.name} <span style="float:right">${fmtPrice(e.price)}</span></div>`
        : `<div class="mod-line">+ ${e.name}</div>`
    ).join('')
    const removed = (item.customizations?.removedIngredients ?? []).map(r =>
      `<div class="mod-line">- Sin ${r}</div>`
    ).join('')
    return line + extras + removed
  }).join('')
}

function renderNonBurgerBurgerYaLines(items, showPrices) {
  return items
    .filter(i => i.area === 'burger_ya' && i.category !== 'burger')
    .map(i => showPrices
      ? `<div class="row"><span>1x ${i.name}</span><span>${fmtPrice(i.unitPrice)}</span></div>`
      : `<div class="row"><span>1x ${i.name}</span></div>`
    ).join('')
}

function renderDrinksLines(items, showPrices) {
  // Each drink item already stores quantity (e.g. qty=2 for "2 Fernet" promo)
  const drinkCounts = {}
  for (const item of items.filter(i => i.area === 'drinks_t6')) {
    if (!drinkCounts[item.id]) drinkCounts[item.id] = { name: item.name, price: item.unitPrice, qty: 0, total: 0 }
    drinkCounts[item.id].qty += (item.quantity ?? 1)
    drinkCounts[item.id].total += item.totalPrice
  }
  return Object.values(drinkCounts).map(d => showPrices
    ? `<div class="row"><span>${d.qty} ${d.name}</span><span>${fmtPrice(d.total)}</span></div>`
    : `<div class="row"><span>${d.qty} ${d.name}</span></div>`
  ).join('')
}

function buildEventTicketHtml(order, type) {
  const { hora, fecha } = getTimestamp(order)
  const num = order.displayOrderCode ?? `#${order.eventOrderNumber}`
  const name = order.customerName ?? ''
  const payment = fmtPayment(order.paymentMethod)
  const burgerYaItems = order.items?.filter(i => i.area === 'burger_ya') ?? []
  const drinksItems = order.items?.filter(i => i.area === 'drinks_t6') ?? []
  const isCancelled = order.status === 'cancelled'
  const cancelledBanner = isCancelled
    ? `<div class="tag" style="border:2px solid #000;padding:3px;margin:4px 0;">*** CANCELADO ***</div>`
    : ''

  let body = ''

  if (type === 'cliente_burgers') {
    const burgerLines = renderBurgerItemLines(burgerYaItems, true)
    const extraLines = renderNonBurgerBurgerYaLines(order.items ?? [], true)
    body = `<div class="ticket">
      <div class="subtitle" style="font-size:11px;">BURGER YA x DRINKST6</div>
      <div class="title">${num}</div>
      ${cancelledBanner}
      <div class="tag">RETIRO BURGERS</div>
      <div class="subtitle">${name}</div>
      <hr class="sep">
      ${burgerLines}${extraLines}
      <hr class="sep">
      <div class="total-row"><span>SUBTOTAL BURGER YA</span><span>${fmtPrice(order.burgerYaSubtotal)}</span></div>
      <hr class="sep">
      <div class="row"><span class="label">Pago</span><span>${payment}</span></div>
      <div class="row"><span class="label">Estado</span><span>PAGADO</span></div>
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
    </div>`

  } else if (type === 'cliente_tragos') {
    const drinkLines = renderDrinksLines(order.items ?? [], true)
    body = `<div class="ticket">
      <div class="subtitle" style="font-size:11px;">BURGER YA x DRINKST6</div>
      <div class="title">${num}</div>
      ${cancelledBanner}
      <div class="tag">RETIRO TRAGOS</div>
      <div class="subtitle">${name}</div>
      <hr class="sep">
      ${drinkLines}
      <hr class="sep">
      <div class="total-row"><span>SUBTOTAL DRINKST6</span><span>${fmtPrice(order.drinksT6Subtotal)}</span></div>
      <hr class="sep">
      <div class="row"><span class="label">Pago</span><span>${payment}</span></div>
      <div class="row"><span class="label">Estado</span><span>PAGADO</span></div>
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
    </div>`

  } else if (type === 'caja') {
    const burgerLines = renderBurgerItemLines(burgerYaItems, true)
    const extraLines = renderNonBurgerBurgerYaLines(order.items ?? [], true)
    const drinkLines = renderDrinksLines(order.items ?? [], true)
    const hasBurgers = burgerYaItems.length > 0
    const hasDrinks = drinksItems.length > 0
    body = `<div class="ticket">
      <div class="section-title">CAJA</div>
      <div class="subtitle" style="font-size:11px;">BURGER YA x DRINKST6</div>
      <hr class="sep-solid">
      <div class="title">${num}</div>
      ${cancelledBanner}
      <div class="subtitle">${name}</div>
      <hr class="sep">
      ${hasBurgers ? burgerLines + extraLines : ''}
      ${hasBurgers && hasDrinks ? '<hr class="sep">' : ''}
      ${hasDrinks ? drinkLines : ''}
      <hr class="sep">
      ${hasBurgers ? `<div class="row"><span class="label">Subtotal Burger Ya</span><span>${fmtPrice(order.burgerYaSubtotal)}</span></div>` : ''}
      ${hasDrinks ? `<div class="row"><span class="label">Subtotal DrinksT6</span><span>${fmtPrice(order.drinksT6Subtotal)}</span></div>` : ''}
      <div class="total-row"><span>TOTAL</span><span>${fmtPrice(order.total)}</span></div>
      <hr class="sep">
      <div class="row"><span class="label">Pago</span><span>${payment}</span></div>
      <div class="row"><span class="label">Estado</span><span>PAGADO</span></div>
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
    </div>`

  } else if (type === 'cocina_plancha' || type === 'cocina_armado' || type === 'cocina_despacho') {
    const titleMap = { cocina_plancha: 'COCINA · PLANCHA', cocina_armado: 'COCINA · ARMADO', cocina_despacho: 'COCINA · DESPACHO' }
    const burgerLines = renderBurgerItemLines(burgerYaItems, false)
    const extraLines = renderNonBurgerBurgerYaLines(order.items ?? [], false)
    body = `<div class="ticket">
      <div class="section-title">${titleMap[type]}</div>
      <div class="subtitle" style="font-size:11px;">BURGER YA x DRINKST6</div>
      <hr class="sep-solid">
      <div class="title">${num}</div>
      <div class="subtitle">${name}</div>
      <hr class="sep">
      ${burgerLines}${extraLines}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora}</div>
    </div>`

  } else if (type === 'barra') {
    const drinkLines = renderDrinksLines(order.items ?? [], false)
    body = `<div class="ticket">
      <div class="section-title">BARRA</div>
      <div class="subtitle" style="font-size:11px;">BURGER YA x DRINKST6</div>
      <hr class="sep-solid">
      <div class="title">${num}</div>
      <div class="subtitle">${name}</div>
      <hr class="sep">
      ${drinkLines}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora}</div>
    </div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${CSS_TICKET}</style></head><body>${body}</body></html>`
}

export async function printEventTicket(order, type) {
  await printViaIframe(buildEventTicketHtml(order, type))
}

// cancelToken: optional { cancelled: false } — set .cancelled = true to abort remaining tickets
export async function printEventTickets(order, cancelToken = null) {
  const hasBurgerYa = (order.items ?? []).some(i => i.area === 'burger_ya')
  const hasDrinksT6 = (order.items ?? []).some(i => i.area === 'drinks_t6')

  const types = []
  if (hasBurgerYa) types.push('cliente_burgers')
  if (hasDrinksT6) types.push('cliente_tragos')
  types.push('caja')
  if (hasBurgerYa) types.push('cocina_plancha', 'cocina_armado', 'cocina_despacho')
  if (hasDrinksT6) types.push('barra')

  for (const type of types) {
    if (cancelToken?.cancelled) break
    await printViaIframe(buildEventTicketHtml(order, type))
    if (cancelToken?.cancelled) break
    await new Promise(r => setTimeout(r, 700))
  }
}

export function getApplicableTicketTypes(order) {
  const hasBurgerYa = (order.items ?? []).some(i => i.area === 'burger_ya')
  const hasDrinksT6 = (order.items ?? []).some(i => i.area === 'drinks_t6')
  return {
    cliente_burgers: hasBurgerYa,
    cliente_tragos: hasDrinksT6,
    caja: true,
    cocina_plancha: hasBurgerYa,
    cocina_armado: hasBurgerYa,
    cocina_despacho: hasBurgerYa,
    barra: hasDrinksT6,
  }
}
