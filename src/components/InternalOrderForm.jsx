import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStaffMembers } from '../hooks/useStaffMembers'
import {
  STAFF_SHIFT_CREDIT,
  STAFF_COST_ITEMS,
  STAFF_ADDON_IDS, STAFF_ADDON_LABELS,
  STAFF_VEGETABLE_IDS, STAFF_VEGETABLE_LABELS,
  STAFF_EXTRA_IDS, STAFF_EXTRA_LABELS,
} from '../data/staffMenu'
import {
  createEmptyStaffBurger,
  duplicateStaffBurger,
  calculateStaffBurgerTotal,
  calculateStaffOrderTotal,
} from '../utils/staffOrderBuilder'
import { getWeekId, calculateStaffCoverage } from '../utils/staffLedger'
import { todayStr } from '../utils/printing'
import { calcGrossTotal, getItemDisplayName } from '../utils/orderUtils'

// suppress unused import warning — STAFF_SHIFT_CREDIT is exported but not used here
void STAFF_SHIFT_CREDIT

function buildOperationalDate(dateString, timeString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const [hours, minutes] = timeString.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const PURPOSES = [
  { value: 'test',             label: 'Prueba' },
  { value: 'staff_consumption', label: 'Staff' },
  { value: 'marketing',        label: 'Marketing' },
  { value: 'internal_account', label: 'Cuenta interna' },
]

const PURPOSE_RULES = {
  test:              { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, affectsInternalBalance: false, costResponsibility: 'system' },
  staff_consumption: { countsAsRevenue: false, affectsCash: false, affectsPayroll: true,  affectsInternalBalance: false, costResponsibility: 'business' },
  marketing:         { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, affectsInternalBalance: false, costResponsibility: 'marketing' },
  marketing_barter:  { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, affectsInternalBalance: false, costResponsibility: 'marketing' },
  internal_account:  { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, affectsInternalBalance: true,  costResponsibility: 'internal_people' },
  owner_consumption: { countsAsRevenue: false, affectsCash: false, affectsPayroll: false, affectsInternalBalance: false, costResponsibility: 'internal_people' },
}

const STAFF_ROLES = [
  { value: 'cocina',   label: 'Cocina' },
  { value: 'caja',     label: 'Caja' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'dueño',    label: 'Dueño' },
  { value: 'otro',     label: 'Otro' },
]

const EMPTY_EXTRAS = { papas: 0, coca_600: 0, coca_225: 0, dip_salsa: 0 }

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', color: 'var(--text)', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', color: 'var(--muted)', fontSize: '11px', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
}

async function loadStaffBalance(staffName, isDelivery, dateStr) {
  const refDate = dateStr || todayStr()
  let q
  if (isDelivery) {
    q = query(collection(db, 'staffLedger'), where('businessDate', '==', refDate), where('staffName', '==', staffName))
  } else {
    const weekId = getWeekId(refDate)
    q = query(collection(db, 'staffLedger'), where('weekId', '==', weekId), where('staffName', '==', staffName))
  }
  const snap = await getDocs(q)
  const entries = snap.docs.map(d => d.data()).filter(e => !e.voided)
  const creditos = entries.filter(e => e.movementType === 'credit_shift_meal').reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const consumos = entries.filter(e => e.movementType === 'debit_staff_meal').reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const internalDebits = entries.filter(e => e.movementType === 'debit_internal_account').reduce((s, e) => s + Number(e.amount ?? 0), 0)
  return creditos - consumos - internalDebits
}

