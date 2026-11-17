import { form, get, post, route } from 'remix/routes'

/** Every URL the site answers. No route reads a query string: filters, sorting and search are POST forms. */
export const routes = route({
  assets: get('/assets/*path'),
  start: get('/'),
  /** A picture by content address: `original{ext}`, or `{width}{ext}.webp` scaled (`app/lib/media.ts`). A wildcard, as a variable ends at a dot. */
  media: get('/media/:md5/*file'),
  /** The typeahead's JSON, fields `lang` and `q`. */
  suggest: post('/api/suggest'),
  search: form('/:region/search'),
  /** A page of the region, a product, or the 404 page (also for a first segment that is no region, e.g. `/en/`). */
  page: form('/:region(/*path)'),
})
