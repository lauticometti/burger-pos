import { useState } from 'react'
import { BURGER_ADDONS } from './eventMenu'

export function EventBurgerModal({ item, burgerDef, onSave, onClose }) {
  const [removedIngredients, setRemovedIngredients] = useState(
    item.customizations?.removedIngredients ?? []
  )
  const [extras, setExtras] = useState(
    item.customizations?.extras ?? []
  )

  const allowedAddonIds = burgerDef?.allowedExtras ?? []
  const allowedAddons = BURGER_ADDONS.filter(a => allowedAddonIds.includes(a.id))
  const removable = burgerDef?.removableIngredients ?? []

  function toggleRemoved(ing) {
    setRemovedIngredients(prev =>
      prev.includes(ing) ? prev.filter(r => r !== ing) : [...prev, ing]
    )
  }

  function toggleExtra(addon) {
    const exists = extras.find(e => e.id === addon.id)
    if (exists) {
      setExtras(prev => prev.filter(e => e.id !== addon.id))
    } else {
      setExtras(prev => [...prev, { id: addon.id, name: addon.name, price: addon.price }])
    }
  }

  function handleSave() {
    onSave({ extras, removedIngredients })
  }

  const extrasTotal = extras.reduce((s, e) => s + e.price, 0)
  const basePrice = item.unitPrice

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '14px', padding: '20px', maxWidth: '480px', width: '100%',
        maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#f5f5f5', marginBottom: '4px' }}>
          Modificar — {item.sizeLabel} {item.name}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(245,245,245,0.5)', marginBottom: '16px' }}>
          Base: ${basePrice.toLocaleString()}
          {extrasTotal > 0 ? ` + $${extrasTotal.toLocaleString()} en extras` : ''}
        </div>

        {removable.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Quitar ingredientes
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {removable.map(ing => {
                const active = removedIngredients.includes(ing)
                return (
                  <button
                    key={ing}
                    onClick={() => toggleRemoved(ing)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      background: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                      borderColor: active ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)',
                      color: active ? '#f87171' : '#ccc',
                    }}
                  >
                    {active ? '✕ ' : ''}{ing}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {allowedAddons.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Agregar extras
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {allowedAddons.map(addon => {
                const active = extras.some(e => e.id === addon.id)
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleExtra(addon)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      background: active ? 'rgba(255,198,42,0.15)' : 'rgba(255,255,255,0.05)',
                      borderColor: active ? 'rgba(255,198,42,0.6)' : 'rgba(255,255,255,0.15)',
                      color: active ? '#FFC62A' : '#ccc',
                    }}
                  >
                    {active ? '+ ' : ''}{addon.name} <span style={{ opacity: 0.7 }}>${addon.price.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {removable.length === 0 && allowedAddons.length === 0 && (
          <div style={{ color: 'rgba(245,245,245,0.5)', fontSize: '13px', marginBottom: '16px' }}>
            Esta burger no tiene modificaciones disponibles.
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
              cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#f5f5f5',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
              cursor: 'pointer', border: 'none', background: '#FFC62A', color: '#000',
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
