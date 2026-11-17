import { renderToString } from 'remix/component/server'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { formatPrice, isRegion, loadLabels, textsOf } from '../lib/i18n.ts'
import { smallSrc } from '../lib/images.ts'
import { serveMedia } from '../lib/media.ts'
import { loadProducts, searchFilter } from '../lib/products.ts'
import { PRODUCT_SEARCH_FIELDS } from '../lib/schema.ts'
import { searchPages } from '../lib/site.ts'
import { routes } from '../routes.ts'
import { Suggestions } from '../ui/suggestions.tsx'
import { notFound } from './not-found.tsx'
import pageAction from './page/controller.tsx'
import searchAction from './search/controller.tsx'

/** A piece of a page, not a document: no doctype (`context.render` writes one). */
const htmlFragment = (html: string) => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

/** English language tags that get British English (the `uk` region) rather than US English. */
const UK_TAGS = /^en-(gb|ie|au|nz|za|in|sg)\b/

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },

    /** `/` → the visitor's region: `/de/` for German browsers, `/uk/` for British English and its neighbours, else `/us/`. */
    start(context) {
      let preferred = context.headers.get('Accept-Language')?.split(',')[0]?.trim().toLowerCase() ?? ''
      let region = preferred.startsWith('de') ? 'de' : UK_TAGS.test(preferred) ? 'uk' : 'us'
      return redirect(routes.page.href({ region, path: '' }))
    },

    media(context) {
      return serveMedia(context.params.md5, context.params.file, context.request)
    },

    search: searchAction,

    page: pageAction,

    /**
     * The typeahead's options as HTML for the query fields `lang` (a region), `q` and `list` (the ID of the box's list,
     * which the option IDs start with); none below 2 characters.
     */
    async suggest(context) {
      let { searchParams } = context.url
      let region = searchParams.get('lang')
      if (!isRegion(region)) return notFound(context, undefined)
      let q = (searchParams.get('q') ?? '').trim()
      let list = searchParams.get('list') ?? 'suggest'
      let productFilter = q.length >= 2 ? searchFilter(q, PRODUCT_SEARCH_FIELDS) : undefined
      if (!productFilter) return htmlFragment('')

      let [products, pages, labels] = await Promise.all([loadProducts(region, productFilter, '$score', 5), searchPages(region, q, 3), loadLabels(region)])
      return htmlFragment(await renderToString(
        <Suggestions
          list={list}
          q={q}
          products={products.map((p) => ({ name: p.name, url: p.url, image: p.image ? smallSrc(p.image) : null, price: formatPrice(p.price, region) }))}
          pages={pages.map((p) => ({ title: p.title, url: p.url }))}
          text={textsOf(labels, region)}
        />,
      ))
    },
  },
})
