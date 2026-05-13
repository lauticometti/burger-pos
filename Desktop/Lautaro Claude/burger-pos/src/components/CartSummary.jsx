import { useState } from 'react'
import { isValidCode, applyHiddenCode, removeHiddenCodeBenefit } from '../utils/hiddenCode'
import { sortCartItems } from '../utils/cartSort'
import { clearOrderFromStorage } from '../hooks/useLocalOrderPersistence'

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

function burgerLineTotal(item) {
  return (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1)
}

function burgerDisplayName(item) {
  const base = `Smash Burger ${MEAT_NAMES[item.meatCount] || ''}`
  return item.noCheddar ? `${base} (sin cheddar)` : base
}

export function CartSummary({ cart, setCart, onViewFull, compact }) {
  const [codeInput, setCodeInput] = useState('')

  const handleBurgerQty = (cartId, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const next = (item.qty || 1) + delta
      if (next <= 0) return prev.filter(i => i.cartId !== cartId)
      return prev.map(i => i.cartId === cartId ? { ...i, qty: next } : i)
    })
  }

  const handleBurgerCheddar = (cartId) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const nextNoCheddar = !item.noCheddar

      const afterRemove = prev
        .map(i => i.cartId !== cartId ? i : i.qty > 1 ? { ...i, qty: i.qty - 1 } : null)
        .filter(Boolean)

      const dest = afterRemove.find(i => i.cartId && i.meatCount === item.meatCount && !!i.noCheddar === nextNoCheddar)
      if (dest) {
        return afterRemove.map(i => i.cartId === dest.cartId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [
        ...afterRemove,
        { ...item, cartId: `burger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, noCheddar: nextNoCheddar, qty: 1 }
      ]
    })
  }

  const handleRemoveBurger = (cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId))
  }

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

  const handleVaciar = () => {
    if (window.confirm('¿Vaciar pedido actual?')) {
      setCart([])
      clearOrderFromStorage()
    }
  }

  const sortedCart = sortCartItems(cart)

  const total = cart.reduce((sum, item) => {
    if (item.category === 'burger' || item.cartId) return sum + burgerLineTotal(item)
    return sum + item.price * item.qty
  }, 0)

  const hasCodeBenefit = cart.some(item => item.isHiddenCodeBenefit)

  const qtyBtn = (onClick, label, color) => (
    <button
      onClick={onClick}
      style={{
        background: color,
        color: color === 'var(--r)' ? 'white' : '#000',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '15px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  )

  const totalUnidades = cart.reduce((s, i) => s + (i.qty || 1), 0)
  const totalLineas = cart.length

  return (
    <div style={{
      minHeight: compact ? undefined : '100vh',
      background: 'var(--bg)',
      padding: compact ? '12px 12px' : '24px 16px',
      paddingBottom: compact ? '8px' : '160px',
    }}>
      <div style={{ maxWidth: compact ? '100%' : '640px', margin: '0 auto' }}>

        {/* Encabezado */}
        <div className="cart-header">
          {!compact && (
            <h1 className="cart-title" style={{ fontSize: '22px' }}>Pedido</h1>
          )}
          {compact && (
            <span className="cart-title" style={{ fontSize: '15px' }}>Pedido</span>
          )}
        </div>

        {/* Síntesis rápida con botón Vaciar integrado */}
        {cart.length > 0 && (
          <div className="cart-summary-row">
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {totalLineas} {totalLineas === 1 ? 'producto' : 'productos'} · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}
            </span>
            <button className="clear-cart-button" onClick={handleVaciar}>
              Vaciar
            </button>
          </div>
        )}

        {cart.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '14px',
            padding: '24px 0',
          }}>
            El pedido está vacío
          </div>
        )}

        {cart.length > 0 && (
          <div style={{
            background: 'var(--panel)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: compact ? '10px' : '16px',
            marginBottom: '16px',
          }}>

            {sortedCart.map(item => {
              const isBurger = item.category === 'burger' || item.cartId
              if (isBurger) {
                const lt = burgerLineTotal(item)
                const qty = item.qty || 1
                return (
                  <div key={item.cartId} style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                  }}>
                    {/* Fila principal */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text)', lineHeight: 1.2 }}>
                        {qty}x {burgerDisplayName(item)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--y)' }}>
                          ${lt.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleRemoveBurger(item.cartId)}
                          style={{
                            background: 'rgba(255,49,49,0.15)',
                            color: 'var(--r)',
                            border: '1px solid rgba(255,49,49,0.3)',
                            borderRadius: '8px',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {/* Info secundaria: solo mostrar si sin cheddar */}
                    {item.noCheddar && (
                      <div style={{ fontSize: '11px', color: 'var(--r)', marginTop: '3px' }}>
                        sin cheddar
                      </div>
                    )}
                    {/* Controles */}
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', width: '80px' }}>Cantidad</span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>
                        {qty}
                      </span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, +1), '+', 'var(--y)')}
                      <button
                        onClick={() => handleBurgerCheddar(item.cartId)}
                        style={{
                          marginLeft: '4px',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid',
                          cursor: 'pointer',
                          fontWeight: '600',
                          background: item.noCheddar ? 'rgba(255,49,49,0.15)' : 'rgba(255,255,255,0.05)',
                          color: item.noCheddar ? 'var(--r)' : 'var(--muted)',
                          borderColor: item.noCheddar ? 'rgba(255,49,49,0.4)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {item.noCheddar ? 'Agregar cheddar' : 'Quitar cheddar'}
                      </button>
                    </div>
                  </div>
                )
              }

              // Producto normal
              return (
                <div key={item.id} style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text)' }}>
                      {item.qty}x {item.name}
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--y)', flexShrink: 0 }}>
                      ${(item.price * item.qty).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', width: '80px' }}>Cantidad</span>
                    {qtyBtn(() => handleQtyChange(item.id, item.qty - 1), '−', 'var(--r)')}
                    <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>
                      {item.qty}
                    </span>
                    {qtyBtn(() => handleQtyChange(item.id, item.qty + 1), '+', 'var(--y)')}
                  </div>
                </div>
              )
            })}

            {/* Código descuento */}
            <div style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '12px',
              marginTop: '12px',
              marginBottom: '12px',
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
                  padding: '10px 14px',
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
                  padding: '10px 14px',
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
                    padding: '10px 14px',
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
            <div style={{ borderTop: '2px solid var(--line)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text)' }}>TOTAL:</span>
                <span style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--y)' }}>
                  ${total.toLocaleString()}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Link ver pedido completo (solo en modo compact/inline) */}
        {compact && cart.length > 0 && onViewFull && (
          <button
            onClick={onViewFull}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 0',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Ver pedido completo
          </button>
        )}

      </div>
    </div>
  )
}
