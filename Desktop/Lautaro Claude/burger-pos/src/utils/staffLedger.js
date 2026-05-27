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
    displayOrderCode: data.displayOrderCode || '',
    internalOrderNumber: data.internalOrderNumber ?? null,
    orderPurpose: data.orderPurpose || '',
    orderId: data.orderId || '',
    note: data.note || '',
    createdAt: serverTimestamp(),
    createdByEmail: user.email,
    createdByUid: user.uid,
  }
  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

/**
 * Registra un adelanto de sueldo.
 * Reduce el total a pagar en la liquidación semanal.
 *
 * @param {{ staffName, staffRole, amount, businessDate, note }} data
 * @param {Object} user
 */
export async function addSalaryAdvance(data, user) {
  if (!data.staffName?.trim()) throw new Error('staffName es obligatorio')
  if (!data.note?.trim()) throw new Error('La nota es obligatoria para adelantos')
  const amount = Number(data.amount)
  if (!amount || amount <= 0) throw new Error('El monto debe ser mayor a 0')

  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    staffName: data.staffName.trim(),
    staffRole: data.staffRole || '',
    movementType: 'salary_advance',
    amount,
    paymentMethod: data.paymentMethod || 'cash',
    note: data.note.trim(),
    shift: '',
    orderCode: '',
    displayOrderCode: '',
    internalOrderNumber: null,
    orderPurpose: '',
    orderId: '',
    createdAt: serverTimestamp(),
    createdByEmail: user?.email || '',
    createdByUid: user?.uid || '',
  }
  if (data.employeeId) entry.employeeId = data.employeeId

  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

/**
 * Registra un pago de sueldo (total o parcial).
 * Reduce el pendiente en la liquidación.
 *
 * @param {{ staffName, staffRole, amount, businessDate, paymentMethod, note }} data
 * @param {Object} user
 */
export async function addSalaryPayment(data, user) {
  if (!data.staffName?.trim()) throw new Error('staffName es obligatorio')
  const amount = Number(data.amount)
  if (!amount || amount <= 0) throw new Error('El monto debe ser mayor a 0')

  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    staffName: data.staffName.trim(),
    staffRole: data.staffRole || '',
    movementType: 'salary_payment',
    amount,
    paymentMethod: data.paymentMethod || 'cash',
    note: data.note?.trim() || '',
    shift: '',
    orderCode: '',
    displayOrderCode: '',
    internalOrderNumber: null,
    orderPurpose: '',
    orderId: '',
    createdAt: serverTimestamp(),
    createdByEmail: user?.email || '',
    createdByUid: user?.uid || '',
  }
  if (data.employeeId) entry.employeeId = data.employeeId

  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

/**
 * Registra un egreso de caja (gasto operativo del día).
 * Reduce la caja esperada si paymentMethod = 'cash'.
 *
 * Categorías válidas: mercaderia | delivery | limpieza | insumos |
 *                     mantenimiento | sueldo | adelanto | otro
 *
 * @param {{ amount, businessDate, category, paymentMethod, note }} data
 * @param {Object} user
 */
/**
 * Registra un turno trabajado para empleados con salaryType = 'shift'.
 * El amount es el shiftRate al momento de registrar.
 *
 * @param {{ staffName, staffRole, employeeId, businessDate, shift, amount, note }} data
 * @param {Object} user
 */
export async function addWorkShift(data, user) {
  if (!data.staffName?.trim()) throw new Error('staffName es obligatorio')
  const VALID_SHIFTS = ['mediodia', 'noche', 'extra']
  const shift = VALID_SHIFTS.includes(data.shift) ? data.shift : 'noche'
  const amount = Number(data.amount ?? 0)

  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    staffName: data.staffName.trim(),
    staffRole: data.staffRole || '',
    movementType: 'work_shift',
    shift,
    amount,
    note: data.note?.trim() || '',
    orderCode: '',
    displayOrderCode: '',
    internalOrderNumber: null,
    orderPurpose: '',
    orderId: '',
    createdAt: serverTimestamp(),
    createdByEmail: user?.email || '',
    createdByUid: user?.uid || '',
  }
  if (data.employeeId) entry.employeeId = data.employeeId

  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

/**
 * Registra una jornada base para empleados con salaryType = 'delivery'.
 * El pago variable por envíos (deliveryPayout) se calcula desde orders, no desde ledger.
 *
 * @param {{ staffName, employeeName, employeeId, staffRole, businessDate, hours, baseAmount, note }} data
 * @param {Object} user
 */
export async function addDeliveryShift(data, user) {
  if (!data.staffName?.trim()) throw new Error('staffName es obligatorio')
  const hours = Number(data.hours)
  if (!hours || hours <= 0) throw new Error('Las horas deben ser mayores a 0')
  const baseAmount = Number(data.baseAmount ?? 0)
  if (baseAmount < 0) throw new Error('La base no puede ser negativa')

  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    staffName: data.staffName.trim(),
    employeeName: data.employeeName || data.staffName.trim(),
    employeeId: data.employeeId || '',
    staffRole: data.staffRole || '',
    movementType: 'delivery_shift',
    hours,
    baseAmount,
    amount: baseAmount,
    note: data.note?.trim() || '',
    shift: '',
    orderCode: '',
    displayOrderCode: '',
    internalOrderNumber: null,
    orderPurpose: '',
    orderId: '',
    createdAt: serverTimestamp(),
    createdByEmail: user?.email || '',
    createdByUid: user?.uid || '',
  }

  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

export async function addCashExpense(data, user) {
  const amount = Number(data.amount)
  if (!amount || amount <= 0) throw new Error('El monto debe ser mayor a 0')
  if (!data.note?.trim()) throw new Error('La nota es obligatoria para egresos de caja')

  const VALID_CATEGORIES = ['mercaderia', 'delivery', 'limpieza', 'insumos', 'mantenimiento', 'sueldo', 'adelanto', 'otro']
  const category = VALID_CATEGORIES.includes(data.category) ? data.category : 'otro'

  const entry = {
    businessDate: data.businessDate,
    weekId: getWeekId(data.businessDate),
    movementType: 'cash_expense',
    amount,
    category,
    paymentMethod: data.paymentMethod || 'cash',
    note: data.note.trim(),
    staffName: '',
    staffRole: '',
    shift: '',
    orderCode: '',
    displayOrderCode: '',
    internalOrderNumber: null,
    orderPurpose: '',
    orderId: '',
    createdAt: serverTimestamp(),
    createdByEmail: user?.email || '',
    createdByUid: user?.uid || '',
  }

  const docRef = await addDoc(collection(db, 'staffLedger'), entry)
  return docRef.id
}

/**
 * Calcula cómo se cubre un monto con el saldo disponible de un empleado.
 * Usado tanto en staff_consumption como en internal_account.
 *
 * @param {number} amountToCover
 * @param {number} availableBalance
 * @returns {{ coveredByBalance: number, payrollDeduction: number, balanceAfter: number }}
 */
export function calculateStaffCoverage(amountToCover, availableBalance) {
  const amount = Math.max(Number(amountToCover) || 0, 0)
  const balance = Math.max(Number(availableBalance) || 0, 0)
  const coveredByBalance = Math.min(amount, balance)
  const payrollDeduction = Math.max(amount - coveredByBalance, 0)
  const balanceAfter = Math.max(balance - coveredByBalance, 0)
  return { coveredByBalance, payrollDeduction, balanceAfter }
}
