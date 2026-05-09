export function sortCartItems(items) {
  return [...items].sort((a, b) => {
    const catDiff = (a.categoryOrder ?? 99) - (b.categoryOrder ?? 99)
    if (catDiff !== 0) return catDiff
    const prodDiff = (a.productOrder ?? 99) - (b.productOrder ?? 99)
    if (prodDiff !== 0) return prodDiff
    if (a.meatCount != null && b.meatCount != null) {
      if (a.meatCount !== b.meatCount) return a.meatCount - b.meatCount
      // mismo producto y misma cantidad de carnes: sin cheddar primero, con cheddar después
      return (b.noCheddar ? 1 : 0) - (a.noCheddar ? 1 : 0)
    }
    return (a.name || '').localeCompare(b.name || '')
  })
}
