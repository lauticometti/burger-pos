import { useState } from 'react'

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/invalid-email': 'El email no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu red.',
}

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || 'Error al ingresar. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: '40px 32px',
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--y)' }}>BURGER YA</span>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>POS — Acceso operador</div>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: '15px',
            padding: '12px 14px',
            outline: 'none',
          }}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: '15px',
            padding: '12px 14px',
            outline: 'none',
          }}
        />

        {error && (
          <div style={{
            background: 'rgba(255,60,60,0.12)',
            border: '1px solid rgba(255,60,60,0.3)',
            borderRadius: 'var(--radius)',
            color: '#ff6b6b',
            fontSize: '13px',
            padding: '10px 12px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: submitting ? 'rgba(255,255,255,0.08)' : 'var(--y)',
            color: submitting ? 'var(--muted)' : '#000',
            fontWeight: 'bold',
            fontSize: '15px',
            padding: '14px',
            borderRadius: 'var(--radius)',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: '4px',
          }}
        >
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
