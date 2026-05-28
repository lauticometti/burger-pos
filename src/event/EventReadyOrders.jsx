export function EventReadyOrders({ orders, updateKitchenStatus, updateBarStatus }) {
  const active = orders.filter(o => o.status !== 'cancelled')

  const burgersReady = active.filter(o => o.kitchenStatus === 'ready')
  const drinksReady = active.filter(o => o.barStatus === 'ready')

  // Recently delivered: last 10 entries by updatedAt
  const recentDelivered = active
    .filter(o => o.kitchenStatus === 'delivered' || o.barStatus === 'delivered')
    .slice(0, 10)

  function fmtTime(order) {
    const d = order.updatedAt?.toDate ? order.updatedAt.toDate() : null
    if (!d) return ''
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
        Pedidos listos
      </div>

      {/* Burgers listas */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Burgers listas ({burgersReady.length})
        </div>
        {burgersReady.length === 0 && (
          <div style={{ fontSize: '13px', color: 'rgba(245,245,245,0.3)' }}>—</div>
        )}
        {burgersReady.map(o => (
          <div key={o.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--panel)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '6px',
          }}>
            <span style={{ fontWeight: 700, color: '#FFC62A', fontSize: '15px' }}>{o.displayOrderCode}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>{o.customerName}</span>
            <button
              onClick={() => updateKitchenStatus(o.id, 'delivered')}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', border: 'none', background: '#22c55e', color: '#000',
              }}
            >
              Entregado
            </button>
          </div>
        ))}
      </div>

      {/* Tragos listos */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Tragos listos ({drinksReady.length})
        </div>
        {drinksReady.length === 0 && (
          <div style={{ fontSize: '13px', color: 'rgba(245,245,245,0.3)' }}>—</div>
        )}
        {drinksReady.map(o => (
          <div key={o.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--panel)', border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '6px',
          }}>
            <span style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '15px' }}>{o.displayOrderCode}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>{o.customerName}</span>
            <button
              onClick={() => updateBarStatus(o.id, 'delivered')}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', border: 'none', background: '#22c55e', color: '#000',
              }}
            >
              Entregado
            </button>
          </div>
        ))}
      </div>

      {/* Entregados recientes */}
      {recentDelivered.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(245,245,245,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Entregados recientes
          </div>
          {recentDelivered.map(o => (
            <div key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              fontSize: '12px', color: 'rgba(245,245,245,0.4)',
              padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontWeight: 700, color: 'rgba(245,245,245,0.5)' }}>{o.displayOrderCode}</span>
              <span>{o.customerName}</span>
              {o.kitchenStatus === 'delivered' && <span>Burgers · {fmtTime(o)}</span>}
              {o.barStatus === 'delivered' && <span>Tragos · {fmtTime(o)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
