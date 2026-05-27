import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStaffMembers } from '../hooks/useStaffMembers'
import { addStaffLedgerEntry, getWeekId } from '../utils/staffLedger'
import { STAFF_SHIFT_CREDIT } from '../data/staffMenu'
import { todayStr } from '../utils/printing'
import { PayrollDashboard } from './PayrollDashboard'
import { formatStaffOrderDisplayLines } from '../utils/staffOrderBuilder'

// ─── Constantes ───────────────────────────────────────────────────────────────

const STAFF_ROLES = [
  { value: 'dueño',    label: 'Dueño' },
  { value: 'caja',     label: 'Caja' },
  { value: 'cocina',   label: 'Cocina' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'otro',     label: 'Otro' },
]

const ROLE_ORDER = ['dueño', 'caja', 'cocina', 'delivery', 'limpieza', 'otro']

const MOVEMENT_LABELS = {
  credit_shift_meal:     'Crédito turno',
  debit_staff_meal:      'Consumo staff',
  debit_internal_account:'Cuenta interna',
  payroll_deduction:     'Descuento sueldo',
  adjustment:            'Ajuste',
}

// Lun → Dom
const STAFF_WEEK_DAYS = [
  { key: 'mon', label: 'Lun', offset: 0 },
  { key: 'tue', label: 'Mar', offset: 1 },
  { key: 'wed', label: 'Mié', offset: 2 },
  { key: 'thu', label: 'Jue', offset: 3 },
  { key: 'fri', label: 'Vie', offset: 4 },
  { key: 'sat', label: 'Sáb', offset: 5 },
  { key: 'sun', label: 'Dom', offset: 6 },
]

// ─── Helpers de semana ────────────────────────────────────────────────────────

// Semana Staff: lunes a domingo
function getStaffWeek(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.getDay() // 0=Dom,1=Lun,...6=Sáb
  const offsetToMon = ((dow - 1) + 7) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - offsetToMon)

  const days = STAFF_WEEK_DAYS.map(({ key, label, offset }) => {
    const dt = new Date(mon)
    dt.setDate(mon.getDate() + offset)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return { key, label, date: `${y}-${m}-${dd}` }
  })

  const startDate = days[0].date
  const endDate   = days[6].date
  const weekId    = getWeekId(startDate)

  return { weekId, startDate, endDate, days }
}

function offsetWeekDate(dateString, weekOffset) {
  const [year, month, day] = dateString.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + weekOffset * 7)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function formatLongDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const labelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '8px',
}

const editInputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', color: 'var(--text)',
  padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit',
}

const SALARY_TYPE_LABELS = {
  fixed:    'Fijo semanal',
  shift:    'Por turno',
  delivery: 'Delivery',
  custom:   'Personalizado',
}

// ─── CollapsibleBlock ─────────────────────────────────────────────────────────

function CollapsibleBlock({ title, open, onToggle, children }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', marginBottom: '16px', overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  )
}

// ─── Render de items de pedido ────────────────────────────────────────────────

