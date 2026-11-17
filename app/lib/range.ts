/** A live product range: the facets (counted over the whole result), the sorting and the batches it is shown in. */
import { RANGE_BATCH } from '../ui/public/range-behaviour.tsx'
import { colorsOf, inStockOf, type Product } from './products.ts'

export const SORTS = ['relevance', 'name', 'price-asc', 'price-desc'] as const
export type Sort = (typeof SORTS)[number]

/** `shown`: how many cards of the result are rendered (a multiple of `RANGE_BATCH`); facets and count cover them all. */
export type Selection = { group: number[]; color: string[]; material: string[]; stock: boolean; min?: number; max?: number; sort?: Sort; shown: number }
export type FacetValue = { value: string; count: number; selected: boolean }
export type Facets = { group: FacetValue[]; color: FacetValue[]; material: FacetValue[]; inStock: number; priceMin: number; priceMax: number }

/**
 * The filters and sorting in a query string (the range form's fields; any other name changes nothing). The form's
 * "reset" button, sent without JavaScript, clears them all. Only the "Show more" button sends `shown`, so any other
 * change starts again with the first batch.
 */
function parseSelection(query: URLSearchParams): Selection {
  let params = query.has('reset') ? new URLSearchParams() : query
  let num = (key: string) => {
    let value = Number(params.get(key))
    return params.get(key) && Number.isFinite(value) ? value : undefined
  }
  let sort = params.get('sort') as Sort
  return {
    group: params.getAll('group').map(Number).filter(Number.isInteger),
    color: params.getAll('color'),
    material: params.getAll('material'),
    stock: params.get('stock') === '1',
    min: num('min'),
    max: num('max'),
    sort: SORTS.includes(sort) ? sort : undefined,
    shown: Math.max(1, Math.ceil((num('shown') ?? 0) / RANGE_BATCH)) * RANGE_BATCH,
  }
}

/** The facets with a list of values; a new one needs its values here, or the lookup does not compile. */
type ListFacet = 'group' | 'color' | 'material'
type Facet = ListFacet | 'stock' | 'price'
const facetValues = (p: Product, facet: ListFacet): string[] =>
  ({ group: p.groupId ? [String(p.groupId)] : [], color: colorsOf(p), material: p.materials })[facet]

/** Whether a product passes every selected facet except `skip` (so a facet's own counts stay open). */
function passes(p: Product, s: Selection, skip?: Facet): boolean {
  let any = (facet: ListFacet, selected: string[]) =>
    skip === facet || !selected.length || facetValues(p, facet).some((v) => selected.includes(v))
  return (
    any('group', s.group.map(String)) && any('color', s.color) && any('material', s.material) &&
    (skip === 'stock' || !s.stock || inStockOf(p) === true) &&
    (skip === 'price' || ((s.min === undefined || (p.price ?? 0) >= s.min) && (s.max === undefined || (p.price ?? Infinity) <= s.max)))
  )
}

/**
 * A facet's values. The list is stable: every value of the unfiltered range, most products first, whatever is selected,
 * so a filter change moves no row. `count` is what the other facets leave of it and may be 0.
 */
function count(products: Product[], s: Selection, facet: ListFacet, selected: string[]): FacetValue[] {
  let totals = new Map<string, number>()
  let counts = new Map<string, number>()
  for (let p of products) {
    for (let v of facetValues(p, facet)) {
      totals.set(v, (totals.get(v) ?? 0) + 1)
      if (passes(p, s, facet)) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  for (let v of selected) if (!totals.has(v)) totals.set(v, 0)
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => ({ value, count: counts.get(value) ?? 0, selected: selected.includes(value) }))
}

/** Applies the selection and counts each facet over the products the other facets let through. */
function applySelection(products: Product[], s: Selection, defaultSort: Sort): { items: Product[]; facets: Facets } {
  let prices = products.map((p) => p.price).filter((v): v is number => v !== undefined)
  let facets: Facets = {
    group: count(products, s, 'group', s.group.map(String)),
    color: count(products, s, 'color', s.color),
    material: count(products, s, 'material', s.material),
    inStock: products.filter((p) => inStockOf(p) && passes(p, s, 'stock')).length,
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  }
  let items = products.filter((p) => passes(p, s))
  let sort = s.sort ?? defaultSort
  let byPrice = (a: Product, b: Product) => (a.price ?? Infinity) - (b.price ?? Infinity)
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'price-asc') items.sort(byPrice)
  if (sort === 'price-desc') items.sort((a, b) => byPrice(b, a))
  return { items, facets } // "relevance" keeps the order the products came in
}

/** A range as a page shows it: the cards rendered (one batch or more), the total and the facets of the whole result. */
export type RangeData = { items: Product[]; total: number; facets: Facets; selection: Selection; defaultSort: Sort }

/** The range of `products` for the query's fields (none: the page as opened): filtered, sorted, counted, cut to the cards shown. */
export function rangeOf(products: Product[], query: URLSearchParams, defaultSort: Sort): RangeData {
  let selection = parseSelection(query)
  let { items, facets } = applySelection(products, selection, defaultSort)
  return { items: items.slice(0, selection.shown), total: items.length, facets, selection, defaultSort }
}
