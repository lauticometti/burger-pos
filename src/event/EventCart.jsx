import { useState } from 'react'
import { calcEventSubtotals, getDisplayName, groupCartForDisplay, sortCartItems } from './eventUtils'
import { EVENT_BURGERS } from './eventMenu'
import { EventModal } from './EventModal'
import { EventBurgerModal } from './EventBurgerModal'

function fmt(n) {
  return '$' + Number(n ?? 0).toLocaleString('es-AR')
}

export function EventCart({ cart, setCart, onSave, saving, customerName, setCustomerName, paymentMethod, setPaymentMethod, validationError }) {
  const [clearModal, setClearModal] = useState(false)
  const [removeModal, setRemoveModal] = useState(null) // { cartItemIds, label }
  const [burgerModal, setBurgerModal] = useState(null) // single item to modify

  const { burgerYaSubtotal, drinksT6Subtotal, total } = calcEventSubtotals(cart)
  const hasBurgerYa = cart.some(i => i.area === 'burger_ya')
  const hasDrinksT6 = cart.some(i => i.area === 'drinks_t6')

  const groups = groupCartForDisplay(sortCartItems(cart))

  function removeItems(cartItemIds) {
    setCart(prev => prev.filter(i => !cartItemIds.includes(i.cartItemId)))
  }

  function handleRemoveGroup(group) {
    const rep = group.representative
    const hasCustomizations =
      (rep.customizations?.extras?.length > 0) ||
      (rep.customizations?.removedIngredients?.length > 0)
    if (rep.category === 'burger' && hasCustomizations) {
      setRemoveModal({ cartItemIds: group.cartItemIds, label: getDisplayName(rep) })
    } else {
      removeItems(group.cartItemIds)
    }
  }

  // Split one item out of a group so it can be individually modified
  function separateOne(group) {
    const idToSplit = group.cartItemIds[0]
    setCart(prev => prev.map(i =>
      i.cartItemId === idToSplit ? { ...i, forceUngroup: true } : i
    ))
  }

  function handleBurgerModifySave({ extras, removedIngredients }) {
    const item = burgerModal
    const burgerDef = EVENT_BURGERS.find(b => b.id === item.id)
    const extrasTotal = extras.reduce((s, e) => s + e.price, 0)
    const newTotalPrice = (burgerDef?.prices[item.size] ?? item.unitPrice) + extrasTotal
    setCart(prev => prev.map(i =>
      i.cartItemId === item.cartItemId
        ? { ...i, customizations: { extras, removedIngredients }, totalPrice: newTotalPrice, forceUngroup: false }
        : i
    ))
    setBurgerModal(null)
  }

  const totalItems = cart.reduce((s, i) => s + (i.quantity ?? 1), 0)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg)', borderLeft: '1px solid var(--line)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
          Carrito {totalItems > 0 ? `(${totalItems})` : ''}
        </span>
        {cart.length > 0 && (
          <button
            onClick={() => setClearModal(true)}
            style={{
              background: 'none', border: 'none', color: 'rgba(239,68,68,0.7)',
              fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Vaciar
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {cart.length === 0 && (
          <div style={{ color: 'rgba(245,245,245,0.3)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
            Sin productos
          </div>
        )}
        {groups.map(group => {
          const rep = group.representative
          const displayName = getDisplayName(rep)
          const isBurger = rep.category === 'burger'
          const hasCustomizations =
            (rep.customizations?.extras?.length > 0) ||
            (rep.customizations?.removedIngredients?.length > 0)
          const isGrouped = group.cartItemIds.length > 1

          return (
            <div key={group.key} style={{
              marginBottom: '8px', padding: '8px 10px',
              background: 'var(--panel)', borderRadius: '8px',
              border: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                    {isBurger ? (
                      <>
                        {group.quantity > 1 && (
                          <span style={{ color: '#FFC62A', marginRight: '4px' }}>{group.quantity}×</span>
                        )}
                        {displayName}
                      </>
                    ) : (
                      // drinks/extras: show real quantity inline — "4 Fernet", "2 Papas"
                      group.quantity > 1
                        ? <><span style={{ color: '#c4b5fd', marginRight: '4px' }}>{group.quantity}</span>{displayName}</>
                        : displayName
                    )}
                  </div>
                  {(rep.customizations?.extras ?? []).map(e => (
                    <div key={e.id} style={{ fontSize: '11px', color: '#FFC62A', paddingLeft: '8px', marginTop: '2px' }}>
                      + {e.name} {fmt(e.price)}
                    </div>
                  ))}
                  {(rep.customizations?.removedIngredients ?? []).map(r => (
                    <div key={r} style={{ fontSize: '11px', color: 'rgba(239,68,68,0.7)', paddingLeft: '8px', marginTop: '2px' }}>
                      - Sin {r}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {isBurger && !isGrouped && (
                      <button
                        onClick={() => setBurgerModal(rep)}
                        style={{
                          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                          fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                        }}
                      >
                        {hasCustomizations ? 'Editar ingredientes' : 'Modificar ingredientes'}
                      </button>
                    )}
                    {isBurger && isGrouped && (
                      <button
                        onClick={() => separateOne(group)}
                        style={{
                          background: 'none', border: 'none', color: 'rgba(255,198,42,0.5)',
                          fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                        }}
                      >
                        Separar una
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{fmt(group.totalPrice)}</span>
                  <button
                    onClick={() => handleRemoveGroup(group)}
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', width: '22px', height: '22px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Subtotals */}
      {cart.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: '12px' }}>
          {hasBurgerYa && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(245,245,245,0.6)', marginBottom: '4px' }}>
              <span>Burger Ya</span><span>{fmt(burgerYaSubtotal)}</span>
            </div>
          )}
          {hasDrinksT6 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(245,245,245,0.6)', marginBottom: '4px' }}>
              <span>DrinksT6</span><span>{fmt(drinksT6Subtotal)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', color: '#FFC62A', marginTop: '6px' }}>
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
        <input
          placeholder="Nombre del cliente *"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          style={{
            width: '100%', background: 'var(--panel)', border: '1px solid var(--line)',
            borderRadius: '8px', padding: '9px 12px', color: 'var(--text)',
            fontSize: '14px', marginBottom: '8px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {['efectivo', 'transferencia'].map(m => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              style={{
                flex: 1, padding: '9px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', border: '1px solid',
                background: paymentMethod === m ? 'rgba(255,198,42,0.15)' : 'var(--panel)',
                borderColor: paymentMethod === m ? 'rgba(255,198,42,0.6)' : 'var(--line)',
                color: paymentMethod === m ? '#FFC62A' : 'rgba(245,245,245,0.6)',
              }}
            >
              {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
            </button>
          ))}
        </div>
        {validationError && (
          <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px', fontWeight: 600 }}>
            {validationError}
          </div>
        )}
        <button
          onClick={onSave}
          disabled={saving || cart.length === 0}
          style={{
            width: '100%', padding: '13px', borderRadius: '10px', fontWeight: 700, fontSize: '15px',
            cursor: cart.length === 0 || saving ? 'not-allowed' : 'pointer', border: 'none',
            background: cart.length === 0 || saving ? 'rgba(255,255,255,0.08)' : '#FFC62A',
            color: cart.length === 0 || saving ? 'rgba(245,245,245,0.4)' : '#000',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar e imprimir'}
        </button>
      </div>

      {clearModal && (
        <EventModal
          title="¿Vaciar pedido?"
          body="Se van a borrar todos los productos cargados."
          onClose={() => setClearModal(false)}
          buttons={[
            { label: 'Cancelar', onClick: () => setClearModal(false) },
            { label: 'Vaciar pedido', danger: true, onClick: () => { setCart([]); setClearModal(false) } },
          ]}
        />
      )}

      {removeModal && (
        <EventModal
          title="¿Quitar esta burger?"
          body={`"${removeModal.label}" tiene modificaciones cargadas.`}
          onClose={() => setRemoveModal(null)}
          buttons={[
            { label: 'Cancelar', onClick: () => setRemoveModal(null) },
            { label: 'Quitar', danger: true, onClick: () => { removeItems(removeModal.cartItemIds); setRemoveModal(null) } },
          ]}
        />
      )}

      {burgerModal && (
        <EventBurgerModal
          item={burgerModal}
          burgerDef={EVENT_BURGERS.find(b => b.id === burgerModal.id)}
          onSave={handleBurgerModifySave}
          onClose={() => setBurgerModal(null)}
        />
      )}
    </div>
  )
}
