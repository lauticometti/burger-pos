import { useState, useMemo } from 'react'
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { calculatePayrollSummary } from '../utils/payrollUtils'
import { addSalaryAdvance, addSalaryPayment, addWorkShift, addDeliveryShift } from '../utils/staffLedger'
import { normalizeStaffMember } from '../hooks/useStaffMembers'
import { todayStr } from '../utils/printing'

// ─── Estilos base ─────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', color: 'var(--text)',
  padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block', color: 'var(--muted)', fontSize: '11px', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
}

const btnSecondaryStyle = {
  flex: 1, padding: '11px 14px', fontSize: '13px',
  background: 'transparent', border: '1px solid var(--line)',
  color: 'var(--muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other',    label: 'Otro' },
]

const MOVEMENT_LABELS = {
  credit_shift_meal:      'Credito turno',
  debit_staff_meal:       'Comida staff',
  debit_internal_account: 'Cuenta interna',
  payroll_deduction:      'Descuento sueldo',
  salary_advance:         'Adelanto',
  salary_payment:         'Pago sueldo',
  work_shift:             'Turno trabajado',
  delivery_shift:         'Jornada delivery',
  adjustment:             'Ajuste',
}

const SHIFT_LABELS = { mediodia: 'Mediodia', noche: 'Noche', extra: 'Extra' }

const fmt = n => '$' + Number(n ?? 0).toLocaleString('es-AR')

// ─── Helpers de fecha legible ─────────────────────────────────────────────────

