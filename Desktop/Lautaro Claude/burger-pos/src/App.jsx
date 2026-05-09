import { useState } from "react";
import { ProductButtons } from "./components/ProductButtons";
import { CartSummary } from "./components/CartSummary";
import { OrderForm } from "./components/OrderForm";
import { OrderHistory } from "./components/OrderHistory";
import { useOrders } from "./hooks/useOrders";
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
  const [step, setStep] = useState("menu");
  const [cart, setCart] = useState([]);
  const { orders, loading, saveOrder, updateOrderStatus, updatePaymentStatus } = useOrders();

  const handleSaveOrder = async (formData) => {
    console.log("App handleSaveOrder recibido:", formData)
    const today = todayStr();
    const todayOrders = orders.filter(o => o.businessDate === today);
    const maxNum = todayOrders.reduce((max, o) => Math.max(max, Number(o.orderNumber || 0)), 0);
    const orderNumber = maxNum + 1;
    const orderCode = `${today}-${String(orderNumber).padStart(3, '0')}`;

    const subtotal = cart.reduce((sum, item) => {
      if (item.cartId) return sum + item.basePrice + (item.meatCount - 1) * item.extraMeatPrice;
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
      status: 'nuevo',
    };

    console.log("Intentando guardar pedido en Firestore:", orderData)

    let firestoreId;
    try {
      firestoreId = await saveOrder(orderData);
      console.log("Firestore guardó OK:", firestoreId)
    } catch (err) {
      console.error("Error guardando pedido en Firestore:", err);
      alert("ERROR: el pedido no se guardó en Firestore. No se va a imprimir ni limpiar el carrito.");
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
  };

  return (
    <div>
      {step === "menu" && (
        <div>
          <ProductButtons cart={cart} setCart={setCart} />
          {cart.length > 0 && (
            <div style={{ position: 'fixed', bottom: '32px', right: '32px' }}>
              <button
                onClick={() => setStep("cart")}
                style={{
                  background: 'var(--y)',
                  color: '#000',
                  fontWeight: 'bold',
                  padding: '18px 36px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  fontSize: '20px',
                  boxShadow: 'var(--shadow)',
                  cursor: 'pointer'
                }}>
                Ver Pedido ({cart.reduce((sum, item) => sum + item.qty, 0)})
              </button>
            </div>
          )}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px 48px' }}>
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
      )}

      {step === "cart" && (
        <div>
          <CartSummary cart={cart} setCart={setCart} />
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
              onClick={() => setStep("confirm")}
              style={{
                flex: 2, background: 'var(--y)', color: '#000',
                fontWeight: 'bold', padding: '16px', borderRadius: 'var(--radius)',
                border: 'none', fontSize: '16px', cursor: 'pointer'
              }}>
              Confirmar Pedido
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div>
          <OrderForm cart={cart} onSave={handleSaveOrder} />
          <div style={{ position: 'fixed', bottom: '32px', left: '32px' }}>
            <button
              onClick={() => setStep("cart")}
              style={{
                background: 'var(--panel)', color: 'var(--text)',
                fontWeight: 'bold', padding: '14px 28px', borderRadius: 'var(--radius)',
                border: '1px solid var(--line)', fontSize: '16px', cursor: 'pointer'
              }}>
              Atrás
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
