import BrandLogo from './BrandLogo'

const BURGER_BASE_PRICE = 6000
const EXTRA_MEAT_PRICE = 3000

const BURGER_SIZES = [
  { meatCount: 1, label: 'Simple',    productOrder: 1 },
  { meatCount: 2, label: 'Doble',     productOrder: 2 },
  { meatCount: 3, label: 'Triple',    productOrder: 3 },
  { meatCount: 4, label: 'Cuádruple', productOrder: 4 },
  { meatCount: 5, label: 'Quíntuple', productOrder: 5 },
  { meatCount: 6, label: 'Séxtuple',  productOrder: 6 },
]

const PRODUCTS = [
  { id: 'papas_fritas',      name: 'Papas Fritas',     btnLabel: 'Papas',    price: 3000, category: 'papas',   categoryOrder: 2, productOrder: 1 },
  { id: 'coca_600',          name: 'Coca 600ml',        btnLabel: 'Coca 600', price: 3000, category: 'bebidas', categoryOrder: 3, productOrder: 1 },
  { id: 'coca_225',          name: 'Coca 2.25L',        btnLabel: 'Coca 2.25',price: 6000, category: 'bebidas', categoryOrder: 3, productOrder: 2 },
  { id: 'dip_salsa_secreta', name: 'Dip Salsa Secreta', btnLabel: 'Dip',      price: 1000, category: 'dips',    categoryOrder: 4, productOrder: 1 },
]

const sectionTitle = (text) => (
  <div style={{
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    marginBottom: '8px',
  }}>
    {text}
  </div>
)

const burgerBtn = (label, price, onClick) => (
  <button
    key={label}
    onClick={onClick}
    style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 'var(--radius)',
      padding: '14px 10px',
      cursor: 'pointer',
      color: 'var(--text)',
      textAlign: 'center',
      boxShadow: '0 6px 16px rgba(0,0,0,0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
  >
    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text)' }}>{label}</span>
    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--y)' }}>${price.toLocaleString()}</span>
  </button>
)

const extraBtn = (label, price, onClick) => (
  <button
    key={label}
    onClick={onClick}
    style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 'var(--radius)',
      padding: '14px 10px',
      cursor: 'pointer',
      color: 'var(--text)',
      textAlign: 'center',
      boxShadow: '0 6px 16px rgba(0,0,0,0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
  >
    <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text)' }}>{label}</span>
    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--y)' }}>${price.toLocaleString()}</span>
  </button>
)

export function ProductButtons({ cart, setCart }) {
  const handleBurger = (meatCount, productOrder) => {
    setCart(prev => {
      const existing = prev.find(item => item.cartId && item.meatCount === meatCount && !item.noCheddar)
      if (existing) {
        return prev.map(item =>
          item.cartId === existing.cartId ? { ...item, qty: item.qty + 1 } : item
        )
      }
      const unitPrice = BURGER_BASE_PRICE + (meatCount - 1) * EXTRA_MEAT_PRICE
      return [
        ...prev,
        {
          cartId: `burger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          id: 'smash_burger',
          name: 'Smash Burger',
          category: 'burger',
          categoryOrder: 1,
          productOrder,
          basePrice: BURGER_BASE_PRICE,
          meatCount,
          extraMeatPrice: EXTRA_MEAT_PRICE,
          qty: 1,
          price: unitPrice,
          lineTotal: unitPrice,
        }
      ]
    })
  }

  const handleProduct = (product) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ))
    } else {
      setCart([...cart, { ...product, qty: 1 }])
    }
  }

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div style={{ background: 'var(--bg)', padding: '24px 16px 32px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <BrandLogo />
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '32px', fontSize: '16px' }}>
          Sistema de Pedidos
        </p>

        {/* Sección Smash Burger */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          marginBottom: '12px',
          boxShadow: '0 10px 28px rgba(0,0,0,0.8)',
        }}>
          {sectionTitle('Smash Burger')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {BURGER_SIZES.map(({ meatCount, label, productOrder }) => {
              const unitPrice = BURGER_BASE_PRICE + (meatCount - 1) * EXTRA_MEAT_PRICE
              return burgerBtn(label, unitPrice, () => handleBurger(meatCount, productOrder))
            })}
          </div>
        </div>

        {/* Sección Extras */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          boxShadow: '0 10px 28px rgba(0,0,0,0.8)',
        }}>
          {sectionTitle('Extras')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {PRODUCTS.map(product =>
              extraBtn(product.btnLabel, product.price, () => handleProduct(product))
            )}
          </div>
        </div>

        {totalItems > 0 && (
          <div style={{
            marginTop: '16px',
            background: 'rgba(255,198,42,0.1)',
            border: '1px solid rgba(255,198,42,0.25)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
              {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en el pedido
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
