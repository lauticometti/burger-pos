import { useState, useEffect } from "react";
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

function isSameDay(firestoreTimestamp) {
  if (!firestoreTimestamp) return false;
  const d = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const _savedOrder = loadOrderFromStorage();
  const [step, setStep] = useState(_savedOrder?.step ?? "menu");
  const [prevStep, setPrevStep] = useState("menu");
  const [cart, setCart] = useState(_savedOrder?.cart ?? []);
  const [saving, setSaving] = useState(false);
  const [orderMode, setOrderMode] = useState(_savedOrder?.orderMode ?? "sale"); // "sale" | "internal"

  const goToConfirm = (from) => { setPrevStep(from); setStep('confirm'); };
  const { orders, loading, saveOrder, updateOrderStatus, updatePaymentStatus } = useOrders();

  useEffect(() => {
    saveOrderToStorage({ cart, step, orderMode });
  }, [cart, step, orderMode]);

  function handleSetOrderMode(mode) {
    if (cart.length > 0) {
      alert('Primero vaciá el carrito para cambiar el modo.');
      return;
    }
    setOrderMode(mode);
  }

  const handleSaveOrder = async (formData) => {
    if (saving) return;
    setSaving(true);
    console.log("App handleSaveOrder recibido:", formData);
    const today = todayStr();
    const todayOrders = orders.filter(o => o.businessDate === today);

    // Numeración separada: ventas normales vs internos
    let orderCode, orderNumber, internalOrderNumber, displayOrderCode;

    if (formData.orderMode === 'internal') {
      const todayInternals = todayOrders.filter(o => o.orderMode === 'internal');
      const maxInternal = todayInternals.reduce(
        (max, o) => Math.max(max, Number(o.internalOrderNumber || 0)), 0
      );
      internalOrderNumber = maxInternal + 1;
      orderNumber = null;
      orderCode = `${today}-M${String(internalOrderNumber).padStart(3, '0')}`;
      displayOrderCode = `M${internalOrderNumber}`;
    } else {
      const todaySales = todayOrders.filter(o => o.orderMode !== 'internal');
      const maxNum = todaySales.reduce(
        (max, o) => Math.max(max, Number(o.orderNumber || 0)), 0
      );
      orderNumber = maxNum + 1;
      internalOrderNumber = null;
      orderCode = `${today}-${String(orderNumber).padStart(3, '0')}`;
      displayOrderCode = orderCode;
    }

    const subtotal = cart.reduce((sum, item) => {
      if (item.category === 'burger' || item.cartId) return sum + (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1);
      return sum + item.price * item.qty;
    }, 0);
    const discountAmount = 0;
    const total = subtotal - discountAmount;

    const orderData = {
      orderNumber,
      orderCode,
      displayOrderCode,
      businessDate: today,
      customerName: formData.customerName,
      items: cart,
      subtotal,
      discountAmount,
      total,
      paymentMethod: formData.paymentMethod,
      paymentStatus: formData.paymentStatus,
      orderType: formData.orderType,
      notes: formData.notes || '',
      mitiMiti: formData.mitiMiti || null,
      status: 'nuevo',
      // Modo y revenue
      orderMode: formData.orderMode || 'sale',
      countsAsRevenue: formData.countsAsRevenue !== false,
      internalOrderNumber: internalOrderNumber ?? null,
      // Campos internos (para ventas normales también se guardan con valores de venta)
      orderPurpose: formData.orderPurpose || 'sale',
      affectsCash: formData.affectsCash !== undefined ? formData.affectsCash : true,
      affectsPayroll: formData.affectsPayroll || false,
      costResponsibility: formData.costResponsibility || 'customer',
      relatedPerson: formData.relatedPerson || formData.customerName || '',
      relatedPersonRole: formData.relatedPersonRole || '',
      internalNote: formData.internalNote || '',
      internalAmount: formData.internalAmount ?? 0,
      saleValueAmount: formData.saleValueAmount ?? total,
      staffMenuItems: formData.staffMenuItems ?? [],
      staffMenuTotal: formData.staffMenuTotal ?? 0,
      // Staff consumption specific fields
      staffCoveredAmount: formData.staffCoveredAmount ?? 0,
      payrollDeductionAmount: formData.payrollDeductionAmount ?? 0,
      staffBalanceBefore: formData.staffBalanceBefore ?? null,
      staffBalanceAfter: formData.staffBalanceAfter ?? null,
    };

    console.log("Intentando guardar pedido en Firestore:", orderData);

    let firestoreId;
    try {
      firestoreId = await saveOrder(orderData, user);
      console.log("Firestore guardó OK:", firestoreId);
    } catch (err) {
      console.error("Error guardando pedido en Firestore:", err);
      alert("ERROR: el pedido no se guardó en Firestore. No se va a imprimir ni limpiar el carrito.");
      setSaving(false);
      return;
    }

    // Crear entradas en staffLedger para pedidos staff_consumption (fire-and-forget)
    if (formData.orderMode === 'internal' && formData.orderPurpose === 'staff_consumption') {
      const ledgerBase = {
        businessDate: today,
        staffName: formData.relatedPerson,
        staffRole: formData.relatedPersonRole || '',
        orderCode,
        orderId: firestoreId,
        note: formData.internalNote || '',
      };
      if ((formData.staffCoveredAmount ?? 0) > 0) {
        addStaffLedgerEntry({
          ...ledgerBase,
          movementType: 'debit_staff_meal',
          amount: formData.staffCoveredAmount,
        }, user).catch(err => console.warn('staffLedger debit_staff_meal failed:', err));
      }
      if ((formData.payrollDeductionAmount ?? 0) > 0) {
        addStaffLedgerEntry({
          ...ledgerBase,
          movementType: 'payroll_deduction',
          amount: formData.payrollDeductionAmount,
        }, user).catch(err => console.warn('staffLedger payroll_deduction failed:', err));
      }
    }

    const savedOrder = { ...orderData, firestoreId };

    // Google Sheets: solo para ventas normales
    if (formData.orderMode !== 'internal') {
      const apiEndpoint = import.meta.env.MODE === 'production'
        ? '/api/save-to-sheets-vercel'
        : '/api/save-to-sheets';
      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedOrder),
      }).catch((err) => {
        console.warn("Google Sheets no guardó el backup:", err);
      });
    }

    printTickets(savedOrder, ['cliente', 'cocina', 'caja']);

    setCart([]);
    setOrderMode('sale'); // volver a modo venta al completar
    setStep('menu');
    clearOrderFromStorage();
    setSaving(false);
  };

  const total = cart.reduce((sum, item) => {
    if (item.category === 'burger' || item.cartId) return sum + (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1);
    return sum + item.price * item.qty;
  }, 0);

  if (authLoading) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  if (!user) return <LoginScreen onLogin={signIn} />;

  return (
    <div>
      {/* Instrucciones POS */}
      {step === "instrucciones" && (
        <PosInstructions onBack={() => setStep('menu')} />
      )}

      {/* Staff dashboard */}
      {step === "staff" && (
        <StaffDashboard onBack={() => setStep('menu')} user={user} />
      )}

      {/* Vista principal: layout 2 columnas desktop, 1 columna mobile */}
      {step === "menu" && (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          {/* Navbar unificado */}
          <nav className="pos-navbar">
            <div className="navbar-left">
              <button
                onClick={() => handleSetOrderMode('sale')}
                className={`nav-button${orderMode === 'sale' ? ' active' : ''}`}
              >
                Nuevo pedido
              </button>
              <button
                onClick={() => handleSetOrderMode('internal')}
                className="nav-button"
                style={orderMode === 'internal' ? {
                  borderColor: 'rgba(255,150,50,0.7)',
                  color: '#ff9666',
                  background: 'rgba(255,150,50,0.08)',
                } : {}}
              >
                Pedido interno
              </button>
            </div>
            <div className="navbar-right">
              <button
                onClick={() => setStep('dashboard')}
                className="nav-button small active"
              >
                Ventas
              </button>
              <button
                onClick={() => setStep('staff')}
                className="nav-button small"
              >
                Staff
              </button>
              <button
                onClick={() => setStep('instrucciones')}
                className="nav-button small"
              >
                Ayuda
              </button>
              <button
                onClick={signOut}
                className="nav-button small exit"
              >
                Salir
              </button>
            </div>
          </nav>

          {/* Layout desktop: flex row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            minHeight: 'calc(100vh - 57px)',
          }}>
            {/* Columna izquierda: botones de productos */}
            <div
              className="menu-left-col"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                paddingBottom: '32px',
              }}>

              {/* Indicador modo interno */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px 0',
                flexWrap: 'wrap',
              }}>
                {orderMode === 'internal' && (
                  <span style={{
                    fontSize: '11px',
                    color: '#ff9666',
                    background: 'rgba(255,150,50,0.08)',
                    border: '1px solid rgba(255,150,50,0.2)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontWeight: '600',
                  }}>
                    Modo: Pedido interno
                  </span>
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
                />
              </div>
            </div>

            {/* Columna derecha: carrito inline sticky — solo desktop */}
            <div style={{
              width: '360px',
              flexShrink: 0,
              position: 'sticky',
              top: '57px',
              height: 'calc(100vh - 57px)',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--line)',
              background: 'var(--bg)',
            }}
              className="cart-sidebar"
            >
              {/* Área scrolleable del carrito */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                paddingBottom: '8px',
              }}>
                <CartSummary
                  cart={cart}
                  setCart={setCart}
                  compact={true}
                  onViewFull={() => setStep('cart')}
                />
              </div>

            </div>
          </div>

          {/* Floating Action Bar: centrado abajo, reemplaza footer viejo */}
          {cart.length > 0 && (
            <div className="floating-action-bar">
              {orderMode === 'internal' && (
                <span style={{ fontSize: '10px', color: '#ff9666', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  INTERNO
                </span>
              )}
              <span style={{
                color: orderMode === 'internal' ? '#ff9666' : '#FFC62A',
                fontWeight: 800,
                fontSize: '18px',
                whiteSpace: 'nowrap',
              }}>
                ${total.toLocaleString()}
              </span>
              <button
                onClick={() => goToConfirm('menu')}
                style={{
                  background: orderMode === 'internal' ? 'rgba(255,150,50,0.85)' : '#FFC62A',
                  color: '#050505',
                  fontWeight: 700,
                  height: '44px',
                  padding: '0 36px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
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
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontWeight: 600,
                  height: '44px',
                  padding: '0 24px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Ver pedido
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step cart: vista expandida completa */}
      {step === "cart" && (
        <div>
          <CartSummary cart={cart} setCart={setCart} compact={false} />
          <div style={{
            position: 'fixed', bottom: '32px', left: '32px', right: '32px',
            display: 'flex', gap: '12px', maxWidth: '640px', margin: '0 auto'
          }}>
            <button
              onClick={() => setStep("menu")}
              style={{
                flex: 1, background: 'var(--panel)', color: 'var(--text)',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: '1px solid var(--line)', fontSize: '16px', cursor: 'pointer'
              }}>
              Volver
            </button>
            <button
              onClick={() => goToConfirm('cart')}
              disabled={cart.length === 0}
              style={{
                flex: 2, background: cart.length === 0
                  ? 'rgba(255,255,255,0.08)'
                  : orderMode === 'internal'
                    ? 'rgba(255,150,50,0.85)'
                    : 'var(--y)',
                color: cart.length === 0 ? 'var(--muted)' : '#000',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: 'none', fontSize: '16px', cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
              }}>
              {orderMode === 'internal' ? 'Confirmar Interno' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard de ventas */}
      {step === "dashboard" && (
        <DailyDashboard onBack={() => setStep('menu')} />
      )}

      {/* Step confirm */}
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
                border: '1px solid var(--line)', fontSize: '16px', cursor: 'pointer'
              }}>
              Atras
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
