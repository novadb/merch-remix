/**
 * Document shell, header and footer of every page. Rendered on the server; in the browser links and forms navigate
 * without a page load (the runtime that `public/entry.ts` starts), and the range, the typeahead and the shop are client
 * entries. Everything works without JavaScript.
 */
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { scriptEntry, styleHref } from '../assets.ts'
import { HTML_LANG, loadLabels, REGION_LABEL, REGIONS, textsOf, type Region, type Texts } from '../lib/i18n.ts'
import type { Seo } from '../lib/seo.ts'
import { loadSite } from '../lib/site.ts'
import { routes } from '../routes.ts'
import { PageBusy } from '../ui/public/page-busy.tsx'
import { SearchBox } from '../ui/public/search-box.tsx'
import { ShopifyCart, type Shop } from '../ui/public/shop.tsx'

/** This demo's repository on GitHub (`github.com/novadb/<REPO>`), linked from the footer of every page. */
const REPO = 'merch-remix3'

/** What every page of a region shows around its content: texts, the home page and two levels of navigation, the shop. */
export type Shell = {
  region: Region
  text: Texts
  home: { url: string; title: string }
  nav: { url: string; title: string; children: { url: string; title: string }[] }[]
  /** Undefined without the shop's domain and token: then there are no buy buttons and no cart. */
  shop?: Shop
}

export async function loadShell(region: Region): Promise<Shell> {
  let [site, labels] = await Promise.all([loadSite(region), loadLabels(region)])
  let text = textsOf(labels, region)
  let { SHOPIFY_DOMAIN: domain, SHOPIFY_STOREFRONT_TOKEN: token } = process.env
  let { addToCart, cart, subtotal, checkout, cartEmpty, cartNotice } = text
  return {
    region,
    text,
    home: { url: site.home.url, title: site.home.title },
    nav: site.home.children.map((p) => ({ url: p.url, title: p.navTitle, children: p.children.map((c) => ({ url: c.url, title: c.navTitle })) })),
    shop: domain && token ? { domain, token, region, text: { addToCart, cart, subtotal, checkout, cartEmpty, cartNotice } } : undefined,
  }
}

/** The search box's props in a region: its URLs and texts. */
export function searchBoxOf({ region, text }: Shell) {
  return {
    region,
    action: routes.search.action.href({ region }),
    suggest: routes.suggest.href(),
    text: { search: text.search, searchPlaceholder: text.searchPlaceholder },
  }
}

type Props = {
  shell: Shell
  /** The page's own title; the site's name follows it. */
  title: string
  /** Canonical and hreflang links; none for a page search engines should not index. */
  seo?: Seo
  /** The same content in every region (region → URL): the header's region switch points there, else to the region's home page. */
  alternates?: Partial<Record<Region, string>>
  children?: RemixNode
}

export function Document(handle: Handle<Props>) {
  return () => {
    let { shell, title, seo, alternates, children } = handle.props
    let { region, text, home, nav, shop } = shell
    let { href, importMap, preloads } = scriptEntry
    return (
      <html lang={HTML_LANG[region]}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${title} · ${text.siteName}`}</title>
          {seo && <link rel="canonical" href={seo.canonical} />}
          {seo?.description && <meta name="description" content={seo.description} />}
          {seo?.robots && <meta name="robots" content={seo.robots} />}
          {seo?.alternates.map((a) => <link key={a.hreflang} rel="alternate" hreflang={a.hreflang} href={a.href} />)}
          <link rel="stylesheet" href={styleHref} />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <ImportMap value={importMap} />
          {preloads.map((preload) => <link key={preload} rel="modulepreload" href={preload} />)}
          <script type="module" src={href}></script>
        </head>
        {/* `data-shop`: a shop is configured; without it site.css hides the place of the buy button. */}
        <body data-shop={shop ? '' : undefined}>
          <a class="skip" href="#main">{text.skip}</a>
          <header class="site-header">
            <div class="site-header__inner">
              <a class="logo" href={home.url}>{home.title}</a>
              <nav class="site-nav" aria-label={text.mainNav}>
                <ul>
                  {nav.map((item) => (
                    <li key={item.url}>
                      <a href={item.url}>{item.title}</a>
                      {item.children.length > 0 && (
                        <ul class="site-nav__sub">
                          {item.children.map((c) => <li key={c.url}><a href={c.url}>{c.title}</a></li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <SearchBox {...searchBoxOf(shell)} />
              <div class="site-header__tools">
                <nav class="regions" aria-label={text.region}>
                  {REGIONS.map((r) => {
                    let { short, title } = REGION_LABEL[r]
                    return r === region
                      ? <span key={r} class="regions__item" aria-current="true" title={title}>{short}</span>
                      // A document load (`data-rmx-document`): Shopify's cart takes the region's market when the page starts.
                      : <a key={r} class="regions__item" href={alternates?.[r] ?? `/${r}/`} hreflang={HTML_LANG[r]} title={title} data-rmx-document>{short}</a>
                  })}
                </nav>
              </div>
            </div>
          </header>
          <main id="main">{children}</main>
          <footer class="site-footer">
            <p innerHTML={text.poweredBy} />
            <a class="site-footer__repo" href={`https://github.com/novadb/${REPO}`}>{REPO}</a>
          </footer>
          {/* The NovaDB logo in the corner: decoration only, the footer's line names NovaDB in words. */}
          <aside class="source" aria-hidden="true" />
          <PageBusy />
          {shop && <ShopifyCart shop={shop} />}
        </body>
      </html>
    )
  }
}