function fmtShort(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function fmtFull(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ─── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = {
    pendiente:       { label: 'Pendiente',              color: '#ff9966', bg: 'rgba(255,150,50,0.12)',  border: 'rgba(255,150,50,0.35)'  },
    pagado:          { label: 'Pagado',                 color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.3)'   },
    a_favor_negocio: { label: 'A favor del negocio',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)'   },
    sin_sueldo:      { label: 'Sin sueldo configurado', color: '#888',    bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)'  },
    sin_turnos:      { label: 'Sin turnos cargados',    color: '#888',    bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)'  },
    sin_jornadas:    { label: 'Sin jornadas',           color: '#888',    bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)'  },
  }[estado] ?? { label: estado, color: '#888', bg: 'rgba(255,255,255,0.04)', border: 'var(--line)' }

  return (
    <span style={{
      fontSize: '11px', fontWeight: '700', padding: '2px 8px',
      borderRadius: '4px', background: cfg.bg,
      border: `1px solid ${cfg.border}`, color: cfg.color,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

// ─── Primitivas UI compartidas ────────────────────────────────────────────────

function ModalWrapper({ onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', padding: '24px',
        maxWidth: '420px', width: '100%',
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onConfirm, confirmLabel, disabled, confirmColor }) {
  const primary = !disabled
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
      <button
        onClick={onConfirm}
        disabled={disabled}
        style={{
          flex: 2, padding: '11px', fontWeight: '700', fontSize: '13px',
          background: !primary ? 'rgba(255,255,255,0.04)' : confirmColor ? 'rgba(245,158,11,0.18)' : 'var(--y)',
          border: !primary ? '1px solid var(--line)' : confirmColor ? `1px solid ${confirmColor}` : 'none',
          color: !primary ? 'var(--muted)' : confirmColor ? confirmColor : '#000',
          borderRadius: 'var(--radius)', cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >{confirmLabel}</button>
      <button onClick={onCancel} style={btnSecondaryStyle}>Cancelar</button>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      marginTop: '12px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
      borderRadius: 'var(--radius)', padding: '10px 14px', color: '#ff6b6b', fontSize: '13px',
    }}>{msg}</div>
  )
}

// ─── Modal Adelanto ───────────────────────────────────────────────────────────

function ModalAdvance({ employee, weekRange, user, onClose, onDone }) {
  const today = todayStr()
  const defaultDate = today >= weekRange.monday && today <= weekRange.sunday ? today : weekRange.monday

  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')
  const [date, setDate]     = useState(defaultDate)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    setError('')
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (!note.trim())     { setError('La nota es obligatoria.'); return }
    if (!date)            { setError('La fecha es obligatoria.'); return }
    setSaving(true)
    try {
      await addSalaryAdvance({
        staffName: employee.employeeName,
        staffRole: employee.employeeRole,
        employeeId: employee.employeeId,
        amount: amt,
        businessDate: date,
        paymentMethod: 'cash',
        note: note.trim(),
      }, user)
      onDone()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>Registrar adelanto</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        {employee.employeeName} · {weekRange.label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Monto</label>
          <input autoFocus type="number" min="0" step="100" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Nota (obligatoria)</label>
          <input type="text" placeholder="Ej: adelanto pedido de Juan" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date} min={weekRange.monday} max={weekRange.sunday}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>
      </div>
      {error && <ErrorBox msg={error} />}
      <ModalActions onCancel={onClose} onConfirm={handleSave}
        confirmLabel={saving ? 'Guardando...' : 'Registrar adelanto'} disabled={saving} />
    </ModalWrapper>
  )
}

// ─── Modal Pago ───────────────────────────────────────────────────────────────

function ModalPayment({ employee, weekRange, user, onClose, onDone }) {
  const today = todayStr()
  const defaultDate = today >= weekRange.monday && today <= weekRange.sunday ? today : weekRange.monday

  const [amount, setAmount]           = useState(String(employee.pendiente > 0 ? employee.pendiente : ''))
  const [paymentMethod, setMethod]    = useState('cash')
  const [note, setNote]               = useState('')
  const [date, setDate]               = useState(defaultDate)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [overConfirm, setOverConfirm] = useState(false)

  const amt    = Number(amount)
  const isOver = amt > employee.pendiente && employee.pendiente > 0

  if (employee.pendiente <= 0 && employee.sueldoBase > 0) {
    return (
      <ModalWrapper onClose={onClose}>
        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '8px' }}>Registrar pago</div>
        <div style={{ fontSize: '13px', color: '#4ade80', marginBottom: '20px' }}>
          {employee.employeeName} ya esta pagado para esta semana.
        </div>
        <button onClick={onClose} style={{ ...btnSecondaryStyle, width: '100%' }}>Cerrar</button>
      </ModalWrapper>
    )
  }

  async function handleSave() {
    setError('')
    if (!amt || amt <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (isOver && !overConfirm) { setOverConfirm(true); return }
    setSaving(true)
    try {
      await addSalaryPayment({
        staffName: employee.employeeName,
        staffRole: employee.employeeRole,
        employeeId: employee.employeeId,
        amount: amt,
        businessDate: date,
        paymentMethod,
        note: note.trim() || 'Pago de sueldo',
      }, user)
      onDone()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>Registrar pago</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        {employee.employeeName} · Pendiente: <strong style={{ color: 'var(--y)' }}>{fmt(employee.pendiente)}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Monto</label>
          <input autoFocus type="number" min="0" step="100" value={amount}
            onChange={e => { setAmount(e.target.value); setOverConfirm(false) }}
            style={inputStyle} />
          {isOver && !overConfirm && (
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
              El monto supera el pendiente ({fmt(employee.pendiente)}). Confirma para continuar de todas formas.
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Medio de pago</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} style={{
                flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: '600',
                borderRadius: '6px', cursor: 'pointer',
                border: paymentMethod === m.value ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
                background: paymentMethod === m.value ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
                color: paymentMethod === m.value ? 'var(--y)' : 'var(--muted)',
              }}>{m.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Nota (opcional)</label>
          <input type="text" placeholder="Ej: pago semanal" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date} min={weekRange.monday} max={weekRange.sunday}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>
      </div>
      {error && <ErrorBox msg={error} />}
      <ModalActions onCancel={onClose} onConfirm={handleSave}
        confirmLabel={saving ? 'Guardando...' : isOver && !overConfirm ? 'Confirmar de todas formas' : 'Registrar pago'}
        disabled={saving} confirmColor={isOver && !overConfirm ? '#f59e0b' : undefined} />
    </ModalWrapper>
  )
}

// ─── Modal Pagar todo ─────────────────────────────────────────────────────────

function ModalMarkPaid({ employee, weekRange, user, onClose, onDone }) {
  const today = todayStr()
  const defaultDate = today >= weekRange.monday && today <= weekRange.sunday ? today : weekRange.monday

  const [paymentMethod, setMethod] = useState('cash')
  const [saving, setSaving]        = useState(false)
  const [error, setError]          = useState('')

  if (employee.pendiente === 0 && employee.sueldoBase > 0) {
    return (
      <ModalWrapper onClose={onClose}>
        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '8px' }}>Pagar todo</div>
        <div style={{ fontSize: '13px', color: '#4ade80', marginBottom: '20px' }}>
          {employee.employeeName} ya esta pagado para esta semana.
        </div>
        <button onClick={onClose} style={{ ...btnSecondaryStyle, width: '100%' }}>Cerrar</button>
      </ModalWrapper>
    )
  }

  if (employee.pendiente < 0) {
    return (
      <ModalWrapper onClose={onClose}>
        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '8px' }}>Pagar todo</div>
        <div style={{ fontSize: '13px', color: '#60a5fa', marginBottom: '20px' }}>
          {employee.employeeName} quedo a favor del negocio. Revisa el detalle antes de registrar otro movimiento.
        </div>
        <button onClick={onClose} style={{ ...btnSecondaryStyle, width: '100%' }}>Cerrar</button>
      </ModalWrapper>
    )
  }

  if (employee.sueldoBase === 0) {
    return (
      <ModalWrapper onClose={onClose}>
        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '8px' }}>Pagar todo</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
          {employee.employeeName} no tiene sueldo configurado. Edita el empleado para asignar un sueldo base.
        </div>
        <button onClick={onClose} style={{ ...btnSecondaryStyle, width: '100%' }}>Cerrar</button>
      </ModalWrapper>
    )
  }

  async function handleConfirm() {
    setError('')
    setSaving(true)
    try {
      await addSalaryPayment({
        staffName: employee.employeeName,
        staffRole: employee.employeeRole,
        employeeId: employee.employeeId,
        amount: employee.pendiente,
        businessDate: defaultDate,
        paymentMethod,
        note: 'Liquidacion semanal pagada',
      }, user)
      onDone()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>Pagar todo</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        Se registrara un pago de <strong style={{ color: 'var(--y)' }}>{fmt(employee.pendiente)}</strong> para {employee.employeeName}.
      </div>
      <div>
        <label style={labelStyle}>Medio de pago</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.value} type="button" onClick={() => setMethod(m.value)} style={{
              flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: '600',
              borderRadius: '6px', cursor: 'pointer',
              border: paymentMethod === m.value ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
              background: paymentMethod === m.value ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
              color: paymentMethod === m.value ? 'var(--y)' : 'var(--muted)',
            }}>{m.label}</button>
          ))}
        </div>
      </div>
      {error && <ErrorBox msg={error} />}
      <ModalActions onCancel={onClose} onConfirm={handleConfirm}
        confirmLabel={saving ? 'Guardando...' : 'Confirmar pago'} disabled={saving} />
    </ModalWrapper>
  )
}

