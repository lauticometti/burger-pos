import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  calculateDailyMetrics,
  groupSalesByPaymentMethod,
  groupSalesByHour,
  groupProductsSold,
  splitOrdersByMode,
  groupInternalOrders,
  getStaffDeductions,
} from '../utils/metrics'
import { getDisplayCode, getItemDisplayName, getItemLineTotal, getOrderNetRevenue } from '../utils/orderUtils'

const fmt = (n) => '$' + Number(n ?? 0).toLocaleString('es-AR')

const CARD_STYLE = {
  background: '#2a2a2a',
  borderRadius: '8px',
  padding: '14px 18px',
  minWidth: '130px',
  flex: '1 1 130px',
}

const LABEL_STYLE = { fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const VALUE_STYLE = { fontSize: '22px', fontWeight: 'bold', color: '#fff' }

function MetricCard({ label, value }) {
  return (
    <div style={CARD_STYLE}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={VALUE_STYLE}>{value}</div>
    </div>
  )
}

const TABLE_STYLE = { borderCollapse: 'collapse', width: '100%', fontSize: '13px' }
const TH_STYLE = { textAlign: 'left', padding: '8px', borderBottom: '2px solid #333', color: '#aaa', fontWeight: '600' }
const TD_STYLE = { padding: '9px 8px', borderBottom: '1px solid #222' }
const TD_RIGHT = { ...TD_STYLE, textAlign: 'right' }

function statusColor(status) {
  if (status === 'cancelado') return '#ef4444'
  if (status === 'entregado') return '#22c55e'
  return '#f59e0b'
}

const SECTION_STYLE = { marginBottom: '32px' }
const SECTION_TITLE = { fontSize: '13px', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }

const PURPOSE_LABELS = {
  test:                 'Prueba',
  staff_consumption:    'Staff',
  staff_meal:           'Staff',              // backward compat
  staff_extra:          'Staff',              // backward compat
  marketing:            'Marketing',
  marketing_barter:     'Marketing',          // backward compat
  internal_account:     'Cuenta interna',
  owner_consumption:    'Cuenta interna',     // backward compat
  personal_consumption: 'Cuenta interna',     // backward compat
  unknown:              'Desconocido',
}

function isStaffPurpose(purpose) {
  return purpose === 'staff_consumption' || purpose === 'staff_meal' || purpose === 'staff_extra'
}

function isMarketingPurpose(purpose) {
  return purpose === 'marketing' || purpose === 'marketing_barter'
}

function isInternalAccountPurpose(purpose) {
  return purpose === 'internal_account' || purpose === 'owner_consumption' || purpose === 'personal_consumption'
}

export function DailyDashboard({ onBack }) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('businessDate', '==', date))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    getDocs(q)
      .then(snapshot => {
        setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [date])

  const validOrders = orders.filter(o => o.status !== 'cancelado')
  const cancelados = orders.filter(o => o.status === 'cancelado')
  const canceladosTotal = cancelados.reduce((s, o) => s + Number(o.total ?? 0), 0)

  const { revenueOrders, internalOrders } = splitOrdersByMode(validOrders)
  const metrics = calculateDailyMetrics(revenueOrders)
  const byPayment = groupSalesByPaymentMethod(revenueOrders)
  const byHour = groupSalesByHour(revenueOrders)
  const products = groupProductsSold(revenueOrders)
  const internalGrouped = groupInternalOrders(internalOrders)
  const staffDeductions = getStaffDeductions(internalOrders)

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: '#fff', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#1a1a1a', borderBottom: '1px solid #2a2a2a',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: '1px solid #444', color: '#aaa',
            fontSize: '12px', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px',
          }}
        >
          Volver
        </button>
        <span style={{ fontWeight: '700', fontSize: '15px', color: '#fff', flex: 1 }}>
          Ventas del dia
        </span>
        <span style={{ fontSize: '13px', color: '#aaa' }}>
          {(() => {
            const [y, m, d] = date.split('-').map(Number)
            const dt = new Date(y, m - 1, d)
            const dia = dt.toLocaleDateString('es-AR', { weekday: 'long' })
            return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
          })()}
        </span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            background: '#2a2a2a', border: '1px solid #444', color: '#fff',
            borderRadius: '6px', padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ padding: '24px 20px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Loading / error */}
        {loading && (
          <div style={{ color: '#888', fontSize: '14px', margin: '32px 0' }}>Cargando...</div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: '13px', margin: '16px 0', background: '#2a1a1a', padding: '10px 14px', borderRadius: '6px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={{ color: '#666', fontSize: '14px', margin: '48px 0', textAlign: 'center' }}>
            Sin pedidos para esta fecha.
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            {/* Metric cards — solo ventas reales */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '32px' }}>
              <MetricCard label="Ventas totales" value={fmt(metrics.ventasTotales)} />
              <MetricCard label="Pedidos cobrados" value={metrics.pedidosTotales} />
              <MetricCard label="Ticket promedio" value={fmt(metrics.ticketPromedio)} />
              <MetricCard label="Burgers" value={metrics.burgersVendidas} />
              <MetricCard label="Carnes" value={metrics.carnesVendidas} />
              <MetricCard label="Papas" value={metrics.papasVendidas} />
              <MetricCard label="Bebidas" value={metrics.bebidasVendidas} />
              <MetricCard label="Dips" value={metrics.dipsVendidos} />
              <MetricCard label="Descuentos" value={fmt(metrics.descuentosTotales)} />
            </div>

            {/* Medios de pago */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Ventas por medio de pago</div>
              <table style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={TH_STYLE}>Medio</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byPayment.map((row, i) => (
                    <tr key={row.method} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <td style={TD_STYLE}>{row.method}</td>
                      <td style={TD_RIGHT}>{row.count}</td>
                      <td style={TD_RIGHT}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ventas por hora */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Ventas por hora</div>
              <table style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={TH_STYLE}>Hora</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byHour.map((row, i) => (
                    <tr key={row.hour} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <td style={TD_STYLE}>{row.label}</td>
                      <td style={TD_RIGHT}>{row.count}</td>
                      <td style={TD_RIGHT}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                  {byHour.length === 0 && (
                    <tr><td colSpan={3} style={{ ...TD_STYLE, color: '#666' }}>Sin datos de hora disponibles.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Productos vendidos */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Productos vendidos</div>
              <table style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={TH_STYLE}>Producto</th>
                    <th style={TH_STYLE}>Categoria</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Cant.</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id || p.name} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <td style={TD_STYLE}>{p.name}</td>
                      <td style={{ ...TD_STYLE, color: '#888' }}>{p.category}</td>
                      <td style={TD_RIGHT}>{p.qty}</td>
                      <td style={TD_RIGHT}>{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pedidos cobrados del dia (solo ventas reales) */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Pedidos cobrados del dia ({revenueOrders.length})</div>
              <table style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={TH_STYLE}>Codigo</th>
                    <th style={TH_STYLE}>Cliente</th>
                    <th style={TH_STYLE}>Tipo</th>
                    <th style={TH_STYLE}>Pago</th>
                    <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                    <th style={TH_STYLE}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueOrders.map((o, i) => {
                    const isEx = expandedOrderId === o.id
                    const deliverySurcharge = Number(o.deliverySurcharge ?? 0)
                    const deliveryPayout = Number(o.deliveryPayout ?? 0)
                    const netRevenue = getOrderNetRevenue(o)
                    const kitchenNote = o.kitchenNote || o.notes || ''
                    const internalNote = o.internalNote || ''
                    return (
                      <>
                        <tr
                          key={o.id}
                          onClick={() => setExpandedOrderId(isEx ? null : o.id)}
                          style={{ background: isEx ? 'rgba(255,255,255,0.05)' : (i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent'), cursor: 'pointer' }}
                        >
                          <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '12px', color: '#aaa' }}>{getDisplayCode(o)}</td>
                          <td style={TD_STYLE}>{o.customerName ?? '-'}</td>
                          <td style={{ ...TD_STYLE, color: '#888' }}>{o.orderType ?? '-'}</td>
                          <td style={{ ...TD_STYLE, color: '#888' }}>{o.paymentMethod ?? '-'}</td>
                          <td style={TD_RIGHT}>{fmt(o.total)}</td>
                          <td style={{ ...TD_STYLE, color: statusColor(o.status), fontWeight: '500' }}>{o.status ?? '-'}</td>
                        </tr>
                        {isEx && (
                          <tr key={`${o.id}-detail`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td colSpan={6} style={{ padding: '8px 16px 12px' }}>
                              {/* Items */}
                              {(o.items || []).map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '2px' }}>
                                  <span>{it.qty || 1}x {getItemDisplayName(it)}</span>
                                  <span>{fmt(getItemLineTotal(it))}</span>
                                </div>
                              ))}
                              {/* Delivery charges */}
                              {deliverySurcharge > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                                  <span>Recargo envío</span><span>+{fmt(deliverySurcharge)}</span>
                                </div>
                              )}
                              {deliveryPayout > 0 && (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginTop: '2px' }}>
                                    <span>Pago delivery{o.assignedDeliveryName ? ` (${o.assignedDeliveryName})` : ''}</span>
                                    <span>-{fmt(deliveryPayout)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4ade80', marginTop: '2px', fontWeight: '600' }}>
                                    <span>Neto Burger Ya</span><span>{fmt(netRevenue)}</span>
                                  </div>
                                </>
                              )}
                              {/* Notes */}
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {kitchenNote && (
                                  <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px', padding: '2px 7px' }}>
                                    Cocina: {kitchenNote}
                                  </span>
                                )}
                                {internalNote && (
                                  <span style={{ fontSize: '11px', color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 7px' }}>
                                    Interno: {internalNote}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                  {revenueOrders.length === 0 && (
                    <tr><td colSpan={6} style={{ ...TD_STYLE, color: '#666' }}>Sin ventas cobradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cancelados */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Cancelados</div>
              {cancelados.length === 0 ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Sin cancelaciones.</div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '10px' }}>
                    {cancelados.length} cancelado{cancelados.length !== 1 ? 's' : ''} — valor referencia: {fmt(canceladosTotal)}
                  </div>
                  <table style={TABLE_STYLE}>
                    <thead>
                      <tr>
                        <th style={TH_STYLE}>Codigo</th>
                        <th style={TH_STYLE}>Cliente</th>
                        <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelados.map((o, i) => (
                        <tr key={o.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                          <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '12px', color: '#aaa' }}>{getDisplayCode(o)}</td>
                          <td style={TD_STYLE}>{o.customerName ?? '-'}</td>
                          <td style={TD_RIGHT}>{fmt(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* Pedidos internos / no cobrados */}
            <div style={SECTION_STYLE}>
              <div style={{
                ...SECTION_TITLE,
                color: '#ff9666',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Pedidos internos / no cobrados
                {internalOrders.length > 0 && (
                  <span style={{
                    background: 'rgba(255,150,50,0.15)',
                    border: '1px solid rgba(255,150,50,0.3)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '11px',
                    fontWeight: '700',
                  }}>
                    {internalOrders.length}
                  </span>
                )}
              </div>

              {internalOrders.length === 0 ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Sin pedidos internos hoy.</div>
              ) : (
                <>
                  {internalGrouped.map(group => {
                    const isStaff = isStaffPurpose(group.purpose)
                    const isMarketing = isMarketingPurpose(group.purpose)
                    const isIntAcc = isInternalAccountPurpose(group.purpose)
                    return (
                      <div key={group.purpose} style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #333' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#ff9666' }}>
                            {PURPOSE_LABELS[group.purpose] ?? group.purpose}
                          </span>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {group.count} pedido{group.count !== 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>
                            {isStaff && (() => {
                              const totalDeduction = group.orders.reduce((s, o) => s + Number(o.payrollDeductionAmount ?? 0), 0)
                              const totalCovered = group.orders.reduce((s, o) => s + Number(o.staffCoveredAmount ?? 0), 0)
                              return `Consumo: ${fmt(group.internalAmountTotal)} · Saldo: ${fmt(totalCovered)} · Desc.: ${fmt(totalDeduction)}`
                            })()}
                            {isMarketing && `Val. ref.: ${fmt(group.orders.reduce((s, o) => s + Number(o.saleValueAmount ?? 0), 0))}`}
                            {isIntAcc && `Val. ref.: ${fmt(group.orders.reduce((s, o) => s + Number(o.saleValueAmount ?? 0), 0))} · Cobrado: ${fmt(group.orders.reduce((s, o) => s + Number(o.cashCollected ?? 0), 0))}`}
                            {!isStaff && !isMarketing && !isIntAcc && group.purpose !== 'test' && `Consumo: ${fmt(group.internalAmountTotal)}`}
                          </span>
                        </div>
                        <table style={TABLE_STYLE}>
                          <thead>
                            <tr>
                              <th style={TH_STYLE}>Codigo</th>
                              <th style={TH_STYLE}>{isStaff ? 'Empleado' : 'Persona'}</th>
                              {isStaff && <th style={TH_STYLE}>Rol</th>}
                              <th style={TH_STYLE}>Nota</th>
                              {isStaff && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Consumo</th>}
                              {isStaff && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Saldo</th>}
                              {isStaff && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Desc. sueldo</th>}
                              {isMarketing && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Val. ref.</th>}
                              {isMarketing && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Costo prod.</th>}
                              {isMarketing && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Envío</th>}
                              {isMarketing && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Costo total</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Cobro real</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Costo prod.</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Envío</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Costo total</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pendiente</th>}
                              {isIntAcc && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Resultado</th>}
                              {!isStaff && !isMarketing && !isIntAcc && group.purpose !== 'test' && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Consumo</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.orders.map((o, i) => (
                              <tr key={o.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '12px', color: '#ff9666' }}>{getDisplayCode(o)}</td>
                                <td style={{ ...TD_STYLE, color: '#ccc' }}>{o.relatedPerson ?? o.customerName ?? '-'}</td>
                                {isStaff && <td style={{ ...TD_STYLE, color: '#888', fontSize: '12px' }}>{o.relatedPersonRole || 'otro'}</td>}
                                <td style={{ ...TD_STYLE, color: '#888', fontSize: '12px' }}>{o.internalNote || '—'}</td>
                                {isStaff && (
                                  <>
                                    <td style={{ ...TD_RIGHT, color: '#ff9666', fontWeight: '600' }}>{fmt(o.internalAmount ?? 0)}</td>
                                    <td style={{ ...TD_RIGHT, color: 'var(--y)' }}>{fmt(o.staffCoveredAmount ?? 0)}</td>
                                    <td style={{ ...TD_RIGHT, color: Number(o.payrollDeductionAmount ?? 0) > 0 ? '#ef9f9f' : '#888' }}>
                                      {fmt(o.payrollDeductionAmount ?? 0)}
                                      {Number(o.deliveryPayout ?? 0) > 0 && <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>(+{fmt(o.deliveryPayout)} envío)</span>}
                                    </td>
                                  </>
                                )}
                                {isMarketing && (
                                  <>
                                    <td style={{ ...TD_RIGHT, color: '#888' }}>{fmt(o.saleValueAmount ?? 0)}</td>
                                    <td style={{ ...TD_RIGHT, color: '#888' }}>{(o.marketingProductCostAmount ?? 0) > 0 ? fmt(o.marketingProductCostAmount) : '—'}</td>
                                    <td style={{ ...TD_RIGHT, color: '#888' }}>{(o.marketingDeliveryCostAmount ?? 0) > 0 ? fmt(o.marketingDeliveryCostAmount) : '—'}</td>
                                    <td style={{ ...TD_RIGHT, color: '#a78bfa', fontWeight: '600' }}>{(o.marketingTotalCostAmount ?? 0) > 0 ? fmt(o.marketingTotalCostAmount) : '—'}</td>
                                  </>
                                )}
                                {isIntAcc && (() => {
                                  const prodCost = Number(o.internalProductCostAmount ?? o.internalCostAmount ?? 0)
                                  const delivCost = Number(o.internalDeliveryCostAmount ?? 0)
                                  const totalCost = Number(o.internalTotalCostAmount ?? (prodCost + delivCost))
                                  const pending = Number(o.internalPendingAmount ?? 0)
                                  const result = Number(o.internalResultAmount ?? (Number(o.cashCollected ?? 0) - totalCost))
                                  return (
                                    <>
                                      <td style={{ ...TD_RIGHT, color: Number(o.cashCollected ?? 0) > 0 ? '#4ade80' : '#888' }}>{fmt(o.cashCollected ?? 0)}</td>
                                      <td style={{ ...TD_RIGHT, color: '#888' }}>{prodCost > 0 ? fmt(prodCost) : '—'}</td>
                                      <td style={{ ...TD_RIGHT, color: '#888' }}>{delivCost > 0 ? fmt(delivCost) : '—'}</td>
                                      <td style={{ ...TD_RIGHT, color: '#888' }}>{totalCost > 0 ? fmt(totalCost) : '—'}</td>
                                      <td style={{ ...TD_RIGHT, color: pending > 0 ? '#ff9966' : '#4ade80' }}>{totalCost > 0 ? fmt(pending) : '—'}</td>
                                      <td style={{ ...TD_RIGHT, color: result >= 0 ? '#4ade80' : '#ff9966', fontWeight: '600' }}>{totalCost > 0 ? fmt(result) : '—'}</td>
                                    </>
                                  )
                                })()}
                                {!isStaff && !isMarketing && !isIntAcc && group.purpose !== 'test' && (
                                  <td style={{ ...TD_RIGHT, color: '#ff9666', fontWeight: '600' }}>{fmt(o.internalAmount ?? 0)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Descuentos staff del dia */}
            {staffDeductions.length > 0 && (
              <div style={SECTION_STYLE}>
                <div style={{ ...SECTION_TITLE, color: '#ef9f9f' }}>
                  Descuentos staff del dia
                </div>
                <table style={TABLE_STYLE}>
                  <thead>
                    <tr>
                      <th style={TH_STYLE}>Empleado</th>
                      <th style={TH_STYLE}>Tipo</th>
                      <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pedidos</th>
                      <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total descuento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffDeductions.map((row, i) => (
                      <tr key={row.staffName} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                        <td style={TD_STYLE}>{row.staffName}</td>
                        <td style={{ ...TD_STYLE, color: '#888', fontSize: '12px' }}>
                          {row.staffRole === 'delivery' ? 'Diario' : 'Semanal'}
                        </td>
                        <td style={TD_RIGHT}>{row.count}</td>
                        <td style={{ ...TD_RIGHT, color: '#ef9f9f', fontWeight: '600' }}>{fmt(row.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
