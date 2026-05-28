import { printEventTickets } from './eventPrinting'

function fmt(n) { return '$' + Number(n ?? 0).toLocaleString('es-AR') }

export function EventCancelledOrders({ orders }) {
  const cancelled = orders.filter(o => o.status === 'cancelled')

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '14px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
        Cancelados ({cancelled.length})
      </div>
      {cancelled.length === 0 && (
        <div style={{ color: 'rgba(245,245,245,0.35)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          No hay pedidos cancelados.
        </div>
      )}
      {cancelled.map(order => (
        <div
          key={order.id}
          style={{
            background: 'var(--panel)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '8px',
            opacity: 0.7,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#f87171' }}>{order.displayOrderCode}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>{order.customerName}</span>
            <span style={{ fontSize: '13px', color: 'rgba(245,245,245,0.5)' }}>{fmt(order.total)}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(239,68,68,0.7)', marginBottom: '4px' }}>
            Motivo: {order.cancelledReason}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(245,245,245,0.3)' }}>
            Por: {order.cancelledByEmail}
          </div>
          <button
            onClick={() => printEventTickets(order)}
            style={{
              marginTop: '8px', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
              cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)', color: '#f87171',
            }}
          >
            Reimprimir (CANCELADO)
          </button>
        </div>
      ))}
    </div>
  )
}