function OrderItemsList({ entry }) {
  // Prioridad: orderSnapshot > staffMenuItems > internalAllocations > note
  const snapshot = entry.orderSnapshot
  if (snapshot?.items?.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
        {snapshot.items.map((item, i) => {
          const sizePart = item.size && item.size !== 'undefined' ? ` ${item.size}` : ''
          const name = `${item.quantity ?? 1}x ${item.name ?? ''}${sizePart}`
          return (
            <div key={i} style={{ paddingLeft: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>{name}</div>
              {item.addons?.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '10px' }}>
                  + {item.addons.join(', ')}
                </div>
              )}
              {item.removedIngredients?.length > 0 && (
                <div style={{ fontSize: '11px', color: 'rgba(255,107,107,0.6)', paddingLeft: '10px' }}>
                  sin {item.removedIngredients.join(', ')}
                </div>
              )}
              {item.kitchenNote && (
                <div style={{ fontSize: '11px', color: '#f59e0b', paddingLeft: '10px' }}>
                  Cocina: {item.kitchenNote}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }
  if (entry.staffOrder?.burgers?.length > 0) {
    const lines = formatStaffOrderDisplayLines(entry.staffOrder)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            fontSize: '12px',
            color: line.startsWith('+') || line.startsWith('Nota:') ? 'rgba(255,255,255,0.45)' : 'var(--text)',
            paddingLeft: line.startsWith('+') || line.startsWith('Nota:') ? '16px' : '8px',
          }}>
            {line}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '3px', paddingLeft: '8px' }}>
      Sin detalle de pedido asociado
    </div>
  )
}

// ─── EmployeeDetail ───────────────────────────────────────────────────────────

function EmployeeDetail({ member, weekLedger, staffWeek, today, user, onClose, onVoid }) {
  const [openMovimientos, setOpenMovimientos] = useState(false)
  const [openConsumoIds, setOpenConsumoIds] = useState(new Set())
  const [calMessage, setCalMessage] = useState({})

  const memberId   = member.id
  const memberName = member.name

  const myEntries = weekLedger.filter(e =>
    e.staffName === memberName || e.staffMemberId === memberId || e.employeeId === memberId
  )

  // creditos = créditos de comida disponibles
  // cubiertos = parte de consumos pagada con crédito (debit_staff_meal + debit_internal_account)
  // descuentos = parte a descontar de sueldo (payroll_deduction)
  // consumosTotal = cubiertos + descuentos = consumo real total del empleado
  let creditos = 0, cubiertos = 0, descuentos = 0
  for (const e of myEntries) {
    if (e.voided === true) continue
    const amt = Number(e.amount ?? 0)
    if (e.movementType === 'credit_shift_meal') creditos += amt
    else if (e.movementType === 'debit_staff_meal' || e.movementType === 'debit_internal_account') cubiertos += amt
    else if (e.movementType === 'payroll_deduction') descuentos += amt
  }
  const consumosTotal = cubiertos + descuentos
  const saldo         = Math.max(0, creditos - cubiertos)
  const aDescontar    = descuentos
  // Debug temporal — quitar después de confirmar
  console.log('[EmployeeDetail]', memberName, { creditos, cubiertos, descuentos, consumosTotal, saldo, aDescontar, myEntries: myEntries.map(e => ({ type: e.movementType, amount: e.amount, voided: e.voided })) })

  // Índice de créditos por date+shift
  const creditIndex = {}
  for (const e of myEntries) {
    if (e.movementType !== 'credit_shift_meal') continue
    const date  = e.businessDate || e.ledgerDate || e.date
    const shift = e.shift || ''
    const key   = `${date}-${shift}`
    if (!creditIndex[key]) creditIndex[key] = []
    creditIndex[key].push(e)
  }

  const consumoEntries = myEntries
    .filter(e => !e.voided && (e.movementType === 'debit_staff_meal' || e.movementType === 'debit_internal_account'))
    .sort((a, b) => (a.businessDate || a.date || '').localeCompare(b.businessDate || b.date || ''))

  // Índice de payroll_deduction por orderId o orderCode para enriquecer consumos
  const payrollByOrder = {}
  for (const e of myEntries) {
    if (e.voided || e.movementType !== 'payroll_deduction') continue
    const key = e.orderId || e.orderCode || ''
    if (!key) continue
    payrollByOrder[key] = (payrollByOrder[key] ?? 0) + Number(e.amount ?? 0)
  }

  const allMovements = [...myEntries].sort((a, b) => {
    const ta = a.createdAt?.toDate?.() ?? new Date(0)
    const tb = b.createdAt?.toDate?.() ?? new Date(0)
    return tb - ta
  })

  function calCellState(date, shift) {
    const key = `${date}-${shift}`
    const msg = calMessage[key]
    if (msg) return msg
    const entries = creditIndex[key] ?? []
    const active  = entries.filter(e => !e.voided)
    const voided  = entries.filter(e => e.voided)
    if (active.length > 0) return 'loaded'
    if (voided.length > 0) return 'voided'
    return 'empty'
  }

  function calCellStyle(state) {
    const base = {
      padding: '3px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
      cursor: state === 'loaded' || state === 'saving' ? 'default' : 'pointer',
      border: '1px solid transparent', minWidth: '30px', textAlign: 'center',
      background: 'transparent',
    }
    if (state === 'loaded') return { ...base, background: 'rgba(255,198,42,0.18)', border: '1px solid rgba(255,198,42,0.5)', color: 'var(--y)' }
    if (state === 'ok')     return { ...base, background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }
    if (state === 'exists') return { ...base, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
    if (state === 'voided') return { ...base, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }
    if (state === 'saving') return { ...base, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line)', color: 'var(--muted)' }
    return { ...base, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', color: 'rgba(255,255,255,0.2)' }
  }

  function calCellLabel(state) {
    if (state === 'loaded') return '✓'
    if (state === 'ok')     return '✓'
    if (state === 'exists') return '!'
    if (state === 'voided') return 'X'
    if (state === 'saving') return '...'
    return '+'
  }

  async function handleCalendarCredit(date, shift) {
    const key     = `${date}-${shift}`
    const existing = (creditIndex[key] ?? []).filter(e => !e.voided)
    if (existing.length > 0) {
      setCalMessage(p => ({ ...p, [key]: 'exists' }))
      setTimeout(() => setCalMessage(p => { const n = { ...p }; delete n[key]; return n }), 2500)
      return
    }
    setCalMessage(p => ({ ...p, [key]: 'saving' }))
    try {
      const q    = query(collection(db, 'staffLedger'), where('businessDate', '==', date))
      const snap = await getDocs(q)
      const dup  = snap.docs.some(d => {
        const e = d.data()
        return (e.staffName === memberName || e.staffMemberId === memberId)
          && e.movementType === 'credit_shift_meal'
          && e.shift === shift
          && !e.voided
      })
      if (dup) {
        setCalMessage(p => ({ ...p, [key]: 'exists' }))
        setTimeout(() => setCalMessage(p => { const n = { ...p }; delete n[key]; return n }), 2500)
        return
      }
      const configuredCredit = Number(member.defaultShiftCreditAmount ?? 0)
      const creditAmount = configuredCredit > 0 ? configuredCredit : STAFF_SHIFT_CREDIT
      await addStaffLedgerEntry({
        businessDate: date,
        staffName: memberName,
        movementType: 'credit_shift_meal',
        amount: creditAmount,
        shift,
        orderCode: '',
        orderId: '',
        note: `Crédito turno ${shift === 'mediodia' ? 'mediodía' : 'noche'}${date !== today ? ` (${date})` : ''}`,
        defaultAmountUsed: configuredCredit <= 0,
        configuredCreditAmount: configuredCredit,
      }, user)
      setCalMessage(p => ({ ...p, [key]: 'ok' }))
      setTimeout(() => setCalMessage(p => { const n = { ...p }; delete n[key]; return n }), 2500)
    } catch (err) {
      console.error('Error cargando crédito calendario:', err)
      setCalMessage(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  const isActive = member.active !== false

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', width: '100%', maxWidth: '560px',
        marginTop: '8px', marginBottom: '32px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '20px 20px 16px', borderBottom: '1px solid var(--line)',
        }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>{memberName}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px', color: 'var(--muted)', background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--line)', borderRadius: '4px', padding: '1px 7px',
              }}>{member.role || 'otro'}</span>
              <span style={{
                fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em',
                color: isActive ? '#4ade80' : '#ff6b6b',
                background: isActive ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
                border: `1px solid ${isActive ? 'rgba(74,222,128,0.3)' : 'rgba(255,107,107,0.3)'}`,
                borderRadius: '4px', padding: '1px 6px',
              }}>{isActive ? 'Activo' : 'Inactivo'}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {formatShortDate(staffWeek.startDate)} – {formatShortDate(staffWeek.endDate)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--line)',
              color: 'var(--muted)', borderRadius: '6px', padding: '6px 12px',
              cursor: 'pointer', fontSize: '13px',
            }}
          >Cerrar</button>
        </div>

        {/* Resumen semana */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Semana {staffWeek.weekId}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { label: 'Saldo comida', value: `$${saldo.toLocaleString('es-AR')}`, color: saldo < 0 ? '#ff6b6b' : saldo > 0 ? 'var(--y)' : 'var(--muted)' },
              { label: 'Créditos',    value: creditos > 0 ? `$${creditos.toLocaleString('es-AR')}` : '—', color: 'var(--y)' },
              { label: 'Consumos',    value: consumosTotal > 0 ? `$${consumosTotal.toLocaleString('es-AR')}` : '—', color: 'var(--muted)' },
              { label: 'A descontar', value: aDescontar > 0 ? `$${aDescontar.toLocaleString('es-AR')}` : '—', color: aDescontar > 0 ? '#ff6b6b' : 'var(--muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)',
                borderRadius: '8px', padding: '10px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendario créditos Lun–Dom */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Créditos de comida
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {staffWeek.days.map(({ label, date }) => {
              const stateM = calCellState(date, 'mediodia')
              const stateN = calCellState(date, 'noche')
              const msgM   = calMessage[`${date}-mediodia`]
              const msgN   = calMessage[`${date}-noche`]
              return (
                <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '26px', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', width: '38px', flexShrink: 0 }}>{formatShortDate(date)}</div>
                  <button
                    type="button"
                    title={`Mediodía ${date}`}
                    onClick={() => { if (stateM !== 'loaded' && stateM !== 'saving') handleCalendarCredit(date, 'mediodia') }}
                    style={calCellStyle(stateM)}
                  >M {calCellLabel(stateM)}</button>
                  <button
                    type="button"
                    title={`Noche ${date}`}
                    onClick={() => { if (stateN !== 'loaded' && stateN !== 'saving') handleCalendarCredit(date, 'noche') }}
                    style={calCellStyle(stateN)}
                  >N {calCellLabel(stateN)}</button>
                  {(msgM === 'ok' || msgN === 'ok') && (
                    <span style={{ fontSize: '10px', color: '#4ade80' }}>Crédito cargado</span>
                  )}
                  {(msgM === 'exists' || msgN === 'exists') && (
                    <span style={{ fontSize: '10px', color: '#f59e0b' }}>Ya cargado</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { state: 'loaded', label: 'Cargado' },
              { state: 'empty',  label: 'Sin cargar' },
              { state: 'voided', label: 'Anulado' },
            ].map(({ state, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ ...calCellStyle(state), padding: '1px 5px', cursor: 'default', fontSize: '10px', minWidth: 'auto' }}>•</div>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consumos de comida */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Consumos de comida
          </div>
          {consumoEntries.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Sin consumos esta semana.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {consumoEntries.map(e => {
                const cubierto  = Number(e.amount ?? 0)
                const dateStr   = e.businessDate || e.ledgerDate || e.date || ''
                const isInternal = e.movementType === 'debit_internal_account'
                const typeLabel  = isInternal ? 'Cuenta interna' : 'Staff'
                const isOpen     = openConsumoIds.has(e.id)
                // Para Cuenta interna, buscar el payroll_deduction del mismo pedido
                const orderKey   = e.orderId || e.orderCode || ''
                const deduccion  = isInternal ? (payrollByOrder[orderKey] ?? 0) : 0
                const totalConsumo = cubierto + deduccion
                return (
                  <div key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Fila cerrada */}
                    <button
                      type="button"
                      onClick={() => setOpenConsumoIds(prev => {
                        const n = new Set(prev)
                        if (n.has(e.id)) n.delete(e.id); else n.add(e.id)
                        return n
                      })}
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        cursor: 'pointer', padding: '9px 0', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {formatShortDate(dateStr)}
                          {e.shift ? ` · ${e.shift === 'mediodia' ? 'M' : 'N'}` : ''}
                          {e.orderCode ? ` · ${e.orderCode}` : ''}
                          {' · '}
                          <span style={{ color: isInternal ? '#a78bfa' : 'var(--y)' }}>{typeLabel}</span>
                        </div>
                        {e.note && (
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>{e.note}</div>
                        )}
                        {isInternal && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', display: 'flex', gap: '10px' }}>
                            {cubierto > 0 && <span>Créditos: <span style={{ color: 'var(--y)' }}>${cubierto.toLocaleString('es-AR')}</span></span>}
                            {deduccion > 0 && <span>Sueldo: <span style={{ color: '#ff6b6b' }}>${deduccion.toLocaleString('es-AR')}</span></span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff9966' }}>
                          −${totalConsumo.toLocaleString('es-AR')}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {/* Detalle expandido */}
                    {isOpen && (
                      <div style={{ paddingBottom: '10px', paddingLeft: '0' }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700', marginBottom: '4px' }}>
                          Pedido
                        </div>
                        <OrderItemsList entry={e} />
                        {isInternal && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div>Total consumo: <span style={{ color: 'var(--text)', fontWeight: '600' }}>${totalConsumo.toLocaleString('es-AR')}</span></div>
                            <div>Cubierto con créditos: <span style={{ color: cubierto > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: '600' }}>${cubierto.toLocaleString('es-AR')}</span></div>
                            <div>A descontar: <span style={{ color: deduccion > 0 ? '#ff6b6b' : 'var(--muted)', fontWeight: '600' }}>${deduccion.toLocaleString('es-AR')}</span></div>
                          </div>
                        )}
                        {!isInternal && (e.orderSnapshot?.total ?? 0) > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                            Total pedido: ${Number(e.orderSnapshot.total).toLocaleString('es-AR')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Movimientos colapsable */}
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => setOpenMovimientos(v => !v)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 0', background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text)', borderBottom: openMovimientos ? '1px solid var(--line)' : 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Movimientos ({allMovements.length})
            </span>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{openMovimientos ? '▲' : '▼'}</span>
          </button>
          {openMovimientos && (
            <div style={{ paddingBottom: '12px' }}>
              {allMovements.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 0' }}>Sin movimientos.</div>
              ) : (
                allMovements.map(e => (
                  <div key={e.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    gap: '12px', opacity: e.voided ? 0.45 : 1,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: '600' }}>
                        {MOVEMENT_LABELS[e.movementType] ?? e.movementType}
                        {e.shift ? ` · ${e.shift === 'mediodia' ? 'mediodía' : 'noche'}` : ''}
                        {e.voided && <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#ff6b6b' }}>ANULADO</span>}
                      </div>
                      {e.note && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{e.note}</div>}
                      {e.voided && e.voidReason && (
                        <div style={{ fontSize: '11px', color: 'rgba(255,107,107,0.6)', marginTop: '1px' }}>Motivo: {e.voidReason}</div>
                      )}
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                        {e.businessDate || e.date || ''}{e.orderCode ? ` · ${e.orderCode}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{
                        fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap',
                        color: e.movementType === 'credit_shift_meal' ? 'var(--y)' : '#ff9966',
                      }}>
                        {e.movementType === 'credit_shift_meal' ? '+' : '−'}${Number(e.amount ?? 0).toLocaleString('es-AR')}
                      </div>
                      {!e.voided && (
                        <button
                          onClick={() => onVoid(e)}
                          style={{
                            fontSize: '10px', color: '#ff6b6b', background: 'transparent',
                            border: '1px solid rgba(255,107,107,0.3)', borderRadius: '4px',
                            padding: '2px 7px', cursor: 'pointer',
                          }}
                        >Anular</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Datos laborales */}
        <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Datos laborales
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[
              {
                label: 'Sueldo semanal',
                value: member.weeklySalary > 0
                  ? '$' + Number(member.weeklySalary).toLocaleString('es-AR')
                  : 'Sin configurar',
                color: member.weeklySalary > 0 ? 'var(--text)' : 'rgba(255,255,255,0.3)',
              },
              {
                label: 'Tipo de sueldo',
                value: SALARY_TYPE_LABELS[member.salaryType] ?? 'Personalizado',
                color: 'var(--muted)',
              },
              {
                label: 'Credito por turno',
                value: member.defaultShiftCreditAmount > 0
                  ? '$' + Number(member.defaultShiftCreditAmount).toLocaleString('es-AR')
                  : '$0',
                color: 'var(--muted)',
              },
              {
                label: 'Dia de pago',
                value: 'Lunes',
                color: 'var(--muted)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', padding: '9px 10px',
              }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                  {label}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── RoleGroup ────────────────────────────────────────────────────────────────

function RoleGroup({ roleLabel, members, openEdit, onToggleActive, togglingId, onViewDetail, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  if (members.length === 0) return null
  const activeCount = members.filter(m => m.active !== false).length
  return (
    <div style={{ marginBottom: '10px' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--line)', borderRadius: '8px',
          cursor: 'pointer', color: 'var(--text)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {roleLabel}
          <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '400', color: 'rgba(255,255,255,0.25)' }}>
            {activeCount} / {members.length}
          </span>
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {members.map(m => {
            const isActive   = m.active !== false
            const isToggling = togglingId === m.id
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px', border: '1px solid var(--line)',
                  gap: '10px', opacity: isActive ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '600' }}>{m.name}</span>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em',
                      color: isActive ? '#4ade80' : '#ff6b6b',
                      background: isActive ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
                      border: `1px solid ${isActive ? 'rgba(74,222,128,0.3)' : 'rgba(255,107,107,0.3)'}`,
                      borderRadius: '4px', padding: '1px 6px',
                    }}>{isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {m.salaryType === 'shift' ? (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        Por turno: {Number(m.shiftRate ?? 0) > 0
                          ? '$' + Number(m.shiftRate).toLocaleString('es-AR')
                          : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Sin configurar</span>
                        }
                      </span>
                    ) : m.salaryType === 'delivery' ? (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        Base delivery: {Number(m.deliveryBaseAmount ?? 0) > 0
                          ? '$' + Number(m.deliveryBaseAmount).toLocaleString('es-AR') + ' / ' + Number(m.deliveryBaseHours ?? 4) + ' hs'
                          : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Sin configurar</span>
                        }
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        Sueldo: {Number(m.weeklySalary ?? 0) > 0
                          ? '$' + Number(m.weeklySalary).toLocaleString('es-AR')
                          : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Sin configurar</span>
                        }
                      </span>
                    )}
                    {m.salaryType && m.salaryType !== 'custom' && (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                        {SALARY_TYPE_LABELS[m.salaryType] ?? m.salaryType}
                      </span>
                    )}
                    {m.defaultShiftCreditAmount > 0 && (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                        Credito turno: ${Number(m.defaultShiftCreditAmount).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                  <button onClick={() => onViewDetail(m)} style={{ padding: '5px 10px', background: 'rgba(255,198,42,0.1)', border: '1px solid rgba(255,198,42,0.3)', color: 'var(--y)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Ver detalle</button>
                  <button onClick={() => openEdit(m)} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                  <button
                    onClick={() => onToggleActive(m)}
                    disabled={isToggling}
                    style={{
                      padding: '5px 10px',
                      background: isActive ? 'rgba(255,107,107,0.1)' : 'rgba(74,222,128,0.1)',
                      border: `1px solid ${isActive ? 'rgba(255,107,107,0.3)' : 'rgba(74,222,128,0.3)'}`,
                      color: isActive ? '#ff6b6b' : '#4ade80',
                      borderRadius: '6px', cursor: isToggling ? 'not-allowed' : 'pointer',
                      fontSize: '11px', fontWeight: '600', opacity: isToggling ? 0.5 : 1,
                    }}
                  >{isToggling ? '...' : isActive ? 'Desactivar' : 'Activar'}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── StaffDashboard ───────────────────────────────────────────────────────────

export function StaffDashboard({ onBack, user, orders = [] }) {
  const { staffMembers: allStaffMembers, loadingStaff, createStaffMember, updateStaffMember } = useStaffMembers({ includeInactive: true })
  const staffMembers = allStaffMembers.filter(m => m.active !== false)

  const today = todayStr()

  // Semana global navegable
  const [weekAnchor, setWeekAnchor] = useState(today) // fecha dentro de la semana seleccionada
  const staffWeek = getStaffWeek(weekAnchor)

  function goWeek(delta) {
    setWeekAnchor(prev => offsetWeekDate(prev, delta))
  }

  const isCurrentWeek = staffWeek.weekId === getStaffWeek(today).weekId

  // Ledger de la semana seleccionada
  const [weekLedger, setWeekLedger]     = useState([])
  const [loadingLedger, setLoadingLedger] = useState(true)

  useEffect(() => {
    setLoadingLedger(true)
    const q = query(collection(db, 'staffLedger'), where('weekId', '==', staffWeek.weekId))
    const unsub = onSnapshot(q, (snap) => {
      setWeekLedger(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingLedger(false)
    }, (err) => {
      console.error('StaffDashboard ledger error:', err)
      setLoadingLedger(false)
    })
    return () => unsub()
  }, [staffWeek.weekId])

  const [activeTab, setActiveTab]       = useState('resumen')
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState('cocina')
  const [error, setError]               = useState('')
  const [voidingEntry, setVoidingEntry] = useState(null)
  const [voidReason, setVoidReason]     = useState('')
  const [voidSaving, setVoidSaving]     = useState(false)

  // Crédito turno — selección múltiple
  const [creditSelectedNames, setCreditSelectedNames] = useState(new Set())
  const [creditAllSelected, setCreditAllSelected]     = useState(false)
  const [creditSelectedShift, setCreditSelectedShift] = useState('noche')
  const [creditSelectedDate, setCreditSelectedDate]   = useState(today)
  const [creditSaving, setCreditSaving]               = useState(false)
  const [creditResult, setCreditResult]               = useState(null)

  // Delivery — dentro de semana Staff usa startDate/endDate de staffWeek
  const [deliveryFilter, setDeliveryFilter]       = useState('today')
  const [deliveryCustomDate, setDeliveryCustomDate] = useState(today)

  // Colapsables resumen
  const [openCredito,     setOpenCredito]     = useState(true)
  const [openSemanal,     setOpenSemanal]     = useState(true)
  const [openDelivery,    setOpenDelivery]    = useState(true)
  const [openMovimientos, setOpenMovimientos] = useState(false)

  // Empleados
  const [editingMember, setEditingMember]       = useState(null)
  const [editName, setEditName]                 = useState('')
  const [editRole, setEditRole]                 = useState('otro')
  const [editActive, setEditActive]             = useState(true)
  const [editWeeklySalary, setEditWeeklySalary]         = useState('')
  const [editSalaryType, setEditSalaryType]             = useState('custom')
  const [editShiftRate, setEditShiftRate]               = useState('')
  const [editDeliveryBaseAmount, setEditDeliveryBaseAmount] = useState('')
  const [editDeliveryBaseHours, setEditDeliveryBaseHours]   = useState('4')
  const [editShiftCredit, setEditShiftCredit]           = useState('')
  const [editSaving, setEditSaving]             = useState(false)
  const [togglingId, setTogglingId]             = useState(null)
  const [detailMember, setDetailMember]         = useState(null)

  // ── Cálculos de resumen ────────────────────────────────────────────────────

  const staffRoleMap = {}
  for (const m of staffMembers) staffRoleMap[m.name] = m.role || 'otro'

  const weeklySummaryMap  = {}
  const deliverySummaryMap = {}

  function getDeliveryTargetDate() {
    if (deliveryFilter === 'today')     return today
    if (deliveryFilter === 'yesterday') {
      const d = new Date(); d.setDate(d.getDate() - 1)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    if (deliveryFilter === 'date') return deliveryCustomDate
    return null // 'week'
  }
  const deliveryTargetDate = getDeliveryTargetDate()

  for (const entry of weekLedger) {
    if (entry.voided === true) continue
    const name = entry.staffName
    const role = staffRoleMap[name] ?? 'otro'
    const amt  = Number(entry.amount ?? 0)

    if (role === 'delivery') {
      if (deliveryFilter !== 'week' && entry.businessDate !== deliveryTargetDate) continue
      if (!deliverySummaryMap[name]) deliverySummaryMap[name] = { creditos: 0, consumos: 0, descuentos: 0 }
      if (entry.movementType === 'credit_shift_meal')   deliverySummaryMap[name].creditos  += amt
      else if (entry.movementType === 'debit_staff_meal')     deliverySummaryMap[name].consumos  += amt
      else if (entry.movementType === 'payroll_deduction')    deliverySummaryMap[name].descuentos += amt
    } else {
      if (!weeklySummaryMap[name]) weeklySummaryMap[name] = { creditos: 0, cubiertos: 0, consumos: 0, descuentos: 0 }
      if (entry.movementType === 'credit_shift_meal')   weeklySummaryMap[name].creditos  += amt
      else if (entry.movementType === 'debit_staff_meal' || entry.movementType === 'debit_internal_account') { weeklySummaryMap[name].cubiertos += amt; weeklySummaryMap[name].consumos += amt }
      else if (entry.movementType === 'payroll_deduction') { weeklySummaryMap[name].descuentos += amt; weeklySummaryMap[name].consumos += amt }
    }
  }

  const weeklyNames = [...new Set([
    ...staffMembers.filter(m => (m.role || 'otro') !== 'delivery').map(m => m.name),
    ...Object.keys(weeklySummaryMap),
  ])].sort((a, b) => a.localeCompare(b))

  const deliveryNames = [...new Set([
    ...staffMembers.filter(m => m.role === 'delivery').map(m => m.name),
    ...Object.keys(deliverySummaryMap),
  ])].sort((a, b) => a.localeCompare(b))

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreateStaff() {
    if (!newStaffName.trim()) return
    try {
      await createStaffMember(newStaffName, newStaffRole, user)
      setNewStaffName('')
      setNewStaffRole('cocina')
      setShowCreateStaff(false)
    } catch (err) {
      console.error('Error creando empleado:', err)
      setError('No se pudo crear el empleado.')
    }
  }

  function resolveShiftCreditAmount(member) {
    const configured = Number(member?.defaultShiftCreditAmount ?? 0)
    return configured > 0 ? configured : STAFF_SHIFT_CREDIT
  }

  async function checkAndLoadCredit(staffName, shift, date, amount, configuredCreditAmount) {
    const q    = query(collection(db, 'staffLedger'), where('businessDate', '==', date))
    const snap = await getDocs(q)
    const dup  = snap.docs.some(d => {
      const e = d.data()
      return e.staffName === staffName
        && e.movementType === 'credit_shift_meal'
        && e.shift === shift
        && !e.voided
    })
    if (dup) return 'skipped'
    await addStaffLedgerEntry({
      businessDate: date,
      staffName,
      movementType: 'credit_shift_meal',
      amount,
      shift,
      orderCode: '',
      orderId: '',
      note: `Crédito turno ${shift === 'mediodia' ? 'mediodía' : 'noche'}${date !== today ? ` (${date})` : ''}`,
      defaultAmountUsed: configuredCreditAmount <= 0,
      configuredCreditAmount: configuredCreditAmount || 0,
    }, user)
    return 'success'
  }

  async function handleBulkCreditShift() {
    const selectedMembers = creditAllSelected
      ? staffMembers
      : staffMembers.filter(m => creditSelectedNames.has(m.name))
    if (selectedMembers.length === 0) return
    setCreditSaving(true)
    setCreditResult(null)
    setError('')
    const success = [], skipped = [], failed = []
    await Promise.allSettled(
      selectedMembers.map(async (member) => {
        const amount = resolveShiftCreditAmount(member)
        const configured = Number(member.defaultShiftCreditAmount ?? 0)
        try {
          const outcome = await checkAndLoadCredit(member.name, creditSelectedShift, creditSelectedDate, amount, configured)
          if (outcome === 'skipped') skipped.push(member.name)
          else success.push(member.name)
        } catch (err) {
          console.error(`Error crédito ${member.name}:`, err)
          failed.push(member.name)
        }
      })
    )
    setCreditResult({ success, skipped, failed })
    setCreditSaving(false)
  }

  async function handleVoidEntry() {
    if (!voidReason.trim()) return
    setVoidSaving(true)
    try {
      await updateDoc(doc(db, 'staffLedger', voidingEntry.id), {
        voided: true,
        voidedAt: serverTimestamp(),
        voidedByEmail: user.email,
        voidedByUid: user.uid,
        voidReason: voidReason.trim(),
      })
      setVoidingEntry(null)
      setVoidReason('')
    } catch (err) {
      console.error('Error anulando movimiento:', err)
      setError('No se pudo anular el movimiento.')
    } finally {
      setVoidSaving(false)
    }
  }

  async function handleToggleActive(member) {
    setTogglingId(member.id)
    setError('')
    try {
      await updateStaffMember(member.id, { active: !(member.active !== false) }, user)
    } catch (err) {
      console.error('Error actualizando empleado:', err)
      setError('No se pudo actualizar el empleado.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleEditSave() {
    if (!editName.trim()) return
    const salary              = Math.max(0, Number(editWeeklySalary)         || 0)
    const shiftRate           = Math.max(0, Number(editShiftRate)            || 0)
    const deliveryBaseAmount  = Math.max(0, Number(editDeliveryBaseAmount)   || 0)
    const deliveryBaseHours   = Math.max(0.5, Number(editDeliveryBaseHours)  || 4)
    const credit = Math.max(0, Number(editShiftCredit)  || 0)
    setEditSaving(true)
    setError('')
    try {
      await updateStaffMember(editingMember.id, {
        name: editName.trim(),
        role: editRole,
        active: editActive,
        weeklySalary: salary,
        salaryType: editSalaryType,
        shiftRate,
        deliveryBaseAmount,
        deliveryBaseHours,
        defaultShiftCreditAmount: credit,
        paymentDay: 'monday',
      }, user)
      setEditingMember(null)
    } catch (err) {
      console.error('Error guardando empleado:', err)
      setError('No se pudo guardar los cambios.')
    } finally {
      setEditSaving(false)
    }
  }

  function openEdit(member) {
    setEditingMember(member)
    setEditName(member.name ?? '')
    setEditRole(member.role || 'otro')
    setEditActive(member.active !== false)
    setEditWeeklySalary(String(Number(member.weeklySalary ?? 0)))
    setEditSalaryType(member.salaryType ?? 'custom')
    setEditShiftRate(String(Number(member.shiftRate ?? 0)))
    setEditDeliveryBaseAmount(String(Number(member.deliveryBaseAmount ?? 0)))
    setEditDeliveryBaseHours(String(Number(member.deliveryBaseHours ?? 4)))
    setEditShiftCredit(String(Number(member.defaultShiftCreditAmount ?? 0)))
  }

  // Agrupar por rol
  const membersByRole = {}
  for (const r of ROLE_ORDER) membersByRole[r] = []
  for (const m of allStaffMembers) {
    const r = m.role || 'otro'
    const bucket = ROLE_ORDER.includes(r) ? r : 'otro'
    membersByRole[bucket].push(m)
  }
  for (const r of ROLE_ORDER) {
    membersByRole[r].sort((a, b) => {
      const aA = a.active !== false ? 0 : 1
      const bA = b.active !== false ? 0 : 1
      if (aA !== bA) return aA - bA
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: '1px solid var(--line)',
              color: 'var(--muted)', padding: '8px 16px',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px',
            }}
          >Volver</button>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '20px', fontWeight: '700' }}>Staff</h2>
        </div>

        {/* Navegador de semana */}
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button
              type="button"
              onClick={() => goWeek(-1)}
              style={{
                padding: '6px 14px', background: 'transparent',
                border: '1px solid var(--line)', color: 'var(--muted)',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}
            >‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: isCurrentWeek ? 'var(--y)' : 'var(--text)' }}>
                Semana {staffWeek.weekId}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {formatLongDate(staffWeek.startDate)} – {formatLongDate(staffWeek.endDate)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => goWeek(1)}
              disabled={isCurrentWeek}
              style={{
                padding: '6px 14px', background: 'transparent',
                border: '1px solid var(--line)',
                color: isCurrentWeek ? 'rgba(255,255,255,0.15)' : 'var(--muted)',
                borderRadius: '6px', cursor: isCurrentWeek ? 'not-allowed' : 'pointer', fontSize: '13px',
              }}
            >›</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[{ key: 'resumen', label: 'Resumen' }, { key: 'liquidacion', label: 'Liquidacion' }, { key: 'empleados', label: 'Empleados' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius)',
                border: activeTab === tab.key ? '1px solid rgba(255,198,42,0.5)' : '1px solid var(--line)',
                background: activeTab === tab.key ? 'rgba(255,198,42,0.12)' : 'transparent',
                color: activeTab === tab.key ? 'var(--y)' : 'var(--muted)',
                fontWeight: activeTab === tab.key ? '700' : '400',
                fontSize: '13px', cursor: 'pointer',
              }}
            >{tab.label}</button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: 'var(--radius)', padding: '10px 14px', color: '#ff6b6b',
            fontSize: '13px', marginBottom: '16px',
          }}>{error}</div>
        )}

        {/* Modal anulación */}
        {voidingEntry && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '24px', maxWidth: '360px', width: '100%',
            }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '6px' }}>Anular movimiento</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                {voidingEntry.staffName} · {MOVEMENT_LABELS[voidingEntry.movementType] ?? voidingEntry.movementType} · ${Number(voidingEntry.amount ?? 0).toLocaleString('es-AR')}
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Motivo (obligatorio)"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !voidSaving && handleVoidEntry()}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)', color: 'var(--text)',
                  padding: '10px 12px', fontSize: '14px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={handleVoidEntry}
                  disabled={!voidReason.trim() || voidSaving}
                  style={{
                    flex: 1, padding: '10px', fontWeight: '700', fontSize: '13px',
                    background: voidReason.trim() && !voidSaving ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${voidReason.trim() && !voidSaving ? 'rgba(255,107,107,0.5)' : 'var(--line)'}`,
                    color: voidReason.trim() && !voidSaving ? '#ff6b6b' : 'var(--muted)',
                    borderRadius: 'var(--radius)', cursor: voidReason.trim() && !voidSaving ? 'pointer' : 'not-allowed',
                  }}
                >{voidSaving ? 'Anulando...' : 'Confirmar anulación'}</button>
                <button
                  onClick={() => { setVoidingEntry(null); setVoidReason('') }}
                  disabled={voidSaving}
                  style={{
                    padding: '10px 14px', fontSize: '13px',
                    background: 'transparent', border: '1px solid var(--line)',
                    color: 'var(--muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal edición empleado */}
        {editingMember && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 100,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '20px', overflowY: 'auto',
          }}>
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '24px',
              maxWidth: '420px', width: '100%', marginTop: '8px', marginBottom: '32px',
            }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '20px' }}>
                Editar empleado
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Nombre */}
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    autoFocus type="text" placeholder="Nombre"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={editInputStyle}
                  />
                </div>

                {/* Rol */}
                <div>
                  <label style={labelStyle}>Rol</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} style={editInputStyle}>
                    {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label style={labelStyle}>Estado</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[{ v: true, l: 'Activo' }, { v: false, l: 'Inactivo' }].map(({ v, l }) => (
                      <button
                        key={l} type="button"
                        onClick={() => setEditActive(v)}
                        style={{
                          flex: 1, padding: '9px', fontSize: '13px', fontWeight: '600',
                          borderRadius: 'var(--radius)', cursor: 'pointer',
                          border: editActive === v
                            ? (v ? '2px solid rgba(74,222,128,0.6)' : '2px solid rgba(255,107,107,0.6)')
                            : '1px solid var(--line)',
                          background: editActive === v
                            ? (v ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)')
                            : 'rgba(255,255,255,0.04)',
                          color: editActive === v
                            ? (v ? '#4ade80' : '#ff6b6b')
                            : 'var(--muted)',
                        }}
                      >{l}</button>
                    ))}
                  </div>
                </div>

                {/* Tipo de sueldo */}
                <div>
                  <label style={labelStyle}>Tipo de sueldo</label>
                  <select value={editSalaryType} onChange={e => setEditSalaryType(e.target.value)} style={editInputStyle}>
                    <option value="fixed">Fijo semanal</option>
                    <option value="shift">Por turno</option>
                    <option value="delivery">Delivery</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                {/* Pago por turno — solo si salaryType = shift */}
                {editSalaryType === 'shift' && (
                  <div>
                    <label style={labelStyle}>Pago por turno</label>
                    <input
                      type="number" min="0" step="1000" placeholder="0"
                      value={editShiftRate}
                      onChange={e => setEditShiftRate(e.target.value)}
                      style={editInputStyle}
                    />
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                      Se multiplica por los turnos registrados en la semana.
                    </div>
                  </div>
                )}

                {/* Campos delivery — solo si salaryType = delivery */}
                {editSalaryType === 'delivery' && (
                  <>
                    <div>
                      <label style={labelStyle}>Base por jornada</label>
                      <input
                        type="number" min="0" step="1000" placeholder="0"
                        value={editDeliveryBaseAmount}
                        onChange={e => setEditDeliveryBaseAmount(e.target.value)}
                        style={editInputStyle}
                      />
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                        Monto fijo por jornada trabajada. Los envíos se suman aparte desde los pedidos.
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Horas base</label>
                      <input
                        type="number" min="0.5" step="0.5" placeholder="4"
                        value={editDeliveryBaseHours}
                        onChange={e => setEditDeliveryBaseHours(e.target.value)}
                        style={editInputStyle}
                      />
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                        Horas por defecto al registrar una jornada.
                      </div>
                    </div>
                  </>
                )}

                {/* Sueldo semanal — solo para fijo y personalizado */}
                {editSalaryType !== 'shift' && editSalaryType !== 'delivery' && (
                  <div>
                    <label style={labelStyle}>Sueldo semanal</label>
                    <input
                      type="number" min="0" step="1000" placeholder="0"
                      value={editWeeklySalary}
                      onChange={e => setEditWeeklySalary(e.target.value)}
                      style={editInputStyle}
                    />
                  </div>
                )}

                {/* Crédito default por turno */}
                <div>
                  <label style={labelStyle}>Credito por turno</label>
                  <input
                    type="number" min="0" step="100" placeholder="0"
                    value={editShiftCredit}
                    onChange={e => setEditShiftCredit(e.target.value)}
                    style={editInputStyle}
                  />
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                    Valor por defecto al cargar credito de turno a este empleado.
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  onClick={handleEditSave}
                  disabled={!editName.trim() || editSaving}
                  style={{
                    flex: 2, padding: '11px', fontWeight: '700', fontSize: '13px',
                    background: editName.trim() && !editSaving ? 'var(--y)' : 'rgba(255,255,255,0.04)',
                    border: 'none',
                    color: editName.trim() && !editSaving ? '#000' : 'var(--muted)',
                    borderRadius: 'var(--radius)',
                    cursor: editName.trim() && !editSaving ? 'pointer' : 'not-allowed',
                  }}
                >{editSaving ? 'Guardando...' : 'Guardar cambios'}</button>
                <button
                  onClick={() => setEditingMember(null)} disabled={editSaving}
                  style={{
                    flex: 1, padding: '11px 14px', fontSize: '13px',
                    background: 'transparent', border: '1px solid var(--line)',
                    color: 'var(--muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Ficha detalle empleado */}
        {detailMember && (
          <EmployeeDetail
            member={detailMember}
            weekLedger={weekLedger}
            staffWeek={staffWeek}
            today={today}
            user={user}
            onClose={() => setDetailMember(null)}
            onVoid={(entry) => { setDetailMember(null); setVoidingEntry(entry); setVoidReason('') }}
          />
        )}

        {/* ═══ TAB: RESUMEN ═══ */}
        {activeTab === 'resumen' && (
          <>
            {/* Cargar crédito de turno */}
            <CollapsibleBlock
              title="Cargar crédito de turno"
              open={openCredito}
              onToggle={() => setOpenCredito(v => !v)}
            >
              {loadingStaff ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando empleados...</div>
              ) : staffMembers.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No hay empleados activos. Creálos en la pestaña Empleados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Selector empleados múltiple */}
                  <div>
                    <label style={labelStyle}>Empleados</label>
                    {/* Fila "Todos" */}
                    <div
                      onClick={() => { setCreditAllSelected(v => !v); setCreditSelectedNames(new Set()); setCreditResult(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', marginBottom: '6px',
                        background: creditAllSelected ? 'rgba(255,198,42,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${creditAllSelected ? 'rgba(255,198,42,0.4)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        border: `2px solid ${creditAllSelected ? 'var(--y)' : 'rgba(255,255,255,0.25)'}`,
                        background: creditAllSelected ? 'var(--y)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {creditAllSelected && <span style={{ fontSize: '10px', color: '#000', fontWeight: '900', lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: creditAllSelected ? 'var(--y)' : 'var(--text)' }}>
                        Todos los empleados activos
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>{staffMembers.length}</span>
                    </div>
                    {/* Lista individual */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {staffMembers.map(m => {
                        const checked = creditAllSelected || creditSelectedNames.has(m.name)
                        const configured = Number(m.defaultShiftCreditAmount ?? 0)
                        const creditAmt  = configured > 0 ? configured : STAFF_SHIFT_CREDIT
                        const isDefault  = configured <= 0
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (creditAllSelected) return
                              setCreditSelectedNames(prev => {
                                const next = new Set(prev)
                                if (next.has(m.name)) next.delete(m.name); else next.add(m.name)
                                return next
                              })
                              setCreditResult(null)
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                              background: checked ? 'rgba(255,198,42,0.07)' : 'transparent',
                              border: `1px solid ${checked ? 'rgba(255,198,42,0.25)' : 'var(--line)'}`,
                              borderRadius: '8px', cursor: creditAllSelected ? 'default' : 'pointer',
                              opacity: creditAllSelected ? 0.6 : 1,
                            }}
                          >
                            <div style={{
                              width: '15px', height: '15px', borderRadius: '3px', flexShrink: 0,
                              border: `2px solid ${checked ? 'var(--y)' : 'rgba(255,255,255,0.2)'}`,
                              background: checked ? 'var(--y)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {checked && <span style={{ fontSize: '9px', color: '#000', fontWeight: '900', lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{m.name}</span>
                            <span style={{ fontSize: '11px', color: isDefault ? 'rgba(255,255,255,0.3)' : 'var(--y)', fontWeight: isDefault ? '400' : '700' }}>
                              ${creditAmt.toLocaleString('es-AR')}
                              {isDefault && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginLeft: '3px' }}>(default)</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Fecha — cualquier día de la semana */}
                  <div>
                    <label style={labelStyle}>Fecha</label>
                    <input
                      type="date"
                      value={creditSelectedDate}
                      onChange={e => { setCreditSelectedDate(e.target.value); setCreditResult(null) }}
                      max={today}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                        color: 'var(--text)', padding: '10px 12px', fontSize: '14px',
                        colorScheme: 'dark',
                      }}
                    />
                    {creditSelectedDate !== today && (
                      <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                        Crédito para fecha anterior: {creditSelectedDate}
                      </div>
                    )}
                  </div>

                  {/* Turno */}
                  <div>
                    <label style={labelStyle}>Turno</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[{ value: 'mediodia', label: 'Mediodía' }, { value: 'noche', label: 'Noche' }].map(sh => (
                        <button
                          key={sh.value} type="button"
                          onClick={() => { setCreditSelectedShift(sh.value); setCreditResult(null) }}
                          style={{
                            flex: 1, padding: '9px 12px', fontSize: '13px', fontWeight: '600',
                            borderRadius: 'var(--radius)',
                            border: creditSelectedShift === sh.value ? '1px solid rgba(255,198,42,0.5)' : '1px solid var(--line)',
                            background: creditSelectedShift === sh.value ? 'rgba(255,198,42,0.12)' : 'transparent',
                            color: creditSelectedShift === sh.value ? 'var(--y)' : 'var(--muted)',
                            cursor: 'pointer',
                          }}
                        >{sh.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Resultado */}
                  {creditResult && (() => {
                    const { success, skipped, failed } = creditResult
                    const total   = success.length + skipped.length + failed.length
                    const allFail = success.length === 0 && skipped.length === 0 && failed.length > 0
                    const allOk   = failed.length === 0
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{
                          padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: '12px',
                          background: allFail ? 'rgba(255,107,107,0.1)' : allOk ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)',
                          border: `1px solid ${allFail ? 'rgba(255,107,107,0.3)' : allOk ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`,
                          color: allFail ? '#ff6b6b' : allOk ? '#4ade80' : '#f59e0b',
                          fontWeight: '600',
                        }}>
                          {allFail
                            ? 'No se pudo cargar ningún crédito. Revisar conexión o intentar nuevamente.'
                            : allOk && skipped.length === 0
                              ? `Créditos cargados correctamente para ${success.length} ${success.length === 1 ? 'empleado' : 'empleados'}.`
                              : `Se cargaron ${success.length}/${total} créditos.`}
                        </div>
                        {failed.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#ff6b6b', paddingLeft: '2px' }}>
                            Fallaron: {failed.join(', ')}
                          </div>
                        )}
                        {skipped.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', paddingLeft: '2px' }}>
                            Ya tenian crédito cargado: {skipped.join(', ')}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Preview créditos a cargar */}
                  {(() => {
                    const selected = creditAllSelected
                      ? staffMembers
                      : staffMembers.filter(m => creditSelectedNames.has(m.name))
                    if (selected.length === 0 || creditSaving) return null

                    if (selected.length === 1) {
                      const amt = resolveShiftCreditAmount(selected[0])
                      return (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '6px 0 0' }}>
                          Credito a cargar: <span style={{ color: 'var(--y)', fontWeight: '700' }}>${amt.toLocaleString('es-AR')}</span>
                        </div>
                      )
                    }

                    const allSame = selected.every(m => resolveShiftCreditAmount(m) === resolveShiftCreditAmount(selected[0]))
                    if (allSame) {
                      const amt = resolveShiftCreditAmount(selected[0])
                      return (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '6px 0 0' }}>
                          Credito a cargar: <span style={{ color: 'var(--y)', fontWeight: '700' }}>${amt.toLocaleString('es-AR')}</span> a cada empleado.
                        </div>
                      )
                    }

                    return (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '6px 0 0' }}>
                        <div style={{ marginBottom: '5px' }}>Creditos individuales:</div>
                        {selected.map(m => {
                          const amt = resolveShiftCreditAmount(m)
                          const isDefault = Number(m.defaultShiftCreditAmount ?? 0) <= 0
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{m.name}</span>
                              <span style={{ color: isDefault ? 'rgba(255,255,255,0.3)' : 'var(--y)', fontWeight: '600' }}>
                                ${amt.toLocaleString('es-AR')}{isDefault ? ' (default)' : ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* Botón */}
                  {(() => {
                    const count    = creditAllSelected ? staffMembers.length : creditSelectedNames.size
                    const canSubmit = count > 0 && !creditSaving
                    return (
                      <button
                        type="button" disabled={!canSubmit}
                        onClick={handleBulkCreditShift}
                        style={{
                          padding: '11px 16px',
                          background: canSubmit ? 'rgba(255,198,42,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${canSubmit ? 'rgba(255,198,42,0.4)' : 'var(--line)'}`,
                          color: canSubmit ? 'var(--y)' : 'var(--muted)',
                          borderRadius: 'var(--radius)', cursor: canSubmit ? 'pointer' : 'not-allowed',
                          fontSize: '13px', fontWeight: '700',
                        }}
                      >
                        {creditSaving
                          ? 'Cargando...'
                          : count === 0
                            ? '+ Cargar credito'
                            : `+ Cargar credito a ${count} ${count === 1 ? 'empleado' : 'empleados'}`}
                      </button>
                    )
                  })()}
                </div>
              )}
            </CollapsibleBlock>

            {/* Staff semanal */}
            <CollapsibleBlock
              title={`Staff semanal — semana ${staffWeek.weekId}`}
              open={openSemanal}
              onToggle={() => setOpenSemanal(v => !v)}
            >
              {loadingLedger ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
              ) : weeklyNames.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Sin movimientos esta semana.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Empleado', 'Rol', 'Créditos semana', 'Consumos', 'A descontar', 'Saldo comida'].map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 10px', textAlign: i < 2 ? 'left' : 'right',
                            color: 'var(--muted)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyNames.map(name => {
                        const s     = weeklySummaryMap[name] ?? { creditos: 0, cubiertos: 0, consumos: 0, descuentos: 0 }
                        const saldo = Math.max(0, s.creditos - (s.cubiertos ?? s.consumos))
                        const role  = staffRoleMap[name] ?? 'otro'
                        return (
                          <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: '600', textAlign: 'left' }}>{name}</td>
                            <td style={{ padding: '10px 10px', color: 'var(--muted)', fontSize: '12px', textAlign: 'left' }}>{role}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>{s.creditos > 0 ? `$${s.creditos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>{s.consumos > 0 ? `$${s.consumos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: s.descuentos > 0 ? '#ff6b6b' : 'var(--muted)' }}>{s.descuentos > 0 ? `$${s.descuentos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: saldo < 0 ? '#ff6b6b' : saldo > 0 ? 'var(--y)' : 'var(--muted)' }}>
                              {saldo !== 0 ? `$${saldo.toLocaleString('es-AR')}` : '$0'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleBlock>

            {/* Delivery */}
            <CollapsibleBlock
              title={`Delivery — ${deliveryFilter === 'week' ? `semana ${staffWeek.weekId}` : deliveryFilter === 'date' ? deliveryCustomDate : deliveryFilter === 'yesterday' ? 'ayer' : today}`}
              open={openDelivery}
              onToggle={() => setOpenDelivery(v => !v)}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {[{ v: 'today', l: 'Hoy' }, { v: 'yesterday', l: 'Ayer' }, { v: 'date', l: 'Fecha' }, { v: 'week', l: 'Semana' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setDeliveryFilter(v)} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: deliveryFilter === v ? '1px solid rgba(255,198,42,0.5)' : '1px solid var(--line)', background: deliveryFilter === v ? 'rgba(255,198,42,0.12)' : 'transparent', color: deliveryFilter === v ? 'var(--y)' : 'var(--muted)', cursor: 'pointer' }}>{l}</button>
                ))}
                {deliveryFilter === 'date' && (
                  <input type="date" value={deliveryCustomDate} onChange={e => setDeliveryCustomDate(e.target.value)} max={today} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '5px 10px', fontSize: '12px', colorScheme: 'dark' }} />
                )}
              </div>
              {loadingLedger ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
              ) : deliveryNames.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Sin deliveries para el período seleccionado.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Delivery', deliveryFilter === 'week' ? 'Créditos semana' : 'Créditos', deliveryFilter === 'week' ? 'Consumos semana' : 'Consumos', 'A descontar', 'Saldo'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--muted)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryNames.map(name => {
                        const s     = deliverySummaryMap[name] ?? { creditos: 0, consumos: 0, descuentos: 0 }
                        const saldo = s.creditos - s.consumos
                        return (
                          <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: '600', textAlign: 'left' }}>{name}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>{s.creditos > 0 ? `$${s.creditos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>{s.consumos > 0 ? `$${s.consumos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: s.descuentos > 0 ? '#ff6b6b' : 'var(--muted)' }}>{s.descuentos > 0 ? `$${s.descuentos.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: saldo < 0 ? '#ff6b6b' : saldo > 0 ? 'var(--y)' : 'var(--muted)' }}>
                              {saldo !== 0 ? `$${saldo.toLocaleString('es-AR')}` : '$0'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleBlock>

            {/* Movimientos */}
            <CollapsibleBlock
              title={`Movimientos de la semana${weekLedger.length > 0 ? ` (${weekLedger.length})` : ''}`}
              open={openMovimientos}
              onToggle={() => setOpenMovimientos(v => !v)}
            >
              {weekLedger.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Sin movimientos esta semana.</div>
              ) : (
                <div>
                  {[...weekLedger]
                    .sort((a, b) => {
                      const ta = a.createdAt?.toDate?.() ?? new Date(0)
                      const tb = b.createdAt?.toDate?.() ?? new Date(0)
                      return tb - ta
                    })
                    .map(entry => (
                      <div key={entry.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        gap: '12px', opacity: entry.voided ? 0.45 : 1,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>
                            {entry.staffName}
                            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '400', color: entry.movementType === 'credit_shift_meal' ? 'var(--y)' : 'var(--muted)' }}>
                              {MOVEMENT_LABELS[entry.movementType] ?? entry.movementType}
                              {entry.shift ? ` · turno ${entry.shift === 'mediodia' ? 'mediodía' : entry.shift}` : ''}
                            </span>
                            {entry.voided && <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#ff6b6b', letterSpacing: '0.05em' }}>ANULADO</span>}
                          </div>
                          {entry.note && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{entry.note}</div>}
                          {entry.voided && entry.voidReason && <div style={{ fontSize: '11px', color: 'rgba(255,107,107,0.6)', marginTop: '2px' }}>Motivo: {entry.voidReason}</div>}
                          {(entry.orderCode || entry.businessDate) && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                              {entry.orderCode ? `${entry.orderCode} · ` : ''}{entry.businessDate}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', color: entry.movementType === 'credit_shift_meal' ? 'var(--y)' : '#ff9966' }}>
                            {entry.movementType === 'credit_shift_meal' ? '+' : '−'}${Number(entry.amount ?? 0).toLocaleString('es-AR')}
                          </div>
                          {!entry.voided && (
                            <button
                              onClick={() => { setError(''); setVoidingEntry(entry); setVoidReason('') }}
                              style={{ fontSize: '11px', color: '#ff6b6b', background: 'transparent', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >Anular</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CollapsibleBlock>
          </>
        )}

        {/* ═══ TAB: LIQUIDACION ═══ */}
        {activeTab === 'liquidacion' && (
          <PayrollDashboard
            staffMembers={staffMembers}
            weekLedger={weekLedger}
            loadingLedger={loadingLedger}
            staffWeek={staffWeek}
            user={user}
            orders={orders}
            onVoidEntry={(entry) => { setVoidingEntry(entry); setVoidReason('') }}
          />
        )}

        {/* ═══ TAB: EMPLEADOS ═══ */}
        {activeTab === 'empleados' && (
          <div>
            {loadingStaff ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '20px 0' }}>Cargando...</div>
            ) : allStaffMembers.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '20px 0' }}>No hay empleados registrados.</div>
            ) : (
              ROLE_ORDER.map(role => {
                const roleLabel = STAFF_ROLES.find(r => r.value === role)?.label ?? role
                return (
                  <RoleGroup
                    key={role}
                    roleLabel={roleLabel}
                    members={membersByRole[role] ?? []}
                    openEdit={openEdit}
                    onToggleActive={handleToggleActive}
                    togglingId={togglingId}
                    onViewDetail={setDetailMember}
                    defaultOpen={role === 'dueño' || role === 'caja' || role === 'cocina'}
                  />
                )
              })
            )}

            {/* Crear empleado */}
            <div style={{ marginTop: '8px' }}>
              {showCreateStaff ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text" placeholder="Nombre del empleado"
                      value={newStaffName}
                      onChange={e => setNewStaffName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStaff())}
                      autoFocus
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '10px 12px', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '10px 12px', fontSize: '14px' }}
                    >
                      {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button onClick={handleCreateStaff} style={{ padding: '10px 16px', background: 'var(--y)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>Guardar</button>
                    <button onClick={() => setShowCreateStaff(false)} style={{ padding: '10px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateStaff(true)}
                  style={{ padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px' }}
                >+ Agregar empleado</button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
