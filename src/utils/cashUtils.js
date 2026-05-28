/**
 * cashUtils.js
 * Helpers para cierre de caja diario.
 * Todas las funciones son puras: reciben datos, devuelven objetos. Sin side effects.
 *
 * REGLAS DE NEGOCIO:
 * - Caja libre solo incluye plata YA cobrada.
 * - Pedidos pendientes van en "pendiente por cobrar", nunca en caja libre.
 * - Cta cte y canjes no son plata física.
 * - La estimación es conservadora: no se suma lo que no entró.
 */

/**
 * Separa y agrupa las ventas del día por método de pago.
 * Solo toma pedidos orderMode="sale", countsAsRevenue=true, status != "cancelado".
 *
 * @param {Object[]} orders
 * @returns {Object} {
 *   efectivo: number,
 *   transferencia: number,
 *   mitiMiti: { efectivo, transferencia, deuda },
 *   ctaCte: number,
 *   canje: number,
 *   otro: number,
 *   pendientePorCobrar: number,
 *   totalCobrado: number,
 *   totalVentas: number,
 *   rows: Array<{ method, total, count }>
 * }
 */
export function groupSalesByPaymentMethod(orders) {
  let efectivo = 0
  let transferencia = 0
  let mitiMitiEfectivo = 0
  let mitiMitiTransferencia = 0
  let mitiMitiDeuda = 0
  let ctaCte = 0
  let canje = 0
  let otro = 0
  let pendientePorCobrar = 0
  let totalCobrado = 0

  for (const o of orders) {
    if (o.status === 'cancelado') continue
    if (o.countsAsRevenue === false) continue
    if (o.orderMode === 'internal') continue

    const total = Number(o.total ?? 0)
    const isPaid = o.paymentStatus !== 'pendiente'

    if (!isPaid) {
      pendientePorCobrar += total
      continue
    }

    totalCobrado += total
    const method = o.paymentMethod ?? 'otro'

    if (method === 'efectivo') {
      efectivo += total
    } else if (method === 'transferencia') {
      transferencia += total
    } else if (method === 'miti_miti') {
      const mm = o.mitiMiti ?? {}
      mitiMitiEfectivo += Number(mm.efectivo ?? 0)
      mitiMitiTransferencia += Number(mm.transferencia ?? 0)
      mitiMitiDeuda += Number(mm.deuda ?? 0)
    } else if (method === 'cta_cte') {
      ctaCte += total
    } else if (method === 'canje') {
      canje += total
    } else {
      otro += total
    }
  }

  return {
    efectivo,
    transferencia,
    mitiMiti: {
      efectivo: mitiMitiEfectivo,
      transferencia: mitiMitiTransferencia,
      deuda: mitiMitiDeuda,
    },
    ctaCte,
    canje,
    otro,
    pendientePorCobrar,
    totalCobrado,
    totalVentas: totalCobrado + pendientePorCobrar,
  }
}

/**
 * Agrupa los egresos del staffLedger y pedidos por tipo y método de pago.
 * Contempla: deliveryPayout de orders, salary_advance, salary_payment, cash_expense del ledger.
 *
 * @param {Object[]} orders
 * @param {Object[]} ledgerMovements  — movimientos del staffLedger del día
 * @returns {Object} {
 *   deliveryPayoutCash: number,
 *   deliveryPayoutTransfer: number,
 *   deliveryPayoutTotal: number,
 *   salaryAdvanceCash: number,
 *   salaryAdvanceTransfer: number,
 *   salaryAdvanceTotal: number,
 *   salaryPaymentCash: number,
 *   salaryPaymentTransfer: number,
 *   salaryPaymentTotal: number,
 *   cashExpensesCash: number,
 *   cashExpensesTransfer: number,
 *   cashExpensesTotal: number,
 *   totalEgresosCash: number,
 *   totalEgresosTransfer: number,
 *   rows: Array<{ category, method, amount, note }>
 * }
 */
export function groupExpensesByPaymentMethod(orders, ledgerMovements) {
  let deliveryPayoutCash = 0
  let deliveryPayoutTransfer = 0

  for (const o of orders) {
    if (o.status === 'cancelado') continue
    if (o.countsAsRevenue === false) continue
    const payout = Number(o.deliveryPayout ?? 0)
    if (payout <= 0) continue
    // El pago al delivery se asume cash salvo que haya campo explícito (futuro)
    deliveryPayoutCash += payout
  }

  let salaryAdvanceCash = 0
  let salaryAdvanceTransfer = 0
  let salaryPaymentCash = 0
  let salaryPaymentTransfer = 0
  let cashExpensesCash = 0
  let cashExpensesTransfer = 0

  const expenseRows = []

  for (const m of ledgerMovements) {
    if (m.voided === true) continue
    const amt = Number(m.amount ?? 0)
    const method = m.paymentMethod ?? 'cash'
    const isCash = method === 'cash' || method === 'efectivo'

    if (m.movementType === 'salary_advance') {
      if (isCash) salaryAdvanceCash += amt
      else salaryAdvanceTransfer += amt
      expenseRows.push({ category: 'Adelanto sueldo', method, amount: amt, note: m.note ?? '', staffName: m.staffName ?? m.employeeName ?? '' })
    } else if (m.movementType === 'salary_payment') {
      if (isCash) salaryPaymentCash += amt
      else salaryPaymentTransfer += amt
      expenseRows.push({ category: 'Pago sueldo', method, amount: amt, note: m.note ?? '', staffName: m.staffName ?? m.employeeName ?? '' })
    } else if (m.movementType === 'cash_expense') {
      if (isCash) cashExpensesCash += amt
      else cashExpensesTransfer += amt
      expenseRows.push({ category: m.category ?? 'otro', method, amount: amt, note: m.note ?? '', staffName: '' })
    }
  }

  return {
    deliveryPayoutCash,
    deliveryPayoutTransfer,
    deliveryPayoutTotal: deliveryPayoutCash + deliveryPayoutTransfer,
    salaryAdvanceCash,
    salaryAdvanceTransfer,
    salaryAdvanceTotal: salaryAdvanceCash + salaryAdvanceTransfer,
    salaryPaymentCash,
    salaryPaymentTransfer,
    salaryPaymentTotal: salaryPaymentCash + salaryPaymentTransfer,
    cashExpensesCash,
    cashExpensesTransfer,
    cashExpensesTotal: cashExpensesCash + cashExpensesTransfer,
    totalEgresosCash: deliveryPayoutCash + salaryAdvanceCash + salaryPaymentCash + cashExpensesCash,
    totalEgresosTransfer: deliveryPayoutTransfer + salaryAdvanceTransfer + salaryPaymentTransfer + cashExpensesTransfer,
    rows: expenseRows,
  }
}

