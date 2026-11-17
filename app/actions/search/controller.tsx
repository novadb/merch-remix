/** `/{region}/search`: full-text search over products (with facets) and pages; the query is the parameter `q`. */
import { createAction } from 'remix/router'

import { isRegion, REGIONS, type Region } from '../../lib/i18n.ts'
import { loadProducts, searchFilter } from '../../lib/products.ts'
import { rangeOf } from '../../lib/range.ts'
import { PRODUCT_SEARCH_FIELDS } from '../../lib/schema.ts'
import { loadGroups, searchPages } from '../../lib/site.ts'
import { routes } from '../../routes.ts'
import { loadShell } from '../document.tsx'
import { notFound } from '../not-found.tsx'
import { SearchPage } from './page.tsx'

/** A search form, or the range form of the results (which carries `q` along), sends its fields here. Without a query the page lists every product. */
export default createAction(routes.search, async (context) => {
  let { region } = context.params
  if (!isRegion(region)) return notFound(context, region)
  let { searchParams } = context.url
  let q = (searchParams.get('q') ?? '').trim()
  let productFilter = searchFilter(q, PRODUCT_SEARCH_FIELDS)
  let [shell, products, pages, groups] = await Promise.all([
    loadShell(region),
    loadProducts(region, productFilter, productFilter ? '$score' : undefined),
    searchPages(region, q, 5),
    loadGroups(region),
  ])
  let range = rangeOf(products, searchParams, productFilter ? 'relevance' : 'name')
  let alternates = Object.fromEntries(REGIONS.map((r) => [r, routes.search.href({ region: r })])) as Record<Region, string>
  return context.render(
    <SearchPage shell={shell} q={q} pages={pages.map((p) => ({ url: p.url, title: p.title }))} range={range} groups={groups} alternates={alternates} />,
  )
})
