import React, { useState } from 'react'
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getDisplayCode, getItemDisplayName, getItemLineTotal, getOrderNetRevenue } from '../utils/orderUtils'
import { getStaffBurgerSizeLabel, calculateStaffBurgerTotal } from '../utils/staffOrderBuilder'
import { STAFF_ADDON_LABELS, STAFF_VEGETABLE_LABELS, STAFF_EXTRA_LABELS, STAFF_PRICES } from '../data/staffMenu'

const STATUS_OPTIONS = [
  { value: 'nuevo',      label: 'Nuevo',      color: '#888' },
  { value: 'en_cocina',  label: 'En cocina',  color: '#f59e0b' },
  { value: 'listo',      label: 'Listo',      color: '#3b82f6' },
  { value: 'entregado',  label: 'Entregado',  color: '#22c55e' },
  { value: 'cancelado',  label: 'Cancelado',  color: '#ef4444' },
]

const PAYMENT_LABELS = {
  efectivo: 'Efectivo', transferencia: 'Transfer.',
  mercado_pago: 'MP', miti_miti: 'Miti miti',
  cta_cte: 'CTA CTE', canje: 'Canje', interno: 'Interno',
  marketing: 'Marketing', internal_account: 'Cuenta int.', otro: 'Otro',
}

const ORDER_TYPE_BADGE = {
  local:    { label: 'Local',    color: '#4ade80' },
  retiro:   { label: 'Retiro',   color: '#facc15' },
  delivery: { label: 'Delivery', color: '#38bdf8' },
  interno:  { label: 'Interno',  color: '#ff9666' },
}

const INTERNAL_PURPOSE_BADGE = {
  staff_consumption:    { label: 'Staff',          color: '#ff9666' },
  marketing:            { label: 'Marketing',      color: '#a78bfa' },
  marketing_barter:     { label: 'Marketing',      color: '#a78bfa' },
  internal_account:     { label: 'Cuenta interna', color: '#60a5fa' },
  owner_consumption:    { label: 'Cuenta interna', color: '#60a5fa' },
  personal_consumption: { label: 'Cuenta interna', color: '#60a5fa' },
  test:                 { label: 'Prueba',         color: '#888' },
}

const PURPOSES_NEEDING_LEDGER_VOID = new Set(['staff_consumption'])

function isSameDay(firestoreTimestamp) {
  if (!firestoreTimestamp) return false
  const d = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp)
  const today = new Date()
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
}

async function voidRelatedLedgerEntries(order, user) {
  const { id: orderId, orderCode, displayOrderCode } = order

  // Buscar por todas las claves de vinculación, deduplicar por doc.id
  const queries = []
  if (orderId)           queries.push(query(collection(db, 'staffLedger'), where('orderId', '==', orderId)))
  if (orderCode)         queries.push(query(collection(db, 'staffLedger'), where('orderCode', '==', orderCode)))
  if (displayOrderCode)  queries.push(query(collection(db, 'staffLedger'), where('displayOrderCode', '==', displayOrderCode)))

  const seen = new Set()
  const toVoid = []
  for (const q of queries) {
    const snap = await getDocs(q)
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        if (!d.data().voided) toVoid.push(d.ref)
      }
    }
  }

  await Promise.all(toVoid.map(ref => updateDoc(ref, {
    voided: true,
    voidedAt: serverTimestamp(),
    voidedByEmail: user?.email || '',
    voidedByUid: user?.uid || '',
    voidReason: 'Pedido cancelado automáticamente',
  })))

  return toVoid.length
}

function TypeBadge({ order }) {
  let cfg
  if (order.orderMode === 'internal') {
    cfg = INTERNAL_PURPOSE_BADGE[order.orderPurpose] || { label: 'Interno', color: '#ff9666' }
  } else {
    cfg = ORDER_TYPE_BADGE[order.orderType] || { label: order.orderType || '?', color: '#888' }
  }
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', color: cfg.color, border: `1px solid ${cfg.color}33`, background: `${cfg.color}15`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', color: opt.color, border: `1px solid ${opt.color}`, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  )
}

