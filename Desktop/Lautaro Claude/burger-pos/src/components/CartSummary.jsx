import { useState } from 'react'
import { isValidCode, applyHiddenCode, removeHiddenCodeBenefit } from '../utils/hiddenCode'
import { sortCartItems } from '../utils/cartSort'
import { clearOrderFromStorage } from '../hooks/useLocalOrderPersistence'
import { getItemUnitPrice, getItemLineTotal, getItemDisplayName } from '../utils/orderUtils'
import { BURGER_ADDONS } from '../data/addons'

export function CartSummary({ cart, setCart, onViewFull, compact }) {
  const [codeInput, setCodeInput] = useState('')
  const [addonModalId, setAddonModalId] = useState(null)
  const [selectedAddonIds, setSelectedAddonIds] = useState([])

  // ── Cantidad ────────────────────────────────────────────────────────────────
  const handleBurgerQty = (cartId, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId)
      if (!item) return prev
      const next = (item.qty || 1) + delta
      if (next <= 0) return prev.filter(i => i.cartId !== cartId)
      return prev.map(i => i.cartId === cartId ? { ...i, qty: next } : i)
    })
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

  const handleRemoveBurger = (cartId) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId))
  }

  const handleSeparateUnit = (item) => {
    const newId = `${item.cartId}_sep_${Date.now()}`
    setCart(prev => prev.map(i => i.cartId === item.cartId
      ? { ...i, qty: i.qty - 1 }
      : i
    ).concat([{ ...item, cartId: newId, qty: 1 }]))
  }

  // ── kitchenNote inline ──────────────────────────────────────────────────────
  const handleKitchenNote = (cartId, value) => {
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, kitchenNote: value } : i))
  }

  // ── Addons ──────────────────────────────────────────────────────────────────
  const openAddonModal = (item) => {
    setAddonModalId(item.cartId)
    setSelectedAddonIds((item.addons ?? []).map(a => a.id))
  }

  const toggleAddonId = (id) => {
    setSelectedAddonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const applyAddons = (item) => {
    const selectedAddons = BURGER_ADDONS.filter(a => selectedAddonIds.includes(a.id))
    const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0)
    // Recalcular desde base para evitar duplicar addons anteriores
    const effectiveBase = (item.basePrice ?? 0) - (item.promoAmount ?? 0)
    const newUnitPrice = effectiveBase + addonsTotal
    setCart(prev => prev.map(i => i.cartId === item.cartId
      ? {
          ...i,
          addons: selectedAddons,
          addonsTotal,
          // No tocar unitPrice si manualPriceApplied — el manual manda
          unitPrice: i.manualPriceApplied ? i.unitPrice : newUnitPrice,
        }
      : i
    ))
    setAddonModalId(null)
    setSelectedAddonIds([])
  }

  // ── Precio manual ───────────────────────────────────────────────────────────
  const [showVaciarConfirm, setShowVaciarConfirm] = useState(false)
  const [editingPrice, setEditingPrice] = useState(null) // cartId o null
  const [manualPriceInput, setManualPriceInput] = useState('')
  const [manualPriceReason, setManualPriceReason] = useState('')

  const openEditPrice = (item) => {
    setEditingPrice(item.cartId)
    setManualPriceInput(String(item.manualPriceApplied ? item.manualPrice : getItemUnitPrice(item)))
    setManualPriceReason(item.manualPriceReason || '')
  }

  const cancelEditPrice = () => {
    setEditingPrice(null)
    setManualPriceInput('')
    setManualPriceReason('')
  }

  const confirmEditPrice = (cartId) => {
    const price = Number(manualPriceInput)
    if (isNaN(price) || price < 0) return
    if (!manualPriceReason.trim()) return
    setCart(prev => prev.map(i => i.cartId !== cartId ? i : {
      ...i,
      manualPriceApplied: true,
      manualPrice: price,
      manualPriceReason: manualPriceReason.trim(),
      unitPrice: price,
      price,
    }))
    cancelEditPrice()
  }

  const clearManualPrice = (cartId) => {
    setCart(prev => prev.map(i => i.cartId !== cartId ? i : {
      ...i,
      manualPriceApplied: false,
      manualPrice: 0,
      manualPriceReason: '',
      unitPrice: i.promoType === 'burger_del_dia' ? i.promoPrice ?? i.basePrice : i.basePrice,
      price:     i.promoType === 'burger_del_dia' ? i.promoPrice ?? i.basePrice : i.basePrice,
    }))
  }

  // ── Descuento código ────────────────────────────────────────────────────────
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
    setShowVaciarConfirm(true)
  }

  const confirmVaciar = () => {
    setCart([])
    clearOrderFromStorage()
    setShowVaciarConfirm(false)
  }

  const sortedCart = sortCartItems(cart)

  const total = cart.reduce((sum, item) => sum + getItemLineTotal(item), 0)

  const hasCodeBenefit = cart.some(item => item.isHiddenCodeBenefit)

  const qtyBtn = (onClick, label, color) => (
    <button
      onClick={onClick}
      style={{
        background: color,
        color: color === 'var(--r)' ? 'white' : '#000',
        width: '28px', height: '28px',
        borderRadius: '8px', border: 'none',
        fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          {!compact && <h1 className="cart-title" style={{ fontSize: '22px' }}>Pedido</h1>}
          {compact  && <span className="cart-title" style={{ fontSize: '15px' }}>Pedido</span>}
        </div>

        {cart.length > 0 && (
          <div className="cart-summary-row">
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {totalLineas} {totalLineas === 1 ? 'producto' : 'productos'} · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}
            </span>
            {showVaciarConfirm ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>¿Vaciar?</span>
                <button
                  onClick={() => setShowVaciarConfirm(false)}
                  style={{
                    fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                    border: '1px solid var(--line)', background: 'transparent',
                    color: 'var(--text)', cursor: 'pointer',
                  }}
                >Cancelar</button>
                <button
                  onClick={confirmVaciar}
                  style={{
                    fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                    border: 'none', background: '#c0392b',
                    color: '#fff', fontWeight: 700, cursor: 'pointer',
                  }}
                >Vaciar</button>
              </span>
            ) : (
              <button className="clear-cart-button" onClick={handleVaciar}>Vaciar</button>
            )}
          </div>
        )}

        {cart.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '24px 0' }}>
            El pedido está vacío
          </div>
        )}

        {cart.length > 0 && (
          <div style={{
            background: 'var(--panel)', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: compact ? '10px' : '16px',
            marginBottom: '16px',
          }}>
            {sortedCart.map(item => {
              const isBurger = item.category === 'burger' || item.cartId
              if (isBurger) {
                const effectivePrice = getItemUnitPrice(item)
                const lt = effectivePrice * (item.qty || 1)
                const qty = item.qty || 1
                const hasPromo = !!item.promoType
                const hasManual = !!item.manualPriceApplied
                const isEditingThis = editingPrice === item.cartId

                return (
                  <div key={item.cartId} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    {/* Fila nombre + precio */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text)' }}>
                          {qty}x {getItemDisplayName(item)}
                        </span>
                        {/* Badge promo */}
                        {hasPromo && !hasManual && (
                          <span style={{
                            display: 'inline-block', marginLeft: '6px',
                            fontSize: '10px', color: 'var(--y)',
                            background: 'rgba(255,198,42,0.1)', border: '1px solid rgba(255,198,42,0.3)',
                            borderRadius: '4px', padding: '1px 5px', fontWeight: '700',
                          }}>
                            Burger del día
                          </span>
                        )}
                        {/* Badge manual */}
                        {hasManual && (
                          <span style={{
                            display: 'inline-block', marginLeft: '6px',
                            fontSize: '10px', color: '#60a5fa',
                            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
                            borderRadius: '4px', padding: '1px 5px', fontWeight: '700',
                          }}>
                            Precio manual
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {/* Precio tachado si hay promo o manual */}
                        {(hasPromo || hasManual) && (
                          <span style={{ fontSize: '11px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                            ${(Number.isFinite(Number(item.basePrice)) ? Number(item.basePrice) * qty : 0).toLocaleString()}
                          </span>
                        )}
                        <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--y)' }}>
                          ${lt.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleRemoveBurger(item.cartId)}
                          style={{
                            background: 'rgba(255,49,49,0.15)', color: 'var(--r)',
                            border: '1px solid rgba(255,49,49,0.3)', borderRadius: '8px',
                            width: '24px', height: '24px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 'bold', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >×</button>
                      </div>
                    </div>

                    {/* Motivo precio manual */}
                    {hasManual && item.manualPriceReason && (
                      <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '2px' }}>
                        {item.manualPriceReason}
                      </div>
                    )}

                    {/* Controles: cantidad + kitchenNote + precio manual */}
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', width: '72px' }}>Cantidad</span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, -1), '−', 'var(--r)')}
                      <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>{qty}</span>
                      {qtyBtn(() => handleBurgerQty(item.cartId, +1), '+', 'var(--y)')}
                      {qty > 1 && (
                        <button
                          onClick={() => handleSeparateUnit(item)}
                          style={{
                            fontSize: '11px', color: 'var(--muted)', background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
                            cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit',
                          }}
                        >Separar unidad</button>
                      )}
                    </div>

                    {/* kitchenNote inline */}
                    <div style={{ marginTop: '6px' }}>
                      <input
                        type="text"
                        value={item.kitchenNote || ''}
                        onChange={e => handleKitchenNote(item.cartId, e.target.value)}
                        placeholder="Nota cocina: sin cheddar, extra barbacoa..."
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '5px 10px', fontSize: '12px',
                          background: item.kitchenNote ? 'rgba(255,198,42,0.06)' : 'rgba(255,255,255,0.03)',
                          border: item.kitchenNote ? '1px solid rgba(255,198,42,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px', color: item.kitchenNote ? 'var(--y)' : 'var(--muted)',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>

                    {/* Addons */}
                    <div style={{ marginTop: '4px' }}>
                      {item.addons?.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>
                          Agregados: {item.addons.map(a => a.name).join(', ')}
                          {item.manualPriceApplied && (
                            <span style={{ marginLeft: '6px', color: '#60a5fa' }}>· Precio manual activo</span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => openAddonModal(item)}
                        style={{
                          fontSize: '11px', color: 'var(--muted)', background: 'transparent',
                          border: 'none', cursor: 'pointer', padding: '2px 0',
                          textDecoration: 'underline', fontFamily: 'inherit',
                        }}
                      >
                        {item.addons?.length > 0 ? 'Editar agregados' : 'Agregados'}
                      </button>
                    </div>

                    {/* Panel de addons */}
                    {addonModalId === item.cartId && (
                      <div style={{
                        marginTop: '6px', padding: '10px 12px',
                        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agregados</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {BURGER_ADDONS.map(addon => {
                            const checked = selectedAddonIds.includes(addon.id)
                            return (
                              <button
                                key={addon.id}
                                onClick={() => toggleAddonId(addon.id)}
                                style={{
                                  padding: '4px 10px', fontSize: '12px', borderRadius: '999px',
                                  border: checked ? '1px solid var(--y)' : '1px solid rgba(255,255,255,0.15)',
                                  background: checked ? 'rgba(255,198,42,0.15)' : 'transparent',
                                  color: checked ? 'var(--y)' : 'var(--muted)',
                                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: checked ? '700' : '400',
                                }}
                              >
                                {addon.name} <span style={{ fontSize: '10px', opacity: 0.7 }}>+${addon.price.toLocaleString()}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => applyAddons(item)}
                            style={{
                              padding: '6px 16px', fontSize: '12px', fontWeight: '700',
                              background: 'var(--y)', color: '#000',
                              border: 'none', borderRadius: '6px', cursor: 'pointer',
                            }}
                          >Aplicar</button>
                          <button
                            onClick={() => { setAddonModalId(null); setSelectedAddonIds([]) }}
                            style={{
                              padding: '6px 12px', fontSize: '12px',
                              background: 'transparent', color: 'var(--muted)',
                              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer',
                            }}
                          >Cancelar</button>
                        </div>
                      </div>
                    )}

                    {/* Precio manual */}
                    {!isEditingThis ? (
                      <div style={{ marginTop: '4px' }}>
                        <button
                          onClick={() => openEditPrice(item)}
                          style={{
                            fontSize: '11px', color: hasManual ? '#60a5fa' : 'var(--muted)',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: '2px 0', textDecoration: 'underline', fontFamily: 'inherit',
                          }}
                        >
                          {hasManual ? `Precio manual: $${item.manualPrice.toLocaleString()} · Editar` : 'Editar precio'}
                        </button>
                        {hasManual && (
                          <button
                            onClick={() => clearManualPrice(item.cartId)}
                            style={{
                              fontSize: '11px', color: 'var(--muted)', marginLeft: '8px',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              textDecoration: 'underline', fontFamily: 'inherit',
                            }}
                          >
                            Quitar manual
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={manualPriceInput}
                            onChange={e => setManualPriceInput(e.target.value)}
                            placeholder="Precio"
                            autoFocus
                            style={{
                              width: '100px', padding: '5px 8px', fontSize: '13px',
                              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
                              borderRadius: '6px', color: 'var(--text)', fontFamily: 'inherit',
                            }}
                          />
                          <input
                            type="text"
                            value={manualPriceReason}
                            onChange={e => setManualPriceReason(e.target.value)}
                            placeholder="Motivo (obligatorio)"
                            style={{
                              flex: 1, padding: '5px 8px', fontSize: '13px',
                              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
                              borderRadius: '6px', color: 'var(--text)', fontFamily: 'inherit',
                            }}
                          />
                          <button
                            onClick={() => confirmEditPrice(item.cartId)}
                            disabled={!manualPriceReason.trim()}
                            style={{
                              padding: '5px 10px', background: manualPriceReason.trim() ? 'var(--y)' : 'rgba(255,255,255,0.08)',
                              color: manualPriceReason.trim() ? '#000' : 'var(--muted)',
                              border: 'none', borderRadius: '6px', cursor: manualPriceReason.trim() ? 'pointer' : 'not-allowed',
                              fontSize: '12px', fontWeight: '700',
                            }}
                          >OK</button>
                          <button
                            onClick={cancelEditPrice}
                            style={{
                              padding: '5px 8px', background: 'transparent', color: 'var(--muted)',
                              border: '1px solid var(--line)', borderRadius: '6px',
                              cursor: 'pointer', fontSize: '12px',
                            }}
                          >✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              // Producto normal (extras)
              return (
                <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text)' }}>
                      {item.qty}x {item.name}
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--y)', flexShrink: 0 }}>
                      ${getItemLineTotal(item).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', width: '72px' }}>Cantidad</span>
                    {qtyBtn(() => handleQtyChange(item.id, item.qty - 1), '−', 'var(--r)')}
                    <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>{item.qty}</span>
                    {qtyBtn(() => handleQtyChange(item.id, item.qty + 1), '+', 'var(--y)')}
                  </div>
                </div>
              )
            })}

            {/* Código descuento */}
            <div style={{
              borderTop: '1px solid var(--line)', paddingTop: '12px',
              marginTop: '12px', marginBottom: '12px', display: 'flex', gap: '8px',
            }}>
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                placeholder="Código de descuento"
                style={{
                  flex: 1, padding: '10px 14px', fontSize: '14px',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                  background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleApplyCode}
                style={{
                  padding: '10px 14px', fontSize: '14px', background: 'var(--y)',
                  color: '#000', border: 'none', borderRadius: 'var(--radius)',
                  fontWeight: 'bold', cursor: 'pointer',
                }}
              >Aplicar</button>
              {hasCodeBenefit && (
                <button
                  onClick={handleRemoveCode}
                  style={{
                    padding: '10px 14px', fontSize: '14px',
                    background: 'rgba(255,49,49,0.15)', color: 'var(--r)',
                    border: '1px solid var(--r)', borderRadius: 'var(--radius)',
                    fontWeight: 'bold', cursor: 'pointer',
                  }}
                >Remover</button>
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

        {compact && cart.length > 0 && onViewFull && (
          <button
            onClick={onViewFull}
            style={{
              background: 'transparent', border: 'none', color: 'var(--muted)',
              fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
              padding: '4px 0', display: 'block', marginBottom: '8px',
            }}
          >Ver pedido completo</button>
        )}
      </div>
    </div>
  )
}
