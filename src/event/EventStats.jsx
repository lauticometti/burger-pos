import { useState } from 'react'
import { EVENT_BURGERS, EVENT_EXTRAS_BURGER_YA, EVENT_DRINKS_T6, BURGER_ADDONS, SIZE_LABELS } from './eventMenu'

function fmt(n) { return '$' + Number(n ?? 0).toLocaleString('es-AR') }

function StatRow({ label, qty, total, accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 10px', borderRadius: '6px',
      background: accent ? 'rgba(255,198,42,0.05)' : 'transparent',
      marginBottom: '2px',
    }}>
      <span style={{ fontSize: '13px', color: 'rgba(245,245,245,0.8)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: accent ? '#FFC62A' : 'var(--text)' }}>
        {qty !== null ? `${qty}u · ` : ''}{fmt(total)}
      </span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(245,245,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ background: 'var(--panel)', borderRadius: '10px', border: '1px solid var(--line)', padding: '8px' }}>
        {children}
      </div>
    </div>
  )
}

export function EventStats({ orders }) {
  const [shiftFilter, setShiftFilter] = useState('all')

  const base = orders.filter(o => {
    if (shiftFilter === 'midday') return o.eventShift === 'midday'
    if (shiftFilter === 'night') return o.eventShift === 'night'
    return true
  })

  const active = base.filter(o => o.status !== 'cancelled')
  const cancelled = base.filter(o => o.status === 'cancelled')

  const totalCobrado = active.reduce((s, o) => s + Number(o.total ?? 0), 0)
  const efectivo = active.reduce((s, o) => {
    if (o.paymentMethod === 'efectivo') return s + Number(o.total ?? 0)
    if (o.paymentMethod === 'split') return s + Number(o.paymentSplit?.efectivo ?? 0)
    return s
  }, 0)
  const transferencia = active.reduce((s, o) => {
    if (o.paymentMethod === 'transferencia') return s + Number(o.total ?? 0)
    if (o.paymentMethod === 'split') return s + Number(o.paymentSplit?.transferencia ?? 0)
    return s
  }, 0)
  const totalBurgerYa = active.reduce((s, o) => s + Number(o.burgerYaSubtotal ?? 0), 0)
  const totalDrinksT6 = active.reduce((s, o) => s + Number(o.drinksT6Subtotal ?? 0), 0)

  const totalPedidos = active.length
  const ticketPromedio = totalPedidos > 0 ? Math.round(totalCobrado / totalPedidos) : 0
  const soloBy = active.filter(o => (o.burgerYaSubtotal > 0) && !(o.drinksT6Subtotal > 0)).length
  const soloDt6 = active.filter(o => !(o.burgerYaSubtotal > 0) && (o.drinksT6Subtotal > 0)).length
  const mixtos = active.filter(o => (o.burgerYaSubtotal > 0) && (o.drinksT6Subtotal > 0)).length

  // Aggregate items
  const allItems = active.flatMap(o => o.items ?? [])
  const byId = id => allItems.filter(i => i.id === id)
  const sumTotal = items => items.reduce((s, i) => s + Number(i.totalPrice ?? 0), 0)

  // Burgers by product and size
  function burgerStats(burgerId) {
    const items = allItems.filter(i => i.id === burgerId && i.category === 'burger')
    const totalUnits = items.length
    const totalRev = items.reduce((s, i) => s + Number(i.totalPrice ?? 0), 0)
    const bySize = {}
    for (const item of items) {
      bySize[item.size] = (bySize[item.size] ?? 0) + 1
    }
    return { totalUnits, totalRev, bySize }
  }

  // Extras (addons on burgers)
  function addonStats(addonId) {
    const items = allItems.filter(i => i.category === 'burger')
    let qty = 0
    let total = 0
    for (const item of items) {
      const extras = item.customizations?.extras ?? []
      const e = extras.find(ex => ex.id === addonId)
      if (e) { qty++; total += e.price ?? 0 }
    }
    return { qty, total }
  }

  // Carnes estimadas
  const carnesBase = allItems
    .filter(i => i.category === 'burger')
    .reduce((s, i) => {
      const sizeMap = { S: 1, D: 2, T: 3 }
      return s + (sizeMap[i.size] ?? 0)
    }, 0)
  const carnesExtra = allItems
    .filter(i => i.category === 'burger')
    .reduce((s, i) => {
      const extras = i.customizations?.extras ?? []
      return s + extras.filter(e => e.id === 'extra_carne').length
    }, 0)
  const totalCarnes = carnesBase + carnesExtra

  const totalDrinks = allItems.filter(i => i.area === 'drinks_t6').length

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
        Estadísticas — Burger Day
      </div>

      {/* Shift filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['all', 'Todo'], ['midday', 'Mediodía'], ['night', 'Noche']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setShiftFilter(val)}
            style={{
              padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: shiftFilter === val ? 'rgba(255,198,42,0.15)' : 'rgba(255,255,255,0.05)',
              borderColor: shiftFilter === val ? 'rgba(255,198,42,0.5)' : 'rgba(255,255,255,0.12)',
              color: shiftFilter === val ? '#FFC62A' : 'rgba(245,245,245,0.6)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Section title="Resumen de caja">
        <StatRow label="Total cobrado" qty={null} total={totalCobrado} accent />
        <StatRow label="Efectivo" qty={null} total={efectivo} />
        <StatRow label="Transferencia" qty={null} total={transferencia} />
      </Section>

      <Section title="Liquidación">
        <StatRow label="Burger Ya" qty={null} total={totalBurgerYa} />
        <StatRow label="DrinksT6" qty={null} total={totalDrinksT6} />
        <div style={{ borderTop: '1px solid var(--line)', margin: '6px 0', paddingTop: '6px' }}>
          <StatRow label="A pagar a DrinksT6" qty={null} total={totalDrinksT6} accent />
          <StatRow label="Queda para Burger Ya" qty={null} total={totalBurgerYa} />
        </div>
      </Section>

      <Section title="Pedidos">
        <StatRow label="Total pedidos" qty={null} total={totalPedidos * 0} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px 10px' }}>
          {[
            ['Total', totalPedidos],
            ['Ticket prom.', null],
            ['Solo BY', soloBy],
            ['Solo DT6', soloDt6],
            ['Mixtos', mixtos],
            ['Cancelados', cancelled.length],
          ].map(([label, val]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
              padding: '8px 12px', minWidth: '80px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                {label === 'Ticket prom.' ? fmt(ticketPromedio) : val}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(245,245,245,0.4)', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Productos Burger Ya">
        {EVENT_BURGERS.map(b => {
          const stats = burgerStats(b.id)
          return (
            <div key={b.id} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(245,245,245,0.8)' }}>{b.name}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{stats.totalUnits}u · {fmt(stats.totalRev)}</span>
              </div>
              {stats.totalUnits > 0 && (
                <div style={{ display: 'flex', gap: '8px', padding: '0 10px 4px', flexWrap: 'wrap' }}>
                  {Object.entries(stats.bySize).map(([sz, qty]) => (
                    <span key={sz} style={{ fontSize: '11px', color: 'rgba(245,245,245,0.4)' }}>
                      {SIZE_LABELS[sz]}: {qty}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' }}>
          {EVENT_EXTRAS_BURGER_YA.map(item => {
            const items = byId(item.id)
            return <StatRow key={item.id} label={item.name} qty={items.length} total={sumTotal(items)} />
          })}
        </div>
      </Section>

      <Section title="Extras en burgers">
        {BURGER_ADDONS.map(a => {
          const stats = addonStats(a.id)
          if (stats.qty === 0) return null
          return <StatRow key={a.id} label={a.name} qty={stats.qty} total={stats.total} />
        })}
        {BURGER_ADDONS.every(a => addonStats(a.id).qty === 0) && (
          <div style={{ fontSize: '13px', color: 'rgba(245,245,245,0.3)', padding: '8px 10px' }}>Sin extras.</div>
        )}
      </Section>

      <Section title="Tragos — DrinksT6">
        {EVENT_DRINKS_T6.map(item => {
          const items = byId(item.id)
          return <StatRow key={item.id} label={item.name} qty={items.length} total={sumTotal(items)} />
        })}
      </Section>

      <Section title="Métricas">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px 10px' }}>
          {[
            ['Burgers totales', allItems.filter(i => i.category === 'burger').length],
            ['Carnes estimadas', carnesBase],
            ['Carnes extra', carnesExtra],
            ['Total carnes', totalCarnes],
            ['Tragos DT6', totalDrinks],
          ].map(([label, val]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
              padding: '8px 12px', minWidth: '90px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFC62A' }}>{val}</div>
              <div style={{ fontSize: '10px', color: 'rgba(245,245,245,0.4)', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
