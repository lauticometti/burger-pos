import { useState } from 'react'
import { sortCartItems } from '../utils/cartSort'

const BTN = {
  base: {
    flex: 1,
    padding: '14px 8px',
    borderRadius: 'var(--radius)',
    border: '2px solid transparent',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
}

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--muted)',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                ...BTN.base,
                background: active ? 'var(--y)' : 'rgba(255,255,255,0.04)',
                color: active ? '#000' : 'var(--text)',
                border: active ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

export function OrderForm({ cart, onSave }) {
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [paymentStatus, setPaymentStatus] = useState('pagado')
  const [orderType, setOrderType] = useState('local')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Miti miti
  const [mitiTransf, setMitiTransf] = useState('')
  const [mitiEfect, setMitiEfect] = useState('')
  const [mitiDeuda, setMitiDeuda] = useState('')

  const itemTotal = (item) => (item.category === 'burger' || item.cartId)
    ? (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1)
    : item.price * item.qty

  const subtotal = cart.reduce((sum, item) => sum + itemTotal(item), 0)

  // Lógica miti miti: si exactamente 2 campos tienen valor, calcular el tercero
  const mitiT = mitiTransf === '' ? null : Number(mitiTransf)
  const mitiE = mitiEfect === '' ? null : Number(mitiEfect)
  const mitiD = mitiDeuda === '' ? null : Number(mitiDeuda)

  const mitiSum = (mitiT ?? 0) + (mitiE ?? 0) + (mitiD ?? 0)
  const mitiMatch = mitiSum === subtotal

  const getMitiCalc = (field) => {
    // Si el campo actual está vacío y los otros 2 tienen valor, calcula este
    if (field === 'transf' && mitiTransf === '' && mitiEfect !== '' && mitiDeuda !== '') {
      const calc = subtotal - (Number(mitiEfect) + Number(mitiDeuda))
      return calc >= 0 ? String(calc) : ''
    }
    if (field === 'efect' && mitiEfect === '' && mitiTransf !== '' && mitiDeuda !== '') {
      const calc = subtotal - (Number(mitiTransf) + Number(mitiDeuda))
      return calc >= 0 ? String(calc) : ''
    }
    if (field === 'deuda' && mitiDeuda === '' && mitiTransf !== '' && mitiEfect !== '') {
      const calc = subtotal - (Number(mitiTransf) + Number(mitiEfect))
      return calc >= 0 ? String(calc) : ''
    }
    return null
  }

  const handleMitiChange = (field, value, setter) => {
    setter(value)
  }

  const getFinalMitiValue = (field, rawValue) => {
    if (rawValue !== '') return Number(rawValue) || 0
    const calc = getMitiCalc(field)
    return calc !== null ? Number(calc) : 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!customerName.trim()) {
      alert("Ingresá el nombre del cliente")
      return
    }

    const mitiMiti = paymentMethod === 'miti_miti' ? {
      transferencia: getFinalMitiValue('transf', mitiTransf),
      efectivo: getFinalMitiValue('efect', mitiEfect),
      deuda: getFinalMitiValue('deuda', mitiDeuda),
    } : null

    const formData = {
      customerName: customerName.trim(),
      paymentMethod,
      paymentStatus,
      orderType,
      notes: notes.trim(),
      mitiMiti,
    }

    setLoading(true)
    try {
      await onSave(formData)
      setCustomerName('')
      setNotes('')
      setPaymentMethod('efectivo')
      setPaymentStatus('pagado')
      setOrderType('local')
      setMitiTransf('')
      setMitiEfect('')
      setMitiDeuda('')
    } catch (err) {
      console.error("Error en OrderForm submit:", err)
      alert(`Error guardando pedido: ${err.message || err}`)
      setError(`Error al guardar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const sortedCart = sortCartItems(cart)

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--radius)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '24px 16px',
      paddingBottom: '140px'
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '24px',
          color: 'var(--text)'
        }}>
          Confirmar Pedido
        </h1>

        <form onSubmit={handleSubmit} style={{
          background: 'var(--panel)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '24px'
        }}>

          {/* Nombre */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Nombre del Cliente
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ej: Juan, Mesa 3, Take-away"
              autoFocus
              style={{
                ...inputStyle,
                fontSize: '18px',
                padding: '14px 16px',
                border: '2px solid rgba(255,255,255,0.15)',
              }}
            />
          </div>

          <OptionGroup
            label="Medio de pago"
            value={paymentMethod}
            onChange={(v) => {
              setPaymentMethod(v)
              setMitiTransf('')
              setMitiEfect('')
              setMitiDeuda('')
            }}
            options={[
              { value: 'efectivo',      label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'miti_miti',     label: 'Miti miti' },
              { value: 'cta_cte',       label: 'Cta cte' },
              { value: 'canje',         label: 'Canje' },
              { value: 'otro',          label: 'Otro' },
            ]}
          />

          {/* Inputs Miti miti */}
          {paymentMethod === 'miti_miti' && (
            <div style={{
              background: 'rgba(255,198,42,0.05)',
              border: '1px solid rgba(255,198,42,0.2)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              marginBottom: '20px',
              marginTop: '-8px',
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
                  const displayValue = value !== '' ? value : (calcVal ?? '')
                  return (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--muted)', width: '120px', flexShrink: 0 }}>
                        {label}
                      </label>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{
                          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--muted)', fontSize: '14px', pointerEvents: 'none'
                        }}>$</span>
                        <input
                          type="number"
                          min="0"
                          value={displayValue}
                          onChange={e => handleMitiChange(field, e.target.value, setter)}
                          placeholder="0"
                          style={{
                            ...inputStyle,
                            paddingLeft: '24px',
                            background: calcVal !== null && value === ''
                              ? 'rgba(255,198,42,0.08)'
                              : 'rgba(255,255,255,0.05)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Validación */}
              {(mitiTransf !== '' || mitiEfect !== '' || mitiDeuda !== '') && (
                <div style={{
                  marginTop: '10px',
                  fontSize: '12px',
                  color: mitiMatch ? '#4caf50' : 'var(--y)',
                  fontWeight: '600',
                }}>
                  {mitiMatch
                    ? `Suma correcta: $${mitiSum.toLocaleString()}`
                    : `Suma: $${mitiSum.toLocaleString()} — Total: $${subtotal.toLocaleString()}`
                  }
                </div>
              )}
            </div>
          )}

          <OptionGroup
            label="Estado de pago"
            value={paymentStatus}
            onChange={setPaymentStatus}
            options={[
              { value: 'pagado',    label: 'Pagado' },
              { value: 'pendiente', label: 'Pendiente' },
            ]}
          />

          <OptionGroup
            label="Tipo de pedido"
            value={orderType}
            onChange={setOrderType}
            options={[
              { value: 'local',    label: 'Local' },
              { value: 'retiro',   label: 'Retiro' },
              { value: 'delivery', label: 'Delivery' },
            ]}
          />

          {/* Observaciones */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Observaciones (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sin cebolla, doble salsa..."
              rows={2}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Resumen ordenado */}
          <div style={{
            background: 'rgba(255,198,42,0.08)',
            border: '1px solid rgba(255,198,42,0.2)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            {sortedCart.map(item => {
              const isBurger = item.category === 'burger' || item.cartId
              const displayName = isBurger
                ? `Smash Burger ${MEAT_NAMES[item.meatCount] || ''}${item.noCheddar ? ' (sin cheddar)' : ''}`
                : item.name
              return (
                <div key={item.cartId || item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: 'var(--muted)',
                  marginBottom: '4px'
                }}>
                  <span>{displayName} x{item.qty || 1}</span>
                  <span>${itemTotal(item).toLocaleString()}</span>
                </div>
              )
            })}
            <div style={{
              borderTop: '1px solid rgba(255,198,42,0.2)',
              marginTop: '10px',
              paddingTop: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              fontSize: '20px',
              color: 'var(--text)'
            }}>
              <span>Total</span>
              <span style={{ color: 'var(--y)' }}>${subtotal.toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <div style={{
              marginBottom: '16px',
              background: 'rgba(255,49,49,0.15)',
              border: '1px solid rgba(255,49,49,0.3)',
              borderRadius: 'var(--radius)',
              padding: '14px',
              color: 'var(--r)',
              fontWeight: 'bold'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'var(--muted)' : 'var(--y)',
              color: loading ? 'var(--text)' : '#000',
              fontWeight: 'bold',
              fontSize: '20px',
              padding: '18px',
              borderRadius: 'var(--radius)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Guardando...' : 'Guardar e Imprimir'}
          </button>
        </form>
      </div>
    </div>
  )
}
