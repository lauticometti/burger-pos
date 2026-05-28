import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

const EVENT_NAME = 'burger_day_2026'

// Query que requiere índice compuesto en Firestore:
// Collection: orders
// Fields: eventMode ASC, eventName ASC, createdAt DESC
// Firestore pegará el link en consola para crearlo directamente.

export function useEventOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [indexError, setIndexError] = useState(null)

  useEffect(() => {
    // Sin orderBy para evitar índice compuesto — se ordena en cliente
    const q = query(
      collection(db, 'orders'),
      where('eventMode', '==', true),
      where('eventName', '==', EVENT_NAME)
    )
    const unsub = onSnapshot(
      q,
      snapshot => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        // Ordenar desc por createdAt en cliente
        docs.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0
          const tb = b.createdAt?.toMillis?.() ?? 0
          return tb - ta
        })
        setOrders(docs)
        setIndexError(null)
        setLoading(false)
      },
      err => {
        console.error('useEventOrders error:', err)
        console.error('useEventOrders error code:', err.code)
        console.error('useEventOrders error message:', err.message)
        setIndexError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  async function saveEventOrder(orderData, user) {
    console.log('EVENT SAVE START', orderData)
    const toSave = {
      ...orderData,
      createdByUid: user.uid,
      createdByEmail: user.email,
      source: 'event_pos',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    try {
      const ref = await addDoc(collection(db, 'orders'), toSave)
      console.log('EVENT SAVE SUCCESS — doc id:', ref.id)
      return ref.id
    } catch (err) {
      console.error('EVENT SAVE ERROR:', err)
      throw err
    }
  }

  async function updateKitchenStatus(docId, kitchenStatus) {
    await updateDoc(doc(db, 'orders', docId), { kitchenStatus, updatedAt: serverTimestamp() })
  }

  async function updateBarStatus(docId, barStatus) {
    await updateDoc(doc(db, 'orders', docId), { barStatus, updatedAt: serverTimestamp() })
  }

  async function cancelOrder(docId, reason, user) {
    await updateDoc(doc(db, 'orders', docId), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledReason: reason,
      cancelledByEmail: user.email,
      cancelledByUid: user.uid,
      updatedAt: serverTimestamp(),
    })
  }

  return { orders, loading, indexError, saveEventOrder, updateKitchenStatus, updateBarStatus, cancelOrder }
}
