export const STAFF_SHIFT_CREDIT = 2500

export const STAFF_PRICES = {
  burger_base:   2500,
  extra_carne:   2000,
  bacon:         1000,
  lautiboom:     1000,
  bbqueen:       1500,
  smoklahoma:    1500,
  cuarto_libra:   500,
  american:      1000,
  papas:         1000,
  coca_600:      1250,
  coca_225:      4000,
  dip_salsa:      500,
}

export const STAFF_ADDON_IDS = ['bacon', 'lautiboom', 'bbqueen', 'smoklahoma', 'cuarto_libra']

export const STAFF_ADDON_LABELS = {
  bacon:        'Bacon',
  lautiboom:    'Cebolla caramelizada',
  bbqueen:      'BBQueen',
  smoklahoma:   'Smoklahoma',
  cuarto_libra: 'Cuarto de libra',
}

export const STAFF_VEGETABLE_IDS = ['lechuga', 'tomate', 'cebolla', 'pepinos']

export const STAFF_VEGETABLE_LABELS = {
  lechuga: 'Lechuga',
  tomate:  'Tomate',
  cebolla: 'Cebolla',
  pepinos: 'Pepinos',
}

export const STAFF_EXTRA_IDS = ['papas', 'coca_600', 'coca_225', 'dip_salsa']

export const STAFF_EXTRA_LABELS = {
  papas:     'Papas',
  coca_600:  'Coca 600ml',
  coca_225:  'Coca 2.25L',
  dip_salsa: 'Dip salsa',
}

export const STAFF_COST_ITEMS = [
  { id: 'burger_base',  name: 'Burger Staff',        price: STAFF_PRICES.burger_base },
  { id: 'extra_carne',  name: 'Carne extra',          price: STAFF_PRICES.extra_carne },
  { id: 'bacon',        name: 'Bacon',                price: STAFF_PRICES.bacon },
  { id: 'lautiboom',    name: 'Cebolla caramelizada', price: STAFF_PRICES.lautiboom },
  { id: 'bbqueen',      name: 'BBQueen',              price: STAFF_PRICES.bbqueen },
  { id: 'smoklahoma',   name: 'Smoklahoma',           price: STAFF_PRICES.smoklahoma },
  { id: 'cuarto_libra', name: 'Cuarto de libra',      price: STAFF_PRICES.cuarto_libra },
  { id: 'american',     name: 'Verduras',             price: STAFF_PRICES.american },
  { id: 'papas',        name: 'Papas',                price: STAFF_PRICES.papas },
  { id: 'coca_600',     name: 'Coca 600ml',           price: STAFF_PRICES.coca_600 },
  { id: 'coca_225',     name: 'Coca 2.25L',           price: STAFF_PRICES.coca_225 },
  { id: 'dip_salsa',    name: 'Dip salsa',            price: STAFF_PRICES.dip_salsa },
]
