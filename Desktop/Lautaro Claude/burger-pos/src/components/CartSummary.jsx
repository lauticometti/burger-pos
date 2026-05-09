import { useState } from 'react'
import { isValidCode, applyHiddenCode, removeHiddenCodeBenefit } from '../utils/hiddenCode'

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

function burgerLineTotal(item) {
  return (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1)
}

function burgerDisplayName(item) {
  return `Smash Burger ${MEAT_NAMES[item.meatCount] || ''}`
}

export function CartSummary({ cart, setCart }) {
  const [codeInput, setCodeInput] = useState('')

  // Handlers para burgers (identificadas por cartId)
  const handleBurgerMeat = (cartId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item
      const next = Math.min(6, Math.max(1, item.meatCount + delta))
      const lt = item.basePrice + (next - 1) * item.extraMeatPrice
      return { ...item, meatCount: next, price: lt, lineTotal: lt }
    }))
  }

  const handleBurgerQty = (cartId, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const next = (item.qty || 1) + delta
      if (next <= 0) return prev.filter(i => i.cartId !== cartId)
      return prev.map(i => i.cartId === cartId ? { ...i, qty: next } : i)
    })
  }

  const handleRemoveBurger = (cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId))
  }

  // Handlers para productos normales (identificados por id)
  const handleQtyChange = (id, newQty) => {
    if (newQty <= 0) {
      let next = cart.filter(item => item.id !== id)
      if (id === 'papas_fritas') next = removeHiddenCodeBenefit(next)
      setCart(next)
    } else {
      setCart(cart.map(item => item.id === id ? { ...item, qty: newQty } : item))
    }
  }

  const handleApplyCode = () => {
    if (!isValidCode(codeInput)) return
    setCart(applyHiddenCode(cart))
    setCodeInput('')
  }

  const handleRemoveCode = () => {
    setCart(removeHiddenCodeBenefit(cart))
    setCodeInput('')
  }

  const total = cart.reduce((sum, item) => {
    if (item.cartId) return sum + burgerLineTotal(item)
    return sum + item.price * item.qty
  }, 0)

  const hasCodeBenefit = cart.some(item => item.isHiddenCodeBenefit)

  const qtyBtn = (onClick, label, color) => (
    <button
      onClick={onClick}
      style={{
        background: color,
        color: color === 'var(--r)' ? 'white' : '#000',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '18px',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '24px 16px',
      paddingBottom: '140px'
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '24px',
          color: 'var(--text)'
        }}>
          Pedido
        </h1>

        <div style={{
          background: 'var(--panel)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '24px',
          marginBottom: '24px'
        }}>

          {cart.map(item => {
            // Burger individual
            if (item.cartId) {
              const lt = burgerLineTotal(item)
              return (
                <div key={item.cartId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--line)',
                  gap: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                      {burgerDisplayName(item)}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Carnes:</span>
                      {qtyBtn(() => handleBurgerMeat(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{
                        width: '20px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        color: 'var(--text)',
                      }}>
                        {item.meatCount}
                      </span>
                      {qtyBtn(() => handleBurgerMeat(item.cartId, +1), '+', item.meatCount >= 6 ? '#444' : 'var(--y)')}
                      {item.meatCount >= 6 && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>máx</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Cantidad:</span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{
                        width: '20px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        color: 'var(--text)',
                      }}>
                        {item.qty || 1}
                      </span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, +1), '+', 'var(--y)')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
                      ${lt.toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleRemoveBurger(item.cartId)}
                      style={{
                        background: 'rgba(255,49,49,0.15)',
                        color: 'var(--r)',
                        border: '1px solid rgba(255,49,49,0.3)',
                        borderRadius: '8px',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            }

            // Producto normal
            return (
              <div key={item.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 0',
                borderBottom: '1px solid var(--line)',
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                    {item.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    ${item.price.toLocaleString()} c/u
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
                  {qtyBtn(() => handleQtyChange(item.id, item.qty - 1), '−', 'var(--r)')}
                  <span style={{ width: '32px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', color: 'var(--text)' }}>
                    {item.qty}
                  </span>
                  {qtyBtn(() => handleQtyChange(item.id, item.qty + 1), '+', 'var(--y)')}
                </div>
                <p style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
                  ${(item.price * item.qty).toLocaleString()}
                </p>
              </div>
            )
          })}

          {/* Código descuento */}
          <div style={{
            borderTop: '1px solid var(--line)',
            paddingTop: '16px',
            marginTop: '16px',
            marginBottom: '16px',
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
              placeholder="Código de descuento"
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text)',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={handleApplyCode}
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                background: 'var(--y)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Aplicar
            </button>
            {hasCodeBenefit && (
              <button
                onClick={handleRemoveCode}
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  background: 'rgba(255,49,49,0.15)',
                  color: 'var(--r)',
                  border: '1px solid var(--r)',
                  borderRadius: 'var(--radius)',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Remover
              </button>
            )}
          </div>

          {/* Total */}
          <div style={{ borderTop: '2px solid var(--line)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text)' }}>TOTAL:</span>
              <span style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--y)' }}>
                ${total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
