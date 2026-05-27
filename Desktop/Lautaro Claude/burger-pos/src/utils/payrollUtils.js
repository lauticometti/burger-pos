/**
 * payrollUtils.js
 * Helpers para liquidación semanal de empleados (Lunes-Domingo).
 * Todas las funciones son puras: reciben datos, devuelven objetos. Sin side effects.
 */

/**
 * Devuelve el rango Lunes-Domingo de la semana que contiene la fecha dada.
 * @param {string} dateString  'YYYY-MM-DD'
 * @returns {{ monday: string, sunday: string, label: string }}
 */
export function getWeekRangeMondaySunday(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dow = date.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
  const offsetToMonday = (dow === 0 ? -6 : 1 - dow)
  const monday = new Date(date)
  monday.setDate(date.getDate() + offsetToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const fmtLabel = (d) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}`
  }

  return {
    monday: fmt(monday),
    sunday: fmt(sunday),
    label: `Lunes ${fmtLabel(monday)} al Domingo ${fmtLabel(sunday)}`,
  }
}

/**
 * Filtra movimientos del staffLedger para un empleado en un rango de fechas.
 * Usa businessDate (no weekId) para ser independiente del ciclo Mié-Dom.
 * Ignora movimientos voided.
 *
 * Estrategia de matching:
 *   1. Si el movimiento tiene employeeId y el empleado tiene id → match por id (robusto ante renombres)
 *   2. Fallback: comparar por staffName / employeeName (movimientos viejos sin employeeId)
 *
 * @param {Object} employee           — documento staffMembers con .id y .name
 * @param {Object[]} ledgerMovements
 * @param {{ monday: string, sunday: string }} weekRange
 * @returns {Object[]}
 */
function filterMovementsForEmployee(employee, ledgerMovements, weekRange) {
  return ledgerMovements.filter(e => {
    if (e.voided === true) return false
    const d = e.businessDate ?? ''
    if (d < weekRange.monday || d > weekRange.sunday) return false

    // Match primario: por employeeId (resistente a renombres)
    if (e.employeeId && employee.id) {
      return e.employeeId === employee.id
    }
    // Fallback: por nombre (movimientos viejos o cargados sin employeeId)
    const movName = e.staffName ?? e.employeeName ?? ''
    return movName === employee.name
  })
}

/**
 * Calcula la liquidación de un empleado para una semana dada.
 *
 * @param {Object} employee     — documento staffMembers
 * @param {Object[]} ledgerMovements — todos los movimientos no filtrados
 * @param {{ monday: string, sunday: string }} weekRange
 * @returns {Object}
 */
export function calculateEmployeePayroll(employee, ledgerMovements, weekRange, orders = []) {
  const isShift    = employee.salaryType === 'shift'
  const isDelivery = employee.salaryType === 'delivery'
  const shiftRate  = Number(employee.shiftRate ?? 0)

  const movements = filterMovementsForEmployee(employee, ledgerMovements, weekRange)

  let consumosStaff        = 0
  let cuentaInternaCubierta = 0  // debit_internal_account = parte cubierta con crédito
  let payrollDeductions    = 0   // payroll_deduction = parte a descontar de sueldo
  let adelantos            = 0
  let pagado               = 0
  let creditosComida       = 0
  let turnosTrabajados     = 0
  let sueldoTurnos         = 0
  let deliveryShiftsCount  = 0
  let deliveryBaseTotal    = 0

  for (const m of movements) {
    const amt = Number(m.amount ?? 0)
    switch (m.movementType) {
      case 'debit_staff_meal':
        consumosStaff += amt
        break
      case 'debit_internal_account':
        // Parte del consumo interno cubierta con crédito de comida
        cuentaInternaCubierta += amt
        break
      case 'payroll_deduction':
        // Parte del consumo interno (staff o cuenta interna) a descontar del sueldo
        payrollDeductions += amt
        break
      case 'salary_advance':
        adelantos += amt
        break
      case 'salary_payment':
        pagado += amt
        break
      case 'credit_shift_meal':
        creditosComida += amt
        break
      case 'work_shift':
        turnosTrabajados += 1
        sueldoTurnos     += amt
        break
      case 'delivery_shift':
        deliveryShiftsCount += 1
        deliveryBaseTotal   += Number(m.baseAmount ?? m.amount ?? 0)
        break
      default:
        break
    }
  }

  // cuentaInterna = total real consumido en cuenta interna (cubierto + a descontar)
  const cuentaInterna = cuentaInternaCubierta + payrollDeductions

  // consumosStaff solo tiene debit_staff_meal; para staff_consumption el payroll_deduction
  // ya está en payrollDeductions y no se duplica.
  const consumoTotalAsignado = consumosStaff + cuentaInternaCubierta
  const cubiertoPorCredito   = Math.min(creditosComida, consumoTotalAsignado)
  const saldoCreditoRestante = Math.max(creditosComida - consumoTotalAsignado, 0)
  // A descontar = los payroll_deduction reales registrados (no la diferencia matemática)
  const consumoADescontar    = payrollDeductions

  // Calcular envíos desde orders (no se duplican en staffLedger)
  let deliveryPayoutTotal = 0
  let deliveryOrdersCount = 0
  const deliveryOrders    = []

  if (isDelivery) {
    for (const o of orders) {
      // Incluir pedidos normales (sale) Y pedidos internos con delivery asignado
      const isNormalSale = o.orderMode === 'sale' && o.countsAsRevenue !== false
      const isInternalWithDelivery = o.orderMode === 'internal' && (o.assignedDeliveryId || o.assignedDeliveryName)
      if (!isNormalSale && !isInternalWithDelivery) continue
      if (o.status === 'cancelled') continue
      const payout = Number(o.deliveryPayout ?? 0)
      if (payout <= 0) continue

      // Fecha del pedido
      let oDate = o.businessDate ?? ''
      if (!oDate && o.createdAt?.toDate) {
        oDate = o.createdAt.toDate().toISOString().slice(0, 10)
      }
      if (oDate < weekRange.monday || oDate > weekRange.sunday) continue

      // Match robusto: por ID primero, fallback por nombre
      const matchById   = o.assignedDeliveryId && employee.id && o.assignedDeliveryId === employee.id
      const matchByName = !o.assignedDeliveryId && o.assignedDeliveryName && o.assignedDeliveryName === employee.name
      if (!matchById && !matchByName) continue

      deliveryPayoutTotal += payout
      deliveryOrdersCount += 1
      deliveryOrders.push({
        id: o.id ?? '',
        businessDate: oDate,
        orderCode: o.orderCode ?? '',
        displayOrderCode: o.displayOrderCode ?? '',
        customerName: o.customerName ?? o.customer ?? '',
        deliveryPayout: payout,
        paymentStatus: o.paymentStatus ?? '',
        status: o.status ?? '',
      })
    }
  }

  const sueldoBase = isShift    ? sueldoTurnos
                   : isDelivery ? (deliveryBaseTotal + deliveryPayoutTotal)
                   : Number(employee.weeklySalary ?? 0)

  const totalDescuentos = consumoADescontar + adelantos
  const totalAPagar = Math.max(sueldoBase - totalDescuentos, 0)
  const pendiente   = Math.max(totalAPagar - pagado, 0)

  let estado
  if (isDelivery && deliveryShiftsCount === 0 && deliveryOrdersCount === 0) {
    estado = 'sin_jornadas'
  } else if (sueldoBase === 0 && !isShift && !isDelivery) {
    estado = 'sin_sueldo'
  } else if (isShift && turnosTrabajados === 0) {
    estado = 'sin_turnos'
  } else if (pendiente === 0 && totalAPagar > 0) {
    estado = 'pagado'
  } else if (totalAPagar === 0 && totalDescuentos > sueldoBase) {
    estado = 'a_favor_negocio'
  } else if (pendiente > 0) {
    estado = 'pendiente'
  } else {
    estado = 'pagado'
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role ?? 'otro',
    salaryType: employee.salaryType ?? 'custom',
    shiftRate,
    turnosTrabajados,
    deliveryShiftsCount,
    deliveryBaseTotal,
    deliveryPayoutTotal,
    deliveryOrdersCount,
    deliveryOrders,
    sueldoBase,
    creditosComida,
    consumosStaff,
    cuentaInterna,
    cuentaInternaCubierta,
    payrollDeductions,
    consumoTotalAsignado,
    cubiertoPorCredito,
    saldoCreditoRestante,
    consumoADescontar,
    adelantos,
    pagado,
    totalAPagar,
    pendiente,
    estado,
    movements,
  }
}

/**
 * Calcula el resumen de liquidación para todos los empleados.
 *
 * @param {Object[]} employees        — array de staffMembers
 * @param {Object[]} ledgerMovements  — todos los movimientos del ledger para el período
 * @param {{ monday: string, sunday: string, label: string }} weekRange
 * @returns {Object}
 */
export function calculatePayrollSummary(employees, ledgerMovements, weekRange, orders = []) {
  const rows = employees.map(emp =>
    calculateEmployeePayroll(emp, ledgerMovements, weekRange, orders)
  )

  const totalSueldosBase = rows.reduce((s, r) => s + r.sueldoBase, 0)
  const totalConsumosStaff = rows.reduce((s, r) => s + r.consumosStaff, 0)
  const totalCuentaInterna = rows.reduce((s, r) => s + r.cuentaInterna, 0)
  const totalAdelantos = rows.reduce((s, r) => s + r.adelantos, 0)
  const totalPagado = rows.reduce((s, r) => s + r.pagado, 0)
  const totalAPagar = rows.reduce((s, r) => s + r.totalAPagar, 0)
  const totalPendiente = rows.reduce((s, r) => s + r.pendiente, 0)

  return {
    weekRange,
    rows,
    totals: {
      totalSueldosBase,
      totalConsumosStaff,
      totalCuentaInterna,
      totalAdelantos,
      totalPagado,
      totalAPagar,
      totalPendiente,
    },
  }
}

/**
 * Devuelve el rango de la semana anterior a la dada.
 * Útil para navegar entre semanas en la UI.
 * @param {{ monday: string }} weekRange
 * @returns {{ monday: string, sunday: string, label: string }}
 */
export function getPreviousWeekRange(weekRange) {
  const [y, m, d] = weekRange.monday.split('-').map(Number)
  const prev = new Date(y, m - 1, d)
  prev.setDate(prev.getDate() - 7)
  const fmt = (dt) => {
    const yr = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const da = String(dt.getDate()).padStart(2, '0')
    return `${yr}-${mo}-${da}`
  }
  return getWeekRangeMondaySunday(fmt(prev))
}

/**
 * Devuelve el rango de la semana siguiente.
 * @param {{ monday: string }} weekRange
 * @returns {{ monday: string, sunday: string, label: string }}
 */
export function getNextWeekRange(weekRange) {
  const [y, m, d] = weekRange.monday.split('-').map(Number)
  const next = new Date(y, m - 1, d)
  next.setDate(next.getDate() + 7)
  const fmt = (dt) => {
    const yr = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const da = String(dt.getDate()).padStart(2, '0')
    return `${yr}-${mo}-${da}`
  }
  return getWeekRangeMondaySunday(fmt(next))
}
