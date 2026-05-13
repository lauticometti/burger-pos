import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useStaffMembers({ includeInactive = false } = {}) {
  const [staffMembers, setStaffMembers] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(true)

  useEffect(() => {
    const col = collection(db, 'staffMembers')
    const q = includeInactive ? col : query(col, where('active', '==', true))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      setStaffMembers(members)
      setLoadingStaff(false)
    }, (err) => {
      console.error('useStaffMembers error:', err)
      setLoadingStaff(false)
    })
    return () => unsubscribe()
  }, [includeInactive])

  async function createStaffMember(name, role, user) {
    const docRef = await addDoc(collection(db, 'staffMembers'), {
      name: name.trim(),
      role: role || 'otro',
      active: true,
      createdAt: serverTimestamp(),
      createdByEmail: user.email,
      createdByUid: user.uid,
    })
    return docRef.id
  }

  async function updateStaffMember(id, fields, user) {
    await updateDoc(doc(db, 'staffMembers', id), {
      ...fields,
      updatedAt: serverTimestamp(),
      updatedByEmail: user.email,
      updatedByUid: user.uid,
    })
  }

  return { staffMembers, loadingStaff, createStaffMember, updateStaffMember }
}
