export function EventModal({ title, body, buttons, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '14px', padding: '24px', maxWidth: '400px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }} onClick={e => e.stopPropagation()}>
        {title && (
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f5f5f5', marginBottom: '10px' }}>
            {title}
          </div>
        )}
        {body && (
          <div style={{ fontSize: '14px', color: 'rgba(245,245,245,0.75)', marginBottom: '20px', lineHeight: 1.5 }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              style={{
                padding: '10px 20px', borderRadius: '8px', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer', border: 'none',
                background: btn.danger ? '#c0392b' : btn.primary ? '#FFC62A' : 'rgba(255,255,255,0.1)',
                color: btn.primary ? '#000' : '#f5f5f5',
                minWidth: '90px',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
