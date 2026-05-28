import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setOrders(ordersList)
        setLoading(false)
      },
      (error) => {
        console.error("Error escuchando pedidos de Firestore:", error)
      }
    )

    return () => unsubscribe()
  }, [])

  const saveOrder = async (orderData, user) => {
    if (!user) throw new Error('Usuario no autenticado')
    const orderToSave = {
      ...orderData,
      createdByUid: user.uid,
      createdByEmail: user.email,
      source: 'pos',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    console.log("USER AUTH:", { uid: user.uid, email: user.email })
    console.log("ORDER TO SAVE:", orderToSave)
    console.log("ORDER KEYS:", Object.keys(orderToSave))
    try {
      const docRef = await addDoc(collection(db, 'orders'), orderToSave)
      console.log("Pedido guardado en Firestore con ID:", docRef.id)
      return docRef.id
    } catch (error) {
      console.error("Firestore saveOrder error:", error)
      console.error("error.code:", error.code)
      console.error("error.message:", error.message)
      throw error
    }
  }

  const updateOrderStatus = async (docId, status) => {
    await updateDoc(doc(db, 'orders', docId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  const updatePaymentStatus = async (docId, paymentStatus) => {
    await updateDoc(doc(db, 'orders', docId), {
      paymentStatus,
      updatedAt: serverTimestamp(),
    })
    console.log("Estado de pago actualizado:", docId, paymentStatus)
  }

  return { orders, loading, saveOrder, updateOrderStatus, updatePaymentStatus }
}
