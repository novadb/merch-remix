# Nova Merchandising — Remix 3

The demo site "Nova Merchandising" built with Remix 3: the Fetch API router (`remix/router`), Remix's own component
runtime (`remix/component`, JSX that is not React), server-rendered, with client entries where the page is interactive.
Every page, product, price and picture is read live from NovaDB's Delivery API (branch `merchDemo`).

The same shop in other stacks: React Router ([live](https://react-router.merch.novadb.com/),
[source](https://github.com/novadb/merch-react-router)) · ASP.NET Core Blazor ([live](https://blazor-dotnet.merch.novadb.com/),
[source](https://github.com/novadb/merch-blazor-dotnet)) · Razor Pages + htmx ([live](https://razor-htmx.merch.novadb.com/),
[source](https://github.com/novadb/merch-razor-htmx)) · Nuxt ([live](https://vue-nuxt.merch.novadb.com/),
[source](https://github.com/novadb/merch-vue-nuxt)) · Astro ([live](https://astro.merch.novadb.com/),
[source](https://github.com/novadb/merch-astro))

A request enters `server.ts`, runs through the middleware in `app/router.ts`, matches a route in `app/routes.ts` and is
answered by an action in `app/actions/`: a Web `Response`, mostly HTML rendered from components with `context.render()`.
Everything works without JavaScript. In the browser the runtime (`app/actions/public/entry.ts`) lets links and forms
navigate without a page load; the range's filters apply in place (the range posts its form in the background and
reconciles the page that answers into the current one: no page load, the URL stays), "Show more" loads while scrolling, the search box suggests while typing (`POST /api/suggest`, as HTML),
and Shopify's own buy button and cart appear in the site's colours. Data only ever comes from the server.

There is no build step: Node runs the TypeScript sources (`remix/node-tsx`), and the asset server (`app/assets.ts`)
compiles each browser module when it is requested, in production minified and under a name with its content hash.

## Run

```bash
npm install
npm run dev          # http://localhost:3000, restarts on every change
```

Before the first start copy `.env.example` to `.env` and set `NOVA_DELIVERY_URL`, `NOVA_DELIVERY_USER` and
`NOVA_DELIVERY_PASSWORD` to the Delivery API login of your NovaDB instance. `npm run dev` reads `.env`; `npm run start`
and the container take the same variables from their environment. Optional variables (see `.env.example`):
`DEMO_BRANCH` (default `merchDemo`), `SHOPIFY_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` (public Buy Button token; without
them there is no cart), `SITE_URL` (public origin for the absolute canonical and hreflang URLs; default: the request's,
which follows the proxy's `X-Forwarded-*` headers, which a client can forge, so set it in production), `PORT`,
`MEDIA_CACHE_DIR`.

Production: `NODE_ENV=production npm run start` (port 3000), or the `Dockerfile`. `NODE_ENV=production` turns on
minified, fingerprinted browser modules.

## Check

`npm run typecheck` (`tsc`). The site's behaviour is checked by a Playwright suite shared by all the demos, run against
the running site.

## Where things are

| Path | What |
|---|---|
| `NOVADB.md` | how the site reads NovaDB: the model, the Delivery API's concepts, what the site decided |
| `server.ts` | the Node server: hands every request to the router; trusts the proxy's `X-Forwarded-*` headers |
| `app/routes.ts` | every URL the site answers, with typed `href()`s for links and forms |
| `app/router.ts`, `app/middleware/one-url.ts` | middleware (log, compression, static files, one URL per page, form data, rendering) and which controller owns which routes |
| `app/actions/controller.tsx` | `/` → region by `Accept-Language`, the picture proxy, the typeahead's JSON, the browser modules |
| `app/actions/page/` | `/{region}/…`: a page (content + live range) or a product |
| `app/actions/search/` | `/{region}/search` |
| `app/actions/document.tsx`, `not-found.tsx` | the document shell with header and footer; the 404 page |
| `app/lib/schema.ts` | every NovaDB name (branch, types, attributes, market variants) as API identifiers: the one place to change |
| `app/lib/delivery.ts` | Delivery API client: Basic auth from the environment, 60 s cache |
| `app/lib/i18n.ts` | regions (`de`, `uk`, `us`: content language, market, currency) and the UI texts read from NovaDB's labels |
| `app/lib/site.ts` | page tree, URLs from `merchPageUrlSegment` + parent page, category page of a group |
| `app/lib/products.ts`, `range.ts` | released products with their articles, full-text filter; facets (counted on the server) and sorting |
| `app/lib/images.ts`, `media.ts` | picture URLs and their scaled variants (`srcset`); the picture proxy (`/media/{md5}/original{ext}`, `/media/{md5}/{width}{ext}.webp`) with disk cache and scaled WebP variants (`sharp`) |
| `app/lib/seo.ts` | canonical and hreflang URLs |
| `app/ui/content.tsx` | Visual Document renderer, page teaser, breadcrumb |
| `app/ui/product-card.tsx`, `range.tsx`, `suggestions.tsx` | product card, live range (facets, sorting, grid), the typeahead's options |
| `app/ui/public/` | what runs in the browser too: the range's background posts, search box, shop, the busy mark of a loading page |
| `app/site.css` | the stylesheet, the same file in every demo |

## Deviations

- The redirect of a URL to its one form (`/en/` → `/en`) has no body.
- `POST /api/suggest` answers HTML (the typeahead's options, their IDs starting with the extra field `list`), never
  JSON: the server renders what the search box shows.
