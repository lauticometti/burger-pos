import { useState } from 'react'

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
      <div style={{ display: 'flex', gap: '8px' }}>
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

export function OrderForm({ cart, onSave }) {
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [paymentStatus, setPaymentStatus] = useState('pagado')
  const [orderType, setOrderType] = useState('retiro')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    console.log("OrderForm submit iniciado")

    if (!customerName.trim()) {
      alert("Ingresá el nombre del cliente")
      return
    }

    const formData = {
      customerName: customerName.trim(),
      paymentMethod,
      paymentStatus,
      orderType,
      notes: notes.trim(),
    }

    console.log("OrderForm llamando onSave", formData)

    setLoading(true)
    try {
      await onSave(formData)
      console.log("OrderForm onSave finalizado")
      setCustomerName('')
      setNotes('')
      setPaymentMethod('efectivo')
      setPaymentStatus('pagado')
      setOrderType('retiro')
    } catch (err) {
      console.error("Error en OrderForm submit:", err)
      alert(`Error guardando pedido: ${err.message || err}`)
      setError(`Error al guardar: ${err.message}`)
    } finally {
      setLoading(false)
    }
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
          fontSize: '36px',
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
                width: '100%',
                padding: '14px 16px',
                fontSize: '18px',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 'var(--radius)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <OptionGroup
            label="Medio de pago"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'mercado_pago', label: 'Mercado Pago' },
              { value: 'otro', label: 'Otro' },
            ]}
          />

          <OptionGroup
            label="Estado de pago"
            value={paymentStatus}
            onChange={setPaymentStatus}
            options={[
              { value: 'pagado', label: 'Pagado' },
              { value: 'pendiente', label: 'Pendiente' },
            ]}
          />

          <OptionGroup
            label="Tipo de pedido"
            value={orderType}
            onChange={setOrderType}
            options={[
              { value: 'retiro', label: 'Retiro' },
              { value: 'local', label: 'Local' },
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

          {/* Resumen */}
          <div style={{
            background: 'rgba(255,198,42,0.08)',
            border: '1px solid rgba(255,198,42,0.2)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            {cart.map(item => (
              <div key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: 'var(--muted)',
                marginBottom: '4px'
              }}>
                <span>{item.name} x{item.qty}</span>
                <span>${(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
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
