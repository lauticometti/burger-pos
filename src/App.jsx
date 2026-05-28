import { useState, useEffect } from "react";
import { EventMode } from "./event/EventMode";
import { ProductButtons } from "./components/ProductButtons";
import { CartSummary } from "./components/CartSummary";
import { OrderForm } from "./components/OrderForm";
import { InternalOrderForm } from "./components/InternalOrderForm";
import { StaffDashboard } from "./components/StaffDashboard";
import { OrderHistory } from "./components/OrderHistory";
import { PosInstructions } from "./components/PosInstructions";
import { LoginScreen } from "./components/LoginScreen";
import { DailyDashboard } from "./components/DailyDashboard";
import { useOrders } from "./hooks/useOrders";
import { useAuth } from "./hooks/useAuth";
import { saveOrderToStorage, loadOrderFromStorage, clearOrderFromStorage } from "./hooks/useLocalOrderPersistence";
import { printTicket, printTickets, todayStr } from "./utils/printing";
import { addStaffLedgerEntry } from "./utils/staffLedger";
import { calcOrderTotals, getItemLineTotal, buildOrderDefaults, sanitizeOrderData } from "./utils/orderUtils";

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const _savedOrder = loadOrderFromStorage();
  const [step, setStep] = useState(_savedOrder?.step ?? "menu");
  const [prevStep, setPrevStep] = useState("menu");
  const [cart, setCart] = useState(_savedOrder?.cart ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [orderMode, setOrderMode] = useState(_savedOrder?.orderMode ?? "sale");

  const goToConfirm = (from) => { setPrevStep(from); setStep('confirm'); };
  const { orders, loading, saveOrder, updateOrderStatus, updatePaymentStatus } = useOrders();

  useEffect(() => {
    saveOrderToStorage({ cart, step, orderMode });
  }, [cart, step, orderMode]);

  function handleSetOrderMode(mode) {
    if (mode === orderMode) return;
    if (cart.length > 0) {
      setCart([]);
      clearOrderFromStorage();
    }
    setOrderMode(mode);
  }

  const handleSaveOrder = async (formData) => {
    if (saving) return;
    setSaving(true);

    const today = todayStr();
    const businessDate = (formData.orderMode === 'internal' && formData.operationalDateStr)
      ? formData.operationalDateStr
      : today;
    const todayOrders = orders.filter(o => o.businessDate === today);

    // ── Numeración ────────────────────────────────────────────────────────────
    let orderCode, orderNumber, internalOrderNumber, displayOrderCode;
    if (formData.orderMode === 'internal') {
      // Numeración de internos basada en businessDate elegida (no necesariamente hoy)
      const dateInternals = orders.filter(o => o.orderMode === 'internal' && o.businessDate === businessDate);
      const maxInternal = dateInternals.reduce((max, o) => Math.max(max, Number(o.internalOrderNumber || 0)), 0);
      internalOrderNumber = maxInternal + 1;
      orderNumber = null;
      orderCode = `${businessDate}-M${String(internalOrderNumber).padStart(3, '0')}`;
      displayOrderCode = `M${internalOrderNumber}`;
    } else {
      const todaySales = todayOrders.filter(o => o.orderMode !== 'internal');
      const maxNum = todaySales.reduce((max, o) => Math.max(max, Number(o.orderNumber || 0)), 0);
      orderNumber = maxNum + 1;
      internalOrderNumber = null;
      orderCode = `${today}-${String(orderNumber).padStart(3, '0')}`;
      displayOrderCode = `#${String(orderNumber).padStart(3, '0')}`;
    }

    // ── Totales ───────────────────────────────────────────────────────────────
    const { grossTotal, discountAmount, total, deliverySurcharge, deliveryPayout, netRevenue } =
      calcOrderTotals(cart, formData);

    // ── orderData ─────────────────────────────────────────────────────────────
    const orderData = {
      // 1. Defaults explícitos para todos los campos
      ...buildOrderDefaults(),
      // 2. Totales calculados (pisan defaults)
      subtotal: grossTotal,           // mantener campo para compatibilidad Google Sheets
      grossTotal,
      discountAmount,
      discountType:   formData.discountType   ?? 'none',
      discountValue:  formData.discountValue  ?? 0,
      discountReason: formData.discountReason ?? '',
      total,
      deliverySurcharge,
      deliveryPayout,
      netRevenue,
      // 3. Identificación
      orderNumber,
      orderCode,
      displayOrderCode,
      businessDate,
      customerName: formData.customerName,
      items: cart,
      // 4. Delivery
      deliveryAddress:        formData.deliveryAddress        ?? '',
      deliveryAddressDetails: formData.deliveryAddressDetails ?? '',
      assignedDeliveryType:   formData.assignedDeliveryType   ?? 'unassigned',
      assignedDeliveryId:     formData.assignedDeliveryId     ?? '',
      assignedDeliveryName:   formData.assignedDeliveryName   ?? '',
      deliveryResponsibility: formData.deliveryResponsibility ?? 'none',
      deliveryChargedTo:      formData.deliveryChargedTo      ?? '',
      chargeableInternalTotal: formData.chargeableInternalTotal ?? 0,
      // 5. Notas
      notes:        formData.notes        ?? '',  // compatibilidad con pedidos viejos
      kitchenNote:  formData.kitchenNote  ?? '',
      internalNote: formData.internalNote ?? '',
      // 6. Pago
      paymentMethod:  formData.paymentMethod,
      paymentStatus:  formData.paymentStatus,
      orderType:      formData.orderType,
      mitiMiti:       formData.mitiMiti || null,
      // 7. Estado
      status: 'nuevo',
      // 8. Modo y revenue
      orderMode:        formData.orderMode || 'sale',
      countsAsRevenue:  formData.countsAsRevenue !== false,
      internalOrderNumber: internalOrderNumber ?? null,
      // 9. Campos internos
      orderPurpose:           formData.orderPurpose           || 'sale',
      affectsCash:            formData.affectsCash            !== undefined ? formData.affectsCash : true,
      affectsPayroll:         formData.affectsPayroll         || false,
      affectsInternalBalance: formData.affectsInternalBalance || false,
      costResponsibility:     formData.costResponsibility     || 'customer',
      relatedPerson:          formData.relatedPerson          || formData.customerName || '',
      relatedPersonRole:      formData.relatedPersonRole      || '',
      internalAmount:         formData.internalAmount         ?? 0,
      cashCollected:          formData.cashCollected          ?? 0,
      saleValueAmount:        formData.saleValueAmount        ?? total,
      staffOrder:             formData.staffOrder             ?? null,
      staffMenuTotal:         formData.staffMenuTotal         ?? 0,
      staffCoveredAmount:     formData.staffCoveredAmount     ?? 0,
      payrollDeductionAmount: formData.payrollDeductionAmount ?? 0,
      staffBalanceBefore:     formData.staffBalanceBefore     ?? null,
      staffBalanceAfter:      formData.staffBalanceAfter      ?? null,
      internalAllocations:    formData.internalAllocations    ?? [],
      barterItems:                    formData.barterItems                    ?? [],
      barterValueAmount:              formData.barterValueAmount              ?? 0,
      internalCostItems:              formData.internalCostItems              ?? [],
      internalCostManualAdjustment:   formData.internalCostManualAdjustment   ?? 0,
      internalCostManualReason:       formData.internalCostManualReason       ?? '',
      internalCostAmount:             formData.internalCostAmount             ?? 0,
      internalProductCostAmount:      formData.internalProductCostAmount      ?? 0,
      internalDeliveryCostAmount:     formData.internalDeliveryCostAmount     ?? 0,
      internalTotalCostAmount:        formData.internalTotalCostAmount        ?? 0,
      internalCoveredByCash:          formData.internalCoveredByCash          ?? 0,
      internalPendingAmount:          formData.internalPendingAmount          ?? 0,
      internalSurplusCash:            formData.internalSurplusCash            ?? 0,
      internalResultAmount:           formData.internalResultAmount           ?? 0,
      marketingCostItems:             formData.marketingCostItems             ?? [],
      marketingCostManualAdjustment:  formData.marketingCostManualAdjustment  ?? 0,
      marketingCostManualReason:      formData.marketingCostManualReason      ?? '',
      marketingProductCostAmount:     formData.marketingProductCostAmount     ?? 0,
      marketingDeliveryCostAmount:    formData.marketingDeliveryCostAmount    ?? 0,
      marketingTotalCostAmount:       formData.marketingTotalCostAmount       ?? 0,
    };

    const cleanOrderData = sanitizeOrderData(orderData);

    let firestoreId;
    try {
      firestoreId = await saveOrder(cleanOrderData, user);
    } catch (err) {
      console.error("Error guardando pedido en Firestore:", err);
      setSaveError("Error al guardar el pedido. No se imprimió ni se limpió el carrito.");
      setSaving(false);
      return;
    }

    // Staff ledger
    if (formData.orderMode === 'internal' && formData.orderPurpose === 'staff_consumption') {
      const ledgerBase = {
        businessDate,
        staffName: formData.relatedPerson,
        staffRole: formData.relatedPersonRole || '',
        orderCode,
        displayOrderCode,
        internalOrderNumber: internalOrderNumber ?? null,
        orderPurpose: 'staff_consumption',
        orderId: firestoreId,
        note: formData.internalNote || '',
      };
      if ((formData.staffCoveredAmount ?? 0) > 0) {
        addStaffLedgerEntry({ ...ledgerBase, movementType: 'debit_staff_meal', amount: formData.staffCoveredAmount, staffOrder: formData.staffOrder ?? null }, user)
          .catch(err => console.warn('staffLedger debit_staff_meal failed:', err));
      }
      if ((formData.payrollDeductionAmount ?? 0) > 0) {
        addStaffLedgerEntry({ ...ledgerBase, movementType: 'payroll_deduction', amount: formData.payrollDeductionAmount }, user)
          .catch(err => console.warn('staffLedger payroll_deduction failed:', err));
      }
    }

    // internal_account ledger: one debit_internal_account entry per allocation — only if there is pending amount
    if (formData.orderMode === 'internal' && formData.orderPurpose === 'internal_account'
        && (formData.internalPendingAmount ?? 0) > 0) {
      const allocations = formData.internalAllocations ?? [];
      for (const alloc of allocations) {
        const ledgerBase = {
          businessDate,
          staffName: alloc.staffName,
          staffRole: alloc.staffRole || '',
          orderCode,
          displayOrderCode,
          internalOrderNumber: internalOrderNumber ?? null,
          orderPurpose: 'internal_account',
          orderId: firestoreId,
          note: formData.internalNote || '',
        };
        if ((alloc.coveredByBalance ?? 0) > 0) {
          addStaffLedgerEntry({ ...ledgerBase, movementType: 'debit_internal_account', amount: alloc.coveredByBalance }, user)
            .catch(err => console.warn('staffLedger debit_internal_account failed:', err));
        }
        if ((alloc.payrollDeductionAmount ?? 0) > 0) {
          addStaffLedgerEntry({ ...ledgerBase, movementType: 'payroll_deduction', amount: alloc.payrollDeductionAmount }, user)
            .catch(err => console.warn('staffLedger payroll_deduction failed:', err));
        }
      }
    }

    const savedOrder = { ...cleanOrderData, firestoreId };

    // Google Sheets (solo ventas normales, campos básicos)
    if (formData.orderMode !== 'internal') {
      const apiEndpoint = import.meta.env.MODE === 'production'
        ? '/api/save-to-sheets-vercel'
        : '/api/save-to-sheets';
      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedOrder),
      }).catch(err => console.warn("Google Sheets no guardó el backup:", err));
    }

    printTickets(savedOrder, ['cliente', 'cocina', 'caja']);

    setCart([]);
    setOrderMode('sale');
    setStep('menu');
    clearOrderFromStorage();
    setSaving(false);
  };

  // Total del carrito para floating bar (usa helpers)
  const cartTotal = cart.reduce((sum, item) => sum + getItemLineTotal(item), 0);

  if (authLoading) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  if (!user) return <LoginScreen onLogin={signIn} />;

  return (
    <div>
      {step === "instrucciones" && <PosInstructions onBack={() => setStep('menu')} />}

      {step === "staff" && <StaffDashboard onBack={() => setStep('menu')} user={user} orders={orders} />}

      {step === "menu" && (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          {/* Banner: error al guardar pedido */}
          {saveError && (
            <div style={{
              position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 9998, background: '#c0392b', color: '#fff',
              borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)', maxWidth: '90vw', textAlign: 'center',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span>{saveError}</span>
              <button
                onClick={() => setSaveError('')}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                  borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 700,
                }}
              >✕</button>
            </div>
          )}

          <nav className="pos-navbar">
            <div className="navbar-left">
              <button
                onClick={() => handleSetOrderMode('sale')}
                className={`nav-button${orderMode === 'sale' ? ' active' : ''}`}
              >Nuevo pedido</button>
              <button
                onClick={() => handleSetOrderMode('internal')}
                className="nav-button"
                style={orderMode === 'internal' ? {
                  borderColor: 'rgba(255,150,50,0.7)', color: '#ff9666',
                  background: 'rgba(255,150,50,0.08)',
                } : {}}
              >Pedido interno</button>
              {cart.length > 0 && (
                <span style={{
                  fontSize: '11px', color: '#d97706',
                  marginLeft: '6px', fontWeight: 500,
                }}>
                  Cambiar de modo vaciará el carrito actual.
                </span>
              )}
            </div>
            <div className="navbar-right">
              <button onClick={() => setStep('dashboard')} className="nav-button small active">Ventas</button>
              <button onClick={() => setStep('staff')} className="nav-button small">Staff</button>
              <button onClick={() => setStep('event')} className="nav-button small" style={{ borderColor: 'rgba(255,198,42,0.4)', color: '#FFC62A' }}>Evento</button>
              <button onClick={() => setStep('instrucciones')} className="nav-button small">Ayuda</button>
              <button onClick={signOut} className="nav-button small exit">Salir</button>
            </div>
          </nav>

          <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 'calc(100vh - 57px)' }}>
            {/* Columna izquierda */}
            <div className="menu-left-col" style={{ flex: '1 1 0', minWidth: 0, paddingBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
                {orderMode === 'internal' && (
                  <span style={{
                    fontSize: '11px', color: '#ff9666',
                    background: 'rgba(255,150,50,0.08)', border: '1px solid rgba(255,150,50,0.2)',
                    borderRadius: '6px', padding: '3px 8px', fontWeight: '600',
                  }}>Modo: Pedido interno</span>
                )}
              </div>

              <ProductButtons cart={cart} setCart={setCart} />
              <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 0 48px' }}>
                <OrderHistory
                  orders={orders}
                  loading={loading}
                  updateOrderStatus={updateOrderStatus}
                  updatePaymentStatus={updatePaymentStatus}
                  printTicket={printTicket}
                  printTickets={printTickets}
                  user={user}
                />
              </div>
            </div>

            {/* Sidebar carrito (desktop) */}
            <div style={{
              width: '360px', flexShrink: 0,
              position: 'sticky', top: '57px',
              height: 'calc(100vh - 57px)',
              display: 'flex', flexDirection: 'column',
              borderLeft: '1px solid var(--line)', background: 'var(--bg)',
            }} className="cart-sidebar">
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '8px' }}>
                <CartSummary
                  cart={cart}
                  setCart={setCart}
                  compact={true}
                  onViewFull={() => setStep('cart')}
                />
              </div>
            </div>
          </div>

          {/* Floating action bar */}
          {cart.length > 0 && (
            <div className="floating-action-bar">
              {orderMode === 'internal' && (
                <span style={{ fontSize: '10px', color: '#ff9666', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  INTERNO
                </span>
              )}
              <span style={{
                color: orderMode === 'internal' ? '#ff9666' : '#FFC62A',
                fontWeight: 800, fontSize: '18px', whiteSpace: 'nowrap',
              }}>
                ${cartTotal.toLocaleString()}
              </span>
              <button
                onClick={() => goToConfirm('menu')}
                style={{
                  background: orderMode === 'internal' ? 'rgba(255,150,50,0.85)' : '#FFC62A',
                  color: '#050505', fontWeight: 700, height: '44px', padding: '0 36px',
                  borderRadius: '999px', border: 'none', fontSize: '15px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {orderMode === 'internal'
                  ? `Interno (${cart.reduce((s, i) => s + i.qty, 0)})`
                  : `Confirmar (${cart.reduce((s, i) => s + i.qty, 0)})`}
              </button>
              <button
                className="fab-ver-pedido"
                onClick={() => setStep('cart')}
                style={{
                  background: 'rgba(255,255,255,0.04)', color: '#fff',
                  fontWeight: 600, height: '44px', padding: '0 24px',
                  borderRadius: '999px', border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Ver pedido</button>
            </div>
          )}
        </div>
      )}

      {step === "cart" && (
        <div>
          <CartSummary cart={cart} setCart={setCart} compact={false} />
          <div style={{
            position: 'fixed', bottom: '32px', left: '32px', right: '32px',
            display: 'flex', gap: '12px', maxWidth: '640px', margin: '0 auto',
          }}>
            <button
              onClick={() => setStep("menu")}
              style={{
                flex: 1, background: 'var(--panel)', color: 'var(--text)',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: '1px solid var(--line)', fontSize: '16px', cursor: 'pointer',
              }}
            >Volver</button>
            <button
              onClick={() => goToConfirm('cart')}
              disabled={cart.length === 0}
              style={{
                flex: 2,
                background: cart.length === 0
                  ? 'rgba(255,255,255,0.08)'
                  : orderMode === 'internal' ? 'rgba(255,150,50,0.85)' : 'var(--y)',
                color: cart.length === 0 ? 'var(--muted)' : '#000',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: 'none', fontSize: '16px',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {orderMode === 'internal' ? 'Confirmar Interno' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      )}

      {step === "dashboard" && <DailyDashboard onBack={() => setStep('menu')} />}

      {step === "event" && <EventMode onBack={() => setStep('menu')} user={user} />}

      {step === "confirm" && (
        <div>
          {orderMode === 'internal'
            ? <InternalOrderForm cart={cart} onSave={handleSaveOrder} user={user} />
            : <OrderForm cart={cart} onSave={handleSaveOrder} />
          }
          <div style={{ position: 'fixed', bottom: '32px', left: '32px' }}>
            <button
              onClick={() => setStep(prevStep)}
              style={{
                background: 'var(--panel)', color: 'var(--text)',
                fontWeight: 'bold', padding: '14px 28px', borderRadius: 'var(--radius)',
                border: '1px solid var(--line)', fontSize: '16px', cursor: 'pointer',
              }}
            >Atras</button>
          </div>
        </div>
      )}
    </div>
  );
}