// ─── Modal Detalle ────────────────────────────────────────────────────────────

function MovementRow({ entry, voided = false, onVoid }) {
  const isCredit = entry.movementType === 'credit_shift_meal' || entry.movementType === 'salary_payment'
  const isWorkShift = entry.movementType === 'work_shift'
  const shiftLabel = entry.shift ? (SHIFT_LABELS[entry.shift] ?? entry.shift) : ''
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: '12px', opacity: voided ? 0.45 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {entry.businessDate}
          {shiftLabel ? ` · ${shiftLabel}` : ''}
          {entry.orderCode ? ` · ${entry.orderCode}` : ''}
          {voided && <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#ff6b6b' }}>ANULADO</span>}
        </div>
        {entry.note && <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '1px' }}>{entry.note}</div>}
        {voided && entry.voidReason && (
          <div style={{ fontSize: '11px', color: 'rgba(255,107,107,0.6)', marginTop: '1px' }}>Motivo: {entry.voidReason}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: isCredit || isWorkShift ? '#4ade80' : '#ff9966' }}>
          {isCredit || isWorkShift ? '+' : '−'}{fmt(entry.amount)}
        </span>
        {!voided && onVoid && (
          <button onClick={() => onVoid(entry)} style={{
            fontSize: '10px', color: '#ff6b6b', background: 'transparent',
            border: '1px solid rgba(255,107,107,0.3)', borderRadius: '4px',
            padding: '2px 7px', cursor: 'pointer',
          }}>Anular</button>
        )}
      </div>
    </div>
  )
}

// ─── Modal Registrar turno ────────────────────────────────────────────────────

