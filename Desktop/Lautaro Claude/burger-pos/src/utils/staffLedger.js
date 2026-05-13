import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function getWeekId(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  // Use local date to avoid UTC shift
  const date = new Date(year, month - 1, day)
  // Find Thursday of this week (ISO week is determined by Thursday)
  const thursday = new Date(date)
  thursday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + 3)
  const isoYear = thursday.getFullYear()
  // Week 1 is the week containing Jan 4
  const jan4 = new Date(isoYear, 0, 4)
  const week1Thursday = new Date(jan4)
  week1Thursday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + 3)
  const weekNum = Math.round((thursday - week1Thursday) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${isoYear}-${String(weekNum).padStart(2, '0')}`
}

export async function addStaffLedgerEntry(data, user) {
  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    staffName: data.staffName,
    staffRole: data.staffRole || '',
    shift: data.shift || '',
    movementType: data.movementType,
    amount: Number(data.amount) || 0,
    orderCode: data.orderCode || '',
    orderId: data.orderId || '',
    note: data.note || '',
    createdAt: serverTimestamp(),
    createdByEmail: user.email,
    createdByUid: user.uid,
  }
  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}
