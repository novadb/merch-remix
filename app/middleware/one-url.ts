import type { Middleware } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { REGIONS } from '../lib/i18n.ts'

const HOME = new RegExp(`^/(${REGIONS.join('|')})/?$`)

/** One URL per page: `/de` → `/de/` (a region's home page) and `/de/shop/` → `/de/shop`, permanently, query string kept. */
export function oneUrl(): Middleware {
  return (context, next) => {
    let { pathname, search } = context.url
    let home = HOME.exec(pathname)
    let wanted = home ? `/${home[1]}/` : pathname.replace(/(?<=.)\/+$/, '')
    if ((context.method === 'GET' || context.method === 'HEAD') && wanted !== pathname) return redirect(wanted + search, 301)
    return next()
  }
}