function ModalWorkShift({ employee, weekRange, user, onClose, onDone }) {
  const today = todayStr()
  const defaultDate = today >= weekRange.monday && today <= weekRange.sunday ? today : weekRange.sunday

  const [date, setDate]     = useState(defaultDate)
  const [shift, setShift]   = useState('noche')
  const [amount, setAmount] = useState(String(employee.shiftRate > 0 ? employee.shiftRate : ''))
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const isShiftRateZero = employee.shiftRate <= 0

  async function handleSave() {
    setError('')
    const amt = Number(amount)
    if (!date) { setError('La fecha es obligatoria.'); return }
    setSaving(true)
    try {
      await addWorkShift({
        staffName: employee.employeeName,
        staffRole: employee.employeeRole,
        employeeId: employee.employeeId,
        businessDate: date,
        shift,
        amount: Math.max(0, amt),
        note: note.trim(),
      }, user)
      onDone()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
        Registrar turno
      </div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        {employee.employeeName} · {weekRange.label}
      </div>

      {isShiftRateZero && (
        <div style={{
          marginBottom: '14px', padding: '9px 12px', fontSize: '12px',
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 'var(--radius)', color: '#f59e0b',
        }}>
          Este empleado no tiene pago por turno configurado. El turno se cargara con monto $0.
          Podes editar el empleado para configurarlo.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date}
            min={weekRange.monday} max={weekRange.sunday}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        <div>
          <label style={labelStyle}>Turno</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ v: 'mediodia', l: 'Mediodia' }, { v: 'noche', l: 'Noche' }, { v: 'extra', l: 'Extra' }].map(({ v, l }) => (
              <button key={v} type="button" onClick={() => setShift(v)} style={{
                flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: '600',
                borderRadius: '6px', cursor: 'pointer',
                border: shift === v ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
                background: shift === v ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
                color: shift === v ? 'var(--y)' : 'var(--muted)',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Monto del turno</label>
          <input type="number" min="0" step="1000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={inputStyle} />
          {employee.shiftRate > 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              Pago por turno configurado: ${employee.shiftRate.toLocaleString('es-AR')}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Nota (opcional)</label>
          <input type="text" placeholder="Ej: turno extra cubriendo a Diego"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            style={inputStyle} />
        </div>
      </div>

      {error && <ErrorBox msg={error} />}
      <ModalActions onCancel={onClose} onConfirm={handleSave}
        confirmLabel={saving ? 'Guardando...' : 'Registrar turno'} disabled={saving} />
    </ModalWrapper>
  )
}

// ─── Modal Jornada Delivery ───────────────────────────────────────────────────

function ModalDeliveryShift({ employee, weekRange, weekLedger, user, onClose, onDone }) {
  const today = todayStr()
  const defaultDate = today >= weekRange.monday && today <= weekRange.sunday ? today : weekRange.sunday

  const [date, setDate]         = useState(defaultDate)
  const [hours, setHours]       = useState(String(employee.deliveryBaseHours > 0 ? employee.deliveryBaseHours : 4))
  const [baseAmount, setBase]   = useState(String(employee.deliveryBaseAmount > 0 ? employee.deliveryBaseAmount : ''))
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function sameEmployee(m) {
    return (
      (m.employeeId && employee.employeeId && m.employeeId === employee.employeeId) ||
      (m.staffName && employee.employeeName && m.staffName === employee.employeeName) ||
      (m.employeeName && employee.employeeName && m.employeeName === employee.employeeName)
    )
  }

  async function handleSave() {
    setError('')
    const hrs = Number(hours)
    const amt = Number(baseAmount)
    if (!date)       { setError('La fecha es obligatoria.'); return }
    if (!hrs || hrs <= 0) { setError('Las horas deben ser mayores a 0.'); return }
    if (isNaN(amt) || amt < 0) { setError('La base no puede ser negativa.'); return }

    // Validar duplicado con helper robusto
    const dup = weekLedger.filter(m =>
      m.movementType === 'delivery_shift' &&
      !m.voided &&
      m.businessDate === date &&
      sameEmployee(m)
    )
    if (dup.length > 0 && !note.trim()) {
      setError('Ya hay una jornada para ese día. Agregá una nota para registrar una segunda.')
      return
    }

    setSaving(true)
    try {
      await addDeliveryShift({
        staffName: employee.employeeName,
        employeeName: employee.employeeName,
        employeeId: employee.employeeId,
        staffRole: employee.employeeRole,
        businessDate: date,
        hours: hrs,
        baseAmount: amt,
        note: note.trim(),
      }, user)
      onDone()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
        Registrar jornada delivery
      </div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        {employee.employeeName} · {weekRange.label}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date}
            min={weekRange.monday} max={weekRange.sunday}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        <div>
          <label style={labelStyle}>Horas trabajadas</label>
          <input type="number" min="0.5" step="0.5" value={hours}
            onChange={e => setHours(e.target.value)}
            style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Base de la jornada</label>
          <input type="number" min="0" step="1000" value={baseAmount}
            onChange={e => setBase(e.target.value)}
            style={inputStyle} />
          {employee.deliveryBaseAmount > 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              Base configurada: ${employee.deliveryBaseAmount.toLocaleString('es-AR')}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Nota (opcional — requerida si ya hay jornada ese día)</label>
          <input type="text" placeholder="Ej: doble jornada, cubriendo fin de semana"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            style={inputStyle} />
        </div>
      </div>

      {error && <ErrorBox msg={error} />}
      <ModalActions onCancel={onClose} onConfirm={handleSave}
        confirmLabel={saving ? 'Guardando...' : 'Registrar jornada'} disabled={saving} />
    </ModalWrapper>
  )
}

function ModalDetail({ row, weekRange, onClose, onVoid }) {
  const active = row.movements.filter(m => !m.voided)
  const voided = row.movements.filter(m => m.voided)

  const byType = {
    work_shift:             active.filter(m => m.movementType === 'work_shift'),
    delivery_shift:         active.filter(m => m.movementType === 'delivery_shift'),
    debit_staff_meal:       active.filter(m => m.movementType === 'debit_staff_meal'),
    debit_internal_account: active.filter(m => m.movementType === 'debit_internal_account'),
    payroll_deduction:      active.filter(m => m.movementType === 'payroll_deduction'),
    salary_advance:         active.filter(m => m.movementType === 'salary_advance'),
    salary_payment:         active.filter(m => m.movementType === 'salary_payment'),
    credit_shift_meal:      active.filter(m => m.movementType === 'credit_shift_meal'),
  }

  const groupLabel = {
    debit_staff_meal:       'Consumos comida',
    debit_internal_account: 'Cuenta interna (cubierto con créditos)',
    payroll_deduction:      'Cuenta interna (descuento sueldo)',
    salary_advance:         'Adelantos',
    salary_payment:         'Pagos',
    work_shift:             'Turnos trabajados',
    delivery_shift:         'Jornadas delivery',
    credit_shift_meal:      'Creditos comida',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', width: '100%', maxWidth: '520px',
        marginTop: '8px', marginBottom: '32px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '20px 20px 16px', borderBottom: '1px solid var(--line)',
        }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>{row.employeeName}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
              {row.employeeRole} · {fmtFull(weekRange.monday)} — {fmtFull(weekRange.sunday)}
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnSecondaryStyle, flex: 'none', padding: '6px 14px', fontSize: '12px' }}>
            Cerrar
          </button>
        </div>

        {/* Resumen */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Resumen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px' }}>
            {[
              { label: 'Sueldo base',          value: fmt(row.sueldoBase),                          color: 'var(--text)' },
              { label: 'Créditos disponibles', value: `+${fmt(row.creditosComida)}`,                color: row.creditosComida > 0 ? '#4ade80' : 'var(--muted)', skip: row.cuentaInterna === 0 && row.consumosStaff === 0 && row.creditosComida === 0 },
              { label: 'Comida staff',         value: fmt(row.consumosStaff),                       color: 'var(--text)',   skip: row.consumosStaff === 0 },
              { label: 'Cuenta interna',       value: fmt(row.cuentaInterna),                       color: 'var(--text)',   skip: row.cuentaInterna === 0 },
              { label: 'Cubierto por crédito', value: `−${fmt(row.cubiertoPorCredito)}`,            color: '#4ade80',       skip: row.cubiertoPorCredito === 0 },
              { label: 'Saldo crédito',        value: fmt(row.saldoCreditoRestante),                color: '#4ade80',       skip: row.saldoCreditoRestante === 0 },
              { label: 'A descontar',          value: `−${fmt(row.consumoADescontar)}`,             color: row.consumoADescontar > 0 ? '#ff9966' : 'var(--muted)', skip: row.consumoADescontar === 0 && row.cuentaInterna === 0 && row.consumosStaff === 0 },
              { label: 'Adelantos',            value: `−${fmt(row.adelantos)}`,                     color: row.adelantos > 0 ? '#f59e0b' : 'var(--muted)',          skip: row.adelantos === 0 },
            ].filter(r => !r.skip).map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ color, fontWeight: '600' }}>{value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '7px', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
              <span style={{ color: 'var(--muted)' }}>Total a pagar</span>
              <span style={{ color: 'var(--text)', fontSize: '14px' }}>{fmt(row.totalAPagar)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Pagado</span>
              <span style={{ color: row.pagado > 0 ? '#4ade80' : 'var(--muted)', fontWeight: '600' }}>{fmt(row.pagado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', paddingTop: '2px' }}>
              <span style={{ color: 'var(--muted)' }}>Pendiente</span>
              <span style={{ color: row.pendiente > 0 ? '#ff9966' : row.pendiente < 0 ? '#60a5fa' : '#4ade80' }}>
                {fmt(row.pendiente)}
              </span>
            </div>
          </div>
        </div>

        {/* Movimientos por grupo */}
        {Object.entries(byType).map(([type, entries]) => {
          if (entries.length === 0) return null
          return (
            <div key={type} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {groupLabel[type]}
              </div>
              {entries.map(e => (
                <MovementRow key={e.id} entry={e} onVoid={onVoid} />
              ))}
            </div>
          )
        })}

        {/* Envíos asignados (solo delivery, calculados desde orders) */}
        {row.salaryType === 'delivery' && row.deliveryOrders && row.deliveryOrders.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Envios asignados
            </div>
            {row.deliveryOrders.map((o, i) => (
              <div key={o.id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: '12px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {fmtShort(o.businessDate)}
                    {(o.displayOrderCode || o.orderCode) ? ` · ${o.displayOrderCode || o.orderCode}` : ''}
                  </div>
                  {o.customerName && (
                    <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '1px' }}>{o.customerName}</div>
                  )}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#4ade80', flexShrink: 0 }}>
                  +{fmt(o.deliveryPayout)}
                </span>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>
              Para corregir un envio, edita el pedido directamente.
            </div>
          </div>
        )}

        {/* Anulados */}
        {voided.length > 0 && (
          <div style={{ padding: '12px 20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,107,107,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Anulados (no impactan calculo)
            </div>
            {voided.map(e => <MovementRow key={e.id} entry={e} voided />)}
          </div>
        )}

        {active.length === 0 && voided.length === 0 && (
          <div style={{ padding: '20px', color: 'var(--muted)', fontSize: '13px' }}>
            Sin movimientos en esta semana.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card de empleado ─────────────────────────────────────────────────────────

// Métricas de consumo unificadas: créditos cubren comida staff + cuenta interna.
// Solo el excedente no cubierto impacta el sueldo.
function consumoMetrics(row) {
  if (row.consumoTotalAsignado === 0 && row.creditosComida === 0) return []
  return [
    ...(row.consumosStaff > 0      ? [{ label: 'Comida staff',      value: fmt(row.consumosStaff),       color: 'var(--text)' }] : []),
    ...(row.cuentaInterna > 0      ? [{ label: 'Cuenta interna',    value: fmt(row.cuentaInterna),       color: 'var(--text)' }] : []),
    ...(row.creditosComida > 0     ? [{ label: 'Créditos',          value: `−${fmt(row.creditosComida)}`, color: '#4ade80'     }] : []),
    { label: 'A descontar',         value: fmt(row.consumoADescontar), color: row.consumoADescontar > 0 ? '#ff9966' : 'var(--muted)' },
    ...(row.adelantos > 0          ? [{ label: 'Adelantos',         value: fmt(row.adelantos),            color: '#f59e0b'     }] : []),
  ]
}

function EmployeeCard({ row, weekRange, user, onAction }) {
  const isPending  = row.pendiente > 0
  const isPaid     = row.estado === 'pagado'
  const noSalary   = row.estado === 'sin_sueldo'
  const noTurnos   = row.estado === 'sin_turnos'
  const noJornadas = row.estado === 'sin_jornadas'
  const isFavor    = row.estado === 'a_favor_negocio'
  const isShift    = row.salaryType === 'shift'
  const isDelivery = row.salaryType === 'delivery'

  const canPayAll  = row.pendiente > 0

  // Borde izquierdo por estado
  const borderColor = isPending ? 'rgba(255,150,50,0.5)'
    : isPaid    ? 'rgba(74,222,128,0.35)'
    : isFavor   ? 'rgba(96,165,250,0.35)'
    : 'rgba(255,255,255,0.1)'

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 'var(--radius)', marginBottom: '10px',
      padding: '14px 16px',
    }}>
      {/* Fila superior: nombre + estado + pendiente */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
            {row.employeeName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line)', borderRadius: '4px', padding: '1px 7px' }}>
              {row.employeeRole}
            </span>
            <EstadoBadge estado={row.estado} />
          </div>
        </div>
        {/* Pendiente destacado */}
        {isPending && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,150,50,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
              Pendiente
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#ff9966', lineHeight: 1 }}>
              {fmt(row.pendiente)}
            </div>
          </div>
        )}
        {isPaid && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'rgba(74,222,128,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
              Pagado
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#4ade80', lineHeight: 1 }}>
              {fmt(row.pagado)}
            </div>
          </div>
        )}
        {isFavor && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'rgba(96,165,250,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
              A favor
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#60a5fa', lineHeight: 1 }}>
              {fmt(Math.abs(row.pendiente))}
            </div>
          </div>
        )}
      </div>

      {/* Grid de métricas */}
      {!noSalary && !noTurnos && !noJornadas && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          marginBottom: '12px',
        }}>
          {(isDelivery ? [
            { label: 'Jornadas',        value: String(row.deliveryShiftsCount), color: 'var(--y)' },
            { label: 'Base jornadas',   value: fmt(row.deliveryBaseTotal),       color: 'var(--text)' },
            { label: 'Envios',          value: fmt(row.deliveryPayoutTotal),     color: 'var(--text)' },
            { label: 'Sueldo generado', value: fmt(row.sueldoBase),              color: 'var(--text)' },
            { label: 'Total a pagar',   value: fmt(row.totalAPagar),             color: 'var(--text)' },
            { label: 'Pagado',          value: fmt(row.pagado),                  color: row.pagado > 0 ? '#4ade80' : 'var(--muted)' },
            ...consumoMetrics(row),
          ] : isShift ? [
            { label: 'Pago por turno',    value: fmt(row.shiftRate),           color: 'var(--text)' },
            { label: 'Turnos trabajados', value: String(row.turnosTrabajados), color: 'var(--y)' },
            { label: 'Sueldo generado',   value: fmt(row.sueldoBase),          color: 'var(--text)' },
            { label: 'Total a pagar',     value: fmt(row.totalAPagar),         color: 'var(--text)' },
            { label: 'Pagado',            value: fmt(row.pagado),              color: row.pagado > 0 ? '#4ade80' : 'var(--muted)' },
            ...consumoMetrics(row),
          ] : [
            { label: 'Sueldo base',   value: fmt(row.sueldoBase),  color: 'var(--text)' },
            { label: 'Total a pagar', value: fmt(row.totalAPagar), color: 'var(--text)' },
            { label: 'Pagado',        value: fmt(row.pagado),      color: row.pagado > 0 ? '#4ade80' : 'var(--muted)' },
            ...consumoMetrics(row),
          ]).map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px', padding: '7px 8px',
            }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                {label}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {noSalary && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
          Sin sueldo configurado. Edita el empleado para asignar un sueldo base.
        </div>
      )}

      {noTurnos && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
          Sin turnos cargados esta semana.
          {row.shiftRate > 0
            ? ` Pago por turno configurado: $${row.shiftRate.toLocaleString('es-AR')}.`
            : ' Configura el pago por turno en el empleado.'}
        </div>
      )}

      {noJornadas && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
          Sin jornadas ni envios esta semana. Registra una jornada o asigna pedidos delivery a este empleado.
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {isDelivery && (
          <button type="button" onClick={() => onAction('deliveryshift', row)} style={actionBtnStyle(true, true)}>
            Jornada
          </button>
        )}
        {isShift && (
          <button type="button" onClick={() => onAction('workshift', row)} style={actionBtnStyle(true, true)}>
            Turno
          </button>
        )}
        <button type="button" onClick={() => onAction('advance', row)} style={actionBtnStyle(false)}>
          Adelanto
        </button>
        <button type="button" onClick={() => onAction('payment', row)} style={actionBtnStyle(false)}>
          Pago
        </button>
        <button
          type="button"
          onClick={() => canPayAll && onAction('markpaid', row)}
          disabled={!canPayAll}
          style={actionBtnStyle(canPayAll, canPayAll)}
        >
          Pagar todo
        </button>
        <button type="button" onClick={() => onAction('detail', row)} style={actionBtnStyle(false)}>
          Detalle
        </button>
      </div>
    </div>
  )
}

function actionBtnStyle(highlight, enabled = true) {
  if (!enabled) {
    return {
      padding: '5px 12px', fontSize: '12px', fontWeight: '600',
      borderRadius: '6px', cursor: 'not-allowed', whiteSpace: 'nowrap',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.2)',
    }
  }
  if (highlight) {
    return {
      padding: '5px 12px', fontSize: '12px', fontWeight: '700',
      borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
      background: 'rgba(255,198,42,0.15)', border: '1px solid rgba(255,198,42,0.4)',
      color: 'var(--y)',
    }
  }
  return {
    padding: '5px 12px', fontSize: '12px', fontWeight: '600',
    borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line)',
    color: 'var(--muted)',
  }
}

// ─── Cards resumen ────────────────────────────────────────────────────────────

function SummaryCards({ totals, sinSueldoCount }) {
  const cards = [
    {
      label: 'Total a pagar',
      value: fmt(totals.totalAPagar),
      color: 'var(--text)',
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.1)',
    },
    {
      label: 'Pendiente',
      value: fmt(totals.totalPendiente),
      color: totals.totalPendiente > 0 ? '#ff9966' : '#4ade80',
      bg: totals.totalPendiente > 0 ? 'rgba(255,150,50,0.07)' : 'rgba(74,222,128,0.06)',
      border: totals.totalPendiente > 0 ? 'rgba(255,150,50,0.3)' : 'rgba(74,222,128,0.25)',
    },
    {
      label: 'Pagado',
      value: fmt(totals.totalPagado),
      color: totals.totalPagado > 0 ? '#4ade80' : 'var(--muted)',
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.1)',
    },
    {
      label: 'Adelantos',
      value: fmt(totals.totalAdelantos),
      color: totals.totalAdelantos > 0 ? '#f59e0b' : 'var(--muted)',
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.1)',
    },
  ]

  if (sinSueldoCount > 0) {
    cards.push({
      label: 'Sin sueldo',
      value: String(sinSueldoCount),
      color: 'rgba(255,255,255,0.35)',
      bg: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
      gap: '8px',
      marginBottom: '20px',
    }}>
      {cards.map(({ label, value, color, bg, border }) => (
        <div key={label} style={{
          background: bg, border: `1px solid ${border}`,
          borderRadius: 'var(--radius)', padding: '12px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
            {label}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PayrollDashboard principal ───────────────────────────────────────────────

export function PayrollDashboard({ staffMembers, weekLedger, loadingLedger, staffWeek, user, onVoidEntry, orders = [] }) {
  const [modal, setModal]       = useState(null)
  const [feedback, setFeedback] = useState('')

  const weekRange = {
    monday: staffWeek.startDate,
    sunday: staffWeek.endDate,
    label: `${fmtFull(staffWeek.startDate)} — ${fmtFull(staffWeek.endDate)}`,
  }

  const normalizedMembers = useMemo(
    () => staffMembers.map(normalizeStaffMember),
    [staffMembers]
  )

  const summary = useMemo(
    () => calculatePayrollSummary(normalizedMembers, weekLedger, weekRange, orders),
    [normalizedMembers, weekLedger, weekRange, orders]
  )

  const sinSueldoCount = summary.rows.filter(r => r.estado === 'sin_sueldo' || r.estado === 'sin_turnos' || r.estado === 'sin_jornadas').length

  // Ordenar: pendiente primero, luego sin_sueldo al fondo
  const sortedRows = useMemo(() => {
    const order = { pendiente: 0, a_favor_negocio: 1, pagado: 2, sin_sueldo: 3, sin_turnos: 3, sin_jornadas: 3 }
    return [...summary.rows].sort((a, b) => {
      const oa = order[a.estado] ?? 99
      const ob = order[b.estado] ?? 99
      if (oa !== ob) return oa - ob
      return b.pendiente - a.pendiente
    })
  }, [summary.rows])

  function openModal(type, row) { setModal({ type, row }); setFeedback('') }
  function closeModal()         { setModal(null) }

  function handleDone() {
    closeModal()
    setFeedback('Guardado correctamente.')
    setTimeout(() => setFeedback(''), 3000)
  }

  if (loadingLedger) {
    return <div style={{ padding: '32px 0', color: 'var(--muted)', fontSize: '14px' }}>Cargando liquidacion...</div>
  }

  if (staffMembers.length === 0) {
    return <div style={{ padding: '32px 0', color: 'var(--muted)', fontSize: '14px' }}>No hay empleados activos. Crealos en la pestana Empleados.</div>
  }

  return (
    <div>
      {/* Feedback */}
      {feedback && (
        <div style={{
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 'var(--radius)', fontSize: '13px', color: '#4ade80', fontWeight: '600',
        }}>{feedback}</div>
      )}

      {/* Semana info */}
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
        {weekRange.label}
      </div>

      {/* Cards resumen */}
      <SummaryCards totals={summary.totals} sinSueldoCount={sinSueldoCount} />

      {/* Lista de empleados */}
      {sortedRows.map(row => (
        <EmployeeCard
          key={row.employeeId}
          row={row}
          weekRange={weekRange}
          user={user}
          onAction={openModal}
        />
      ))}

      {/* Modales */}
      {modal?.type === 'deliveryshift' && (
        <ModalDeliveryShift employee={modal.row} weekRange={weekRange} weekLedger={weekLedger} user={user}
          onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'workshift' && (
        <ModalWorkShift employee={modal.row} weekRange={weekRange} user={user}
          onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'advance' && (
        <ModalAdvance employee={modal.row} weekRange={weekRange} user={user}
          onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'payment' && (
        <ModalPayment employee={modal.row} weekRange={weekRange} user={user}
          onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'markpaid' && (
        <ModalMarkPaid employee={modal.row} weekRange={weekRange} user={user}
          onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'detail' && (
        <ModalDetail row={modal.row} weekRange={weekRange}
          onClose={closeModal}
          onVoid={(entry) => { closeModal(); onVoidEntry(entry) }} />
      )}
    </div>
  )
}
