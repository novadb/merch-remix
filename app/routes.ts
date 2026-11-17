import { get, route } from 'remix/routes'

/** Every URL the site answers. Filters, sorting, "Show more" and search are GET forms: their fields are the query string of the page. */
export const routes = route({
  assets: get('/assets/*path'),
  start: get('/'),
  /** A picture by content address: `original{ext}`, or `{width}{ext}.webp` scaled (`app/lib/media.ts`). A wildcard, as a variable ends at a dot. */
  media: get('/media/:md5/*file'),
  /** The typeahead's options as HTML, query fields `lang`, `q` and `list`. */
  suggest: get('/api/suggest'),
  search: get('/:region/search'),
  /** A page of the region, a product, or the 404 page (also for a first segment that is no region, e.g. `/en/`). */
  page: get('/:region(/*path)'),
})
