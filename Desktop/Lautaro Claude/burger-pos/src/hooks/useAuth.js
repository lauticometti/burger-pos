import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const signOut = () => firebaseSignOut(auth)

  return { user, loading, signIn, signOut }
}
