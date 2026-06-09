import { useMemo, useState } from 'react'
import BrandLogo from './BrandLogo'
import {
  SMASH_BASE_PRICE, SMASH_EXTRA_MEAT_PRICE, SMASH_SIZES,
  MENU_BURGERS, MENU_BURGER_SIZES,
  EXTRAS,
  getBurgerDelDiaId, BURGER_DEL_DIA_DESCUENTO,
  SIZE_LABELS,
} from '../data/menu.js'

// ── Botón genérico para take away ───────────────────────────────────────────
function ItemBtn({ label, price, promoPrice, isPromo, onClick }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative',
        flex: '1 1 90px',
        minWidth: '80px',
        maxWidth: '140px',
        height: '64px',
        cursor: 'pointer',
        borderRadius: '12px',
        border: isPromo
          ? '1px solid rgba(255,198,42,0.45)'
          : '1px solid rgba(255,255,255,0.09)',
        background: isPromo
          ? 'linear-gradient(145deg, rgba(255,198,42,0.13) 0%, rgba(255,198,42,0.04) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: pressed
          ? 'none'
          : isPromo
            ? '0 4px 16px rgba(255,198,42,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.01em', lineHeight: 1 }}>
        {label}
      </span>
      {isPromo ? (
        <>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', lineHeight: 1 }}>
            ${price.toLocaleString()}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--y)', lineHeight: 1 }}>
            ${promoPrice.toLocaleString()}
          </span>
        </>
      ) : (
        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--y)', lineHeight: 1 }}>
          ${price.toLocaleString()}
        </span>
      )}
    </button>
  )
}

// ── Botón de tamaño para Burgers c/papas ────────────────────────────────────
function SizeBtn({ label, price, promoPrice, isPromo, onClick }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flex: 1,
        minWidth: 0,
        height: '56px',
        cursor: 'pointer',
        borderRadius: '10px',
        border: isPromo
          ? '1px solid rgba(255,198,42,0.4)'
          : '1px solid rgba(255,255,255,0.08)',
        background: isPromo
          ? 'linear-gradient(145deg, rgba(255,198,42,0.12) 0%, rgba(255,198,42,0.03) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
        boxShadow: pressed
          ? 'none'
          : '0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.01em', lineHeight: 1 }}>
        {label}
      </span>
      {isPromo ? (
        <>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', lineHeight: 1 }}>
            ${price.toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--y)', lineHeight: 1 }}>
            ${promoPrice.toLocaleString()}
          </span>
        </>
      ) : (
        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--y)', lineHeight: 1 }}>
          ${price.toLocaleString()}
        </span>
      )}
    </button>
  )
}

const TABS = [
  { key: 'takeaway', label: 'Take away' },
  { key: 'burgers',  label: 'Burgers c/ papas' },
]

const sectionLabel = (text) => (
  <div style={{
    fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '12px',
  }}>
    {text}
  </div>
)

