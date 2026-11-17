/** `/{region}/search`: full-text search over products (with facets) and pages; the query is the posted field `q`. */
import { createController } from 'remix/router'

import { isRegion, REGIONS, type Region } from '../../lib/i18n.ts'
import { loadProducts, searchFilter } from '../../lib/products.ts'
import { rangeOf } from '../../lib/range.ts'
import { PRODUCT_SEARCH_FIELDS } from '../../lib/schema.ts'
import { loadGroups, searchPages } from '../../lib/site.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { loadShell } from '../document.tsx'
import { notFound } from '../not-found.tsx'
import { SearchPage } from './page.tsx'

/**
 * A search form, or the range form of the results (which carries `q` along), posts here. Opened with GET (an empty
 * form), the page lists every product.
 */
export default createController(routes.search, {
  actions: {
    index: (context) => respond(context, context.params.region),
    action: (context) => respond(context, context.params.region),
  },
})

async function respond(context: AppContext, region: string) {
  if (!isRegion(region)) return notFound(context, region)
  let q = String(context.formData.get('q') ?? '').trim()
  let productFilter = searchFilter(q, PRODUCT_SEARCH_FIELDS)
  let [shell, products, pages, groups] = await Promise.all([
    loadShell(region),
    loadProducts(region, productFilter, productFilter ? '$score' : undefined),
    searchPages(region, q, 5),
    loadGroups(region),
  ])
  let range = rangeOf(products, context.formData, productFilter ? 'relevance' : 'name')
  let alternates = Object.fromEntries(REGIONS.map((r) => [r, routes.search.index.href({ region: r })])) as Record<Region, string>
  return context.render(
    <SearchPage shell={shell} q={q} pages={pages.map((p) => ({ url: p.url, title: p.title }))} range={range} groups={groups} alternates={alternates} />,
  )
}
