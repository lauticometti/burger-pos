import { useState } from 'react'
import { EVENT_BURGERS, EVENT_EXTRAS_BURGER_YA, EVENT_DRINKS_T6, SIZE_LABELS } from './eventMenu'
import { buildCartItem, calcEventSubtotals, getNextOrderNumber, sanitizeEventOrder, determineStatuses } from './eventUtils'
import { EventCart } from './EventCart'
import { EventDrinkModal } from './EventDrinkModal'
import { printEventTickets } from './eventPrinting'

const SHIFT_LABELS = { midday: 'Mediodía', night: 'Noche' }

const BTN = {
  base: {
    border: 'none', cursor: 'pointer', borderRadius: '10px',
    fontFamily: 'inherit', fontWeight: 700,
  },
}

export function EventPOS({ orders, saveEventOrder, user, shift, setShift }) {
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [splitPayment, setSplitPayment] = useState({ efectivo: '', transferencia: '' })
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [cancelTokenRef] = useState({ current: null })
  const [validationError, setValidationError] = useState('')
  const [drinkModal, setDrinkModal] = useState(null) // product def for combo_trago

  function addToCart(product, size = null) {
    if (product.category === 'combo_trago') {
      setDrinkModal(product)
      return
    }
    setCart(prev => [...prev, buildCartItem(product, size)])
  }

  function handleDrinkModalSave({ selections }) {
    if (!drinkModal) return
    const item = buildCartItem(drinkModal, null, { selections })
    setCart(prev => [...prev, item])
    setDrinkModal(null)
  }

  async function handleSave() {
    setValidationError('')
    if (!customerName.trim()) { setValidationError('Falta el nombre del cliente.'); return }
    if (!paymentMethod) { setValidationError('Seleccioná un medio de pago.'); return }
    if (paymentMethod === 'split') {
      const ef = Number(splitPayment.efectivo) || 0
      const tr = Number(splitPayment.transferencia) || 0
      const { total: orderTotal } = calcEventSubtotals(cart)
      if (ef + tr !== orderTotal) {
        const diff = orderTotal - (ef + tr)
        const fmtN = n => '$' + Number(n).toLocaleString('es-AR')
        const msg = diff > 0
          ? `La suma de pagos debe ser igual al total. Faltan ${fmtN(diff)}.`
          : `La suma de pagos debe ser igual al total. Sobran ${fmtN(-diff)}.`
        setValidationError(msg)
        return
      }
    }
    if (cart.length === 0) { setValidationError('El carrito está vacío.'); return }

    setSaving(true)
    try {
      // Re-derive number at save time to minimize duplicates
      const nextNum = getNextOrderNumber(orders, shift)
      const displayOrderCode = `#${nextNum}`
      const { burgerYaSubtotal, drinksT6Subtotal, total } = calcEventSubtotals(cart)
      const { kitchenStatus, barStatus } = determineStatuses(cart)

      const orderData = sanitizeEventOrder({
        eventMode: true,
        eventName: 'birthday',
        eventShift: shift,
        eventShiftLabel: SHIFT_LABELS[shift],
        eventOrderNumber: nextNum,
        displayOrderCode,
        customerName: customerName.trim(),
        paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
        paymentLabel: paymentMethod === 'split' ? 'Efectivo + Transferencia' : null,
        paymentSplit: paymentMethod === 'split'
          ? { efectivo: Number(splitPayment.efectivo) || 0, transferencia: Number(splitPayment.transferencia) || 0 }
          : null,
        paymentStatus: 'paid',
        items: cart,
        burgerYaItems: cart.filter(i => i.area === 'burger_ya'),
        drinksT6Items: cart.filter(i => i.area === 'drinks_t6'),
        burgerYaSubtotal,
        drinksT6Subtotal,
        total,
        kitchenStatus,
        barStatus,
        status: 'active',
        cancelledAt: null,
        cancelledReason: null,
        cancelledByEmail: null,
        cancelledByUid: null,
      })

      const firestoreId = await saveEventOrder(orderData, user)
      const savedOrder = { ...orderData, id: firestoreId }

      setSaving(false)
      const token = { cancelled: false }
      cancelTokenRef.current = token
      setPrinting(true)
      try {
        await printEventTickets(savedOrder, token)
      } finally {
        cancelTokenRef.current = null
        setPrinting(false)
      }

      setCart([])
      setCustomerName('')
      setPaymentMethod('')
      setSplitPayment({ efectivo: '', transferencia: '' })
      setValidationError('')
      return
    } catch (err) {
      console.error('Error guardando pedido evento:', err)
      setValidationError('Error al guardar. Intentá de nuevo.')
    }
    setSaving(false)
  }

  function cancelPrinting() {
    if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', overflow: 'hidden' }}>
      {/* Products panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Shift indicator — birthday event runs night-only, selector hidden */}
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(245,245,245,0.45)', fontWeight: 600 }}>
          Turno: <span style={{ color: '#FFC62A' }}>{SHIFT_LABELS[shift]}</span>
        </div>

        {/* Burgers section */}
        <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'rgba(245,245,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Burgers &amp; extras
        </div>

        {/* Burgers grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {EVENT_BURGERS.map(burger => (
            <div
              key={burger.id}
              style={{
                background: 'var(--panel)', border: '1px solid var(--line)',
                borderRadius: '12px', padding: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.3 }}>
                {burger.name}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {Object.entries(burger.prices).map(([size]) => (
                  <button
                    key={size}
                    onClick={() => addToCart(burger, size)}
                    style={{
                      ...BTN.base,
                      flex: 1, padding: '7px 0', fontSize: '12px',
                      background: 'rgba(255,198,42,0.12)',
                      border: '1px solid rgba(255,198,42,0.25)',
                      color: '#FFC62A',
                    }}
                  >
                    {SIZE_LABELS[size][0]}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
                {Object.entries(burger.prices).map(([size, price]) => (
                  <span key={size} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'rgba(245,245,245,0.35)' }}>
                    ${(price / 1000).toFixed(0)}k
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Extras Burger Ya */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          {EVENT_EXTRAS_BURGER_YA.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              style={{
                ...BTN.base,
                padding: '10px 8px', fontSize: '12px', textAlign: 'center',
                background: 'var(--panel)', border: '1px solid var(--line)',
                color: 'var(--text)', lineHeight: 1.3,
              }}
            >
              <div>{item.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(245,245,245,0.45)', marginTop: '3px' }}>
                ${item.price.toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* Drinks (Tragos combos) section */}
        <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'rgba(245,245,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Tragos — DrinksT6
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {EVENT_DRINKS_T6.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              style={{
                ...BTN.base,
                padding: '14px 10px', fontSize: '13px', textAlign: 'center',
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd', lineHeight: 1.3,
              }}
            >
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '3px' }}>
                ${item.price.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>
                → elegir variedad
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart sidebar */}
      <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        {printing && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
            borderLeft: '1px solid var(--line)',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFC62A' }}>Imprimiendo tickets...</div>
            <button
              onClick={cancelPrinting}
              style={{
                padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', border: '1px solid rgba(239,68,68,0.5)',
                background: 'rgba(239,68,68,0.15)', color: '#f87171',
              }}
            >
              Cancelar impresiones
            </button>
          </div>
        )}
        <EventCart
          cart={cart}
          setCart={setCart}
          onSave={handleSave}
          saving={saving || printing}
          customerName={customerName}
          setCustomerName={setCustomerName}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          splitPayment={splitPayment}
          setSplitPayment={setSplitPayment}
          validationError={validationError}
        />
      </div>

      {drinkModal && (
        <EventDrinkModal
          product={drinkModal}
          onSave={handleDrinkModalSave}
          onClose={() => setDrinkModal(null)}
        />
      )}
    </div>
  )
}