function PaymentStatusToggle({ status, docId, onUpdate }) {
  const isPending = status !== 'pagado'
  return (
    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
      <button onClick={(e) => { e.stopPropagation(); if (isPending) return; onUpdate(docId, 'pendiente') }} style={{ padding: '0 10px', height: '32px', fontSize: '11px', fontWeight: 'bold', border: 'none', cursor: isPending ? 'default' : 'pointer', background: isPending ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: isPending ? '#000' : 'rgba(255,255,255,0.35)' }}>Pendiente</button>
      <button onClick={(e) => { e.stopPropagation(); if (!isPending) return; onUpdate(docId, 'pagado') }} style={{ padding: '0 10px', height: '32px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: !isPending ? 'default' : 'pointer', background: !isPending ? '#22c55e' : 'rgba(255,255,255,0.05)', color: !isPending ? '#000' : 'rgba(255,255,255,0.35)' }}>Pagado</button>
    </div>
  )
}

function ExpandedDetail({ order }) {
  const items = order.items || []
  const kitchenNote = order.kitchenNote || order.notes || ''
  const internalNote = order.internalNote || ''
  const isInternal = order.orderMode === 'internal'
  const deliverySurcharge = Number(order.deliverySurcharge ?? 0)
  const deliveryPayout = Number(order.deliveryPayout ?? 0)
  const netRevenue = getOrderNetRevenue(order)
  const discountAmount = Number(order.discountAmount ?? 0)
  const allocations = order.internalAllocations || []

  return (
    <tr style={{ background: 'rgba(255,198,42,0.03)' }}>
      <td colSpan={8} style={{ padding: '10px 16px 14px' }}>
        {/* Items */}
        {isInternal && order.staffOrder?.burgers?.length > 0 ? (
          <div style={{ marginBottom: '8px' }}>
            {order.staffOrder.burgers.map((burger, i) => (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>
                  <span>Burger Staff {getStaffBurgerSizeLabel(burger.patties)}</span>
                  <span>${calculateStaffBurgerTotal(burger).toLocaleString()}</span>
                </div>
                {(burger.addons ?? []).map(id => (
                  <div key={id} style={{ fontSize: '11px', paddingLeft: '12px', color: 'rgba(255,255,255,0.4)' }}>+ {STAFF_ADDON_LABELS[id] ?? id}</div>
                ))}
                {(burger.vegetables ?? []).map(id => (
                  <div key={id} style={{ fontSize: '11px', paddingLeft: '12px', color: 'rgba(255,255,255,0.4)' }}>+ {STAFF_VEGETABLE_LABELS[id] ?? id}</div>
                ))}
                {burger.note?.trim() && (
                  <div style={{ fontSize: '11px', paddingLeft: '12px', color: '#f59e0b' }}>Nota: {burger.note}</div>
                )}
              </div>
            ))}
            {Object.entries(order.staffOrder.extras ?? {}).filter(([, q]) => q > 0).map(([id, qty]) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>
                <span>{qty}x {STAFF_EXTRA_LABELS[id] ?? id}</span>
                <span>${((STAFF_PRICES[id] ?? 0) * qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div style={{ marginBottom: '8px' }}>
            {items.map((it, i) => (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '1px' }}>
                  <span>{it.qty || 1}x {getItemDisplayName(it)}</span>
                  <span>${getItemLineTotal(it).toLocaleString()}</span>
                </div>
                {it.addons?.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '14px', marginBottom: '2px', opacity: 0.75 }}>
                    Agregados: {it.addons.map(a => a.name).join(', ')}
                  </div>
                )}
              </React.Fragment>
            ))}
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#f59e0b', marginBottom: '2px' }}>
                <span>Descuento{order.discountReason ? ` (${order.discountReason})` : ''}</span>
                <span>-${discountAmount.toLocaleString()}</span>
              </div>
            )}
            {deliverySurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#38bdf8', marginBottom: '2px' }}>
                <span>Recargo envío</span>
                <span>+${deliverySurcharge.toLocaleString()}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Internal order detail */}
        {isInternal && order.orderPurpose !== 'staff_consumption' && (
          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {order.relatedPerson && <span>Persona: <strong style={{ color: 'var(--text)' }}>{order.relatedPerson}</strong></span>}
            {(order.saleValueAmount ?? 0) > 0 && <span>Valor ref.: <strong style={{ color: 'var(--text)' }}>${Number(order.saleValueAmount).toLocaleString()}</strong></span>}
            {order.orderPurpose === 'internal_account' && <span>Cobro real: <strong style={{ color: (order.cashCollected ?? 0) > 0 ? '#4ade80' : 'var(--muted)' }}>${Number(order.cashCollected ?? 0).toLocaleString()}</strong></span>}
            {(order.orderPurpose === 'marketing' || order.orderPurpose === 'marketing_barter') && (
              <>
                <span style={{ color: '#a78bfa' }}>Cobro real: $0</span>
                {(order.marketingTotalCostAmount ?? 0) > 0 && (
                  <>
                    <span>Costo producto: <strong style={{ color: 'var(--text)' }}>${Number(order.marketingProductCostAmount ?? 0).toLocaleString()}</strong></span>
                    {(order.marketingDeliveryCostAmount ?? 0) > 0 && <span>Envío: <strong style={{ color: 'var(--text)' }}>${Number(order.marketingDeliveryCostAmount).toLocaleString()}</strong></span>}
                    <span>Costo total mkt: <strong style={{ color: '#a78bfa' }}>${Number(order.marketingTotalCostAmount).toLocaleString()}</strong></span>
                  </>
                )}
              </>
            )}
            {/* Cuenta interna: costo + resultado */}
            {order.orderPurpose === 'internal_account' && (Number(order.internalTotalCostAmount ?? order.internalCostAmount ?? 0) > 0) && (
              <>
                <span>Costo producto: <strong style={{ color: 'var(--text)' }}>${Number(order.internalProductCostAmount ?? order.internalCostAmount ?? 0).toLocaleString()}</strong></span>
                {(order.internalDeliveryCostAmount ?? 0) > 0 && <span>Envío: <strong style={{ color: 'var(--text)' }}>${Number(order.internalDeliveryCostAmount).toLocaleString()}</strong></span>}
                {(order.internalDeliveryCostAmount ?? 0) > 0 && <span>Costo total: <strong style={{ color: 'var(--text)' }}>${Number(order.internalTotalCostAmount ?? 0).toLocaleString()}</strong></span>}
                <span>Pendiente: <strong style={{ color: (order.internalPendingAmount ?? 0) > 0 ? '#ff9966' : '#4ade80' }}>${Number(order.internalPendingAmount ?? 0).toLocaleString()}</strong></span>
                {(order.internalSurplusCash ?? 0) > 0 && <span>Excedente: <strong style={{ color: 'var(--y)' }}>${Number(order.internalSurplusCash).toLocaleString()}</strong></span>}
                <span>Resultado: <strong style={{ color: Number(order.internalResultAmount ?? 0) >= 0 ? '#4ade80' : '#ff9966' }}>${Number(order.internalResultAmount ?? 0).toLocaleString()}</strong></span>
              </>
            )}
            {order.orderPurpose === 'internal_account' && (order.barterItems?.length ?? 0) > 0 && (
              <span>Recibido: <strong style={{ color: '#a78bfa' }}>{order.barterItems.map(b => b.description).join(', ')}{(order.barterValueAmount ?? 0) > 0 ? ` ($${Number(order.barterValueAmount).toLocaleString()})` : ''}</strong></span>
            )}
          </div>
        )}

        {/* Allocations para Cuenta interna */}
        {allocations.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsables internos</div>
            {allocations.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>
                <span>{a.staffName}{a.note ? ` — ${a.note}` : ''}</span>
                <span style={{ color: '#ff9666' }}>${Number(a.amount || 0).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ff9666', fontWeight: '600', marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2px' }}>
              <span>Monto interno total</span>
              <span>${allocations.reduce((s, a) => s + Number(a.amount || 0), 0).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Notas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: kitchenNote || internalNote ? '8px' : '0' }}>
          {kitchenNote && <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', padding: '2px 8px' }}>Cocina: {kitchenNote}</span>}
          {internalNote && <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 8px' }}>Interno: {internalNote}</span>}
        </div>

        {/* Delivery info */}
        {(deliveryPayout > 0 || order.assignedDeliveryName || order.deliveryAddress) && (
          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
            {order.assignedDeliveryName && <span>Repartidor: <strong style={{ color: 'var(--text)' }}>{order.assignedDeliveryName}</strong></span>}
            {deliveryPayout > 0 && <span>Pago delivery: <strong style={{ color: '#38bdf8' }}>-${deliveryPayout.toLocaleString()}</strong></span>}
            {deliveryPayout > 0 && <span>Neto: <strong style={{ color: '#4ade80' }}>${netRevenue.toLocaleString()}</strong></span>}
            {order.deliveryAddress && <span>Dir: {order.deliveryAddress}{order.deliveryAddressDetails ? ` (${order.deliveryAddressDetails})` : ''}</span>}
          </div>
        )}
      </td>
    </tr>
  )
}

function ActionRow({ order, updateOrderStatus, printTicket, printTickets, user }) {
  const [updating, setUpdating] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const handleStatus = async (status) => {
    if (status !== 'cancelado') {
      setUpdating(true)
      try { await updateOrderStatus(order.id, status) }
      finally { setUpdating(false) }
      return
    }

    // Cancelación — verificar si necesita anular staffLedger
    const needsLedgerVoid = PURPOSES_NEEDING_LEDGER_VOID.has(order.orderPurpose)
    if (needsLedgerVoid && !cancelConfirm) {
      setCancelConfirm(true)
      return
    }

    setUpdating(true)
    setCancelConfirm(false)
    try {
      if (needsLedgerVoid) {
        await voidRelatedLedgerEntries(order, user)
      }
      await updateOrderStatus(order.id, 'cancelado')
    } catch (err) {
      console.error('Error cancelando pedido:', err)
      setCancelError('Error al cancelar. Revisá los movimientos de staff manualmente.')
    } finally {
      setUpdating(false)
    }
  }

  const btnStyle = (color = 'var(--panel)') => ({
    padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)', background: color,
    color: color === 'var(--panel)' ? 'var(--text)' : '#000',
    cursor: 'pointer', whiteSpace: 'nowrap',
  })

  return (
    <tr style={{ background: 'rgba(255,198,42,0.04)', borderBottom: '1px solid var(--line)' }}>
      <td colSpan={8} style={{ padding: '8px 12px' }}>
        {cancelConfirm && (
          <div style={{
            background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.4)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>
              Este pedido generó movimientos de staff. Al cancelar se anularán automáticamente.
            </span>
            <button
              onClick={() => setCancelConfirm(false)}
              style={{
                fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                border: '1px solid var(--line)', background: 'transparent',
                color: 'var(--text)', cursor: 'pointer',
              }}
            >Cancelar</button>
            <button
              onClick={() => handleStatus('cancelado')}
              style={{
                fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                border: 'none', background: '#c0392b',
                color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}
            >Confirmar cancelación</button>
          </div>
        )}
        {cancelError && (
          <div style={{
            background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.5)',
            borderRadius: '6px', padding: '8px 12px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '12px', color: '#e74c3c', flex: 1 }}>{cancelError}</span>
            <button
              onClick={() => setCancelError('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}
            >✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>Estado:</span>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatus(opt.value)}
              disabled={updating || order.status === opt.value}
              style={{ ...btnStyle(), border: order.status === opt.value ? `1px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)', color: order.status === opt.value ? opt.color : 'var(--muted)', opacity: updating ? 0.5 : 1 }}
            >{opt.label}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button onClick={() => printTicket(order, 'cliente')} style={btnStyle()}>Cliente</button>
            <button onClick={() => printTicket(order, 'cocina')} style={btnStyle()}>Cocina</button>
            <button onClick={() => printTicket(order, 'caja')} style={btnStyle()}>Caja</button>
            <button onClick={() => printTickets(order)} style={{ ...btnStyle('var(--y)'), color: '#000' }}>3 comandas</button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function OrderTable({ orders, expandedId, setExpandedId, updateOrderStatus, updatePaymentStatus, printTicket, printTickets, user, emptyMsg }) {
  if (orders.length === 0) {
    return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>{emptyMsg}</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            {['#', 'Hora', 'Tipo', 'Cliente', 'Total', 'Pago', 'Estado pago', 'Estado'].map(col => (
              <th key={col} style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--muted)', textAlign: col === 'Total' ? 'right' : 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const isExpanded = expandedId === order.id
            const hora = order.createdAt?.toDate
              ? order.createdAt.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              : '-'
            const code = getDisplayCode(order)
            return (
              <React.Fragment key={order.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--line)', cursor: 'pointer', background: isExpanded ? 'rgba(255,198,42,0.06)' : 'transparent' }}
                >
                  <td style={{ padding: '12px 8px', fontWeight: '600', color: order.orderMode === 'internal' ? '#ff9666' : 'var(--y)', whiteSpace: 'nowrap' }}>{code}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--muted)' }}>{hora}</td>
                  <td style={{ padding: '12px 8px' }}><TypeBadge order={order} /></td>
                  <td style={{ padding: '12px 8px', color: 'var(--text)', fontWeight: '500' }}>{order.customerName}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text)' }}>
                    {order.orderMode === 'internal'
                      ? (() => {
                          const ref = order.internalReferenceTotal ?? order.internalTotalCostAmount ?? order.internalPendingAmount ?? order.internalAmount ?? order.total ?? 0
                          return ref > 0 ? <span style={{ color: 'var(--muted)' }}>${Number(ref).toLocaleString('es-AR')}</span> : '—'
                        })()
                      : `$${(order.total || 0).toLocaleString()}`}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--muted)' }}>
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '-'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {order.orderMode !== 'internal' && (
                      <PaymentStatusToggle status={order.paymentStatus} docId={order.id} onUpdate={updatePaymentStatus} />
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}><StatusBadge status={order.status || 'nuevo'} /></td>
                </tr>
                {isExpanded && (
                  <>
                    <ExpandedDetail order={order} />
                    <ActionRow order={order} updateOrderStatus={updateOrderStatus} printTicket={printTicket} printTickets={printTickets} user={user} />
                  </>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function OrderHistory({ orders, loading, updateOrderStatus, updatePaymentStatus, printTicket, printTickets, user }) {
  const [expandedId, setExpandedId] = useState(null)
  const [activeTab, setActiveTab] = useState('activos')

  const todayOrders = orders
    .filter(o => isSameDay(o.createdAt))
    .sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0)
      const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0)
      return ta - tb
    })

  const activeOrders = todayOrders.filter(o => o.status !== 'cancelado')
  const canceledOrders = todayOrders.filter(o => o.status === 'cancelado')

  const activeRevenueOrders = activeOrders.filter(
    o => o.orderMode !== 'internal' && o.countsAsRevenue !== false
  )
  const total = activeRevenueOrders.reduce((sum, o) => sum + (o.total || 0), 0)

  const tabStyle = (isActive) => ({
    padding: '6px 16px', fontSize: '12px', fontWeight: '700', borderRadius: '6px',
    border: isActive ? '1px solid rgba(255,198,42,0.4)' : '1px solid rgba(255,255,255,0.1)',
    background: isActive ? 'rgba(255,198,42,0.1)' : 'transparent',
    color: isActive ? 'var(--y)' : 'var(--muted)',
    cursor: 'pointer',
  })

  const displayOrders = activeTab === 'activos' ? activeOrders : canceledOrders

  return (
    <div style={{ background: 'var(--panel)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px', marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>Pedidos del día</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={tabStyle(activeTab === 'activos')} onClick={() => setActiveTab('activos')}>
              Activos {activeOrders.length > 0 && `(${activeOrders.length})`}
            </button>
            <button style={tabStyle(activeTab === 'cancelados')} onClick={() => setActiveTab('cancelados')}>
              Cancelados {canceledOrders.length > 0 && `(${canceledOrders.length})`}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{activeRevenueOrders.length} pedidos</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)' }}>${total.toLocaleString()}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Cargando...</p>
      ) : (
        <OrderTable
          orders={displayOrders}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          updateOrderStatus={updateOrderStatus}
          updatePaymentStatus={updatePaymentStatus}
          printTicket={printTicket}
          printTickets={printTickets}
          user={user}
          emptyMsg={activeTab === 'activos' ? 'Sin pedidos activos hoy' : 'Sin pedidos cancelados hoy'}
        />
      )}
    </div>
  )
}