export function ProductButtons({ cart, setCart }) {
  const burgerDelDiaId = useMemo(() => getBurgerDelDiaId(), [])
  const [activeTab, setActiveTab] = useState('takeaway')

  const handleSmash = (sizeObj) => {
    const { size, meatCount, productOrder } = sizeObj
    const basePrice = SMASH_BASE_PRICE + (meatCount - 1) * SMASH_EXTRA_MEAT_PRICE
    setCart(prev => {
      const existing = prev.find(i => i.id === 'smash_burger' && i.size === size)
      if (existing) {
        return prev.map(i => i.cartId === existing.cartId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, {
        cartId: `smash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id: 'smash_burger', name: 'Smash Burger',
        category: 'burger', categoryOrder: 1, productOrder,
        size, meatCount, qty: 1, basePrice,
        promoType: '', promoAmount: 0, promoReason: '',
        unitPrice: basePrice, price: basePrice, lineTotal: basePrice,
        extraMeatPrice: SMASH_EXTRA_MEAT_PRICE,
        manualPriceApplied: false, manualPrice: 0, manualPriceReason: '', kitchenNote: '',
      }]
    })
  }

  const handleMenuBurger = (burger, sizeObj) => {
    const { size, meatCount } = sizeObj
    const basePrice = burger.prices[size]
    const isPromo = burger.id === burgerDelDiaId
    const promoAmount = isPromo ? BURGER_DEL_DIA_DESCUENTO : 0
    const unitPrice = basePrice - promoAmount

    setCart(prev => {
      const existing = prev.find(i => i.id === burger.id && i.size === size)
      if (existing) {
        return prev.map(i => i.cartId === existing.cartId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, {
        cartId: `${burger.id}-${size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id: burger.id, name: burger.name,
        category: 'burger', categoryOrder: 1, productOrder: burger.productOrder,
        size, meatCount, qty: 1, basePrice,
        promoType: isPromo ? 'burger_del_dia' : '',
        promoAmount, promoPrice: isPromo ? unitPrice : 0,
        promoReason: isPromo ? 'Burger del día' : '',
        unitPrice, price: unitPrice, lineTotal: unitPrice,
        manualPriceApplied: false, manualPrice: 0, manualPriceReason: '', kitchenNote: '',
      }]
    })
  }

  const handleExtra = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const totalItems = cart.reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <div style={{ background: 'var(--bg)', padding: '16px 16px 32px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <BrandLogo />
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginBottom: '20px', fontSize: '13px', letterSpacing: '0.05em' }}>
          SISTEMA DE PEDIDOS
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: active ? '1px solid rgba(255,198,42,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  background: active
                    ? 'linear-gradient(145deg, rgba(255,198,42,0.15) 0%, rgba(255,198,42,0.05) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  color: active ? 'var(--y)' : 'rgba(255,255,255,0.4)',
                  fontWeight: '700',
                  fontSize: '13px',
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  boxShadow: active ? '0 2px 12px rgba(255,198,42,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
          {totalItems > 0 && (
            <span style={{
              marginLeft: 'auto', alignSelf: 'center',
              fontSize: '12px', fontWeight: '700', color: 'var(--y)',
              background: 'rgba(255,198,42,0.1)',
              border: '1px solid rgba(255,198,42,0.2)',
              borderRadius: '20px',
              padding: '3px 10px',
            }}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {/* Tab: Take away */}
        {activeTab === 'takeaway' && (
          <>
            <div style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
              padding: '16px 18px',
              marginBottom: '10px',
            }}>
              {sectionLabel('Smash Burger')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SMASH_SIZES.map(s => (
                  <ItemBtn
                    key={s.size}
                    label={s.label}
                    price={SMASH_BASE_PRICE + (s.meatCount - 1) * SMASH_EXTRA_MEAT_PRICE}
                    isPromo={false}
                    onClick={() => handleSmash(s)}
                  />
                ))}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
              padding: '16px 18px',
            }}>
              {sectionLabel('Extras')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {EXTRAS.map(product => (
                  <ItemBtn
                    key={product.id}
                    label={product.btnLabel}
                    price={product.price}
                    isPromo={false}
                    onClick={() => handleExtra(product)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tab: Burgers c/ papas */}
        {activeTab === 'burgers' && (
          <div style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}>
            {MENU_BURGERS.map((burger, idx) => {
              const isPromo = burger.id === burgerDelDiaId
              const isUnavailable = burger.unavailable === true
              return (
                <div key={burger.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  minHeight: '76px',
                  borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  background: isUnavailable ? 'rgba(255,255,255,0.01)' : isPromo ? 'rgba(255,198,42,0.03)' : 'transparent',
                  borderLeft: isUnavailable ? '3px solid rgba(255,80,80,0.5)' : isPromo ? '3px solid rgba(255,198,42,0.5)' : '3px solid transparent',
                  opacity: isUnavailable ? 0.6 : 1,
                }}>
                  {/* Nombre */}
                  <div style={{ width: 'clamp(70px, 18%, 110px)', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2 }}>
                      {burger.name}
                    </div>
                    {isUnavailable && (
                      <div style={{
                        fontSize: '10px', fontWeight: '700', color: '#ff5050',
                        marginTop: '4px',
                        background: 'rgba(255,80,80,0.12)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        display: 'inline-block',
                      }}>
                        No disponible
                      </div>
                    )}
                    {!isUnavailable && isPromo && (
                      <div style={{
                        fontSize: '10px', fontWeight: '700', color: 'var(--y)',
                        marginTop: '4px',
                        background: 'rgba(255,198,42,0.1)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        display: 'inline-block',
                      }}>
                        −${BURGER_DEL_DIA_DESCUENTO.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: '8px', flex: 1, pointerEvents: isUnavailable ? 'none' : 'auto' }}>
                    {MENU_BURGER_SIZES.map(s => {
                      const base = burger.prices[s.size]
                      const promoPrice = base - BURGER_DEL_DIA_DESCUENTO
                      return (
                        <SizeBtn
                          key={s.size}
                          label={s.label}
                          price={base}
                          promoPrice={promoPrice}
                          isPromo={!isUnavailable && isPromo}
                          onClick={() => handleMenuBurger(burger, s)}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
