export const SIZE_LABELS = { S: 'Simple', D: 'Doble', T: 'Triple' }

// ─── CATÁLOGO CUMPLEAÑOS 2 AÑOS BURGER YA ────────────────────────────────────
// Burgers sin papas incluidas. Precios del flyer — completar antes de abrir.

export const EVENT_BURGERS = [
  {
    id: 'cheese',
    name: 'Cheese',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: false,
    prices: { S: 6000, D: 9000, T: 12000 },
    removableIngredients: ['Cheddar', 'Lechuga', 'Tomate', 'Pepinos agridulces', 'Salsa Burger Ya'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
  {
    id: 'lautiboom',
    name: 'Lautiboom',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: false,
    prices: { S: 7000, D: 10000, T: 13000 },
    removableIngredients: ['Cheddar', 'Bacon', 'Cebolla caramelizada', 'Pepinos agridulces'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
  {
    id: 'smoklahoma',
    name: 'Smoklahoma',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: false,
    prices: { S: 8000, D: 11000, T: 14000 },
    removableIngredients: ['Cheddar', 'Cebolla', 'Bacon', 'Salsa Burger Ya'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
  {
    id: 'doritos',
    name: 'Doritos',
    area: 'burger_ya',
    category: 'burger',
    hasPapas: false,
    prices: { S: 9000, D: 12000, T: 15000 },
    removableIngredients: ['Cheddar', 'Bacon', 'Barbacoa', 'Doritos'],
    allowedExtras: ['extra_carne', 'bacon', 'cebolla_caramelizada', 'pepinos', 'lechuga', 'tomate', 'cebolla', 'salsa_burger_ya', 'barbacoa'],
  },
]

export const EVENT_EXTRAS_BURGER_YA = [
  { id: 'papas',    name: 'Papas',      area: 'burger_ya', category: 'extra', price: 3000 },
  { id: 'dip',      name: 'Dip',        area: 'burger_ya', category: 'extra', price: 1000 },
  { id: 'coca_600', name: 'Coca 600',   area: 'burger_ya', category: 'extra', price: 3000 },
  { id: 'coca_225', name: 'Coca 2.25',  area: 'burger_ya', category: 'extra', price: 6000 },
  { id: 'heineken', name: 'Heineken',   area: 'burger_ya', category: 'cerveza', price: 4000 },
  { id: 'corona',   name: 'Corona',     area: 'burger_ya', category: 'cerveza', price: 4000 },
  { id: 'stella',   name: 'Stella',     area: 'burger_ya', category: 'cerveza', price: 3500 },
]

// Variedades de tragos disponibles hoy (para selector en combos)
export const DRINK_VARIETIES = [
  { id: 'fernet',        name: 'Fernet' },
  { id: 'caipiroska',    name: 'Caipiroska' },
  { id: 'caipi_frutos',  name: 'Caipi frutos rojos' },
]

// Combos de tragos: precio fijo, selección de variedades en modal
// category: 'combo_trago' — se identifican en impresión para mostrar selecciones
export const EVENT_DRINKS_T6 = [
  {
    id: 'combo_1trago',
    name: '1 trago',
    btnLabel: '1 trago — $10.000',
    area: 'drinks_t6',
    category: 'combo_trago',
    price: 10000,
    qty: 1,
    selectCount: 1,
  },
  {
    id: 'combo_2tragos',
    name: '2 tragos',
    btnLabel: '2 tragos — $15.000',
    area: 'drinks_t6',
    category: 'combo_trago',
    price: 15000,
    qty: 1,
    selectCount: 2,
  },
]

export const BURGER_ADDONS = [
  { id: 'extra_carne',           name: 'Carne c/ cheddar',     price: 3000 },
  { id: 'bacon',                 name: 'Bacon',                price: 1500 },
  { id: 'cebolla_caramelizada',  name: 'Cebolla caramelizada', price: 600 },
  { id: 'pepinos',               name: 'Pepinos',              price: 800 },
  { id: 'lechuga',               name: 'Lechuga',              price: 500 },
  { id: 'tomate',                name: 'Tomate',               price: 500 },
  { id: 'cebolla',               name: 'Cebolla',              price: 500 },
  { id: 'salsa_burger_ya',       name: 'Salsa Burger Ya',      price: 500 },
  { id: 'barbacoa',              name: 'Barbacoa',             price: 500 },
]
