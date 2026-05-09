import { useState } from 'react'
import { isValidCode, applyHiddenCode, removeHiddenCodeBenefit } from '../utils/hiddenCode'

const MEAT_NAMES = ['', 'Simple', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple', 'Séxtuple']

function burgerLineTotal(item) {
  return (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1)
}

function burgerDisplayName(item) {
  const base = `Smash Burger ${MEAT_NAMES[item.meatCount] || ''}`
  return item.noCheddar ? `${base} (sin cheddar)` : base
}

export function CartSummary({ cart, setCart }) {
  const [codeInput, setCodeInput] = useState('')

  // Al sumar/restar carne: mueve 1 unidad del grupo origen al grupo destino
  const handleBurgerMeat = (cartId, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const nextMeat = Math.min(6, Math.max(1, item.meatCount + delta))
      if (nextMeat === item.meatCount) return prev

      // Reducir qty origen en 1 (eliminar si queda en 0)
      const afterRemove = prev
        .map(i => i.cartId !== cartId ? i : i.qty > 1 ? { ...i, qty: i.qty - 1 } : null)
        .filter(Boolean)

      // Buscar grupo destino con el nuevo meatCount
      const dest = afterRemove.find(i => i.cartId && i.meatCount === nextMeat)
      if (dest) {
        return afterRemove.map(i => i.cartId === dest.cartId ? { ...i, qty: i.qty + 1 } : i)
      }
      // Crear nuevo grupo
      return [
        ...afterRemove,
        { ...item, cartId: `burger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, meatCount: nextMeat, qty: 1 }
      ]
    })
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

  const handleBurgerCheddar = (cartId) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const nextNoCheddar = !item.noCheddar

      // Reducir qty origen en 1 (eliminar si queda en 0)
      const afterRemove = prev
        .map(i => i.cartId !== cartId ? i : i.qty > 1 ? { ...i, qty: i.qty - 1 } : null)
        .filter(Boolean)

      // Buscar grupo destino con mismo meatCount y mismo noCheddar objetivo
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

  const PRODUCT_ORDER = ['papas_fritas', 'coca_600', 'coca_225', 'dip_salsa_secreta']

  const sortedCart = [...cart].sort((a, b) => {
    // Burgers primero, ordenadas por meatCount descendente
    if (a.cartId && b.cartId) return b.meatCount - a.meatCount
    if (a.cartId) return -1
    if (b.cartId) return 1
    return PRODUCT_ORDER.indexOf(a.id) - PRODUCT_ORDER.indexOf(b.id)
  })

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

  // Mini síntesis
  const totalUnidades = cart.reduce((s, i) => s + (i.qty || 1), 0)
  const totalLineas = cart.length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '24px 16px',
      paddingBottom: '160px'
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '12px',
          color: 'var(--text)'
        }}>
          Pedido
        </h1>

        {/* Síntesis rápida */}
        <div style={{
          background: 'rgba(255,198,42,0.08)',
          border: '1px solid rgba(255,198,42,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
            {totalLineas} {totalLineas === 1 ? 'producto' : 'productos'} · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--y)' }}>
            ${total.toLocaleString()}
          </span>
        </div>

        <div style={{
          background: 'var(--panel)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '16px',
          marginBottom: '24px'
        }}>

          {sortedCart.map(item => {
            // Burger
            if (item.cartId) {
              const lt = burgerLineTotal(item)
              const qty = item.qty || 1
              return (
                <div key={item.cartId} style={{
                  padding: '14px 0',
                  borderBottom: '1px solid var(--line)',
                }}>
                  {/* Fila principal: cantidad+nombre | precio + eliminar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text)', lineHeight: 1.2 }}>
                      {qty}x {burgerDisplayName(item)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--y)' }}>
                        ${lt.toLocaleString()}
                      </span>
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
                  {/* Info secundaria */}
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    {item.meatCount} {item.meatCount === 1 ? 'carne' : 'carnes'} c/u{item.noCheddar ? ' · sin cheddar' : ''}
                  </div>
                  {/* Controles */}
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--muted)', width: '90px' }}>Cantidad</span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: 'var(--text)' }}>
                        {qty}
                      </span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, +1), '+', 'var(--y)')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--muted)', width: '90px' }}>Carnes c/u</span>
                      {qtyBtn(() => handleBurgerMeat(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: 'var(--text)' }}>
                        {item.meatCount}
                      </span>
                      {qtyBtn(() => handleBurgerMeat(item.cartId, +1), '+', item.meatCount >= 6 ? '#444' : 'var(--y)')}
                      {item.meatCount >= 6 && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>máx</span>}
                      <button
                        onClick={() => handleBurgerCheddar(item.cartId)}
                        style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid',
                          cursor: 'pointer',
                          fontWeight: '600',
                          background: item.noCheddar ? 'rgba(255,49,49,0.15)' : 'rgba(255,255,255,0.05)',
                          color: item.noCheddar ? 'var(--r)' : 'var(--muted)',
                          borderColor: item.noCheddar ? 'rgba(255,49,49,0.4)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {item.noCheddar ? '✕ sin cheddar' : 'sin cheddar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            // Producto normal
            return (
              <div key={item.id} style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--line)',
              }}>
                {/* Fila principal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text)' }}>
                    {item.qty}x {item.name}
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--y)', flexShrink: 0 }}>
                    ${(item.price * item.qty).toLocaleString()}
                  </span>
                </div>
                {/* Control cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)', width: '90px' }}>Cantidad</span>
                  {qtyBtn(() => handleQtyChange(item.id, item.qty - 1), '−', 'var(--r)')}
                  <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: 'var(--text)' }}>
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
