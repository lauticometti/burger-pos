export const SIZE_LABELS = { S: 'Simple', D: 'Doble', T: 'Triple' }

export const EVENT_BURGERS = [
  {
    id: 'salsa',
    name: 'Burger de la salsa',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: false,
    prices: { S: 6000, D: 9000, T: 12000 },
    removableIngredients: ['Cheddar', 'Salsa Burger Ya'],
    allowedExtras: [],
  },
  {
    id: 'american',
    name: 'American c/ papas',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: true,
    prices: { S: 10000, D: 13000, T: 16000 },
    removableIngredients: ['Cheddar', 'Lechuga', 'Tomate', 'Cebolla', 'Pepinos agridulces', 'Salsa Burger Ya'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
  {
    id: 'bbqueen',
    name: 'BBQueen c/ papas',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: true,
    prices: { S: 11000, D: 14000, T: 17000 },
    removableIngredients: ['Cheddar', 'Bacon', 'Cebolla caramelizada', 'Tomate', 'Barbacoa'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
  {
    id: 'smoklahoma',
    name: 'Smoklahoma c/ papas',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: true,
    prices: { S: 11000, D: 14000, T: 17000 },
    removableIngredients: ['Cheddar', 'Cebolla', 'Bacon', 'Salsa Burger Ya'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
]

export const EVENT_EXTRAS_BURGER_YA = [
  { id: 'papas', name: 'Papas', area: 'burger_ya', category: 'extra', price: 3000 },
  { id: 'dip', name: 'Dip', area: 'burger_ya', category: 'extra', price: 1000 },
  { id: 'coca_600', name: 'Coca 600', area: 'burger_ya', category: 'extra', price: 3000 },
  { id: 'coca_225', name: 'Coca 2.25', area: 'burger_ya', category: 'extra', price: 6000 },
]

// qty = unidades reales al presionar el botón una vez (2 para promos 2x1)
// btnLabel = lo que muestra el botón en pantalla
export const EVENT_DRINKS_T6 = [
  { id: 'fernet',     name: 'Fernet',         btnLabel: '2 Fernet',         area: 'drinks_t6', category: 'trago', price: 10000, qty: 2 },
  { id: 'caipiroska', name: 'Caipiroska',      btnLabel: '2 Caipiroska',     area: 'drinks_t6', category: 'trago', price: 10000, qty: 2 },
  { id: 'tropicana',  name: 'Tropicana',       btnLabel: 'Tropicana',        area: 'drinks_t6', category: 'trago', price: 10000, qty: 1 },
  { id: 'cherry',     name: 'Cherry',          btnLabel: 'Cherry',           area: 'drinks_t6', category: 'trago', price: 10000, qty: 1 },
  { id: 'gin_tonic',  name: 'Gin tonic',       btnLabel: 'Gin tonic',        area: 'drinks_t6', category: 'trago', price: 10000, qty: 1 },
  { id: 'gin_frutos', name: 'Gin frutos rojos',btnLabel: 'Gin frutos rojos', area: 'drinks_t6', category: 'trago', price: 10000, qty: 1 },
]

export const BURGER_ADDONS = [
  { id: 'extra_carne', name: 'Carne c/ cheddar', price: 3000 },
  { id: 'bacon', name: 'Bacon', price: 1500 },
  { id: 'cebolla_caramelizada', name: 'Cebolla caramelizada', price: 600 },
  { id: 'pepinos', name: 'Pepinos', price: 800 },
  { id: 'lechuga', name: 'Lechuga', price: 500 },
  { id: 'tomate', name: 'Tomate', price: 500 },
  { id: 'cebolla', name: 'Cebolla', price: 500 },
  { id: 'salsa_burger_ya', name: 'Salsa Burger Ya', price: 500 },
  { id: 'barbacoa', name: 'Barbacoa', price: 500 },
]
