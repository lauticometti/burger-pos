// Lógica para el código oculto JUERNES16
const VALID_CODE = 'JUERNES16'

export function isValidCode(code) {
  return code.trim().toUpperCase() === VALID_CODE
}

export function applyHiddenCode(cart) {
  // Verificar si ya hay código aplicado
  if (cart.some(item => item.isHiddenCodeBenefit)) {
    return cart
  }

  // Verificar si hay papas en el carrito
  const hasPapas = cart.some(item => item.id === 'papas_fritas')
  if (!hasPapas) {
    return cart
  }

  // Agregar nueva mejora gratis de cheddar
  return [
    ...cart,
    {
      id: 'cheddar-benefit',
      name: 'Papas + cheddar',
      price: 0,
      qty: 1,
      isHiddenCodeBenefit: true,
      parentProductId: 3
    }
  ]
}

export function removeHiddenCodeBenefit(cart) {
  return cart.filter(item => !item.isHiddenCodeBenefit)
}