/**
 * Calcula el efectivo esperado en caja al final del día.
 * Solo suma plata que ya entró en efectivo y resta egresos en efectivo.
 *
 * @param {Object} sales   — resultado de groupSalesByPaymentMethod
 * @param {Object} expenses — resultado de groupExpensesByPaymentMethod
 * @returns {number}
 */
export function calculateExpectedCash(sales, expenses) {
  const entradaEfectivo =
    sales.efectivo +
    sales.mitiMiti.efectivo

  // Cobros de cuenta interna en efectivo también entran
  // (affectsCash=true en esos pedidos, pero ya están filtrados fuera de countsAsRevenue)
  // Se agregan en calculateDailyCashSummary si se pasan

  const salidaEfectivo = expenses.totalEgresosCash

  return entradaEfectivo - salidaEfectivo
}

/**
 * Calcula la caja libre estimada de forma conservadora.
 * NO incluye: pendientes, cta cte, canjes, deuda miti miti.
 *
 * @param {Object} sales
 * @param {Object} expenses
 * @param {number} sueldosPendientesTotal  — de payrollSummary
 * @returns {Object}
 */
export function calculateAvailableCash(sales, expenses, sueldosPendientesTotal = 0) {
  const efectivoEsperado = calculateExpectedCash(sales, expenses)
  const transferenciasCobradas = sales.transferencia + sales.mitiMiti.transferencia

  // Caja libre = efectivo + transferencias - sueldos pendientes
  // NO se suma: pendientes por cobrar, cta cte, canjes, deuda miti miti
  const cajaLibreEstimada = efectivoEsperado + transferenciasCobradas - sueldosPendientesTotal

  return {
    efectivoEsperado,
    transferenciasCobradas,
    pendientePorCobrar: sales.pendientePorCobrar,
    sueldosPendientes: sueldosPendientesTotal,
    cajaLibreEstimada,
    noContabilizado: {
      ctaCte: sales.ctaCte,
      canje: sales.canje,
      deudaMitiMiti: sales.mitiMiti.deuda,
      otro: sales.otro,
    },
  }
}

/**
 * Calcula el cierre de caja diario completo.
 * Función principal que compone todas las anteriores.
 *
 * @param {Object[]} orders               — todos los pedidos del día
 * @param {Object[]} ledgerMovements      — movimientos del staffLedger del día
 * @param {Object|null} cashClosure       — cierre guardado (si ya existe)
 * @param {string} businessDate           — 'YYYY-MM-DD'
 * @param {number} sueldosPendientes      — de calculatePayrollSummary (semana)
 * @returns {Object}
 */
export function calculateDailyCashSummary(orders, ledgerMovements, cashClosure, businessDate, sueldosPendientes = 0) {
  // Filtrar solo pedidos del día
  const dayOrders = orders.filter(o => o.businessDate === businessDate)
  const dayLedger = ledgerMovements.filter(m => m.businessDate === businessDate)

  const sales = groupSalesByPaymentMethod(dayOrders)
  const expenses = groupExpensesByPaymentMethod(dayOrders, dayLedger)
  const available = calculateAvailableCash(sales, expenses, sueldosPendientes)

  const efectivoEsperado = available.efectivoEsperado
  const efectivoContado = cashClosure ? Number(cashClosure.countedCash ?? 0) : null
  const diferenciaCaja = efectivoContado !== null ? efectivoContado - efectivoEsperado : null

  let estadoCaja = 'sin_contar'
  if (diferenciaCaja !== null) {
    if (diferenciaCaja === 0) estadoCaja = 'cuadrada'
    else if (diferenciaCaja > 0) estadoCaja = 'sobra'
    else estadoCaja = 'falta'
  }

  return {
    businessDate,
    sales,
    expenses,
    available,
    cierre: {
      efectivoEsperado,
      efectivoContado,
      diferenciaCaja,
      estadoCaja,
      notas: cashClosure?.notes ?? '',
      guardado: cashClosure != null,
    },
    meta: {
      totalOrdenesDelDia: dayOrders.length,
      ordenesCanceladas: dayOrders.filter(o => o.status === 'cancelado').length,
      ordenesPendientesPago: dayOrders.filter(o => o.paymentStatus === 'pendiente' && o.status !== 'cancelado').length,
    },
  }
}
