import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStaffMembers } from '../hooks/useStaffMembers'
import { STAFF_MENU_ITEMS } from '../data/staffMenu'
import { getWeekId } from '../utils/staffLedger'
import { todayStr } from '../utils/printing'

// UI purposes — staff_meal/staff_extra removed; only staff_consumption for new orders
const PURPOSES = [
  { value: 'test',              label: 'Prueba' },
  { value: 'staff_consumption', label: 'Pedido Staff' },
  { value: 'marketing_barter',  label: 'Canje marketing' },
  { value: 'owner_consumption', label: 'Consumo personal' },
]

const PURPOSE_RULES = {
  test:              { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, costResponsibility: 'none' },
  staff_consumption: { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, costResponsibility: 'business' },
  marketing_barter:  { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, costResponsibility: 'marketing' },
  owner_consumption: { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, costResponsibility: 'owner' },
}

const STAFF_ROLES = [
  { value: 'cocina',   label: 'Cocina' },
  { value: 'caja',     label: 'Caja' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'dueño',    label: 'Dueño' },
  { value: 'otro',     label: 'Otro' },
]

const GROUP_LABELS = {
  base:         'Base',
  mejora:       'Mejoras',
  burger_extra: 'Extras de burger',
  extra:        'Extras',
}
const GROUP_ORDER = ['base', 'mejora', 'burger_extra', 'extra']

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
}

