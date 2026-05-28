import { useState, useEffect } from 'react'
import { sortCartItems } from '../utils/cartSort'
import { getItemDisplayName, getItemLineTotal, calcOrderTotals } from '../utils/orderUtils'
import { useStaffMembers } from '../hooks/useStaffMembers'

const BTN_BASE = {
  flex: 1, padding: '12px 8px', borderRadius: 'var(--radius)',
  border: '2px solid transparent', fontSize: '13px',
  fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.1s',
}

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{
        display: 'block', fontSize: '13px', fontWeight: '600',
        color: 'var(--muted)', marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt.value
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
              ...BTN_BASE,
              background: active ? 'var(--y)' : 'rgba(255,255,255,0.04)',
              color: active ? '#000' : 'var(--text)',
              border: active ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)',
            }}>{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

const DELIVERY_SURCHARGE_PRESETS = [0, 1000, 1500, 2000, 2500, 3000, 3500, 4000]
const DELIVERY_PAYOUT_PRESETS = [1000, 1500, 2000, 2500, 3000, 3500, 4000]

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '16px',
  border: '2px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius)',
  background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: 'var(--muted)', marginBottom: '8px',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export function OrderForm({ cart, onSave }) {
  const { staffMembers } = useStaffMembers()
  const deliveryStaff = staffMembers.filter(m => m.role === 'delivery' && m.active !== false)

  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [paymentStatus, setPaymentStatus] = useState('pagado')
  const [orderType, setOrderType] = useState('local')
  const [notes, setNotes] = useState('')
  const [kitchenNote, setKitchenNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Miti miti
  const [mitiTransf, setMitiTransf] = useState('')
  const [mitiEfect, setMitiEfect] = useState('')
  const [mitiDeuda, setMitiDeuda] = useState('')

  // Delivery
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryAddressDetails, setDeliveryAddressDetails] = useState('')
  const [deliverySurcharge, setDeliverySurcharge] = useState(0)
  const [deliverySurchargeManual, setDeliverySurchargeManual] = useState('')
  const [deliverySurchargeMode, setDeliverySurchargeMode] = useState('preset') // 'preset' | 'manual'
  const [deliveryPayout, setDeliveryPayout] = useState(0)
  const [deliveryPayoutManual, setDeliveryPayoutManual] = useState('')
  const [deliveryPayoutMode, setDeliveryPayoutMode] = useState('preset')
  const [assignedDeliveryType, setAssignedDeliveryType] = useState('unassigned')
  const [assignedDeliveryId, setAssignedDeliveryId] = useState('')
  const [assignedDeliveryName, setAssignedDeliveryName] = useState('')

  // Descuento manual
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')

  const isDelivery = orderType === 'delivery'

  // Calcular totales en vivo
  const formDataForCalc = {
    discountType, discountValue: Number(discountValue) || 0,
    deliverySurcharge: isDelivery ? deliverySurcharge : 0,
    deliveryPayout: isDelivery ? deliveryPayout : 0,
  }
  const { grossTotal, discountAmount, total, netRevenue } = calcOrderTotals(cart, formDataForCalc)

  // Reset delivery cuando cambia orderType
  useEffect(() => {
    if (!isDelivery) {
      setDeliverySurcharge(0)
      setDeliveryPayout(0)
      setAssignedDeliveryType('unassigned')
      setAssignedDeliveryId('')
      setAssignedDeliveryName('')
      setDeliveryAddress('')
      setDeliveryAddressDetails('')
    }
  }, [isDelivery])

  // Reset kitchenNote global desde cart (los items tienen su propio kitchenNote)
  // El kitchenNote del OrderForm es el global del pedido
  // Sincronizar los kitchenNotes de los items individuales en un string combinado
  const itemKitchenNotes = cart
    .filter(i => i.kitchenNote)
    .map(i => `${getItemDisplayName(i)}: ${i.kitchenNote}`)
    .join(' / ')

  // ── Miti miti ──────────────────────────────────────────────────────────────
  const mitiT = mitiTransf === '' ? null : Number(mitiTransf)
  const mitiE = mitiEfect === '' ? null : Number(mitiEfect)
  const mitiD = mitiDeuda === '' ? null : Number(mitiDeuda)
  const mitiSum = (mitiT ?? 0) + (mitiE ?? 0) + (mitiD ?? 0)
  const mitiMatch = mitiSum === grossTotal

  const getMitiCalc = (field) => {
    if (field === 'transf' && mitiTransf === '' && mitiEfect !== '' && mitiDeuda !== '')
      return Math.max(0, grossTotal - (Number(mitiEfect) + Number(mitiDeuda)))
    if (field === 'efect' && mitiEfect === '' && mitiTransf !== '' && mitiDeuda !== '')
      return Math.max(0, grossTotal - (Number(mitiTransf) + Number(mitiDeuda)))
    if (field === 'deuda' && mitiDeuda === '' && mitiTransf !== '' && mitiEfect !== '')
      return Math.max(0, grossTotal - (Number(mitiTransf) + Number(mitiEfect)))
    return null
  }

  const getFinalMitiValue = (field, rawValue) => {
    if (rawValue !== '') return Number(rawValue) || 0
    const calc = getMitiCalc(field)
    return calc !== null ? calc : 0
  }

  // ── Delivery helpers ────────────────────────────────────────────────────────
  const handleDeliverySurchargePreset = (val) => {
    setDeliverySurcharge(val)
    setDeliverySurchargeMode('preset')
    setDeliverySurchargeManual('')
  }
  const handleDeliveryPayoutPreset = (val) => {
    setDeliveryPayout(val)
    setDeliveryPayoutMode('preset')
    setDeliveryPayoutManual('')
  }

  const presetBtn = (val, current, onSelect, prefix = '$') => (
    <button
      key={val}
      type="button"
      onClick={() => onSelect(val)}
      style={{
        padding: '6px 10px', fontSize: '12px', fontWeight: '600',
        borderRadius: '6px', border: current === val ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
        background: current === val ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
        color: current === val ? 'var(--y)' : 'var(--muted)',
        cursor: 'pointer',
      }}
    >
      {prefix}{val.toLocaleString()}
    </button>
  )

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!customerName.trim()) { setError('Ingresá el nombre del cliente.'); return }
    if (isDelivery && !deliveryAddress.trim()) {
      setError('Ingresá la dirección del delivery.')
      return
    }
    if (discountType !== 'none' && (Number(discountValue) > 0) && !discountReason.trim()) {
      setError('El motivo del descuento es obligatorio.'); return
    }

    const mitiMiti = paymentMethod === 'miti_miti' ? {
      transferencia: getFinalMitiValue('transf', mitiTransf),
      efectivo: getFinalMitiValue('efect', mitiEfect),
      deuda: getFinalMitiValue('deuda', mitiDeuda),
    } : null

    // kitchenNote: combinar nota global + notas individuales de items
    const combinedKitchenNote = [kitchenNote.trim(), itemKitchenNotes].filter(Boolean).join(' | ')

    const formData = {
      customerName: customerName.trim(),
      paymentMethod, paymentStatus, orderType,
      notes: notes.trim(),
      kitchenNote: combinedKitchenNote,
      internalNote: internalNote.trim(),
      mitiMiti,
      // Delivery
      deliveryAddress: isDelivery ? deliveryAddress.trim() : '',
      deliveryAddressDetails: isDelivery ? deliveryAddressDetails.trim() : '',
      deliverySurcharge: isDelivery ? deliverySurcharge : 0,
      deliveryPayout: isDelivery ? deliveryPayout : 0,
      assignedDeliveryType: isDelivery ? assignedDeliveryType : 'unassigned',
      assignedDeliveryId: isDelivery ? assignedDeliveryId : '',
      assignedDeliveryName: isDelivery ? assignedDeliveryName : '',
      deliveryResponsibility: isDelivery ? 'customer' : 'none',
      deliveryChargedTo: '',
      // Descuento
      discountType,
      discountValue: Number(discountValue) || 0,
      discountReason: discountReason.trim(),
    }

    setLoading(true)
    try {
      await onSave(formData)
      // Reset
      setCustomerName(''); setNotes(''); setKitchenNote(''); setInternalNote('')
      setPaymentMethod('efectivo'); setPaymentStatus('pagado'); setOrderType('local')
      setMitiTransf(''); setMitiEfect(''); setMitiDeuda('')
      setDiscountType('none'); setDiscountValue(''); setDiscountReason('')
      setDeliveryAddress(''); setDeliveryAddressDetails('')
      setDeliverySurcharge(0); setDeliveryPayout(0)
      setAssignedDeliveryType('unassigned'); setAssignedDeliveryId(''); setAssignedDeliveryName('')
    } catch (err) {
      console.error('Error en OrderForm submit:', err)
      setError(`Error al guardar: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const sortedCart = sortCartItems(cart)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px', color: 'var(--text)' }}>
          Confirmar Pedido
        </h1>

        <form onSubmit={handleSubmit} style={{
          background: 'var(--panel)', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)', padding: '24px',
        }}>

          {/* Nombre */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Nombre del Cliente</label>
            <input
              type="text" value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Ej: Juan, Mesa 3, Take-away"
              autoFocus style={{ ...inputStyle, fontSize: '18px', padding: '14px 16px' }}
            />
          </div>

          <OptionGroup
            label="Medio de pago" value={paymentMethod}
            onChange={v => { setPaymentMethod(v); setMitiTransf(''); setMitiEfect(''); setMitiDeuda('') }}
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'miti_miti', label: 'Miti miti' },
              { value: 'cta_cte', label: 'Cta cte' },
              { value: 'canje', label: 'Canje' },
              { value: 'otro', label: 'Otro' },
            ]}
          />

          {/* Miti miti */}
          {paymentMethod === 'miti_miti' && (
            <div style={{
              background: 'rgba(255,198,42,0.05)', border: '1px solid rgba(255,198,42,0.2)',
              borderRadius: 'var(--radius)', padding: '16px', marginBottom: '18px', marginTop: '-8px',
            }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px', fontWeight: '600' }}>
                DESGLOSE MITI MITI
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Transferencia', field: 'transf', value: mitiTransf, setter: setMitiTransf },
                  { label: 'Efectivo',      field: 'efect',  value: mitiEfect,  setter: setMitiEfect },
                  { label: 'Queda debiendo', field: 'deuda', value: mitiDeuda,  setter: setMitiDeuda },
                ].map(({ label, field, value, setter }) => {
                  const calcVal = getMitiCalc(field)
                  const displayValue = value !== '' ? value : (calcVal !== null ? String(calcVal) : '')
                  return (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--muted)', width: '120px', flexShrink: 0 }}>{label}</label>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px', pointerEvents: 'none' }}>$</span>
                        <input
                          type="number" min="0"
                          value={displayValue}
                          onChange={e => setter(e.target.value)}
                          placeholder="0"
                          style={{
                            ...inputStyle, paddingLeft: '24px',
                            background: calcVal !== null && value === '' ? 'rgba(255,198,42,0.08)' : 'rgba(255,255,255,0.05)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {(mitiTransf !== '' || mitiEfect !== '' || mitiDeuda !== '') && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: mitiMatch ? '#4caf50' : 'var(--y)', fontWeight: '600' }}>
                  {mitiMatch
                    ? `Suma correcta: $${mitiSum.toLocaleString()}`
                    : `Suma: $${mitiSum.toLocaleString()} — Total: $${grossTotal.toLocaleString()}`}
                </div>
              )}
            </div>
          )}

          <OptionGroup
            label="Estado de pago" value={paymentStatus} onChange={setPaymentStatus}
            options={[{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }]}
          />

          <OptionGroup
            label="Tipo de pedido" value={orderType} onChange={setOrderType}
            options={[
              { value: 'local', label: 'Local' },
              { value: 'retiro', label: 'Retiro' },
              { value: 'delivery', label: 'Delivery' },
            ]}
          />

          {/* ── DELIVERY ── */}
          {isDelivery && (
            <div style={{
              background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)',
              borderRadius: 'var(--radius)', padding: '16px', marginBottom: '18px', marginTop: '-4px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Datos de entrega
              </div>

              {/* Dirección */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...labelStyle, fontSize: '11px' }}>
                  Dirección <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <input type="text" value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); if (error) setError('') }}
                  placeholder="Ej: Cuzco 3033"
                  style={{ ...inputStyle, fontSize: '14px', padding: '8px 12px', borderColor: error && !deliveryAddress.trim() ? 'rgba(255,107,107,0.6)' : undefined }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ ...labelStyle, fontSize: '11px' }}>Entre calles / Referencia</label>
                <input type="text" value={deliveryAddressDetails} onChange={e => setDeliveryAddressDetails(e.target.value)}
                  placeholder="Ej: Acoyte y Balaguer" style={{ ...inputStyle, fontSize: '14px', padding: '8px 12px' }} />
              </div>

              {/* Recargo envío */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ ...labelStyle, fontSize: '11px' }}>Recargo envío (cobra al cliente)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {DELIVERY_SURCHARGE_PRESETS.map(val => presetBtn(val, deliverySurcharge, handleDeliverySurchargePreset))}
                  <button type="button" onClick={() => setDeliverySurchargeMode(m => m === 'manual' ? 'preset' : 'manual')}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', cursor: 'pointer' }}>
                    Manual
                  </button>
                </div>
                {deliverySurchargeMode === 'manual' && (
                  <input type="number" min="0" value={deliverySurchargeManual}
                    onChange={e => { setDeliverySurchargeManual(e.target.value); setDeliverySurcharge(Number(e.target.value) || 0) }}
                    placeholder="Ingresá el monto"
                    style={{ ...inputStyle, fontSize: '14px', padding: '8px 12px' }} />
                )}
              </div>

              {/* Pago al repartidor */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ ...labelStyle, fontSize: '11px' }}>Pago al delivery (interno, no en ticket cliente)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {DELIVERY_PAYOUT_PRESETS.map(val => presetBtn(val, deliveryPayout, handleDeliveryPayoutPreset))}
                  <button type="button" onClick={() => setDeliveryPayoutMode(m => m === 'manual' ? 'preset' : 'manual')}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', cursor: 'pointer' }}>
                    Manual
                  </button>
                </div>
                {deliveryPayoutMode === 'manual' && (
                  <input type="number" min="0" value={deliveryPayoutManual}
                    onChange={e => { setDeliveryPayoutManual(e.target.value); setDeliveryPayout(Number(e.target.value) || 0) }}
                    placeholder="Ingresá el monto"
                    style={{ ...inputStyle, fontSize: '14px', padding: '8px 12px' }} />
                )}
              </div>

              {/* Repartidor */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ ...labelStyle, fontSize: '11px' }}>Repartidor</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[
                    { val: 'staff', label: 'Staff' },
                    { val: 'owner', label: 'Lauti / BY' },
                    { val: 'unassigned', label: 'Sin asignar' },
                  ].map(({ val, label }) => (
                    <button key={val} type="button"
                      onClick={() => {
                        setAssignedDeliveryType(val)
                        setAssignedDeliveryId('')
                        setAssignedDeliveryName(val === 'owner' ? 'Lauti / Burger Ya' : '')
                      }}
                      style={{
                        padding: '6px 12px', fontSize: '12px', fontWeight: '600',
                        borderRadius: '6px',
                        border: assignedDeliveryType === val ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
                        background: assignedDeliveryType === val ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
                        color: assignedDeliveryType === val ? 'var(--y)' : 'var(--muted)', cursor: 'pointer',
                      }}
                    >{label}</button>
                  ))}
                </div>
                {assignedDeliveryType === 'staff' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {deliveryStaff.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No hay deliveries activos registrados.</span>
                    ) : (
                      deliveryStaff.map(m => (
                        <button key={m.id} type="button"
                          onClick={() => { setAssignedDeliveryId(m.id); setAssignedDeliveryName(m.name) }}
                          style={{
                            padding: '5px 10px', fontSize: '12px',
                            borderRadius: '6px',
                            border: assignedDeliveryId === m.id ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
                            background: assignedDeliveryId === m.id ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
                            color: assignedDeliveryId === m.id ? 'var(--y)' : 'var(--muted)', cursor: 'pointer',
                          }}
                        >{m.name}</button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Preview totales delivery */}
              <div style={{ borderTop: '1px solid rgba(56,189,248,0.2)', paddingTop: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: '3px' }}>
                  <span>Productos</span><span>${grossTotal.toLocaleString()}</span>
                </div>
                {deliverySurcharge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: '3px' }}>
                    <span>Recargo envío</span><span>+${deliverySurcharge.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--text)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginBottom: '3px' }}>
                  <span>Total cliente</span><span>${total.toLocaleString()}</span>
                </div>
                {deliveryPayout > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff9966', marginBottom: '3px' }}>
                      <span>Pago delivery</span><span>-${deliveryPayout.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--y)' }}>
                      <span>Neto Burger Ya</span><span>${netRevenue.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── DESCUENTO MANUAL ── */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Descuento</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {[
                { val: 'none', label: 'Sin descuento' },
                { val: 'percent', label: '% Porcentaje' },
                { val: 'amount', label: '$ Monto fijo' },
              ].map(({ val, label }) => (
                <button key={val} type="button" onClick={() => { setDiscountType(val); setDiscountValue(''); setDiscountReason('') }}
                  style={{
                    flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: '600',
                    borderRadius: '6px',
                    border: discountType === val ? '2px solid var(--y)' : '1px solid rgba(255,255,255,0.1)',
                    background: discountType === val ? 'rgba(255,198,42,0.12)' : 'rgba(255,255,255,0.04)',
                    color: discountType === val ? 'var(--y)' : 'var(--muted)', cursor: 'pointer',
                  }}
                >{label}</button>
              ))}
            </div>
            {discountType !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number" min="0" max={discountType === 'percent' ? 100 : undefined}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? '% descuento' : '$ monto'}
                    style={{ ...inputStyle, width: '140px', fontSize: '14px' }}
                  />
                  {discountType === 'percent' && Number(discountValue) > 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--y)', fontWeight: '700' }}>
                      = -${Math.round(grossTotal * Number(discountValue) / 100).toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder="Motivo obligatorio (ej: amigo de Lauti, promo)"
                  style={{ ...inputStyle, fontSize: '14px' }}
                />
              </div>
            )}
          </div>

          {/* ── NOTAS ── */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Nota para cocina (se imprime)</label>
            <textarea
              value={kitchenNote}
              onChange={e => setKitchenNote(e.target.value)}
              placeholder="Ej: sin cebolla, extra barbacoa, todo sin sal"
              rows={2}
              style={{ ...inputStyle, resize: 'none', fontSize: '14px' }}
            />
            {itemKitchenNotes && (
              <div style={{ fontSize: '11px', color: 'var(--y)', marginTop: '4px' }}>
                Notas de items: {itemKitchenNotes}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Nota interna (no se imprime en cocina/cliente)</label>
            <textarea
              value={internalNote}
              onChange={e => setInternalNote(e.target.value)}
              placeholder="Ej: sesión de fotos, amigo de Lauti, take away pedido web"
              rows={2}
              style={{ ...inputStyle, resize: 'none', fontSize: '14px' }}
            />
          </div>

          {/* Observaciones generales (compatibilidad) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ ...labelStyle, fontSize: '11px', opacity: 0.7 }}>Observaciones adicionales (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas varias..."
              rows={1}
              style={{ ...inputStyle, resize: 'none', fontSize: '13px', opacity: 0.7 }}
            />
          </div>

          {/* ── RESUMEN ── */}
          <div style={{
            background: 'rgba(255,198,42,0.08)', border: '1px solid rgba(255,198,42,0.2)',
            borderRadius: 'var(--radius)', padding: '16px', marginBottom: '18px',
          }}>
            {sortedCart.map(item => {
              const lt = getItemLineTotal(item)
              return (
                <div key={item.cartId || item.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '13px', color: 'var(--muted)', marginBottom: '4px',
                }}>
                  <span>{getItemDisplayName(item)} x{item.qty || 1}{item.kitchenNote ? ` · ${item.kitchenNote}` : ''}</span>
                  <span>${lt.toLocaleString()}</span>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid rgba(255,198,42,0.2)', marginTop: '8px', paddingTop: '8px' }}>
              {discountAmount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', marginBottom: '3px' }}>
                    <span>Subtotal</span><span>${grossTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ff9966', marginBottom: '3px' }}>
                    <span>Descuento {discountReason && `(${discountReason})`}</span>
                    <span>-${discountAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
              {isDelivery && deliverySurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', marginBottom: '3px' }}>
                  <span>Recargo envío</span><span>+${deliverySurcharge.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '20px', color: 'var(--text)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--y)' }}>${total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              marginBottom: '16px', background: 'rgba(255,49,49,0.15)',
              border: '1px solid rgba(255,49,49,0.3)', borderRadius: 'var(--radius)',
              padding: '14px', color: 'var(--r)', fontWeight: 'bold',
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'var(--muted)' : 'var(--y)',
              color: loading ? 'var(--text)' : '#000',
              fontWeight: 'bold', fontSize: '20px', padding: '18px',
              borderRadius: 'var(--radius)', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Guardando...' : 'Guardar e Imprimir'}
          </button>
        </form>
      </div>
    </div>
  )
}
