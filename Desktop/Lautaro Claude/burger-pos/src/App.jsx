import { useState, useEffect } from "react";
import { ProductButtons } from "./components/ProductButtons";
import { CartSummary } from "./components/CartSummary";
import { OrderForm } from "./components/OrderForm";
import { OrderHistory } from "./components/OrderHistory";
import { PosInstructions } from "./components/PosInstructions";
import { LoginScreen } from "./components/LoginScreen";
import { useOrders } from "./hooks/useOrders";
import { useAuth } from "./hooks/useAuth";
import { printTicket, printTickets, todayStr } from "./utils/printing";

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
  const [step, setStep] = useState("menu");
  const [prevStep, setPrevStep] = useState("menu");
  const [cart, setCart] = useState([]);
  const [saving, setSaving] = useState(false);

  const goToConfirm = (from) => { setPrevStep(from); setStep('confirm'); };
  const { orders, loading, saveOrder, updateOrderStatus, updatePaymentStatus } = useOrders();

  // Protección contra navegación accidental cuando hay carrito activo
  useEffect(() => {
    if (cart.length === 0) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    const onPopState = () => {
      if (!window.confirm('Hay un pedido en curso. ¿Seguro que querés salir?')) {
        history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    history.pushState(null, '', window.location.href);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [cart.length]);

  const handleSaveOrder = async (formData) => {
    if (saving) return;
    setSaving(true);
    console.log("App handleSaveOrder recibido:", formData);
    const today = todayStr();
    const todayOrders = orders.filter(o => o.businessDate === today);
    const maxNum = todayOrders.reduce((max, o) => Math.max(max, Number(o.orderNumber || 0)), 0);
    const orderNumber = maxNum + 1;
    const orderCode = `${today}-${String(orderNumber).padStart(3, '0')}`;

    const subtotal = cart.reduce((sum, item) => {
      if (item.category === 'burger' || item.cartId) return sum + (item.basePrice + (item.meatCount - 1) * item.extraMeatPrice) * (item.qty || 1);
      return sum + item.price * item.qty;
    }, 0);
    const discountAmount = 0;
    const total = subtotal - discountAmount;

    const orderData = {
      orderNumber,
      orderCode,
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

    const savedOrder = { ...orderData, firestoreId };

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

    printTickets(savedOrder, ['cliente', 'cocina', 'caja']);

    setCart([]);
    setStep('menu');
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

      {/* Vista principal: layout 2 columnas desktop, 1 columna mobile */}
      {step === "menu" && (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          {/* Controles top-right: instrucciones + logout */}
          <div style={{
            position: 'fixed', top: '12px', right: '12px', zIndex: 100,
            display: 'flex', gap: '4px', alignItems: 'center',
          }}>
            <button
              onClick={() => setStep('instrucciones')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              Instrucciones POS
            </button>
            <button
              onClick={signOut}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--muted)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              Cerrar sesión
            </button>
          </div>

          {/* Layout desktop: flex row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            minHeight: '100vh',
          }}>
            {/* Columna izquierda: botones de productos */}
            <div
              className="menu-left-col"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                paddingBottom: '32px',
              }}>
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
              top: 0,
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--line)',
              background: 'var(--bg)',
              // En mobile se oculta con media query via className
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

              {/* Footer sticky del panel derecho: total + confirmar */}
              <div style={{
                borderTop: '2px solid var(--line)',
                padding: '16px',
                background: 'var(--bg)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text)' }}>TOTAL</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--y)' }}>
                    ${total.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => goToConfirm('menu')}
                  disabled={cart.length === 0}
                  style={{
                    width: '100%',
                    background: cart.length === 0 ? 'rgba(255,255,255,0.08)' : 'var(--y)',
                    color: cart.length === 0 ? 'var(--muted)' : '#000',
                    fontWeight: 'bold',
                    padding: '16px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    fontSize: '16px',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cart.length === 0 ? 'Pedido vacío' : `Confirmar Pedido (${cart.reduce((s, i) => s + i.qty, 0)})`}
                </button>
              </div>
            </div>
          </div>

          {/* Footer mobile: total + confirmar (solo en mobile, oculto en desktop) */}
          {cart.length > 0 && (
            <div className="cart-footer-mobile" style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--panel)',
              borderTop: '2px solid var(--line)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 50,
            }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--y)', flexShrink: 0 }}>
                ${total.toLocaleString()}
              </span>
              <button
                onClick={() => goToConfirm('menu')}
                style={{
                  width: '250px',
                  background: 'var(--y)',
                  color: '#000',
                  fontWeight: 'bold',
                  padding: '14px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Confirmar ({cart.reduce((s, i) => s + i.qty, 0)})
              </button>
              <button
                onClick={() => setStep('cart')}
                style={{
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontWeight: 'bold',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  flexShrink: 0,
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
                flex: 2, background: cart.length === 0 ? 'rgba(255,255,255,0.08)' : 'var(--y)',
                color: cart.length === 0 ? 'var(--muted)' : '#000',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: 'none', fontSize: '16px', cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
              }}>
              Confirmar Pedido
            </button>
          </div>
        </div>
      )}

      {/* Step confirm */}
      {step === "confirm" && (
        <div>
          <OrderForm cart={cart} onSave={handleSaveOrder} />
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
