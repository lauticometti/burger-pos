import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStaffMembers } from '../hooks/useStaffMembers'
import { addStaffLedgerEntry, getWeekId } from '../utils/staffLedger'
import { STAFF_SHIFT_CREDIT } from '../data/staffMenu'
import { todayStr } from '../utils/printing'

const STAFF_ROLES = [
  { value: 'cocina',   label: 'Cocina' },
  { value: 'caja',     label: 'Caja' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'dueño',    label: 'Dueño' },
  { value: 'otro',     label: 'Otro' },
]

const labelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '8px',
}

const cardStyle = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  padding: '20px',
  marginBottom: '20px',
}

const MOVEMENT_LABELS = {
  credit_shift_meal: 'Crédito turno',
  debit_staff_meal: 'Consumo staff',
  payroll_deduction: 'Descuento sueldo',
  adjustment: 'Ajuste',
}

export function StaffDashboard({ onBack, user }) {
  const { staffMembers: allStaffMembers, loadingStaff, createStaffMember, updateStaffMember } = useStaffMembers({ includeInactive: true })
  // staffMembers = solo activos (para créditos, resúmenes, lógica existente)
  const staffMembers = allStaffMembers.filter(m => m.active !== false)

  const [activeTab, setActiveTab] = useState('resumen')
  const [weekLedger, setWeekLedger] = useState([])
  const [loadingLedger, setLoadingLedger] = useState(true)
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState('cocina')
  const [creditLoadingShift, setCreditLoadingShift] = useState(null)
  const [creditSaving, setCreditSaving] = useState(null)
  const [error, setError] = useState('')
  const [voidingEntry, setVoidingEntry] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)

  // Gestión empleados
  const [editingMember, setEditingMember] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('otro')
  const [editSaving, setEditSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const today = todayStr()
  const currentWeekId = getWeekId(today)

  useEffect(() => {
    const q = query(collection(db, 'staffLedger'), where('weekId', '==', currentWeekId))
    const unsub = onSnapshot(q, (snap) => {
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setWeekLedger(entries)
      setLoadingLedger(false)
    }, (err) => {
      console.error('StaffDashboard ledger error:', err)
      setLoadingLedger(false)
    })
    return () => unsub()
  }, [currentWeekId])

  const staffRoleMap = {}
  for (const m of staffMembers) staffRoleMap[m.name] = m.role || 'otro'

  const weeklySummaryMap = {}
  const deliverySummaryMap = {}

  for (const entry of weekLedger) {
    if (entry.voided === true) continue
    const name = entry.staffName
    const role = staffRoleMap[name] ?? 'otro'
    const amt = Number(entry.amount ?? 0)

    if (role === 'delivery') {
      if (entry.businessDate !== today) continue
      if (!deliverySummaryMap[name]) deliverySummaryMap[name] = { creditos: 0, consumos: 0, descuentos: 0 }
      if (entry.movementType === 'credit_shift_meal') deliverySummaryMap[name].creditos += amt
      else if (entry.movementType === 'debit_staff_meal') deliverySummaryMap[name].consumos += amt
      else if (entry.movementType === 'payroll_deduction') deliverySummaryMap[name].descuentos += amt
    } else {
      if (!weeklySummaryMap[name]) weeklySummaryMap[name] = { creditos: 0, consumos: 0, descuentos: 0 }
      if (entry.movementType === 'credit_shift_meal') weeklySummaryMap[name].creditos += amt
      else if (entry.movementType === 'debit_staff_meal') weeklySummaryMap[name].consumos += amt
      else if (entry.movementType === 'payroll_deduction') weeklySummaryMap[name].descuentos += amt
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

  async function handleConfirmCreditShift(staffName, shift) {
    setCreditSaving(staffName)
    setCreditLoadingShift(null)
    setError('')
    try {
      const q = query(collection(db, 'staffLedger'), where('businessDate', '==', today))
      const snap = await getDocs(q)
      const alreadyExists = snap.docs.some(d => {
        const e = d.data()
        return e.staffName === staffName
          && e.movementType === 'credit_shift_meal'
          && e.shift === shift
      })
      if (alreadyExists) {
        const shiftLabel = shift === 'mediodia' ? 'mediodía' : 'noche'
        setError(`${staffName} ya tiene crédito cargado para el turno ${shiftLabel} de hoy.`)
        return
      }
      await addStaffLedgerEntry({
        businessDate: today,
        staffName,
        movementType: 'credit_shift_meal',
        amount: STAFF_SHIFT_CREDIT,
        shift,
        orderCode: '',
        orderId: '',
        note: `Crédito turno ${shift === 'mediodia' ? 'mediodía' : 'noche'}`,
      }, user)
    } catch (err) {
      console.error('Error cargando crédito:', err)
      setError(`No se pudo cargar el crédito para ${staffName}.`)
    } finally {
      setCreditSaving(null)
    }
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
    setEditSaving(true)
    setError('')
    try {
      await updateStaffMember(editingMember.id, { name: editName.trim(), role: editRole }, user)
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
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ← Volver
          </button>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '20px', fontWeight: '700' }}>
              Staff
            </h2>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Semana {currentWeekId}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { key: 'resumen', label: 'Resumen' },
            { key: 'empleados', label: 'Empleados' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius)',
                border: activeTab === tab.key ? '1px solid rgba(255,198,42,0.5)' : '1px solid var(--line)',
                background: activeTab === tab.key ? 'rgba(255,198,42,0.12)' : 'transparent',
                color: activeTab === tab.key ? 'var(--y)' : 'var(--muted)',
                fontWeight: activeTab === tab.key ? '700' : '400',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: 'var(--radius)', padding: '10px 14px', color: '#ff6b6b',
            fontSize: '13px', marginBottom: '16px',
          }}>
            {error}
          </div>
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
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '6px' }}>
                Anular movimiento
              </div>
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
                >
                  {voidSaving ? 'Anulando...' : 'Confirmar anulación'}
                </button>
                <button
                  onClick={() => { setVoidingEntry(null); setVoidReason('') }}
                  disabled={voidSaving}
                  style={{
                    padding: '10px 14px', fontSize: '13px',
                    background: 'transparent', border: '1px solid var(--line)',
                    color: 'var(--muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal edición empleado */}
        {editingMember && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '24px', maxWidth: '360px', width: '100%',
            }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', marginBottom: '16px' }}>
                Editar empleado
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !editSaving && handleEditSave()}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius)', color: 'var(--text)',
                    padding: '10px 12px', fontSize: '14px',
                  }}
                />
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius)', color: 'var(--text)',
                    padding: '10px 12px', fontSize: '14px',
                  }}
                >
                  {STAFF_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={handleEditSave}
                  disabled={!editName.trim() || editSaving}
                  style={{
                    flex: 1, padding: '10px', fontWeight: '700', fontSize: '13px',
                    background: editName.trim() && !editSaving ? 'var(--y)' : 'rgba(255,255,255,0.04)',
                    border: 'none',
                    color: editName.trim() && !editSaving ? '#000' : 'var(--muted)',
                    borderRadius: 'var(--radius)', cursor: editName.trim() && !editSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditingMember(null)}
                  disabled={editSaving}
                  style={{
                    padding: '10px 14px', fontSize: '13px',
                    background: 'transparent', border: '1px solid var(--line)',
                    color: 'var(--muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: RESUMEN ===== */}
        {activeTab === 'resumen' && (
          <>
            {/* Empleados activos y crédito de turno */}
            <div style={cardStyle}>
              <label style={labelStyle}>Empleados activos</label>

              {loadingStaff ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
              ) : staffMembers.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>
                  No hay empleados registrados.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {staffMembers.map(m => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '600' }}>
                          {m.name}
                        </span>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          color: 'var(--muted)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--line)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                        }}>
                          {m.role || 'otro'}
                        </span>
                      </div>

                      {creditSaving === m.name ? (
                        <span style={{ color: 'var(--muted)', fontSize: '12px', flexShrink: 0 }}>
                          Cargando...
                        </span>
                      ) : creditLoadingShift === m.name ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Turno:</span>
                          <button
                            onClick={() => handleConfirmCreditShift(m.name, 'mediodia')}
                            style={{
                              padding: '5px 10px',
                              background: 'rgba(255,198,42,0.15)',
                              border: '1px solid rgba(255,198,42,0.3)',
                              color: 'var(--y)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            Mediodía
                          </button>
                          <button
                            onClick={() => handleConfirmCreditShift(m.name, 'noche')}
                            style={{
                              padding: '5px 10px',
                              background: 'rgba(255,198,42,0.15)',
                              border: '1px solid rgba(255,198,42,0.3)',
                              color: 'var(--y)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            Noche
                          </button>
                          <button
                            onClick={() => setCreditLoadingShift(null)}
                            style={{
                              padding: '5px 8px',
                              background: 'transparent',
                              border: '1px solid var(--line)',
                              color: 'var(--muted)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setError(''); setCreditLoadingShift(m.name) }}
                          style={{
                            padding: '6px 14px',
                            background: 'rgba(255,198,42,0.15)',
                            border: '1px solid rgba(255,198,42,0.3)',
                            color: 'var(--y)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            flexShrink: 0,
                          }}
                        >
                          + Crédito turno (${STAFF_SHIFT_CREDIT.toLocaleString('es-AR')})
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showCreateStaff ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Nombre del empleado"
                      value={newStaffName}
                      onChange={e => setNewStaffName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStaff())}
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                        padding: '10px 12px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={newStaffRole}
                      onChange={e => setNewStaffRole(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                        padding: '10px 12px',
                        fontSize: '14px',
                      }}
                    >
                      {STAFF_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleCreateStaff}
                      style={{
                        padding: '10px 16px', background: 'var(--y)', color: '#000',
                        border: 'none', borderRadius: 'var(--radius)', fontWeight: '700',
                        cursor: 'pointer', fontSize: '13px',
                      }}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setShowCreateStaff(false)}
                      style={{
                        padding: '10px 12px', background: 'transparent', color: 'var(--muted)',
                        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                        cursor: 'pointer', fontSize: '13px',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateStaff(true)}
                  style={{
                    padding: '8px 14px', background: 'transparent', color: 'var(--muted)',
                    border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)',
                    cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  + Agregar empleado
                </button>
              )}
            </div>

            {/* Staff Semanal */}
            <div style={cardStyle}>
              <label style={labelStyle}>Staff semanal — semana {currentWeekId}</label>

              {loadingLedger ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
              ) : weeklyNames.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Sin movimientos esta semana.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Empleado', 'Rol', 'Créditos semana', 'Consumos', 'A descontar lunes', 'Saldo comida'].map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 10px',
                            textAlign: i < 2 ? 'left' : 'right',
                            color: 'var(--muted)',
                            fontWeight: '600',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyNames.map(name => {
                        const s = weeklySummaryMap[name] ?? { creditos: 0, consumos: 0, descuentos: 0 }
                        const saldo = s.creditos - s.consumos
                        const role = staffRoleMap[name] ?? 'otro'
                        return (
                          <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: '600', textAlign: 'left' }}>
                              {name}
                            </td>
                            <td style={{ padding: '10px 10px', color: 'var(--muted)', fontSize: '12px', textAlign: 'left' }}>
                              {role}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                              {s.creditos > 0 ? `$${s.creditos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                              {s.consumos > 0 ? `$${s.consumos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: s.descuentos > 0 ? '#ff6b6b' : 'var(--muted)' }}>
                              {s.descuentos > 0 ? `$${s.descuentos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{
                              padding: '10px 10px', textAlign: 'right',
                              color: saldo < 0 ? '#ff6b6b' : saldo > 0 ? 'var(--y)' : 'var(--muted)',
                              fontWeight: '700',
                            }}>
                              {saldo !== 0 ? `$${saldo.toLocaleString('es-AR')}` : '$0'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Delivery Diario */}
            <div style={cardStyle}>
              <label style={labelStyle}>Delivery diario — {today}</label>

              {loadingLedger ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
              ) : deliveryNames.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Sin deliveries registrados.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Delivery', 'Créditos hoy', 'Consumos hoy', 'A descontar hoy', 'Saldo del día'].map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 10px',
                            textAlign: i === 0 ? 'left' : 'right',
                            color: 'var(--muted)',
                            fontWeight: '600',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryNames.map(name => {
                        const s = deliverySummaryMap[name] ?? { creditos: 0, consumos: 0, descuentos: 0 }
                        const saldo = s.creditos - s.consumos
                        return (
                          <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: '600', textAlign: 'left' }}>
                              {name}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                              {s.creditos > 0 ? `$${s.creditos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                              {s.consumos > 0 ? `$${s.consumos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: s.descuentos > 0 ? '#ff6b6b' : 'var(--muted)' }}>
                              {s.descuentos > 0 ? `$${s.descuentos.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{
                              padding: '10px 10px', textAlign: 'right',
                              color: saldo < 0 ? '#ff6b6b' : saldo > 0 ? 'var(--y)' : 'var(--muted)',
                              fontWeight: '700',
                            }}>
                              {saldo !== 0 ? `$${saldo.toLocaleString('es-AR')}` : '$0'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Movimientos recientes */}
            {weekLedger.length > 0 && (
              <div style={cardStyle}>
                <label style={labelStyle}>Movimientos de la semana</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[...weekLedger]
                    .sort((a, b) => {
                      const ta = a.createdAt?.toDate?.() ?? new Date(0)
                      const tb = b.createdAt?.toDate?.() ?? new Date(0)
                      return tb - ta
                    })
                    .map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          gap: '12px',
                          opacity: entry.voided ? 0.45 : 1,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>
                            {entry.staffName}
                            <span style={{
                              marginLeft: '8px', fontSize: '11px', fontWeight: '400',
                              color: entry.movementType === 'credit_shift_meal' ? 'var(--y)' : 'var(--muted)',
                            }}>
                              {MOVEMENT_LABELS[entry.movementType] ?? entry.movementType}
                              {entry.shift ? ` · turno ${entry.shift === 'mediodia' ? 'mediodía' : entry.shift}` : ''}
                            </span>
                            {entry.voided && (
                              <span style={{
                                marginLeft: '8px', fontSize: '10px', fontWeight: '700',
                                color: '#ff6b6b', letterSpacing: '0.05em',
                              }}>
                                ANULADO
                              </span>
                            )}
                          </div>
                          {entry.note && (
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                              {entry.note}
                            </div>
                          )}
                          {entry.voided && entry.voidReason && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,107,107,0.6)', marginTop: '2px' }}>
                              Motivo: {entry.voidReason}
                            </div>
                          )}
                          {entry.orderCode && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                              {entry.orderCode} · {entry.businessDate}
                            </div>
                          )}
                          {!entry.orderCode && entry.businessDate && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                              {entry.businessDate}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <div style={{
                            fontSize: '14px', fontWeight: '700',
                            color: entry.movementType === 'credit_shift_meal' ? 'var(--y)' : '#ff9966',
                            whiteSpace: 'nowrap',
                          }}>
                            {entry.movementType === 'credit_shift_meal' ? '+' : '−'}${Number(entry.amount ?? 0).toLocaleString('es-AR')}
                          </div>
                          {!entry.voided && (
                            <button
                              onClick={() => { setError(''); setVoidingEntry(entry); setVoidReason('') }}
                              style={{
                                fontSize: '11px', color: '#ff6b6b',
                                background: 'transparent',
                                border: '1px solid rgba(255,107,107,0.3)',
                                borderRadius: '4px', padding: '2px 8px',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== TAB: EMPLEADOS ===== */}
        {activeTab === 'empleados' && (
          <div style={cardStyle}>
            <label style={labelStyle}>
              Todos los empleados ({allStaffMembers.length})
            </label>

            {loadingStaff ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando...</div>
            ) : allStaffMembers.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                No hay empleados registrados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allStaffMembers.map(m => {
                  const isActive = m.active !== false
                  const isToggling = togglingId === m.id
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        gap: '12px',
                        opacity: isActive ? 1 : 0.5,
                      }}
                    >
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '600' }}>
                            {m.name}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--muted)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--line)',
                            borderRadius: '4px',
                            padding: '1px 6px',
                          }}>
                            {m.role || 'otro'}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                            color: isActive ? '#4ade80' : '#ff6b6b',
                            background: isActive ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
                            border: `1px solid ${isActive ? 'rgba(74,222,128,0.3)' : 'rgba(255,107,107,0.3)'}`,
                            borderRadius: '4px',
                            padding: '1px 6px',
                          }}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        {m.createdByEmail && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                            Creado por {m.createdByEmail.split('@')[0]}
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(m)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--line)',
                            color: 'var(--muted)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(m)}
                          disabled={isToggling}
                          style={{
                            padding: '6px 12px',
                            background: isActive ? 'rgba(255,107,107,0.1)' : 'rgba(74,222,128,0.1)',
                            border: `1px solid ${isActive ? 'rgba(255,107,107,0.3)' : 'rgba(74,222,128,0.3)'}`,
                            color: isActive ? '#ff6b6b' : '#4ade80',
                            borderRadius: '6px',
                            cursor: isToggling ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            opacity: isToggling ? 0.5 : 1,
                          }}
                        >
                          {isToggling ? '...' : isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