export function InternalOrderForm({ cart, onSave, user }) {
  const { staffMembers, loadingStaff, createStaffMember } = useStaffMembers()

  const [orderPurpose, setOrderPurpose] = useState('test')
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedTime, setSelectedTime] = useState(nowTimeStr)
  // Staff fields
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedStaffRole, setSelectedStaffRole] = useState('')
  const [staffBurgers, setStaffBurgers] = useState([createEmptyStaffBurger()])
  const [staffExtras, setStaffExtras] = useState({ ...EMPTY_EXTRAS })
  const [staffBalance, setStaffBalance] = useState(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffInlineRole, setNewStaffInlineRole] = useState('cocina')
  // Shared fields
  const [freeRelatedPerson, setFreeRelatedPerson] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [kitchenNote, setKitchenNote] = useState('')
  // Delivery fields
  const [hasDelivery, setHasDelivery] = useState(false)
  const [deliveryPayout, setDeliveryPayout] = useState('')
  const [deliverySurcharge, setDeliverySurcharge] = useState('')
  const [deliveryStaffId, setDeliveryStaffId] = useState('')
  const [deliveryStaffName, setDeliveryStaffName] = useState('')
  // Cuenta interna fields
  const [cashCollected, setCashCollected] = useState('')
  const [cashPaymentMethod, setCashPaymentMethod] = useState('efectivo')
  const [internalAllocations, setInternalAllocations] = useState([])
  const [allocationBalances, setAllocationBalances] = useState({})
  const [barterItems, setBarterItems] = useState([])
  // Costo interno selector (Cuenta interna + Marketing)
  const [internalCostSelections, setInternalCostSelections] = useState({})
  const [internalCostAdjustment, setInternalCostAdjustment] = useState('')
  const [internalCostAdjustmentReason, setInternalCostAdjustmentReason] = useState('')
  const [marketingCostSelections, setMarketingCostSelections] = useState({})
  const [marketingCostAdjustment, setMarketingCostAdjustment] = useState('')
  const [marketingCostAdjustmentReason, setMarketingCostAdjustmentReason] = useState('')
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isStaffPurpose = orderPurpose === 'staff_consumption'
  const isMarketing = orderPurpose === 'marketing'
  const isInternalAccount = orderPurpose === 'internal_account'
  const isDelivery = selectedStaffRole === 'delivery'

  const cartTotal = calcGrossTotal(cart)
  const cartHasItems = cart.length > 0

  // Staff order calculations
  const staffOrderDraft = { burgers: staffBurgers, extras: staffExtras }
  const staffMenuTotal = calculateStaffOrderTotal(staffOrderDraft)
  const deliveryPayoutNum = hasDelivery ? (parseFloat(deliveryPayout) || 0) : 0
  const deliverySurchargeNum = parseFloat(deliverySurcharge) || 0
  const chargeableInternalTotal = isStaffPurpose
    ? staffMenuTotal + (hasDelivery ? deliveryPayoutNum : 0)
    : 0
  const saldoDisponible = Math.max(staffBalance ?? 0, 0)
  const {
    coveredByBalance: saldoUsado,
    payrollDeduction: descuentoSueldo,
    balanceAfter: saldoFinal,
  } = isStaffPurpose
    ? calculateStaffCoverage(chargeableInternalTotal, saldoDisponible)
    : { coveredByBalance: 0, payrollDeduction: 0, balanceAfter: 0 }

  // Costo interno calculations (Cuenta interna)
  const internalCostItems = STAFF_COST_ITEMS
    .filter(item => (internalCostSelections[item.id] ?? 0) > 0)
    .map(item => ({ id: item.id, name: item.name, price: item.price, qty: internalCostSelections[item.id], lineTotal: item.price * internalCostSelections[item.id] }))
  const internalCostItemsTotal = internalCostItems.reduce((s, i) => s + i.lineTotal, 0)
  const internalCostAdjNum = parseFloat(internalCostAdjustment) || 0
  const internalProductCostNum = internalCostItemsTotal + internalCostAdjNum

  // Marketing cost calculations
  const marketingCostItems = STAFF_COST_ITEMS
    .filter(item => (marketingCostSelections[item.id] ?? 0) > 0)
    .map(item => ({ id: item.id, name: item.name, price: item.price, qty: marketingCostSelections[item.id], lineTotal: item.price * marketingCostSelections[item.id] }))
  const marketingCostItemsTotal = marketingCostItems.reduce((s, i) => s + i.lineTotal, 0)
  const marketingCostAdjNum = parseFloat(marketingCostAdjustment) || 0
  const marketingProductCostNum = marketingCostItemsTotal + marketingCostAdjNum
  const marketingDeliveryCostNum = hasDelivery ? deliveryPayoutNum : 0
  const marketingTotalCostNum = marketingProductCostNum + marketingDeliveryCostNum

  // Cuenta interna calculations
  const cashCollectedNum = parseFloat(cashCollected) || 0
  const barterValueAmount = barterItems.reduce((s, b) => s + (parseFloat(b.estimatedValue) || 0), 0)
  const internalDeliveryCostNum = hasDelivery ? deliveryPayoutNum : 0
  const internalTotalCostNum = internalProductCostNum + internalDeliveryCostNum
  const internalCoveredByCash = Math.min(cashCollectedNum, internalTotalCostNum)
  const internalPendingAmount = Math.max(internalTotalCostNum - cashCollectedNum, 0)
  const internalSurplusCash = Math.max(cashCollectedNum - internalTotalCostNum, 0)
  const internalResultAmount = cashCollectedNum - internalTotalCostNum
  const internalAmount = internalAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)

  useEffect(() => {
    const initialBurgers = [createEmptyStaffBurger()]
    const initialExtras = { ...EMPTY_EXTRAS }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaffBurgers(initialBurgers)
    setStaffExtras(initialExtras)
    setSelectedStaff('')
    setSelectedStaffRole('')
    setFreeRelatedPerson('')
    setInternalNote('')
    setKitchenNote('')
    setStaffBalance(null)
    setHasDelivery(false)
    setDeliveryPayout('')
    setDeliverySurcharge('')
    setDeliveryStaffId('')
    setDeliveryStaffName('')
    setCashCollected('')
    setCashPaymentMethod('efectivo')
    setInternalAllocations([])
    setAllocationBalances({})
    setBarterItems([])
    setInternalCostSelections({})
    setInternalCostAdjustment('')
    setInternalCostAdjustmentReason('')
    setMarketingCostSelections({})
    setMarketingCostAdjustment('')
    setMarketingCostAdjustmentReason('')
    setError('')
  }, [orderPurpose])

  useEffect(() => {
    if (!isStaffPurpose || !selectedStaff) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStaffBalance(null)
      return
    }
    setLoadingBalance(true)
    loadStaffBalance(selectedStaff, isDelivery, selectedDate)
      .then(bal => setStaffBalance(bal))
      .catch(() => setStaffBalance(0))
      .finally(() => setLoadingBalance(false))
  }, [selectedStaff, isStaffPurpose, isDelivery, selectedDate])

  useEffect(() => {
    if (!hasDelivery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeliveryStaffId('')
      setDeliveryStaffName('')
    }
  }, [hasDelivery])

  useEffect(() => {
    if (!isInternalAccount) return
    const names = [...new Set(internalAllocations.map(a => a.staffName).filter(Boolean))]
    names.forEach(name => {
      loadStaffBalance(name, false, selectedDate)
        .then(bal => setAllocationBalances(prev => ({ ...prev, [name]: bal })))
        .catch(() => setAllocationBalances(prev => ({ ...prev, [name]: 0 })))
    })
  }, [isInternalAccount, internalAllocations, selectedDate])

  // Staff burger helpers
  function addBurger() { setStaffBurgers(prev => [...prev, createEmptyStaffBurger()]) }
  function removeBurger(idx) { setStaffBurgers(prev => prev.filter((_, i) => i !== idx)) }
  function duplicateBurger(idx) {
    setStaffBurgers(prev => {
      const copy = [...prev]
      copy.splice(idx + 1, 0, duplicateStaffBurger(prev[idx]))
      return copy
    })
  }
  function updateBurger(idx, field, value) {
    setStaffBurgers(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }
  function toggleBurgerAddon(idx, id) {
    setStaffBurgers(prev => prev.map((b, i) => i !== idx ? b : {
      ...b,
      addons: b.addons.includes(id) ? b.addons.filter(a => a !== id) : [...b.addons, id],
    }))
  }
  function toggleBurgerVegetable(idx, id) {
    setStaffBurgers(prev => prev.map((b, i) => i !== idx ? b : {
      ...b,
      vegetables: b.vegetables.includes(id) ? b.vegetables.filter(v => v !== id) : [...b.vegetables, id],
    }))
  }
  function updateExtra(id, delta) {
    setStaffExtras(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))
  }

  async function handleCreateStaff() {
    if (!newStaffName.trim()) return
    try {
      await createStaffMember(newStaffName.trim(), newStaffInlineRole, user)
      setSelectedStaff(newStaffName.trim())
      setSelectedStaffRole(newStaffInlineRole)
      setNewStaffName('')
      setNewStaffInlineRole('cocina')
      setShowCreateStaff(false)
    } catch (err) {
      console.error('Error creando empleado:', err)
      setError('No se pudo crear el empleado.')
    }
  }

  function addAllocation() {
    setInternalAllocations(prev => [...prev, { staffMemberId: '', staffName: '', staffRole: '', amount: '', note: '', status: 'pending', settledAmount: 0 }])
  }
  function removeAllocation(idx) {
    setInternalAllocations(prev => prev.filter((_, i) => i !== idx))
  }
  function updateAllocation(idx, field, value) {
    setInternalAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }
  function selectStaffForAllocation(idx, member) {
    setInternalAllocations(prev => prev.map((a, i) => i === idx
      ? { ...a, staffMemberId: member.id, staffName: member.name, staffRole: member.role || 'otro' }
      : a
    ))
    loadStaffBalance(member.name, false, selectedDate)
      .then(bal => setAllocationBalances(prev => ({ ...prev, [member.name]: bal })))
      .catch(() => setAllocationBalances(prev => ({ ...prev, [member.name]: 0 })))
  }

  function validate() {
    if (isStaffPurpose) {
      if (!selectedStaff) return 'Seleccioná un empleado.'
      if (staffBurgers.length === 0) return 'Agregá al menos una burger.'
      if (!internalNote.trim()) return 'La nota interna es obligatoria.'
    } else if (isMarketing) {
      if (!freeRelatedPerson.trim()) return 'Ingresá el nombre del influencer o persona.'
      if (!internalNote.trim()) return 'La nota interna es obligatoria (motivo de marketing).'
      if (marketingCostAdjNum !== 0 && !marketingCostAdjustmentReason.trim()) return 'El motivo del ajuste manual de costo marketing es obligatorio.'
    } else if (isInternalAccount) {
      if (!freeRelatedPerson.trim()) return 'Ingresá el nombre del destinatario.'
      if (!internalNote.trim()) return 'La nota interna es obligatoria (motivo).'
      if (internalCostAdjNum !== 0 && !internalCostAdjustmentReason.trim()) return 'El motivo del ajuste manual de costo interno es obligatorio.'
      if (hasDelivery && deliveryPayoutNum > 0 && !deliveryStaffId) return 'Seleccioná el delivery asignado para este envío.'
      if (internalPendingAmount > 0) {
        const validAllocations = internalAllocations.filter(a => a.staffName && (parseFloat(a.amount) || 0) > 0)
        if (validAllocations.length === 0) return 'Hay pendiente interno sin responsable asignado.'
        const pendingBalanceLoad = validAllocations.some(a => allocationBalances[a.staffName] === undefined)
        if (pendingBalanceLoad) return 'Cargando saldo de responsables, esperá un momento...'
        const allocSum = validAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
        if (Math.round(allocSum) !== Math.round(internalPendingAmount)) {
          return `La suma de responsables ($${allocSum.toLocaleString('es-AR')}) debe ser exactamente igual al pendiente interno ($${internalPendingAmount.toLocaleString('es-AR')}).`
        }
      }
    } else if (orderPurpose === 'test') {
      if (!internalNote.trim()) return 'Describí el motivo de la prueba.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setError('')
    setLoading(true)

    let formData

    if (isStaffPurpose) {
      const staffOrder = {
        burgers: staffBurgers,
        extras: staffExtras,
        total: staffMenuTotal,
      }
      formData = {
        customerName: selectedStaff,
        paymentMethod: 'interno',
        paymentStatus: 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        kitchenNote: kitchenNote.trim(),
        internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose: 'staff_consumption',
        countsAsRevenue: false,
        affectsCash: false,
        affectsPayroll: descuentoSueldo > 0,
        affectsInternalBalance: false,
        costResponsibility: descuentoSueldo > 0 ? 'staff' : 'business',
        relatedPerson: selectedStaff,
        relatedPersonRole: selectedStaffRole || 'otro',
        internalAmount: chargeableInternalTotal,
        saleValueAmount: 0,
        cashCollected: 0,
        staffOrder,
        staffMenuTotal,
        staffCoveredAmount: saldoUsado,
        payrollDeductionAmount: descuentoSueldo,
        staffBalanceBefore: saldoDisponible,
        staffBalanceAfter: saldoFinal,
        deliveryPayout: hasDelivery ? deliveryPayoutNum : 0,
        deliverySurcharge: 0,
        deliveryResponsibility: hasDelivery ? 'staff' : 'none',
        deliveryChargedTo: hasDelivery ? selectedStaff : '',
        chargeableInternalTotal,
        internalAllocations: [],
        netRevenue: 0,
        grossTotal: staffMenuTotal,
        total: staffMenuTotal,
      }
    } else if (isMarketing) {
      formData = {
        customerName: freeRelatedPerson.trim() || 'Marketing',
        paymentMethod: 'marketing',
        paymentStatus: 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        kitchenNote: kitchenNote.trim(),
        internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose: 'marketing',
        ...PURPOSE_RULES['marketing'],
        relatedPerson: freeRelatedPerson.trim(),
        relatedPersonRole: '',
        internalAmount: 0,
        saleValueAmount: cartTotal,
        cashCollected: 0,
        staffOrder: null,
        staffMenuTotal: 0,
        staffCoveredAmount: 0,
        payrollDeductionAmount: 0,
        staffBalanceBefore: null,
        staffBalanceAfter: null,
        deliverySurcharge: hasDelivery ? deliverySurchargeNum : 0,
        deliveryPayout: hasDelivery ? deliveryPayoutNum : 0,
        deliveryResponsibility: hasDelivery ? (deliveryPayoutNum > 0 ? 'business' : 'none') : 'none',
        deliveryChargedTo: '',
        chargeableInternalTotal: 0,
        internalAllocations: [],
        marketingCostItems,
        marketingCostManualAdjustment: marketingCostAdjNum,
        marketingCostManualReason: marketingCostAdjustmentReason.trim(),
        marketingProductCostAmount: marketingProductCostNum,
        marketingDeliveryCostAmount: marketingDeliveryCostNum,
        marketingTotalCostAmount: marketingTotalCostNum,
      }
    } else if (isInternalAccount) {
      const enrichedAllocations = internalPendingAmount > 0
        ? internalAllocations
            .filter(a => a.staffName && (parseFloat(a.amount) || 0) > 0)
            .map(a => {
              const amount = parseFloat(a.amount) || 0
              const balanceBefore = allocationBalances[a.staffName] ?? 0
              const { coveredByBalance, payrollDeduction: payrollDeductionAmount, balanceAfter } =
                calculateStaffCoverage(amount, balanceBefore)
              return {
                staffMemberId: a.staffMemberId || '',
                staffName: a.staffName,
                staffRole: a.staffRole || 'otro',
                amount,
                note: a.note || '',
                status: 'pending',
                settledAmount: 0,
                coveredByBalance,
                payrollDeductionAmount,
                balanceBefore,
                balanceAfter,
              }
            })
        : []
      const totalInternal = enrichedAllocations.reduce((s, a) => s + a.amount, 0)
      const totalCovered = enrichedAllocations.reduce((s, a) => s + a.coveredByBalance, 0)
      const totalDeduction = enrichedAllocations.reduce((s, a) => s + a.payrollDeductionAmount, 0)
      const hasCash = cashCollectedNum > 0
      formData = {
        customerName: freeRelatedPerson.trim() || 'Cuenta interna',
        paymentMethod: hasCash ? cashPaymentMethod : 'internal_account',
        paymentStatus: hasCash ? 'pagado' : 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        kitchenNote: kitchenNote.trim(),
        internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose: 'internal_account',
        ...PURPOSE_RULES['internal_account'],
        affectsCash: hasCash,
        affectsPayroll: totalDeduction > 0,
        affectsInternalBalance: internalPendingAmount > 0,
        relatedPerson: freeRelatedPerson.trim(),
        relatedPersonRole: '',
        internalAmount: totalInternal,
        saleValueAmount: cartTotal,
        cashCollected: cashCollectedNum,
        barterItems: barterItems.filter(b => b.description?.trim()),
        barterValueAmount,
        internalCostItems,
        internalCostManualAdjustment: internalCostAdjNum,
        internalCostManualReason: internalCostAdjustmentReason.trim(),
        internalCostAmount: internalProductCostNum,
        internalProductCostAmount: internalProductCostNum,
        internalDeliveryCostAmount: internalDeliveryCostNum,
        internalTotalCostAmount: internalTotalCostNum,
        internalCoveredByCash,
        internalPendingAmount,
        internalSurplusCash,
        internalResultAmount,
        staffOrder: null,
        staffMenuTotal: 0,
        staffCoveredAmount: totalCovered,
        payrollDeductionAmount: totalDeduction,
        staffBalanceBefore: null,
        staffBalanceAfter: null,
        deliverySurcharge: hasDelivery ? deliverySurchargeNum : 0,
        deliveryPayout: hasDelivery ? deliveryPayoutNum : 0,
        deliveryResponsibility: hasDelivery ? (deliveryPayoutNum > 0 ? 'business' : 'none') : 'none',
        deliveryChargedTo: hasDelivery && deliveryPayoutNum > 0 ? deliveryStaffName : '',
        deliveryStaffId: hasDelivery && deliveryPayoutNum > 0 ? deliveryStaffId : '',
        deliveryStaffName: hasDelivery && deliveryPayoutNum > 0 ? deliveryStaffName : '',
        assignedDeliveryId: hasDelivery && deliveryPayoutNum > 0 ? deliveryStaffId : '',
        assignedDeliveryName: hasDelivery && deliveryPayoutNum > 0 ? deliveryStaffName : '',
        chargeableInternalTotal: 0,
        internalAllocations: enrichedAllocations,
      }
    } else {
      // test
      formData = {
        customerName: 'Sistema',
        paymentMethod: 'interno',
        paymentStatus: 'no_aplica',
        orderType: 'interno',
        notes: internalNote,
        kitchenNote: kitchenNote.trim(),
        internalNote,
        mitiMiti: null,
        orderMode: 'internal',
        orderPurpose: 'test',
        relatedPerson: 'Sistema',
        relatedPersonRole: '',
        internalAmount: 0,
        saleValueAmount: cartTotal,
        cashCollected: 0,
        staffOrder: null,
        staffMenuTotal: 0,
        staffCoveredAmount: 0,
        payrollDeductionAmount: 0,
        staffBalanceBefore: null,
        staffBalanceAfter: null,
        deliverySurcharge: 0,
        deliveryPayout: 0,
        deliveryResponsibility: 'none',
        deliveryChargedTo: '',
        chargeableInternalTotal: 0,
        internalAllocations: [],
        ...PURPOSE_RULES['test'],
      }
    }

    if (!selectedDate || !selectedTime) {
      setError('La fecha y hora son obligatorias.')
      setLoading(false)
      return
    }

    formData.operationalDateStr = selectedDate
    formData.operationalDate = buildOperationalDate(selectedDate, selectedTime)

    try {
      await onSave(formData)
    } catch (err) {
      console.error('Error guardando pedido interno:', err)
      setError('No se pudo guardar el pedido. Intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px 120px' }}>
      <div style={{ width: '100%', maxWidth: '540px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,198,42,0.12)', border: '1px solid rgba(255,198,42,0.3)', color: 'var(--y)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', marginBottom: '8px' }}>
            PEDIDO INTERNO
          </div>
          {!isStaffPurpose && (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {cart.length} item{cart.length !== 1 ? 's' : ''} · ${cartTotal.toLocaleString('es-AR')}
            </div>
          )}
          {isStaffPurpose && cartHasItems && (
            <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,150,50,0.08)', border: '1px solid rgba(255,150,50,0.2)', borderRadius: '6px', padding: '4px 10px' }}>
              <span style={{ fontSize: '11px', color: '#ff9666', fontWeight: '600' }}>Carrito ignorado</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>— Staff usa su propio menú</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Fecha y hora operativa */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Fecha</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="internal-datetime-input"
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Hora</label>
              <input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="internal-datetime-input"
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PURPOSES.map(p => (
                <button key={p.value} type="button" onClick={() => setOrderPurpose(p.value)}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: orderPurpose === p.value ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: orderPurpose === p.value ? 'rgba(255,198,42,0.12)' : 'transparent', color: orderPurpose === p.value ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >{p.label}</button>
              ))}
            </div>
          </div>

          {/* ── STAFF ── */}
          {isStaffPurpose && (
            <>
              {/* Selector de empleado */}
              <div>
                <label style={labelStyle}>Empleado</label>
                {loadingStaff ? (
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cargando empleados...</div>
                ) : (
                  <>
                    {staffMembers.length === 0 && !showCreateStaff && (
                      <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '8px' }}>No hay empleados registrados.</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {staffMembers.map(m => (
                        <button key={m.id} type="button" onClick={() => { setSelectedStaff(m.name); setSelectedStaffRole(m.role || 'otro') }}
                          style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: selectedStaff === m.name ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: selectedStaff === m.name ? 'rgba(255,198,42,0.12)' : 'transparent', color: selectedStaff === m.name ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                          <span>{m.name}</span>
                          <span style={{ fontSize: '10px', opacity: 0.7, fontWeight: '400' }}>{m.role || 'otro'}</span>
                        </button>
                      ))}
                    </div>
                    {selectedStaff && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', paddingLeft: '2px' }}>
                        {loadingBalance ? 'Calculando saldo...' : staffBalance !== null
                          ? <>{isDelivery ? 'Saldo disponible hoy' : 'Saldo disponible esta semana'}:{' '}
                              <span style={{ color: saldoDisponible > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: '700' }}>${saldoDisponible.toLocaleString('es-AR')}</span></>
                          : null}
                      </div>
                    )}
                  </>
                )}
                {showCreateStaff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <input type="text" placeholder="Nombre del empleado" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStaff())} style={{ ...inputStyle }} autoFocus />
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select value={newStaffInlineRole} onChange={e => setNewStaffInlineRole(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '10px 12px', fontSize: '14px' }}>
                        {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button type="button" onClick={handleCreateStaff} style={{ padding: '10px 16px', background: 'var(--y)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: '700', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>Guardar</button>
                      <button type="button" onClick={() => setShowCreateStaff(false)} style={{ padding: '10px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowCreateStaff(true)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px' }}>+ Crear empleado</button>
                )}
              </div>

              {/* Staff Burger Builder */}
              <div>
                <label style={labelStyle}>Burgers</label>

                {staffBurgers.map((burger, idx) => (
                  <div key={burger.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text)', fontWeight: '600', fontSize: '13px' }}>Burger Staff #{idx + 1}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => duplicateBurger(idx)}
                          style={{ padding: '5px 10px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          Duplicar
                        </button>
                        <button type="button" onClick={() => removeBurger(idx)}
                          style={{ padding: '5px 10px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Tamaño */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ ...labelStyle, marginBottom: '6px' }}>Tamaño</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4].map(p => {
                          const label = p === 1 ? 'Simple' : p === 2 ? 'Doble' : p === 3 ? 'Triple' : '+ Carne'
                          const isSelected = burger.patties === p
                          return (
                            <button key={p} type="button" onClick={() => updateBurger(idx, 'patties', p)}
                              style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: isSelected ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(255,198,42,0.15)' : 'transparent', color: isSelected ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              {label}
                            </button>
                          )
                        })}
                        {burger.patties > 4 && (
                          <span style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--y)' }}>x{burger.patties} carnes</span>
                        )}
                      </div>
                    </div>

                    {/* Agregados */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ ...labelStyle, marginBottom: '6px' }}>Agregados</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {STAFF_ADDON_IDS.map(id => {
                          const isSelected = burger.addons.includes(id)
                          return (
                            <button key={id} type="button" onClick={() => toggleBurgerAddon(idx, id)}
                              style={{ padding: '7px 12px', borderRadius: 'var(--radius)', border: isSelected ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(255,198,42,0.15)' : 'transparent', color: isSelected ? 'var(--y)' : 'var(--muted)', fontSize: '12px', fontWeight: isSelected ? '700' : '400', cursor: 'pointer' }}>
                              {STAFF_ADDON_LABELS[id]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Verduras */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ ...labelStyle, marginBottom: '6px' }}>Verduras</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {STAFF_VEGETABLE_IDS.map(id => {
                          const isSelected = burger.vegetables.includes(id)
                          return (
                            <button key={id} type="button" onClick={() => toggleBurgerVegetable(idx, id)}
                              style={{ padding: '7px 12px', borderRadius: 'var(--radius)', border: isSelected ? '2px solid #38bdf8' : '2px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(56,189,248,0.12)' : 'transparent', color: isSelected ? '#38bdf8' : 'var(--muted)', fontSize: '12px', fontWeight: isSelected ? '700' : '400', cursor: 'pointer' }}>
                              {STAFF_VEGETABLE_LABELS[id]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Nota burger */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ ...labelStyle, marginBottom: '4px' }}>Nota burger</div>
                      <textarea rows={2} value={burger.note} onChange={e => updateBurger(idx, 'note', e.target.value)}
                        placeholder="Instrucción específica para esta burger..."
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4', fontSize: '13px' }} />
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--muted)' }}>
                      Subtotal: <span style={{ color: 'var(--y)', fontWeight: '700' }}>${calculateStaffBurgerTotal(burger).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addBurger}
                  style={{ padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px', marginBottom: '4px' }}>
                  + Agregar Burger Staff
                </button>
              </div>

              {/* Extras generales */}
              <div>
                <label style={labelStyle}>Extras generales</label>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {STAFF_EXTRA_IDS.map((id, idx) => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: idx < STAFF_EXTRA_IDS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: staffExtras[id] > 0 ? 'rgba(255,198,42,0.04)' : 'transparent' }}>
                      <span style={{ fontSize: '13px', color: staffExtras[id] > 0 ? 'var(--text)' : 'var(--muted)', fontWeight: staffExtras[id] > 0 ? '600' : '400' }}>{STAFF_EXTRA_LABELS[id]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => updateExtra(id, -1)} disabled={staffExtras[id] === 0}
                          style={{ width: '28px', height: '28px', background: staffExtras[id] > 0 ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid var(--line)', borderRadius: '6px', color: staffExtras[id] > 0 ? 'var(--text)' : 'var(--muted)', cursor: staffExtras[id] > 0 ? 'pointer' : 'default', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ width: '20px', textAlign: 'center', fontSize: '14px', color: staffExtras[id] > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: staffExtras[id] > 0 ? '700' : '400' }}>{staffExtras[id]}</span>
                        <button type="button" onClick={() => updateExtra(id, 1)}
                          style={{ width: '28px', height: '28px', background: 'rgba(255,198,42,0.15)', border: '1px solid rgba(255,198,42,0.3)', borderRadius: '6px', color: 'var(--y)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery toggle */}
              <div>
                <label style={labelStyle}>Envío</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: hasDelivery ? '12px' : '0' }}>
                  {[{ v: false, l: 'Sin envío' }, { v: true, l: 'Con envío' }].map(({ v, l }) => (
                    <button key={String(v)} type="button" onClick={() => setHasDelivery(v)} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: hasDelivery === v ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: hasDelivery === v ? 'rgba(255,198,42,0.12)' : 'transparent', color: hasDelivery === v ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
                {hasDelivery && (
                  <div>
                    <label style={{ ...labelStyle, marginTop: '4px' }}>Pago al repartidor (a cargo de {selectedStaff || 'staff'})</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>$</span>
                      <input type="number" min="0" step="100" value={deliveryPayout} onChange={e => setDeliveryPayout(e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: '24px' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Staff balance summary */}
              {(staffMenuTotal > 0 || (hasDelivery && deliveryPayoutNum > 0)) && (
                <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Total consumo</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>${staffMenuTotal.toLocaleString('es-AR')}</span></div>
                  {hasDelivery && deliveryPayoutNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Envío a cargo ({selectedStaff || 'staff'})</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>+${deliveryPayoutNum.toLocaleString('es-AR')}</span></div>}
                  {hasDelivery && deliveryPayoutNum > 0 && <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontWeight: '600' }}>Total a cubrir</span><span style={{ color: 'var(--text)', fontWeight: '700' }}>${chargeableInternalTotal.toLocaleString('es-AR')}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>{isDelivery ? 'Saldo disponible hoy' : 'Saldo disponible esta semana'}</span><span style={{ color: 'var(--muted)' }}>${saldoDisponible.toLocaleString('es-AR')}</span></div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Cubierto con saldo</span><span style={{ color: 'var(--y)', fontWeight: '700' }}>${saldoUsado.toLocaleString('es-AR')}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>{isDelivery ? 'A descontar hoy' : 'A descontar lunes'}</span><span style={{ color: descuentoSueldo > 0 ? '#ff9966' : 'var(--muted)', fontWeight: '700' }}>${descuentoSueldo.toLocaleString('es-AR')}</span></div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Saldo final</span><span style={{ color: saldoFinal < 0 ? '#ff6b6b' : 'var(--y)', fontWeight: '700' }}>${saldoFinal.toLocaleString('es-AR')}</span></div>
                </div>
              )}
            </>
          )}

          {/* ── MARKETING ── */}
          {isMarketing && (
            <>
              <div>
                <label style={labelStyle}>Persona / influencer / responsable externo</label>
                <input type="text" placeholder="Nombre o cuenta" value={freeRelatedPerson} onChange={e => setFreeRelatedPerson(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ background: 'rgba(255,150,50,0.07)', border: '1px solid rgba(255,150,50,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '12px', color: '#ff9666' }}>
                Cobro real: $0 · Forma de pago: Marketing · No suma ventas
              </div>
              <div>
                <label style={labelStyle}>Valor venta referencia (automático)</label>
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: '14px', color: 'var(--muted)' }}>
                  ${cartTotal.toLocaleString('es-AR')} <span style={{ fontSize: '11px' }}>(precio normal del pedido)</span>
                </div>
                <OrderPreview items={cart} />
              </div>
              <DeliverySection hasDelivery={hasDelivery} setHasDelivery={setHasDelivery} deliveryPayout={deliveryPayout} setDeliveryPayout={setDeliveryPayout} deliverySurcharge={deliverySurcharge} setDeliverySurcharge={setDeliverySurcharge} inputStyle={inputStyle} labelStyle={labelStyle} />
              <CostSelector
                label="Costo marketing"
                selections={marketingCostSelections}
                setSelections={setMarketingCostSelections}
                adjustment={marketingCostAdjustment}
                setAdjustment={setMarketingCostAdjustment}
                adjustmentReason={marketingCostAdjustmentReason}
                setAdjustmentReason={setMarketingCostAdjustmentReason}
                itemsTotal={marketingCostItemsTotal}
                adjustNum={marketingCostAdjNum}
                totalCost={marketingTotalCostNum}
                deliveryCost={marketingDeliveryCostNum}
                inputStyle={inputStyle}
                labelStyle={labelStyle}
              />
            </>
          )}

          {/* ── CUENTA INTERNA ── */}
          {isInternalAccount && (
            <>
              <div>
                <label style={labelStyle}>Destinatario / amigo</label>
                <input type="text" placeholder="Nombre del destinatario" value={freeRelatedPerson} onChange={e => setFreeRelatedPerson(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Valor venta referencia (automático)</label>
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: '14px', color: 'var(--muted)' }}>
                  ${cartTotal.toLocaleString('es-AR')} <span style={{ fontSize: '11px' }}>(precio normal del pedido)</span>
                </div>
                <OrderPreview items={cart} />
              </div>
              <div>
                <label style={labelStyle}>Cobro real en cash (opcional — default $0)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>$</span>
                    <input type="number" min="0" step="100" value={cashCollected} onChange={e => setCashCollected(e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: '24px' }} />
                  </div>
                  {cashCollectedNum > 0 && (
                    <select value={cashPaymentMethod} onChange={e => setCashPaymentMethod(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '10px 12px', fontSize: '14px' }}>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="mercado_pago">MP</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Recibido en especie */}
              <div>
                <label style={labelStyle}>Recibido en especie (opcional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {barterItems.map((b, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                      <div style={{ flex: 2 }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Descripción</div>
                        <input type="text" placeholder="Ej: 2 Skyy, tragos, etc." value={b.description} onChange={e => setBarterItems(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} style={{ ...inputStyle, fontSize: '13px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Valor est.</div>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '13px' }}>$</span>
                          <input type="number" min="0" step="100" placeholder="0" value={b.estimatedValue} onChange={e => setBarterItems(prev => prev.map((x, i) => i === idx ? { ...x, estimatedValue: e.target.value } : x))} style={{ ...inputStyle, paddingLeft: '22px', fontSize: '13px' }} />
                        </div>
                      </div>
                      <button type="button" onClick={() => setBarterItems(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '6px 10px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginTop: '18px', flexShrink: 0 }}>x</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setBarterItems(prev => [...prev, { description: '', estimatedValue: '', note: '' }])} style={{ padding: '8px 12px', background: 'transparent', color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>+ Agregar recibido en especie</button>
                  {barterValueAmount > 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Valor recibido en especie: <span style={{ color: '#a78bfa', fontWeight: '600' }}>${barterValueAmount.toLocaleString('es-AR')}</span></div>}
                </div>
              </div>

              <DeliverySection hasDelivery={hasDelivery} setHasDelivery={setHasDelivery} deliveryPayout={deliveryPayout} setDeliveryPayout={setDeliveryPayout} deliverySurcharge={deliverySurcharge} setDeliverySurcharge={setDeliverySurcharge} deliveryStaffId={deliveryStaffId} setDeliveryStaffId={setDeliveryStaffId} setDeliveryStaffName={setDeliveryStaffName} staffMembers={staffMembers} inputStyle={inputStyle} labelStyle={labelStyle} />

              <CostSelector
                label="Costo interno del producto"
                selections={internalCostSelections}
                setSelections={setInternalCostSelections}
                adjustment={internalCostAdjustment}
                setAdjustment={setInternalCostAdjustment}
                adjustmentReason={internalCostAdjustmentReason}
                setAdjustmentReason={setInternalCostAdjustmentReason}
                itemsTotal={internalCostItemsTotal}
                adjustNum={internalCostAdjNum}
                totalCost={internalTotalCostNum}
                deliveryCost={internalDeliveryCostNum}
                inputStyle={inputStyle}
                labelStyle={labelStyle}
              />

              {(internalProductCostNum > 0 || internalDeliveryCostNum > 0) && (
                <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Costo producto interno</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>${internalProductCostNum.toLocaleString('es-AR')}</span></div>
                  {internalDeliveryCostNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Envío a cubrir</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>${internalDeliveryCostNum.toLocaleString('es-AR')}</span></div>}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontWeight: '600' }}>Costo total interno</span><span style={{ color: 'var(--text)', fontWeight: '700' }}>${internalTotalCostNum.toLocaleString('es-AR')}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Cobro real</span><span style={{ color: cashCollectedNum > 0 ? '#4ade80' : 'var(--muted)', fontWeight: '600' }}>${cashCollectedNum.toLocaleString('es-AR')}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Cubierto por cash</span><span style={{ color: internalCoveredByCash > 0 ? '#4ade80' : 'var(--muted)', fontWeight: '600' }}>${internalCoveredByCash.toLocaleString('es-AR')}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontWeight: '600' }}>Pendiente interno</span><span style={{ color: internalPendingAmount > 0 ? '#ff9966' : '#4ade80', fontWeight: '700' }}>${internalPendingAmount.toLocaleString('es-AR')}</span></div>
                  {internalSurplusCash > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Excedente cash</span><span style={{ color: 'var(--y)', fontWeight: '600' }}>${internalSurplusCash.toLocaleString('es-AR')}</span></div>}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontWeight: '600' }}>Resultado interno</span><span style={{ color: internalResultAmount >= 0 ? '#4ade80' : '#ff9966', fontWeight: '700' }}>${internalResultAmount.toLocaleString('es-AR')}</span></div>
                  {barterValueAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Recibido en especie</span><span style={{ color: '#a78bfa', fontWeight: '600' }}>${barterValueAmount.toLocaleString('es-AR')}</span></div>}
                </div>
              )}

              {internalPendingAmount > 0 ? (
                <div>
                  <label style={labelStyle}>Responsables internos</label>
                  <div style={{ fontSize: '11px', color: '#ff9966', marginBottom: '8px' }}>
                    Pendiente a repartir: <strong>${internalPendingAmount.toLocaleString('es-AR')}</strong> · Asignado: <strong>${internalAmount.toLocaleString('es-AR')}</strong>
                    {Math.round(internalAmount) === Math.round(internalPendingAmount) && internalAmount > 0 && <span style={{ color: '#4ade80', marginLeft: '6px' }}>ok</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {internalAllocations.map((a, idx) => {
                      const bal = Math.max(allocationBalances[a.staffName] ?? 0, 0)
                      const amt = parseFloat(a.amount) || 0
                      const covered = Math.min(amt, bal)
                      const deduction = Math.max(amt - covered, 0)
                      return (
                        <div key={idx} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Empleado</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {staffMembers.map(m => (
                                  <button key={m.id} type="button" onClick={() => selectStaffForAllocation(idx, m)} style={{ padding: '5px 10px', borderRadius: '6px', border: a.staffName === m.name ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: a.staffName === m.name ? 'rgba(255,198,42,0.12)' : 'transparent', color: a.staffName === m.name ? 'var(--y)' : 'var(--muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{m.name}</button>
                                ))}
                                {staffMembers.length === 0 && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Sin empleados</span>}
                              </div>
                              {a.staffName && allocationBalances[a.staffName] !== undefined && (
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                  Saldo disponible: <span style={{ color: bal > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: '600' }}>${bal.toLocaleString('es-AR')}</span>
                                  {amt > 0 && (<span style={{ marginLeft: '8px' }}>
                                    · Cubierto: <span style={{ color: 'var(--y)' }}>${covered.toLocaleString('es-AR')}</span>
                                    {deduction > 0 && <> · A descontar: <span style={{ color: '#ff9966' }}>${deduction.toLocaleString('es-AR')}</span></>}
                                  </span>)}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => removeAllocation(idx)} style={{ padding: '6px 10px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>x</button>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Monto a cargo</div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '13px' }}>$</span>
                                <input type="number" min="0" step="100" value={a.amount} onChange={e => updateAllocation(idx, 'amount', e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: '22px', fontSize: '13px' }} />
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Nota (opcional)</div>
                              <input type="text" value={a.note} onChange={e => updateAllocation(idx, 'note', e.target.value)} placeholder="..." style={{ ...inputStyle, fontSize: '13px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <button type="button" onClick={addAllocation} style={{ padding: '8px 12px', background: 'transparent', color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>+ Agregar responsable interno</button>
                  </div>
                </div>
              ) : internalTotalCostNum > 0 ? (
                <div style={{ padding: '10px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 'var(--radius)', fontSize: '12px', color: '#4ade80' }}>
                  Sin pendiente interno — no se requieren responsables
                </div>
              ) : null}
            </>
          )}

          {/* Nota cocina (todos excepto prueba) */}
          {orderPurpose !== 'test' && (
            <div>
              <label style={labelStyle}>Nota cocina</label>
              <textarea rows={2} placeholder="Instrucciones para cocina..." value={kitchenNote} onChange={e => setKitchenNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }} />
            </div>
          )}

          {/* Nota interna (todos) */}
          <div>
            <label style={labelStyle}>
              {orderPurpose === 'test' ? 'Nota interna (motivo de la prueba)' : orderPurpose === 'marketing' ? 'Motivo / acción esperada' : 'Nota interna / motivo'}
            </label>
            <textarea rows={2} placeholder={orderPurpose === 'test' ? 'Describí qué se está probando...' : orderPurpose === 'marketing' ? 'Ej: post en instagram, difusión, etc.' : 'Descripción o motivo...'} value={internalNote} onChange={e => setInternalNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }} />
          </div>

          {/* Resumen general (no-staff, sin costo interno ya mostrado arriba) */}
          {!isStaffPurpose && !isInternalAccount && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Valor venta (referencia)</span>
                <span style={{ color: 'var(--text)' }}>${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cobro real</span>
                <span style={{ color: 'var(--muted)', fontWeight: '600' }}>$0</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', color: '#ff6b6b', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? 'rgba(255,255,255,0.08)' : 'var(--y)', color: loading ? 'var(--muted)' : '#000', fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)', border: 'none', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Guardando...' : 'Confirmar pedido interno'}
          </button>
        </form>
      </div>
    </div>
  )
}

const GROUP_LABELS_COST = { base: 'Base', burger_extra: 'Carnes', agregado: 'Agregados', extra: 'Extras' }
const GROUP_ORDER_COST = ['base', 'burger_extra', 'agregado', 'extra']

// Agrupa STAFF_COST_ITEMS en categorías para el selector de costos
const COST_ITEMS_BY_GROUP = {
  base:         STAFF_COST_ITEMS.filter(i => ['burger_base'].includes(i.id)),
  burger_extra: STAFF_COST_ITEMS.filter(i => ['extra_carne'].includes(i.id)),
  agregado:     STAFF_COST_ITEMS.filter(i => ['cuarto_libra', 'bacon', 'lautiboom', 'american', 'bbqueen', 'smoklahoma'].includes(i.id)),
  extra:        STAFF_COST_ITEMS.filter(i => ['papas', 'coca_600', 'coca_225', 'dip_salsa'].includes(i.id)),
}

function CostSelector({ label, selections, setSelections, adjustment, setAdjustment, adjustmentReason, setAdjustmentReason, itemsTotal, adjustNum, totalCost, deliveryCost, inputStyle, labelStyle }) {
  function updateQty(itemId, delta) {
    setSelections(prev => {
      const current = prev[itemId] ?? 0
      const next = Math.max(0, current + delta)
      if (next === 0) { const { [itemId]: _, ...rest } = prev; return rest }
      return { ...prev, [itemId]: next }
    })
  }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '8px' }}>
        {GROUP_ORDER_COST.map((group, groupIdx) => {
          const groupItems = COST_ITEMS_BY_GROUP[group] ?? []
          if (groupItems.length === 0) return null
          return (
            <div key={group}>
              <div style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.03)', borderTop: groupIdx > 0 ? '1px solid var(--line)' : 'none', borderBottom: '1px solid var(--line)', fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {GROUP_LABELS_COST[group]}
              </div>
              {groupItems.map((item, idx) => {
                const qty = selections[item.id] ?? 0
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: idx < groupItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: qty > 0 ? 'rgba(255,198,42,0.04)' : 'transparent' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: qty > 0 ? '600' : '400' }}>{item.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>${item.price.toLocaleString('es-AR')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button type="button" onClick={() => updateQty(item.id, -1)} disabled={qty === 0} style={{ width: '26px', height: '26px', background: qty > 0 ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid var(--line)', borderRadius: '6px', color: qty > 0 ? 'var(--text)' : 'var(--muted)', cursor: qty > 0 ? 'pointer' : 'default', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ width: '18px', textAlign: 'center', fontSize: '13px', color: qty > 0 ? 'var(--y)' : 'var(--muted)', fontWeight: qty > 0 ? '700' : '400' }}>{qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, 1)} style={{ width: '26px', height: '26px', background: 'rgba(255,198,42,0.12)', border: '1px solid rgba(255,198,42,0.3)', borderRadius: '6px', color: 'var(--y)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '13px' }}>$</span>
          <input type="number" step="100" value={adjustment} onChange={e => setAdjustment(e.target.value)} placeholder="Ajuste manual (opcional)" style={{ ...inputStyle, paddingLeft: '22px', fontSize: '13px' }} />
        </div>
        {adjustNum !== 0 && (
          <input type="text" value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} placeholder="Motivo ajuste (obligatorio)" style={{ flex: 1, ...inputStyle, fontSize: '13px' }} />
        )}
      </div>
      {(itemsTotal > 0 || adjustNum !== 0) && (
        <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {itemsTotal > 0 && <span>Items: <strong style={{ color: 'var(--text)' }}>${itemsTotal.toLocaleString('es-AR')}</strong></span>}
          {adjustNum !== 0 && <span>Ajuste: <strong style={{ color: adjustNum > 0 ? 'var(--text)' : '#ff9966' }}>{adjustNum > 0 ? '+' : ''}${adjustNum.toLocaleString('es-AR')}</strong></span>}
          {deliveryCost > 0 && <span>Envío: <strong style={{ color: 'var(--text)' }}>${deliveryCost.toLocaleString('es-AR')}</strong></span>}
          <span style={{ fontWeight: '700' }}>Total: <strong style={{ color: 'var(--y)' }}>${totalCost.toLocaleString('es-AR')}</strong></span>
        </div>
      )}
    </div>
  )
}

function OrderPreview({ items }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
        Sin productos cargados.
      </div>
    )
  }
  return (
    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Pedido</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, idx) => {
          const qty = item.qty ?? item.quantity ?? 1
          const name = getItemDisplayName(item)
          const addons = item.addons ?? item.selectedAddons ?? []
          const note = item.kitchenNote ?? item.note ?? ''
          return (
            <div key={idx}>
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>{qty}x {name}</div>
              {addons.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '14px' }}>
                  Agregados: {addons.map(a => a.name ?? a).join(', ')}
                </div>
              )}
              {note && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', paddingLeft: '14px', fontStyle: 'italic' }}>
                  Nota: {note}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeliverySection({ hasDelivery, setHasDelivery, deliveryPayout, setDeliveryPayout, deliverySurcharge, setDeliverySurcharge, deliveryStaffId, setDeliveryStaffId, setDeliveryStaffName, staffMembers, inputStyle, labelStyle }) {
  const deliveryPayoutNum = parseFloat(deliveryPayout) || 0
  const deliveryStaff = (staffMembers ?? []).filter(m => m.role === 'delivery' && m.active !== false)
  return (
    <div>
      <label style={labelStyle}>Envío (opcional)</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: hasDelivery ? '12px' : '0' }}>
        {[{ v: false, l: 'Sin envío' }, { v: true, l: 'Con envío' }].map(({ v, l }) => (
          <button key={String(v)} type="button" onClick={() => setHasDelivery(v)} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: hasDelivery === v ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: hasDelivery === v ? 'rgba(255,198,42,0.12)' : 'transparent', color: hasDelivery === v ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      {hasDelivery && (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginTop: '4px' }}>Pago al repartidor</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>$</span>
                <input type="number" min="0" step="100" value={deliveryPayout} onChange={e => setDeliveryPayout(e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: '24px' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginTop: '4px' }}>Recargo envío (opcional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>$</span>
                <input type="number" min="0" step="100" value={deliverySurcharge} onChange={e => setDeliverySurcharge(e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: '24px' }} />
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>
              Delivery asignado
              {deliveryPayoutNum > 0 && <span style={{ color: '#ff6b6b' }}> *</span>}
            </label>
            {deliveryStaff.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#f59e0b' }}>No hay empleados delivery activos.</div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {deliveryStaff.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setDeliveryStaffId(m.id); setDeliveryStaffName(m.name) }}
                    style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: deliveryStaffId === m.id ? '2px solid var(--y)' : '2px solid rgba(255,255,255,0.1)', background: deliveryStaffId === m.id ? 'rgba(255,198,42,0.12)' : 'transparent', color: deliveryStaffId === m.id ? 'var(--y)' : 'var(--muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >{m.name}</button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
