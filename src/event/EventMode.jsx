import { useState } from 'react'
import { useEventOrders } from './useEventOrders'
import { EventPOS } from './EventPOS'
import { EventActiveOrders } from './EventActiveOrders'
import { EventReadyOrders } from './EventReadyOrders'
import { EventStats } from './EventStats'
import { EventCancelledOrders } from './EventCancelledOrders'

const TABS = [
  { id: 'pos', label: 'Tomar pedido' },
  { id: 'active', label: 'Activos' },
  { id: 'ready', label: 'Listos' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'cancelled', label: 'Cancelados' },
]

export function EventMode({ onBack, user }) {
  const [tab, setTab] = useState('pos')
  const { orders, loading, indexError, saveEventOrder, updateKitchenStatus, updateBarStatus, cancelOrder } = useEventOrders()

  const activeCount = orders.filter(o => o.status !== 'cancelled').length
  const readyCount = orders.filter(o =>
    o.status !== 'cancelled' && (o.kitchenStatus === 'ready' || o.barStatus === 'ready')
  ).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        height: '57px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', borderBottom: '1px solid var(--line)',
        background: 'var(--bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid var(--line)', color: 'var(--muted)',
              borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            ← POS
          </button>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFC62A', letterSpacing: '0.02em' }}>
            BURGER DAY
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(245,245,245,0.4)' }}>
            Burger Ya × DrinksT6
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
          {TABS.map(t => {
            const badge = t.id === 'active' ? activeCount : t.id === 'ready' ? readyCount : 0
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid', whiteSpace: 'nowrap',
                  background: isActive ? 'rgba(255,198,42,0.15)' : 'transparent',
                  borderColor: isActive ? 'rgba(255,198,42,0.4)' : 'transparent',
                  color: isActive ? '#FFC62A' : 'rgba(245,245,245,0.6)',
                  position: 'relative',
                }}
              >
                {t.label}
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    background: t.id === 'ready' ? '#22c55e' : '#f59e0b',
                    color: '#000', borderRadius: '999px', fontSize: '10px',
                    fontWeight: 800, minWidth: '16px', height: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {indexError && (
          <div style={{
            background: '#7f1d1d', color: '#fca5a5', padding: '12px 16px',
            fontSize: '13px', fontWeight: 600, borderBottom: '1px solid rgba(239,68,68,0.4)',
          }}>
            ⚠️ Falta crear índice de Firestore para cargar pedidos evento. Revisar consola para el link de creación.
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px', fontWeight: 400, wordBreak: 'break-all' }}>
              {indexError}
            </div>
          </div>
        )}
        {loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(245,245,245,0.4)', fontSize: '13px' }}>
            Cargando pedidos...
          </div>
        )}
        {!loading && tab === 'pos' && (
          <EventPOS orders={orders} saveEventOrder={saveEventOrder} user={user} />
        )}
        {!loading && tab === 'active' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EventActiveOrders
              orders={orders}
              updateKitchenStatus={updateKitchenStatus}
              updateBarStatus={updateBarStatus}
              cancelOrder={cancelOrder}
              user={user}
            />
          </div>
        )}
        {!loading && tab === 'ready' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EventReadyOrders
              orders={orders}
              updateKitchenStatus={updateKitchenStatus}
              updateBarStatus={updateBarStatus}
            />
          </div>
        )}
        {!loading && tab === 'stats' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EventStats orders={orders} />
          </div>
        )}
        {!loading && tab === 'cancelled' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EventCancelledOrders orders={orders} />
          </div>
        )}
      </div>
    </div>
  )
}
