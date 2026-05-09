export function OrderTicket({ order }) {
  if (!order) return null

  return (
    <div
      id="order-ticket"
      className="hidden print:block print:w-full print:h-full"
      style={{
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
      }}
    >
      {`
BURGER YA
═════════════════════════════
PEDIDO #${order.orderNumber}
CLIENTE: ${order.customerName}
─────────────────────────────
${order.items.map(item => {
  const subtotal = item.price * item.qty
  return `${item.name}
  x${item.qty} @ $${item.price.toLocaleString()} = $${subtotal.toLocaleString()}`
}).join('\n')}
─────────────────────────────
TOTAL: $${order.total.toLocaleString()}
═════════════════════════════
${new Date().toLocaleString('es-AR')}
      `}
    </div>
  )
}
