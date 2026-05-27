import { sortCartItems } from './cartSort.js'
import { getItemDisplayName, getItemLineTotal, getDisplayCode, getOrderGrossTotal, getOrderNetRevenue } from './orderUtils.js'
import { formatStaffOrderKitchenHtml, getStaffBurgerSizeLabel, calculateStaffBurgerTotal } from './staffOrderBuilder.js'
import { STAFF_ADDON_LABELS, STAFF_VEGETABLE_LABELS, STAFF_EXTRA_LABELS, STAFF_PRICES } from '../data/staffMenu.js'

function formatPaymentMethod(method) {
  const map = {
    efectivo: 'Efectivo', transferencia: 'Transferencia',
    miti_miti: 'Miti miti', cta_cte: 'CTA CTE',
    canje: 'CANJE', otro: 'Otro',
    marketing: 'Marketing', internal_account: 'Cuenta interna',
    marketing_barter: 'Marketing', owner_consumption: 'Cuenta interna',
    interno: 'Interno',
  };
  return map[method] || method;
}

function getPurposeLabel(purpose) {
  const map = {
    test: 'Prueba', staff_consumption: 'Staff',
    marketing: 'Marketing', marketing_barter: 'Marketing',
    internal_account: 'Cuenta interna', owner_consumption: 'Cuenta interna',
    personal_consumption: 'Cuenta interna',
  }
  return map[purpose] || 'Interno'
}

