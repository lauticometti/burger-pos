const KEY = 'burger_pos_current_order';
const SAFE_STEPS = ['menu', 'cart'];

export function saveOrderToStorage({ cart, step, orderMode }) {
  try {
    const data = {
      cart,
      step: SAFE_STEPS.includes(step) ? step : 'menu',
      orderMode,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    if (import.meta.env.DEV) console.log('Pedido guardado en localStorage');
  } catch {
    // localStorage puede fallar en modo privado o cuando está lleno
  }
}

export function loadOrderFromStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.cart)) {
      localStorage.removeItem(KEY);
      if (import.meta.env.DEV) console.log('Pedido local limpiado (datos inválidos)');
      return null;
    }
    if (import.meta.env.DEV) console.log('Pedido restaurado desde localStorage');
    return data;
  } catch {
    localStorage.removeItem(KEY);
    if (import.meta.env.DEV) console.log('Pedido local limpiado (error al parsear)');
    return null;
  }
}

export function clearOrderFromStorage() {
  localStorage.removeItem(KEY);
  if (import.meta.env.DEV) console.log('Pedido local limpiado');
}
