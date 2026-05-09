import BrandLogo from './BrandLogo'

const BURGER_BASE_PRICE = 6000
const EXTRA_MEAT_PRICE = 3000

const PRODUCTS = [
  { id: 'papas_fritas', name: 'Papas Fritas', price: 3000 },
  { id: 'coca_600', name: 'Coca 600ml', price: 3000 },
  { id: 'coca_225', name: 'Coca 2.25L', price: 6000 },
  { id: 'dip_salsa_secreta', name: 'Dip Salsa Secreta', price: 1000 },
]

export function ProductButtons({ cart, setCart }) {
  const handleBurger = () => {
    setCart(prev => [
      ...prev,
      {
        cartId: `burger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        id: 'smash_burger',
        name: 'Smash Burger',
        basePrice: BURGER_BASE_PRICE,
        meatCount: 1,
        extraMeatPrice: EXTRA_MEAT_PRICE,
        qty: 1,
        price: BURGER_BASE_PRICE,
        lineTotal: BURGER_BASE_PRICE,
      }
    ])
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
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '24px 16px',
      paddingBottom: '140px'
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <BrandLogo />
        <p style={{
          textAlign: 'center',
          color: 'var(--muted)',
          marginBottom: '32px',
          fontSize: '16px'
        }}>
          Sistema de Pedidos
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={handleBurger}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              cursor: 'pointer',
              color: 'var(--text)',
              textAlign: 'left',
              boxShadow: '0 10px 22px rgba(0,0,0,0.9)',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--text)' }}>
              Smash Burger
            </h2>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
              $6.000
            </p>
          </button>
          {PRODUCTS.map(product => (
            <button
              key={product.id}
              onClick={() => handleProduct(product)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius)',
                padding: '16px',
                cursor: 'pointer',
                color: 'var(--text)',
                textAlign: 'left',
                boxShadow: '0 10px 22px rgba(0,0,0,0.9)',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--text)' }}>
                {product.name}
              </h2>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
                ${product.price.toLocaleString()}
              </p>
            </button>
          ))}
        </div>

        {totalItems > 0 && (
          <div style={{
            marginTop: '24px',
            background: 'rgba(255,198,42,0.1)',
            border: '1px solid rgba(255,198,42,0.25)',
            borderRadius: 'var(--radius)',
            padding: '14px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)', margin: 0 }}>
              {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en el pedido
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
