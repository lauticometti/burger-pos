
function formatPaymentMethod(method) {
  const map = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    miti_miti: 'Miti miti',
    cta_cte: 'Cta cte',
    canje: 'Canje',
    otro: 'Otro',
  };
  return map[method] || method;
}

function formatOrderType(type) {
  const map = { retiro: 'Retiro', local: 'Local', delivery: 'Delivery' };
  return map[type] || type;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// CSS base sin altura fija — la altura se inyecta dinámicamente después de medir el DOM
const CSS_BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 302px !important;
    max-width: 302px !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.2;
    color: #000;
    background: white !important;
  }
  .ticket {
    width: 272px !important;
    max-width: 272px !important;
    margin: 0 auto !important;
    padding: 4px 4px 0 4px !important;
    height: auto !important;
    min-height: 0 !important;
    font-family: monospace;
    font-size: 11px;
    line-height: 1.2;
    color: black;
    background: white;
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

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple'];

function itemDisplayName(item) {
  if (item.cartId) {
    const base = `Smash Burger ${MEAT_NAMES[item.meatCount] || ''}`;
    return item.noCheddar ? `${base} (sin cheddar)` : base;
  }
  return item.name;
}

function itemLineTotal(item) {
  const unitPrice = item.cartId
    ? item.basePrice + (item.meatCount - 1) * item.extraMeatPrice
    : item.price;
  return unitPrice * (item.qty || 1);
}

function buildSingleTicketHtml(order, type) {
  const hora = new Date(
    order.createdAt?.toDate ? order.createdAt.toDate() : new Date()
  ).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const fecha = new Date().toLocaleDateString('es-AR');
  const numStr = String(order.orderNumber).padStart(3, '0');

  const itemsWithPrices = order.items.map(item =>
    `<div class="row"><span>${item.qty || 1}x ${itemDisplayName(item)}</span><span>$${itemLineTotal(item).toLocaleString()}</span></div>`
  ).join('');

  const itemsNoPrices = order.items.map(item =>
    `<div class="row"><span>${item.qty || 1}x ${itemDisplayName(item)}</span></div>`
  ).join('');

  const discountRow = order.discountAmount > 0
    ? `<div class="row"><span>Descuento</span><span>-$${order.discountAmount.toLocaleString()}</span></div>`
    : '';
  const subtotalRow = order.discountAmount > 0
    ? `<div class="row"><span>Subtotal</span><span>$${order.subtotal.toLocaleString()}</span></div>`
    : '';
  const notesRow = order.notes
    ? `<hr class="sep"><div class="tag">OBS: ${order.notes}</div>`
    : '';

  let body;
  if (type === 'cliente') {
    body = `<div class="ticket">
      <div class="title">BURGER YA.</div>
      <hr class="sep-solid">
      <div class="subtitle">PEDIDO #${numStr}</div>
      <div class="subtitle">${order.customerName}</div>
      <hr class="sep">
      ${itemsWithPrices}
      <hr class="sep">
      ${subtotalRow}${discountRow}
      <div class="total-row"><span>TOTAL</span><span>$${order.total.toLocaleString()}</span></div>
      <hr class="sep">
      <div class="row"><span class="label">Pago</span><span>${formatPaymentMethod(order.paymentMethod)}</span></div>
      <div class="row"><span class="label">Estado</span><span>${order.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}</span></div>
      <div class="row"><span class="label">Tipo</span><span>${formatOrderType(order.orderType)}</span></div>
      ${notesRow}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
      <div class="center" style="font-size:10px;margin-top:4px;">Gracias por tu compra!</div>
    </div>`;
  } else if (type === 'cocina') {
    body = `<div class="ticket">
      <div class="section-title">COCINA</div>
      <hr class="sep-solid">
      <div class="subtitle">PEDIDO #${numStr}</div>
      <div class="subtitle">${order.customerName}</div>
      <hr class="sep">
      ${itemsNoPrices}
      ${notesRow}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora}</div>
    </div>`;
  } else {
    body = `<div class="ticket">
      <div class="section-title">CAJA</div>
      <hr class="sep-solid">
      <div class="subtitle">PEDIDO #${numStr}</div>
      <div class="subtitle">${order.customerName}</div>
      <hr class="sep">
      ${itemsWithPrices}
      <hr class="sep">
      ${subtotalRow}${discountRow}
      <div class="total-row"><span>TOTAL</span><span>$${order.total.toLocaleString()}</span></div>
      <hr class="sep">
      <div class="row"><span class="label">Pago</span><span>${formatPaymentMethod(order.paymentMethod)}</span></div>
      <div class="row"><span class="label">Estado</span><span>${order.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}</span></div>
      <div class="row"><span class="label">Tipo</span><span>${formatOrderType(order.orderType)}</span></div>
      ${notesRow}
      <hr class="sep">
      <div class="center" style="font-size:10px;">${hora} · ${fecha}</div>
    </div>`;
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
    // Visible pero fuera de pantalla con ancho real (302px ≈ 80mm a 96dpi)
    iframe.style.cssText = 'position:fixed;top:-9999px;left:0;width:302px;height:auto;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;

        // Medir alto real del contenido
        const bodyHeight = doc.body.scrollHeight;
        const PX_PER_MM = 96 / 25.4;
        const heightMm = Math.ceil(bodyHeight / PX_PER_MM) + 4; // +4mm margen seguro
        const finalHeightMm = Math.min(Math.max(heightMm, 45), 200);

        console.log('Ticket print size (medido):', { bodyHeight, heightMm, finalHeightMm });

        // Inyectar @page con el alto medido
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