function formatOrderType(type) {
  const map = { retiro: 'Retiro', local: 'Local', delivery: 'Delivery' };
  return map[type] || type;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CSS_BASE = `
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
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

function buildMitiMitiRows(order) {
  if (order.paymentMethod !== 'miti_miti' || !order.mitiMiti) return ''
  const { transferencia, efectivo, deuda } = order.mitiMiti
  const rows = []
  if (transferencia > 0) rows.push(`<div class="row"><span class="label">&nbsp;&nbsp;Transferencia</span><span>$${transferencia.toLocaleString()}</span></div>`)
  if (efectivo > 0) rows.push(`<div class="row"><span class="label">&nbsp;&nbsp;Efectivo</span><span>$${efectivo.toLocaleString()}</span></div>`)
  if (deuda > 0) rows.push(`<div class="row"><span class="label">&nbsp;&nbsp;Queda debiendo</span><span>$${deuda.toLocaleString()}</span></div>`)
  return rows.join('')
}

function addonLineNoPrices(item) {
  if (!item.addons?.length) return ''
  return `<div style="font-size:10px;color:#555;padding-left:10px;margin-bottom:2px;">Agregados: ${item.addons.map(a => a.name).join(', ')}</div>`
}

function buildStaffOrderPriceRows(staffOrder) {
  const rows = []
  for (const burger of staffOrder.burgers ?? []) {
    const sizeLabel = getStaffBurgerSizeLabel(burger.patties)
    const total = calculateStaffBurgerTotal(burger)
    rows.push(`<div class="row"><span>1x Burger Staff ${sizeLabel}</span><span>$${total.toLocaleString()}</span></div>`)
    for (const id of burger.addons ?? [])
      rows.push(`<div style="padding-left:12px;font-size:11px;color:#aaa;"><span>+ ${STAFF_ADDON_LABELS[id] ?? id}</span></div>`)
    for (const id of burger.vegetables ?? [])
      rows.push(`<div style="padding-left:12px;font-size:11px;color:#aaa;"><span>+ ${STAFF_VEGETABLE_LABELS[id] ?? id}</span></div>`)
    if (burger.note?.trim())
      rows.push(`<div style="padding-left:12px;font-size:11px;color:#aaa;"><span>Nota: ${burger.note.trim()}</span></div>`)
  }
  const extras = staffOrder.extras ?? {}
  for (const [id, qty] of Object.entries(extras)) {
    if (qty > 0) rows.push(`<div class="row"><span>${qty}x ${STAFF_EXTRA_LABELS[id] ?? id}</span><span>$${((STAFF_PRICES[id] ?? 0) * qty).toLocaleString()}</span></div>`)
  }
  return rows.join('')
}

function buildSingleTicketHtml(order, type) {
  const hora = new Date(
    order.createdAt?.toDate ? order.createdAt.toDate() : new Date()
  ).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const fecha = new Date().toLocaleDateString('es-AR');

  // Número de pedido usando el helper compartido
  const numStr = getDisplayCode(order)

  const sortedItems = sortCartItems(order.items || [])

  // Items sin precio (cocina)
  const itemsNoPrices = sortedItems.map(item =>
    `<div class="row"><span>${item.qty || 1}x ${getItemDisplayName(item)}</span></div>`
    + addonLineNoPrices(item)
  ).join('')

  // Items con precio (cliente/caja)
  const itemsWithPrices = sortedItems.map(item => {
    const lt = getItemLineTotal(item)
    return `<div class="row"><span>${item.qty || 1}x ${getItemDisplayName(item)}</span><span>$${lt.toLocaleString()}</span></div>`
      + addonLineNoPrices(item)
  }).join('')

  // Notas
  const kitchenNote = order.kitchenNote || order.notes || ''
  const internalNote = order.internalNote || ''

  // Descuento
  const grossTotal = getOrderGrossTotal(order)
  const discountAmount = Number(order.discountAmount ?? 0)
  const discountRow = discountAmount > 0
    ? `<div class="row"><span>Descuento</span><span>-$${discountAmount.toLocaleString()}</span></div>`
    : ''
  const subtotalRow = discountAmount > 0
    ? `<div class="row"><span>Subtotal</span><span>$${grossTotal.toLocaleString()}</span></div>`
    : ''

  // Delivery
  const deliverySurcharge = Number(order.deliverySurcharge ?? 0)
  const deliveryPayout = Number(order.deliveryPayout ?? 0)
  const netRevenue = getOrderNetRevenue(order)
  const surchargeRow = deliverySurcharge > 0
    ? `<div class="row"><span>Recargo envío</span><span>+$${deliverySurcharge.toLocaleString()}</span></div>`
    : ''

  // Dirección
  const addressRows = order.deliveryAddress
    ? `<div class="row"><span class="label">Dirección</span><span>${order.deliveryAddress}</span></div>`
      + (order.deliveryAddressDetails ? `<div class="row"><span class="label">Ref.</span><span>${order.deliveryAddressDetails}</span></div>` : '')
    : ''

  const isInternal = order.orderMode === 'internal'
  const purposeLabel = getPurposeLabel(order.orderPurpose)

  // Para internos Staff, los items vienen de staffOrder (nuevo modelo)
  const staffOrder = order.staffOrder ?? null
  const hasStaffOrder = isInternal && staffOrder?.burgers?.length > 0
  const itemsNoPricesInternal = hasStaffOrder
    ? formatStaffOrderKitchenHtml(staffOrder, order.kitchenNote || '')
    : itemsNoPrices
  const itemsWithPricesInternal = hasStaffOrder
    ? buildStaffOrderPriceRows(staffOrder)
    : itemsWithPrices

  // Allocations para cuenta interna
  const allocations = order.internalAllocations || []
  const allocationsRows = allocations.length > 0
    ? allocations.map(a => `<div class="row"><span class="label">&nbsp;&nbsp;${a.staffName}${a.note ? ` (${a.note})` : ''}</span><span>$${Number(a.amount || 0).toLocaleString()}</span></div>`).join('')
    : ''

  let body;
  const mitiMitiRows = buildMitiMitiRows(order)

  if (type === 'cocina') {
    // COCINA: sin precios, sin pago, sin internalNote, sin netRevenue, sin allocations
    body = `<div class="ticket">
      <div class="section-title">COCINA</div>
      <hr class="sep-solid">
      <div class="subtitle">PEDIDO ${numStr}</div>
      <div class="subtitle">${order.customerName ?? ''}</div>
      ${isInternal ? `<div class="tag">[${purposeLabel.toUpperCase()}]</div>` : ''}
      <hr class="sep">
      ${isInternal ? itemsNoPricesInternal : itemsNoPrices}
      ${kitchenNote && !hasStaffOrder ? `<hr class="sep"><div class="tag">NOTA: ${kitchenNote}</div>` : ''}
      ${order.deliveryAddress ? `<hr class="sep">${addressRows}` : ''}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora}</div>
    </div>`

  } else if (type === 'cliente') {
    if (isInternal) {
      const isStaffOrder = order.orderPurpose === 'staff_consumption'
      const saleValueAmount = Number(order.saleValueAmount ?? order.total ?? 0)
      const staffMenuTotalVal = Number(order.staffMenuTotal ?? order.internalAmount ?? 0)
      const staffCovered = Number(order.staffCoveredAmount ?? 0)
      const staffDeduction = Number(order.payrollDeductionAmount ?? 0)
      const staffDelivery = Number(order.deliveryPayout ?? 0)
      const chargeableTotal = Number(order.chargeableInternalTotal ?? staffMenuTotalVal)
      const hasStaffDelivery = isStaffOrder && staffDelivery > 0

      const staffSummaryRows = isStaffOrder ? `
        <hr class="sep">
        <div class="row"><span class="label">Total consumo</span><span>$${staffMenuTotalVal.toLocaleString()}</span></div>
        ${hasStaffDelivery ? `<div class="row"><span class="label">Envío a cargo</span><span>$${staffDelivery.toLocaleString()}</span></div>` : ''}
        ${hasStaffDelivery ? `<div class="row"><span class="label">Total a cubrir</span><span>$${chargeableTotal.toLocaleString()}</span></div>` : ''}
        <div class="row"><span class="label">Cubierto con saldo</span><span>$${staffCovered.toLocaleString()}</span></div>
        <div class="row"><span class="label">A descontar</span><span>$${staffDeduction.toLocaleString()}</span></div>
      ` : `<hr class="sep"><div class="total-row"><span>TOTAL REF.</span><span>$${saleValueAmount.toLocaleString()}</span></div>`

      body = `<div class="ticket">
        <div class="title">BURGER YA.</div>
        <hr class="sep-solid">
        <div class="subtitle">PEDIDO ${numStr}</div>
        <div class="subtitle">${order.customerName ?? ''}</div>
        <div class="tag">[${purposeLabel.toUpperCase()}]</div>
        <hr class="sep">
        ${itemsWithPricesInternal}
        ${staffSummaryRows}
        ${kitchenNote ? `<hr class="sep"><div class="tag">OBS: ${kitchenNote}</div>` : ''}
        ${order.deliveryAddress ? `<hr class="sep">${addressRows}` : ''}
        <hr class="sep">
        <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
        <div class="center" style="font-size:10px;margin-top:4px;">Gracias!</div>
      </div>`
    } else {
      // CLIENTE normal
      body = `<div class="ticket">
        <div class="title">BURGER YA.</div>
        <hr class="sep-solid">
        <div class="subtitle">PEDIDO ${numStr}</div>
        <div class="subtitle">${order.customerName ?? ''}</div>
        <hr class="sep">
        ${itemsWithPrices}
        <hr class="sep">
        ${subtotalRow}${discountRow}
        ${surchargeRow}
        <div class="total-row"><span>TOTAL</span><span>$${(order.total ?? 0).toLocaleString()}</span></div>
        <hr class="sep">
        <div class="row"><span class="label">Pago</span><span>${formatPaymentMethod(order.paymentMethod)}</span></div>
        ${mitiMitiRows}
        <div class="row"><span class="label">Estado</span><span>${order.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}</span></div>
        <div class="row"><span class="label">Tipo</span><span>${formatOrderType(order.orderType)}</span></div>
        ${kitchenNote ? `<hr class="sep"><div class="tag">OBS: ${kitchenNote}</div>` : ''}
        ${order.deliveryAddress ? `<hr class="sep">${addressRows}` : ''}
        <hr class="sep">
        <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
        <div class="center" style="font-size:10px;margin-top:4px;">Gracias por tu compra!</div>
      </div>`
    }

  } else {
    // CAJA
    if (isInternal) {
      const saleValueAmount = Number(order.saleValueAmount ?? 0)
      const cashCollected = Number(order.cashCollected ?? 0)
      const internalAmount = Number(order.internalAmount ?? 0)
      const purpose = order.orderPurpose || ''
      const isStaff = purpose === 'staff_consumption'
      const isMarketing = purpose === 'marketing' || purpose === 'marketing_barter'
      const isInternalAcc = purpose === 'internal_account' || purpose === 'owner_consumption' || purpose === 'personal_consumption'

      // Cuenta interna campos mixtos
      const barterItemsArr = order.barterItems || []
      const barterValueAmount = Number(order.barterValueAmount ?? 0)
      const internalProductCostNum = Number(order.internalProductCostAmount ?? order.internalCostAmount ?? 0)
      const internalDeliveryCostNum = Number(order.internalDeliveryCostAmount ?? 0)
      const internalTotalCostNum = Number(order.internalTotalCostAmount ?? (internalProductCostNum + internalDeliveryCostNum))
      const internalCoveredByCash = Number(order.internalCoveredByCash ?? 0)
      const internalPendingAmount = Number(order.internalPendingAmount ?? 0)
      const internalSurplusCash = Number(order.internalSurplusCash ?? 0)
      const internalResultAmount = Number(order.internalResultAmount ?? (Number(order.cashCollected ?? 0) - internalTotalCostNum))
      // Marketing cost fields
      const mktProductCost = Number(order.marketingProductCostAmount ?? 0)
      const mktDeliveryCost = Number(order.marketingDeliveryCostAmount ?? 0)
      const mktTotalCost = Number(order.marketingTotalCostAmount ?? (mktProductCost + mktDeliveryCost))
      const mktCostItems = order.marketingCostItems || []
      // Internal cost items (for ticket breakdown)
      const intCostItems = order.internalCostItems || []

      const staffMenuTotalVal = Number(order.staffMenuTotal ?? order.internalAmount ?? 0)
      const staffCovered = Number(order.staffCoveredAmount ?? 0)
      const staffDeduction = Number(order.payrollDeductionAmount ?? 0)
      const staffDelivery = Number(order.deliveryPayout ?? 0)
      const chargeableTotal = Number(order.chargeableInternalTotal ?? staffMenuTotalVal)
      const hasStaffDelivery = isStaff && staffDelivery > 0

      const staffCajaRows = isStaff ? `
        <div class="row"><span class="label">Total consumo interno</span><span>$${staffMenuTotalVal.toLocaleString()}</span></div>
        ${hasStaffDelivery ? `<div class="row"><span class="label">Envío a cargo</span><span>$${staffDelivery.toLocaleString()}</span></div>` : ''}
        ${hasStaffDelivery ? `<div class="row"><span class="label">Total a cubrir</span><span>$${chargeableTotal.toLocaleString()}</span></div>` : ''}
        <div class="row"><span class="label">Cubierto con saldo</span><span>$${staffCovered.toLocaleString()}</span></div>
        <div class="row"><span class="label">A descontar nómina</span><span>$${staffDeduction.toLocaleString()}</span></div>
      ` : ''

      body = `<div class="ticket">
        <div class="section-title">CAJA</div>
        <hr class="sep-solid">
        <div class="subtitle">PEDIDO ${numStr}</div>
        <div class="subtitle">${order.customerName ?? ''}</div>
        <div class="tag">[${purposeLabel.toUpperCase()}]</div>
        <hr class="sep">
        ${itemsWithPricesInternal}
        <hr class="sep">
        <div class="row"><span class="label">Tipo</span><span>${purposeLabel}</span></div>
        ${isStaff ? staffCajaRows : ''}
        ${!isStaff ? `<div class="row"><span class="label">Val. referencia</span><span>$${saleValueAmount.toLocaleString()}</span></div>` : ''}
        ${isMarketing ? `<div class="row"><span class="label">Cobro real</span><span>$0</span></div>` : ''}
        ${isMarketing && order.relatedPerson ? `<div class="row"><span class="label">Persona</span><span>${order.relatedPerson}</span></div>` : ''}
        ${isMarketing && mktTotalCost > 0 ? `
          <hr class="sep">
          <div class="row"><span class="label">Costo marketing</span></div>
          ${mktCostItems.map(i => `<div class="row"><span class="label">&nbsp;&nbsp;${i.qty}x ${i.name}</span><span>$${Number(i.lineTotal).toLocaleString()}</span></div>`).join('')}
          ${mktProductCost > 0 ? `<div class="row"><span class="label">Costo producto</span><span>$${mktProductCost.toLocaleString()}</span></div>` : ''}
          ${mktDeliveryCost > 0 ? `<div class="row"><span class="label">Envío</span><span>$${mktDeliveryCost.toLocaleString()}</span></div>` : ''}
          <div class="row"><span class="label">Costo total mkt</span><span>$${mktTotalCost.toLocaleString()}</span></div>
        ` : ''}
        ${isInternalAcc ? `<div class="row"><span class="label">Cobro real</span><span>$${cashCollected.toLocaleString()}</span></div>` : ''}
        ${isInternalAcc && order.relatedPerson ? `<div class="row"><span class="label">Destinatario</span><span>${order.relatedPerson}</span></div>` : ''}
        ${isInternalAcc && barterItemsArr.length > 0 ? `<div class="row"><span class="label">Recibido en especie</span></div>${barterItemsArr.map(b => `<div class="row"><span class="label">&nbsp;&nbsp;${b.description || ''}</span><span>${Number(b.estimatedValue) > 0 ? '$' + Number(b.estimatedValue).toLocaleString() : ''}</span></div>`).join('')}<div class="row"><span class="label">Valor recibido</span><span>$${barterValueAmount.toLocaleString()}</span></div>` : ''}
        ${isInternalAcc && internalTotalCostNum > 0 ? `
          <hr class="sep">
          <div class="row"><span class="label">Costo interno</span></div>
          ${intCostItems.map(i => `<div class="row"><span class="label">&nbsp;&nbsp;${i.qty}x ${i.name}</span><span>$${Number(i.lineTotal).toLocaleString()}</span></div>`).join('')}
          <div class="row"><span class="label">Costo producto interno</span><span>$${internalProductCostNum.toLocaleString()}</span></div>
          ${internalDeliveryCostNum > 0 ? `<div class="row"><span class="label">Envío a cubrir</span><span>$${internalDeliveryCostNum.toLocaleString()}</span></div>` : ''}
          <div class="row"><span class="label">Costo total interno</span><span>$${internalTotalCostNum.toLocaleString()}</span></div>
          <div class="row"><span class="label">Cobro real</span><span>$${Number(order.cashCollected ?? 0).toLocaleString()}</span></div>
          <div class="row"><span class="label">Cubierto por cash</span><span>$${internalCoveredByCash.toLocaleString()}</span></div>
          <div class="row"><span class="label">Pendiente interno</span><span>$${internalPendingAmount.toLocaleString()}</span></div>
          ${internalSurplusCash > 0 ? `<div class="row"><span class="label">Excedente cash</span><span>$${internalSurplusCash.toLocaleString()}</span></div>` : ''}
          <div class="row"><span class="label">Resultado interno</span><span>$${internalResultAmount.toLocaleString()}</span></div>
        ` : ''}
        ${isInternalAcc && allocations.length > 0 ? `<hr class="sep"><div class="row"><span class="label">Responsables internos</span></div>${allocationsRows}<div class="row"><span class="label">Monto interno total</span><span>$${internalAmount.toLocaleString()}</span></div>` : ''}
        ${isStaff && deliveryPayout > 0 ? `<div class="row"><span class="label">Pago repartidor</span><span>-$${deliveryPayout.toLocaleString()}</span></div>` : ''}
        ${!isStaff && deliveryPayout > 0 ? `<div class="row"><span class="label">Pago delivery</span><span>-$${deliveryPayout.toLocaleString()}</span></div>` : ''}
        ${kitchenNote ? `<div class="row"><span class="label">Nota cocina</span><span>${kitchenNote}</span></div>` : ''}
        ${internalNote ? `<div class="row"><span class="label">Nota interna</span><span>${internalNote}</span></div>` : ''}
        ${order.deliveryAddress ? `<hr class="sep">${addressRows}` : ''}
        <hr class="sep">
        <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
      </div>`
    } else {
      // CAJA normal
      body = `<div class="ticket">
        <div class="section-title">CAJA</div>
        <hr class="sep-solid">
        <div class="subtitle">PEDIDO ${numStr}</div>
        <div class="subtitle">${order.customerName ?? ''}</div>
        <hr class="sep">
        ${itemsWithPrices}
        <hr class="sep">
        ${subtotalRow}${discountRow}
        ${surchargeRow}
        <div class="total-row"><span>TOTAL</span><span>$${(order.total ?? 0).toLocaleString()}</span></div>
        <hr class="sep">
        <div class="row"><span class="label">Pago</span><span>${formatPaymentMethod(order.paymentMethod)}</span></div>
        ${mitiMitiRows}
        <div class="row"><span class="label">Estado</span><span>${order.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}</span></div>
        <div class="row"><span class="label">Tipo</span><span>${formatOrderType(order.orderType)}</span></div>
        ${deliveryPayout > 0 ? `<div class="row"><span class="label">Pago delivery</span><span>-$${deliveryPayout.toLocaleString()}</span></div>` : ''}
        ${deliveryPayout > 0 ? `<div class="row"><span class="label">Neto Burger Ya</span><span>$${netRevenue.toLocaleString()}</span></div>` : ''}
        ${kitchenNote ? `<div class="row"><span class="label">Nota cocina</span><span>${kitchenNote}</span></div>` : ''}
        ${internalNote ? `<div class="row"><span class="label">Nota interna</span><span>${internalNote}</span></div>` : ''}
        ${order.assignedDeliveryName ? `<div class="row"><span class="label">Repartidor</span><span>${order.assignedDeliveryName}</span></div>` : ''}
        ${order.deliveryAddress ? `<hr class="sep">${addressRows}` : ''}
        <hr class="sep">
        <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
      </div>`
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${CSS_BASE}</style></head>
<body>
${body}
</body>
</html>`;
}

function printViaIframe(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:0;width:302px;height:auto;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        const bodyHeight = doc.body.scrollHeight;
        const PX_PER_MM = 96 / 25.4;
        const heightMm = Math.ceil(bodyHeight / PX_PER_MM) + 4;
        const finalHeightMm = Math.min(Math.max(heightMm, 45), 200);
        const style = doc.createElement('style');
        style.textContent = `
          @page { size: 80mm ${finalHeightMm}mm portrait; margin: 0; }
          html, body { height: ${finalHeightMm}mm !important; overflow: hidden !important; }
        `;
        doc.head.appendChild(style);
        win.focus();
        win.print();
      } catch (e) {
        console.warn('printViaIframe error:', e);
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        resolve();
      }, 1500);
    };
  });
}

export function printTicket(order, type) {
  printViaIframe(buildSingleTicketHtml(order, type));
}

export async function printTickets(order, types = ['cliente', 'cocina', 'caja']) {
  for (const type of types) {
    await printViaIframe(buildSingleTicketHtml(order, type));
    await new Promise(resolve => setTimeout(resolve, 700));
  }
}
