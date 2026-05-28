import { useState } from 'react'
import { EventModal } from './EventModal'
import { printEventTicket, printEventTickets, getApplicableTicketTypes } from './eventPrinting'
import { getDisplayName, groupBurgersForPrint, sortCartItems } from './eventUtils'

function fmt(n) { return '$' + Number(n ?? 0).toLocaleString('es-AR') }

const STATUS_LABELS = { pending: 'Pendiente', cooking: 'Marchando', ready: 'Listo', delivered: 'Entregado', not_applicable: 'N/A' }
const STATUS_COLORS = {
  pending: '#f59e0b',
  cooking: '#fb923c',
  ready: '#22c55e',
  delivered: 'rgba(245,245,245,0.4)',
  not_applicable: 'rgba(245,245,245,0.2)',
}

function StatusBtn({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
        cursor: 'pointer', border: '1px solid',
        background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
        borderColor: active ? color : 'rgba(255,255,255,0.12)',
        color: active ? color : 'rgba(245,245,245,0.4)',
      }}
    >
      {label}
    </button>
  )
}

function OrderCard({ order, updateKitchenStatus, updateBarStatus, cancelOrder, user }) {
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmPrint, setConfirmPrint] = useState(null) // type key pending confirm
  const confirmTimerRef = { current: null }

  function requestPrint(fn, key) {
    if (confirmPrint === key) {
      // Second click within window — execute
      clearTimeout(confirmTimerRef.current)
      setConfirmPrint(null)
      fn()
    } else {
      // First click — enter confirm state
      setConfirmPrint(key)
      confirmTimerRef.current = setTimeout(() => setConfirmPrint(null), 1500)
    }
  }

  const isActive = order.status !== 'cancelled'
  const hasBurgers = order.kitchenStatus !== 'not_applicable'
  const hasDrinks = order.barStatus !== 'not_applicable'

  async function handleCancel() {
    if (!cancelReason.trim()) { setCancelError('El motivo es obligatorio.'); return }
    await cancelOrder(order.id, cancelReason.trim(), user)
    setCancelModal(false)
    setCancelReason('')
  }

  const applicable = getApplicableTicketTypes(order)
  const REPRINT_LABELS = {
    cliente_burgers: 'Cliente burgers',
    cliente_tragos: 'Cliente tragos',
    caja: 'Caja',
    cocina_plancha: 'Plancha',
    cocina_armado: 'Armado',
    cocina_despacho: 'Despacho',
    barra: 'Barra',
  }

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: '12px', padding: '12px 14px', marginBottom: '10px',
      opacity: isActive ? 1 : 0.5,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 800, fontSize: '16px', color: '#FFC62A' }}>{order.displayOrderCode}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{order.customerName}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{fmt(order.total)}</span>
      </div>

      {isActive && (
        <>
          {/* Kitchen status */}
          {hasBurgers && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'rgba(245,245,245,0.5)', minWidth: '52px' }}>Burgers:</span>
              {['pending', 'cooking', 'ready', 'delivered'].map(s => (
                <StatusBtn
                  key={s}
                  label={STATUS_LABELS[s]}
                  active={order.kitchenStatus === s}
                  color={STATUS_COLORS[s]}
                  onClick={() => updateKitchenStatus(order.id, s)}
                />
              ))}
            </div>
          )}

          {/* Bar status */}
          {hasDrinks && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'rgba(245,245,245,0.5)', minWidth: '52px' }}>Tragos:</span>
              {['pending', 'cooking', 'ready', 'delivered'].map(s => (
                <StatusBtn
                  key={s}
                  label={STATUS_LABELS[s]}
                  active={order.barStatus === s}
                  color={STATUS_COLORS[s]}
                  onClick={() => updateBarStatus(order.id, s)}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setDetailOpen(v => !v)}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(245,245,245,0.7)',
              }}
            >
              {detailOpen ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
            <button
              onClick={() => setCancelModal(true)}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)', color: '#f87171',
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {order.status === 'cancelled' && (
        <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>
          CANCELADO — {order.cancelledReason}
        </div>
      )}

      {/* Detail panel */}
      {detailOpen && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
          {/* Items — grouped */}
          {groupBurgersForPrint(sortCartItems(order.items ?? [])).map((item, i) => {
            const qty = item.displayQty ?? 1
            const isBurger = item.category === 'burger'
            const displayQtyStr = isBurger
              ? (qty > 1 ? `${qty}× ` : '')
              : (qty > 1 ? `${qty} ` : '')
            return (
            <div key={i} style={{ fontSize: '12px', color: 'rgba(245,245,245,0.7)', marginBottom: '4px' }}>
              <span>
                {displayQtyStr && <span style={{ color: isBurger ? '#FFC62A' : '#c4b5fd', marginRight: '1px' }}>{displayQtyStr}</span>}
                {getDisplayName(item)}
              </span>
              {' '}<span style={{ color: 'rgba(245,245,245,0.4)' }}>{fmt(item.totalPrice)}</span>
              {(item.customizations?.extras ?? []).map(e => (
                <div key={e.id} style={{ paddingLeft: '12px', color: '#FFC62A', fontSize: '11px' }}>+ {e.name}</div>
              ))}
              {(item.customizations?.removedIngredients ?? []).map(r => (
                <div key={r} style={{ paddingLeft: '12px', color: 'rgba(239,68,68,0.7)', fontSize: '11px' }}>- Sin {r}</div>
              ))}
            </div>
            )
          })}

          {/* Payment */}
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(245,245,245,0.5)' }}>
            {order.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
          </div>

          {/* Reprint */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(245,245,245,0.4)', marginBottom: '6px', fontWeight: 600 }}>Reimprimir:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(REPRINT_LABELS).map(([type, label]) => {
                const pending = confirmPrint === type
                return (
                  <button
                    key={type}
                    onClick={() => applicable[type] && requestPrint(() => printEventTicket(order, type), type)}
                    disabled={!applicable[type]}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      cursor: applicable[type] ? 'pointer' : 'not-allowed', border: '1px solid',
                      background: pending ? 'rgba(255,198,42,0.15)' : applicable[type] ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      borderColor: pending ? 'rgba(255,198,42,0.5)' : applicable[type] ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                      color: pending ? '#FFC62A' : applicable[type] ? 'rgba(245,245,245,0.7)' : 'rgba(245,245,245,0.2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {pending ? 'Click otra vez' : label}
                  </button>
                )
              })}
              <button
                onClick={() => requestPrint(() => printEventTickets(order), 'all')}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  background: confirmPrint === 'all' ? 'rgba(255,198,42,0.25)' : 'rgba(255,198,42,0.08)',
                  borderColor: confirmPrint === 'all' ? 'rgba(255,198,42,0.7)' : 'rgba(255,198,42,0.3)',
                  color: '#FFC62A',
                  transition: 'all 0.15s',
                }}
              >
                {confirmPrint === 'all' ? 'Click otra vez' : 'Todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <EventModal
          title={`Cancelar pedido ${order.displayOrderCode}`}
          body={
            <div>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: 'rgba(245,245,245,0.7)' }}>
                Esta acción marca el pedido como cancelado. No borra el registro.
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(245,245,245,0.5)', marginBottom: '8px' }}>Motivo de cancelación *</div>
              <input
                value={cancelReason}
                onChange={e => { setCancelReason(e.target.value); setCancelError('') }}
                placeholder="Motivo..."
                style={{
                  width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', padding: '8px 10px', color: '#f5f5f5', fontSize: '13px', outline: 'none',
                }}
              />
              {cancelError && <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>{cancelError}</div>}
            </div>
          }
          onClose={() => { setCancelModal(false); setCancelReason('') }}
          buttons={[
            { label: 'Volver', onClick: () => { setCancelModal(false); setCancelReason('') } },
            { label: 'Cancelar pedido', danger: true, onClick: handleCancel },
          ]}
        />
      )}
    </div>
  )
}

export function EventActiveOrders({ orders, updateKitchenStatus, updateBarStatus, cancelOrder, user }) {
  const active = orders.filter(o => o.status !== 'cancelled')

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '14px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
        Pedidos activos {active.length > 0 ? `(${active.length})` : ''}
      </div>
      {active.length === 0 && (
        <div style={{ color: 'rgba(245,245,245,0.35)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          No hay pedidos activos.
        </div>
      )}
      {active.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          updateKitchenStatus={updateKitchenStatus}
          updateBarStatus={updateBarStatus}
          cancelOrder={cancelOrder}
          user={user}
        />
      ))}
    </div>
  )
}
