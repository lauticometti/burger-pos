// ── Smash Burger ──────────────────────────────────────────────────────────────
export const SMASH_BASE_PRICE = 6000
export const SMASH_EXTRA_MEAT_PRICE = 3000

export const SMASH_SIZES = [
  { size: 'simple',    meatCount: 1, label: 'Simple',    productOrder: 1 },
  { size: 'doble',     meatCount: 2, label: 'Doble',     productOrder: 2 },
  { size: 'triple',    meatCount: 3, label: 'Triple',    productOrder: 3 },
  { size: 'cuadruple', meatCount: 4, label: 'Cuádruple', productOrder: 4 },
  { size: 'quintuple', meatCount: 5, label: 'Quíntuple', productOrder: 5 },
  { size: 'sextuple',  meatCount: 6, label: 'Séxtuple',  productOrder: 6 },
]

// ── Burgers menú completo ─────────────────────────────────────────────────────
export const MENU_BURGERS = [
  { id: 'cheese',     name: 'Cheese',     productOrder: 2, prices: { simple: 10500, doble: 14000, triple: 17500 } },
  { id: 'bacon',      name: 'Bacon',      productOrder: 3, prices: { simple: 11500, doble: 15000, triple: 18500 } },
  { id: 'american',   name: 'American',   productOrder: 4, prices: { simple: 11500, doble: 15000, triple: 18500 } },
  { id: 'lautiboom',  name: 'Lautiboom',  productOrder: 5, prices: { simple: 11500, doble: 15000, triple: 18500 }, unavailable: true },
  { id: 'bbqueen',    name: 'BBQueen',    productOrder: 6, prices: { simple: 12000, doble: 15500, triple: 19000 }, unavailable: true },
  { id: 'smoklahoma', name: 'Smoklahoma', productOrder: 7, prices: { simple: 12000, doble: 15500, triple: 19000 } },
]

export const MENU_BURGER_SIZES = [
  { size: 'simple', meatCount: 1, label: 'Simple' },
  { size: 'doble',  meatCount: 2, label: 'Doble'  },
  { size: 'triple', meatCount: 3, label: 'Triple' },
]

// ── Burger del día ────────────────────────────────────────────────────────────
// getDay(): 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
const BURGER_DEL_DIA_MAP = {
  0: 'lautiboom',  // domingo
  1: null,         // lunes
  2: null,         // martes
  3: 'american',   // miércoles
  4: 'smoklahoma', // jueves
  5: 'bbqueen',    // viernes
  6: 'bacon',      // sábado
}

export const BURGER_DEL_DIA_DESCUENTO = 1500

export function getBurgerDelDiaId() {
  return BURGER_DEL_DIA_MAP[new Date().getDay()] ?? null
}

// ── Extras ────────────────────────────────────────────────────────────────────
export const EXTRAS = [
  { id: 'papas_chicas',      name: 'Papas extra chicas',  btnLabel: 'Papas S',  price: 3000, category: 'papas',   categoryOrder: 2, productOrder: 1 },
  { id: 'papas_grandes',     name: 'Papas extra grandes', btnLabel: 'Papas L',  price: 9000, category: 'papas',   categoryOrder: 2, productOrder: 2 },
  { id: 'dip_salsa_secreta', name: 'Dip Salsa Secreta',   btnLabel: 'Dip',      price: 1000, category: 'dips',    categoryOrder: 4, productOrder: 1 },
  { id: 'coca_600',          name: 'Coca 600ml',          btnLabel: 'Coca 600', price: 3000, category: 'bebidas', categoryOrder: 3, productOrder: 1 },
  { id: 'coca_225',          name: 'Coca 2.25L',          btnLabel: 'Coca 2.25',price: 6000, category: 'bebidas', categoryOrder: 3, productOrder: 2 },
]

// ── Labels de tamaño ─────────────────────────────────────────────────────────
export const SIZE_LABELS = {
  simple:    'Simple',
  doble:     'Doble',
  triple:    'Triple',
  cuadruple: 'Cuádruple',
  quintuple: 'Quíntuple',
  sextuple:  'Séxtuple',
}
