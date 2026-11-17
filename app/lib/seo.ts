/** Canonical URL and language/region variants (`rel="canonical"`, `rel="alternate" hreflang`) for search engines. */
import { HTML_LANG, REGIONS, type Region } from './i18n.ts'

export type Seo = {
  canonical: string
  alternates: { hreflang: string; href: string }[]
  description?: string
  /** Value of `<meta name="robots">`, e.g. `noindex, nofollow`; none: the default. */
  robots?: string
}

/** What a product's SEO attributes ask of search engines. */
export type SeoHints = { description?: string; noIndex?: boolean; noFollow?: boolean }

/**
 * Public origin (`https://host`) for absolute URLs: `SITE_URL` if set, else the request's, which reflects what the
 * ingress forwards (`X-Forwarded-Proto/Host`, see `trustProxy` in `server.ts`). A client can forge those headers: set `SITE_URL` in production.
 */
function originOf(url: URL): string {
  return process.env.SITE_URL?.replace(/\/+$/, '') ?? url.origin
}

/**
 * `path` is the page's clean URL (no filters, sorting, tracking parameters). `variants` holds the same content in every
 * region that has it, the page itself included: every variant lists all of them, `x-default` is `/`, which picks a region.
 * A page that asks not to be indexed lists no variants: it is not part of the language set.
 */
export function seoOf(url: URL, path: string, variants: Partial<Record<Region, string>>, hints: SeoHints = {}): Seo {
  let origin = originOf(url)
  let alternates = hints.noIndex ? [] : REGIONS.flatMap((region) => (variants[region] ? [{ hreflang: HTML_LANG[region], href: origin + variants[region] }] : []))
  if (alternates.length) alternates.push({ hreflang: 'x-default', href: `${origin}/` })
  let robots = [hints.noIndex && 'noindex', hints.noFollow && 'nofollow'].filter(Boolean).join(', ')
  return { canonical: origin + path, alternates, description: hints.description, robots: robots || undefined }
}
