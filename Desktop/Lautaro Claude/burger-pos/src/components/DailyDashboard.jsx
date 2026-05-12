import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  calculateDailyMetrics,
  groupSalesByPaymentMethod,
  groupSalesByHour,
  groupProductsSold,
} from '../utils/metrics'

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

export function DailyDashboard({ onBack }) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const q = query(collection(db, 'orders'), where('businessDate', '==', date))
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
  const metrics = calculateDailyMetrics(validOrders)
  const byPayment = groupSalesByPaymentMethod(validOrders)
  const byHour = groupSalesByHour(validOrders)
  const products = groupProductsSold(validOrders)

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
            {/* Metric cards */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '32px' }}>
              <MetricCard label="Ventas totales" value={fmt(metrics.ventasTotales)} />
              <MetricCard label="Pedidos" value={metrics.pedidosTotales} />
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

            {/* Pedidos del dia */}
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Pedidos del dia ({validOrders.length})</div>
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
                  {validOrders.map((o, i) => (
                    <tr key={o.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '12px', color: '#aaa' }}>{o.orderCode ?? '-'}</td>
                      <td style={TD_STYLE}>{o.customerName ?? '-'}</td>
                      <td style={{ ...TD_STYLE, color: '#888' }}>{o.orderType ?? '-'}</td>
                      <td style={{ ...TD_STYLE, color: '#888' }}>{o.paymentMethod ?? '-'}</td>
                      <td style={TD_RIGHT}>{fmt(o.total)}</td>
                      <td style={{ ...TD_STYLE, color: statusColor(o.status), fontWeight: '500' }}>{o.status ?? '-'}</td>
                    </tr>
                  ))}
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
                    {cancelados.length} cancelado{cancelados.length !== 1 ? 's' : ''} — total: {fmt(canceladosTotal)}
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
                          <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: '12px', color: '#aaa' }}>{o.orderCode ?? '-'}</td>
                          <td style={TD_STYLE}>{o.customerName ?? '-'}</td>
                          <td style={TD_RIGHT}>{fmt(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