export function InternalOrderForm({ cart, onSave, user }) {
  const { staffMembers, loadingStaff, createStaffMember } = useStaffMembers()

  const [orderPurpose, setOrderPurpose] = useState('test')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedStaffRole, setSelectedStaffRole] = useState('')
  const [freeRelatedPerson, setFreeRelatedPerson] = useState('')
  const [staffMenuSelections, setStaffMenuSelections] = useState({})
  const [internalNote, setInternalNote] = useState('')
  const [internalAmount, setInternalAmount] = useState('') // for marketing/owner only
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffInlineRole, setNewStaffInlineRole] = useState('cocina')
  const [staffBalance, setStaffBalance] = useState(null)   // null = not loaded
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isStaffPurpose = orderPurpose === 'staff_consumption'
  const isFreePurpose = orderPurpose === 'marketing_barter' || orderPurpose === 'owner_consumption'
  const isDelivery = selectedStaffRole === 'delivery'

  // Cart total (reference value for non-staff internal orders)
  const cartTotal = cart.reduce((sum, item) => {
    if (item.category === 'burger' || item.cartId)
      return sum + (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1)
    return sum + item.price * item.qty
  }, 0)

  // Staff menu total (calculated from selections)
  const staffMenuTotal = STAFF_MENU_ITEMS.reduce((sum, item) =>
    sum + (staffMenuSelections[item.id] ?? 0) * item.price, 0)

  // Staff balance calculations
  const saldoDisponible = Math.max(staffBalance ?? 0, 0)
  const saldoUsado = isStaffPurpose ? Math.min(staffMenuTotal, saldoDisponible) : 0
  const descuentoSueldo = isStaffPurpose ? Math.max(staffMenuTotal - saldoUsado, 0) : 0
  const saldoFinal = isStaffPurpose ? saldoDisponible - saldoUsado : 0

  // Reset state when purpose changes
  useEffect(() => {
    setStaffMenuSelections({})
    setSelectedStaff('')
    setSelectedStaffRole('')
    setFreeRelatedPerson('')
    setInternalAmount('')
    setStaffBalance(null)
    setError('')
  }, [orderPurpose])

  // Load staff balance when employee or role changes
  useEffect(() => {
    if (!isStaffPurpose || !selectedStaff) {
      setStaffBalance(null)
      return
    }
    setLoadingBalance(true)
    const today = todayStr()

    let q
    if (isDelivery) {
      // Delivery: scope to today only
      q = query(
        collection(db, 'staffLedger'),
        where('businessDate', '==', today),
        where('staffName', '==', selectedStaff)
      )
    } else {
      // Weekly staff: scope to current week
      const weekId = getWeekId(today)
      q = query(
        collection(db, 'staffLedger'),
        where('weekId', '==', weekId),
        where('staffName', '==', selectedStaff)
      )
    }

    getDocs(q)
      .then(snap => {
        const entries = snap.docs.map(d => d.data())
        const creditos = entries
          .filter(e => e.movementType === 'credit_shift_meal')
          .reduce((s, e) => s + Number(e.amount ?? 0), 0)
        const consumos = entries
          .filter(e => e.movementType === 'debit_staff_meal')
          .reduce((s, e) => s + Number(e.amount ?? 0), 0)
        setStaffBalance(creditos - consumos)
      })
      .catch(err => {
        console.error('Error loading staff balance:', err)
        setStaffBalance(0)
      })
      .finally(() => setLoadingBalance(false))
  }, [selectedStaff, isStaffPurpose, selectedStaffRole, isDelivery])

  function updateStaffMenuQty(itemId, delta) {
    setStaffMenuSelections(prev => {
      const current = prev[itemId] ?? 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: next }
    })
  }

  async function handleCreateStaff() {
    if (!newStaffName.trim()) return
    try {
      await createStaffMember(newStaffName.trim(), newStaffInlineRole, user)
      setSelectedStaff(newStaffName.trim())
      setSelectedStaffRole(newStaffInlineRole)
      setNewStaffName('')
      setNewStaffInlineRole('cocina')
      setShowCreateStaff(false)
    } catch (err) {
      console.error('Error creando empleado:', err)
      setError('No se pudo crear el empleado.')
    }
  }

  function validate() {
    if (isStaffPurpose) {
      if (!selectedStaff) return 'Seleccioná un empleado.'
      if (staffMenuTotal === 0) return 'Seleccioná al menos un item del menú staff.'
      if (!internalNote.trim()) return 'La nota interna es obligatoria.'
    } else if (isFreePurpose) {
      if (!freeRelatedPerson.trim()) return 'Ingresá el nombre o responsable.'
      if (!internalNote.trim()) return 'La nota interna es obligatoria.'
      const amt = parseFloat(internalAmount)
      if (isNaN(amt) || amt < 0) return 'El valor interno debe ser un número mayor o igual a 0.'
    } else if (orderPurpose === 'test') {
      if (!internalNote.trim()) return 'Describí el motivo de la prueba.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setError('')
    setLoading(true)

    const staffMenuItems = STAFF_MENU_ITEMS
      .filter(item => (staffMenuSelections[item.id] ?? 0) > 0)
      .map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: staffMenuSelections[item.id],
        lineTotal: item.price * staffMenuSelections[item.id],
      }))

    let formData

    if (isStaffPurpose) {
      formData = {
        customerName: selectedStaff,
        paymentMethod: 'interno',
        paymentStatus: 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose: 'staff_consumption',
        countsAsRevenue: false,
        affectsCash: false,
        affectsPayroll: descuentoSueldo > 0,
        costResponsibility: descuentoSueldo > 0 ? 'staff' : 'business',
        relatedPerson: selectedStaff,
        relatedPersonRole: selectedStaffRole || 'otro',
        internalNote,
        internalAmount: staffMenuTotal,
        saleValueAmount: 0,
        staffMenuItems,
        staffMenuTotal,
        staffCoveredAmount: saldoUsado,
        payrollDeductionAmount: descuentoSueldo,
        staffBalanceBefore: saldoDisponible,
        staffBalanceAfter: saldoFinal,
      }
    } else {
      const relatedPerson = orderPurpose === 'test' ? 'Sistema' : freeRelatedPerson.trim()
      formData = {
        customerName: relatedPerson || 'Interno',
        paymentMethod: 'interno',
        paymentStatus: 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose,
        relatedPerson,
        relatedPersonRole: '',
        internalNote,
        internalAmount: orderPurpose === 'test' ? 0 : (parseFloat(internalAmount) || 0),
        saleValueAmount: cartTotal,
        staffMenuItems: [],
        staffMenuTotal: 0,
        ...PURPOSE_RULES[orderPurpose],
      }
    }

    try {
      await onSave(formData)
    } catch (err) {
      console.error('Error guardando pedido interno:', err)
      setError('No se pudo guardar el pedido. Intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '32px 16px 120px',
    }}>
      <div style={{ width: '100%', maxWidth: '540px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,198,42,0.12)',
            border: '1px solid rgba(255,198,42,0.3)',
            color: 'var(--y)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}>
            PEDIDO INTERNO
          </div>
          {!isStaffPurpose && (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {cart.length} item{cart.length !== 1 ? 's' : ''} · ${cartTotal.toLocaleString('es-AR')}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PURPOSES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setOrderPurpose(p.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius)',
                    border: orderPurpose === p.value
                      ? '2px solid var(--y)'
                      : '2px solid rgba(255,255,255,0.1)',
                    background: orderPurpose === p.value
                      ? 'rgba(255,198,42,0.12)'
                      : 'transparent',
                    color: orderPurpose === p.value ? 'var(--y)' : 'var(--muted)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── PEDIDO STAFF ── */}
          {isStaffPurpose && (
            <>
              {/* Selector de empleado */}
              <div>
                <label style={labelStyle}>Empleado</label>
                {loadingStaff ? (
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando empleados...</div>
                ) : (
                  <>
                    {staffMembers.length === 0 && !showCreateStaff && (
                      <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '8px' }}>
                        No hay empleados registrados. Creá uno primero.
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {staffMembers.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaff(m.name)
                            setSelectedStaffRole(m.role || 'otro')
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 'var(--radius)',
                            border: selectedStaff === m.name
                              ? '2px solid var(--y)'
                              : '2px solid rgba(255,255,255,0.1)',
                            background: selectedStaff === m.name
                              ? 'rgba(255,198,42,0.12)'
                              : 'transparent',
                            color: selectedStaff === m.name ? 'var(--y)' : 'var(--muted)',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '2px',
                          }}
                        >
                          <span>{m.name}</span>
                          <span style={{ fontSize: '10px', opacity: 0.7, fontWeight: '400' }}>
                            {m.role || 'otro'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Saldo disponible */}
                    {selectedStaff && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        marginBottom: '4px',
                        paddingLeft: '2px',
                      }}>
                        {loadingBalance
                          ? 'Calculando saldo...'
                          : staffBalance !== null
                            ? <>
                                {isDelivery ? 'Saldo disponible hoy' : 'Saldo disponible esta semana'}:{' '}
                                <span style={{ color: saldoDisponible > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: '700' }}>
                                  ${saldoDisponible.toLocaleString('es-AR')}
                                </span>
                              </>
                            : null
                        }
                      </div>
                    )}
                  </>
                )}

                {/* Crear empleado inline */}
                {showCreateStaff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Nombre del empleado"
                        value={newStaffName}
                        onChange={e => setNewStaffName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStaff())}
                        style={{ ...inputStyle, flex: 1 }}
                        autoFocus
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={newStaffInlineRole}
                        onChange={e => setNewStaffInlineRole(e.target.value)}
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
                      <button type="button" onClick={handleCreateStaff} style={{
                        padding: '10px 16px', background: 'var(--y)', color: '#000',
                        border: 'none', borderRadius: 'var(--radius)', fontWeight: '700',
                        cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
                      }}>Guardar</button>
                      <button type="button" onClick={() => setShowCreateStaff(false)} style={{
                        padding: '10px 12px', background: 'transparent', color: 'var(--muted)',
                        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                        cursor: 'pointer', fontSize: '13px',
                      }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowCreateStaff(true)} style={{
                    padding: '6px 12px', background: 'transparent', color: 'var(--muted)',
                    border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)',
                    cursor: 'pointer', fontSize: '12px',
                  }}>+ Crear empleado</button>
                )}
              </div>

              {/* Staff Menu agrupado */}
              <div>
                <label style={labelStyle}>Qué se llevó</label>
                <div style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}>
                  {GROUP_ORDER.map((group, groupIdx) => {
                    const groupItems = STAFF_MENU_ITEMS.filter(i => i.group === group)
                    if (groupItems.length === 0) return null
                    return (
                      <div key={group}>
                        {/* Group header */}
                        <div style={{
                          padding: '6px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          borderTop: groupIdx > 0 ? '1px solid var(--line)' : 'none',
                          borderBottom: '1px solid var(--line)',
                          fontSize: '10px',
                          fontWeight: '700',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}>
                          {GROUP_LABELS[group]}
                        </div>
                        {groupItems.map((item, idx) => {
                          const qty = staffMenuSelections[item.id] ?? 0
                          return (
                            <div key={item.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderBottom: idx < groupItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              background: qty > 0 ? 'rgba(255,198,42,0.05)' : 'transparent',
                            }}>
                              <div>
                                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: qty > 0 ? '600' : '400' }}>
                                  {item.name}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>
                                  ${item.price.toLocaleString('es-AR')}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => updateStaffMenuQty(item.id, -1)}
                                  disabled={qty === 0}
                                  style={{
                                    width: '28px', height: '28px',
                                    background: qty > 0 ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: '1px solid var(--line)', borderRadius: '6px',
                                    color: qty > 0 ? 'var(--text)' : 'var(--muted)',
                                    cursor: qty > 0 ? 'pointer' : 'default',
                                    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >−</button>
                                <span style={{
                                  width: '20px', textAlign: 'center', fontSize: '14px',
                                  color: qty > 0 ? 'var(--y)' : 'var(--muted)',
                                  fontWeight: qty > 0 ? '700' : '400',
                                }}>{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateStaffMenuQty(item.id, 1)}
                                  style={{
                                    width: '28px', height: '28px',
                                    background: 'rgba(255,198,42,0.15)',
                                    border: '1px solid rgba(255,198,42,0.3)', borderRadius: '6px',
                                    color: 'var(--y)', cursor: 'pointer',
                                    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Resumen de cálculo (visible cuando hay items seleccionados) */}
              {staffMenuTotal > 0 && (
                <div style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Total consumo</span>
                    <span style={{ color: 'var(--text)', fontWeight: '600' }}>${staffMenuTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {isDelivery ? 'Saldo disponible hoy' : 'Saldo disponible esta semana'}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>${saldoDisponible.toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Cubierto con saldo</span>
                    <span style={{ color: 'var(--y)', fontWeight: '700' }}>${saldoUsado.toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {isDelivery ? 'A descontar hoy' : 'A descontar lunes'}
                    </span>
                    <span style={{ color: descuentoSueldo > 0 ? '#ff9966' : 'var(--muted)', fontWeight: '700' }}>
                      ${descuentoSueldo.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Saldo final</span>
                    <span style={{ color: saldoFinal < 0 ? '#ff6b6b' : 'var(--y)', fontWeight: '700' }}>
                      ${saldoFinal.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── MARKETING / OWNER ── */}
          {isFreePurpose && (
            <>
              <div>
                <label style={labelStyle}>Persona / Responsable</label>
                <input
                  type="text"
                  placeholder="Nombre o razón social"
                  value={freeRelatedPerson}
                  onChange={e => setFreeRelatedPerson(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Valor interno</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={internalAmount}
                    onChange={e => setInternalAmount(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '24px' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Nota interna (todos los tipos) */}
          <div>
            <label style={labelStyle}>
              Nota interna{orderPurpose === 'test' ? ' (motivo de la prueba)' : ''}
            </label>
            <textarea
              rows={2}
              placeholder={orderPurpose === 'test' ? 'Describí qué se está probando...' : 'Descripción o motivo...'}
              value={internalNote}
              onChange={e => setInternalNote(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }}
            />
          </div>

          {/* Resumen general (no-staff) */}
          {!isStaffPurpose && (
            <div style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              fontSize: '13px',
              color: 'var(--muted)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Valor venta (referencia)</span>
                <span style={{ color: 'var(--text)' }}>${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Valor interno {orderPurpose === 'test' ? '(sin cargo)' : ''}</span>
                <span style={{ color: orderPurpose === 'test' ? 'var(--muted)' : 'var(--y)', fontWeight: '600' }}>
                  {orderPurpose === 'test' ? '$0' : `$${(parseFloat(internalAmount) || 0).toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(255,80,80,0.1)',
              border: '1px solid rgba(255,80,80,0.3)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: '#ff6b6b',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(255,255,255,0.08)' : 'var(--y)',
              color: loading ? 'var(--muted)' : '#000',
              fontWeight: 'bold',
              padding: '16px',
              borderRadius: 'var(--radius)',
              border: 'none',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Guardando...' : 'Confirmar pedido interno'}
          </button>
        </form>
      </div>
    </div>
  )
}
