import { useState } from 'react'
import { DRINK_VARIETIES } from './eventMenu'

/**
 * Modal para seleccionar variedades de tragos en combos.
 * selectCount = 1 → elegir exactamente 1 variedad
 * selectCount = 2 → elegir exactamente 2 variedades (con repetición)
 */
export function EventDrinkModal({ product, onSave, onClose }) {
  const count = product.selectCount ?? 1
  // selections = array de nombres de variedad, length === count
  const [selections, setSelections] = useState(Array(count).fill(null))

  function choose(slotIdx, varietyName) {
    setSelections(prev => {
      const next = [...prev]
      next[slotIdx] = varietyName
      return next
    })
  }

  const allFilled = selections.every(s => s !== null)

  function handleSave() {
    if (!allFilled) return
    onSave({ selections })
  }

  const slotLabels = count === 1 ? ['Variedad'] : ['Trago 1', 'Trago 2']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '14px', padding: '20px', maxWidth: '380px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#f5f5f5', marginBottom: '4px' }}>
          {product.name}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(245,245,245,0.5)', marginBottom: '20px' }}>
          Elegí {count === 1 ? 'una variedad' : 'dos variedades (podés repetir)'}
        </div>

        {selections.map((selected, slotIdx) => (
          <div key={slotIdx} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              {slotLabels[slotIdx]}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DRINK_VARIETIES.map(v => {
                const active = selected === v.name
                return (
                  <button
                    key={v.id}
                    onClick={() => choose(slotIdx, v.name)}
                    style={{
                      padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                      borderColor: active ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.15)',
                      color: active ? '#c4b5fd' : '#ccc',
                    }}
                  >
                    {active ? '✓ ' : ''}{v.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
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
            disabled={!allFilled}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
              cursor: allFilled ? 'pointer' : 'not-allowed', border: 'none',
              background: allFilled ? '#c4b5fd' : 'rgba(255,255,255,0.1)',
              color: allFilled ? '#1a1a2e' : 'rgba(245,245,245,0.3)',
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
