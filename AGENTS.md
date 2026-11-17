# AGENTS.md

Single source of truth for coding agents in this repository; `CLAUDE.md` only imports it. A line stays only if an agent would decide wrongly without it.

## Project

"Nova Merchandising": a demo website that shows NovaDB as CMS and PIM in one. Every page, product, price, picture and UI text is read live from NovaDB's Delivery API. Stack: Remix 3 (`remix` package: Fetch API router, its own component runtime with JSX, no React), server-rendered with client entries, TypeScript run by Node without a build step.

Agencies and developers read this code to learn how the stack works with NovaDB, then change it for their own project. Measure every change against that: easy to read (a short path from URL to HTML, no layer of our own, fewer lines); the NovaDB code in the open, one place per concern; everything else (shop, pictures, SEO, deployment) in the smallest form that is right in concept; modern, idiomatic Remix 3 and TypeScript; a complete site on the live API.

The site's HTML structure, CSS classes, label keys (`app/lib/i18n.ts`), routes and behaviour follow a contract shared with the same site in other stacks; a shared Playwright suite checks it. Change none of them on your own: say so in your answer instead.

Non-goals: reading NovaDB in the browser, writes to NovaDB, a database or shared cache, query strings, a cart of our own.

## Commands and gates

- Run: `npm run dev` (reads `.env`). It needs the Delivery login (`NOVA_DELIVERY_URL`, `NOVA_DELIVERY_USER`, `NOVA_DELIVERY_PASSWORD`) and fails loudly without it.
- `npm run typecheck` (`tsc`; Node itself never type-checks), `docker build .`
- The shared browser suite (Playwright, one project per demo; it lives outside this repository): in its folder `BASE_URL=http://localhost:3000 npx playwright test --project remix3` against a running site. CI leaves out the tests tagged `@shopify` (buy button, cart): run them locally.
- Local container (`localhost:4004`, podman): `uv run scripts/refresh-container.py` after every completed change; `--full` after a change to `package.json`, `package-lock.json`, `tsconfig.json` or `Dockerfile`.
- Done means: typecheck passes, `docker build` succeeds, and the suite is green against the real Delivery API, in production mode (the container). "Should work" is not a result; report each gate with its output.
- The suite asserts structure and data rules, not CMS copy. Its seed paths (e.g. `/uk/shop/t-shirts/we-build-value`) are CMS data: if one disappears, fix the test's path, not the app.

## NovaDB

Before touching `app/lib/` or `app/ui/content.tsx` read `NOVADB.md`: the model and the Delivery API's concepts (identifiers, `lang`, `props`, variants, references, Visual Document, files, search). The wire protocol (routes, filter and sort grammar, paging) is in the product documentation it links. `README.md` lists which file does what.

- Read-only, branch `merchDemo`.
- Only products and articles in the workflow state "released" (`WORKFLOW_RELEASED`) are on the site, never an unfinished one. A product is the card, URL and page; SKU, colour, stock and delivery time come from its articles.
- Every NovaDB name (branch, types, attributes, market variants) is an API identifier and stands only in `app/lib/schema.ts`. An unavoidable numeric ID goes there too, as a named constant.
- A missing `props` key means unset or untranslated: omit it. Never fall back to another language or to `displayName`.
- Never print `NOVA_DELIVERY_URL/USER/PASSWORD`. The token stays on the server: pictures go through the `/media` proxy.
- Other env: `DEMO_BRANCH` (default `merchDemo`; not `NOVA_BRANCH`, which shells export for other work), `SHOPIFY_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN`, `SITE_URL` (set it in production), `MEDIA_CACHE_DIR`.
- `app/lib/delivery.ts` caches responses for 60 s: after a NovaDB data change wait a minute or restart before judging output.
- A UI text is a `merchLabel` object in NovaDB: a new text is a new label there plus its key in `app/lib/i18n.ts`. The name of a product attribute is not a label: it is the name of the attribute's definition (`ATTRIBUTE_TEXT`). A missing text prints `⟦key⟧` and fails the suite.

## Rules

- Fix the cause, not the symptom: no swallowed exception, fallback value or retry that hides a defect. Missing env or data fails loudly (`env()` in `app/lib/delivery.ts`).
- Never weaken, skip or delete a test to get green.
- Change only what the task needs; list unrelated findings at the end of your answer (`file:line`).
- Ask before adding a dependency or touching `Dockerfile` or deploy configuration.
- Comments say why the code is this way (a constraint of NovaDB, the framework, browser or contract) or what a name stands for, true for a reader who never saw an earlier version. A declaration other files use gets a doc comment when name and type leave something open (a unit, what a missing value means); a file header or one comment for a group may cover several. Never what the code plainly does or how it changed: that goes in the pull request. No TODO, no commented-out code; test names likewise.

## Where the code does not say why

- Remix 3 is not React: a component is a setup function that returns a render function, state is a variable plus `handle.update()`, events are `mix={on(...)}`. Read `node_modules/remix/INDEX.md` (guides and package READMEs of the installed version) before using an API; never apply React or Remix 2 patterns from memory.
- Everything must work without JavaScript: check a changed page with JS off (the suite has such tests) and its HTML with `curl`.
- Only a `public/` folder below `app/` (plus `app/routes.ts` and `app/site.css`, see `app/assets.ts`) reaches the browser. The server sends HTML, never JSON: the range, the cards and the typeahead's options are server components; a client entry gets plain data and texts as props. NovaDB is read in `app/lib/` only, on the server.
- The site writes no query string and reads none (a foreign one is ignored): filters, sorting and search are POST forms answered with the page itself (`form()` routes; `formData()` gives a GET an empty form), so a filtered view has no URL of its own. That is intended.
- The range (`app/ui/public/range-behaviour.tsx`) posts its form itself, gets the whole page as without JavaScript, and reconciles it with `frames.top.replace()`; it never lets the runtime navigate. A navigation would put `#range` into the address, show the answer before its pictures load (the runtime's frame resolver is not exported), and race the self-clicking "Show more" against the navigation's lifecycle. The reconciler keeps live `checked`, `value`, `selected` where the answer differs: "Reset" clears them first. Cards carry `data-rmx-key`: a card that stays keeps its element.
- Links and forms are intercepted by the runtime (a navigation of the top frame, reconciled into the page). `PageBusy` marks `main` busy meanwhile; the suite waits for that mark. The region switch carries `data-rmx-document` (a document load): Shopify's cart takes the region's market when the page starts.
- `app/site.css`, `NOVADB.md` and everything in `public/` (`favicon.svg`, `robots.txt`, the fonts) are the same files in every port, kept identical from outside this repository: never adapt them to this stack. Only how they reach the browser is this demo's own (the asset server). `site.css` is also the CMS editor's stylesheet: keep its `@editor` markers, and between them nothing of the header, the range or the product page.
- Page content is made from a closed set of components: a class `merch*` in content that is not in `COMPONENT_CLASSES` (in the shared suite) fails the suite. Compose, or follow the structure with CSS, before asking for a new one.
- The shop is Shopify's own Buy Button and cart (`app/ui/public/shop.tsx`). What the shop can configure (prices per market, product titles, languages) is configured there, not in code. Without `SHOPIFY_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` there are no buy buttons and no cart, silently: keep both in `.env`.

## Git

- Branch from a fresh `origin/main` as `feature/<id>-<slug>` or `bugfix/<id>-<slug>` (`<id>` is the number of the work item, the slug lower-case words). `main` changes only by pull request, completed as **squash merge** with the source branch deleted; direct and force pushes to `main` are rejected.
- **Title and description of the PR are the one public commit message.** Write them with the skill `pr-text` (title up to 60 characters, description optional, up to three lines), check them with `scripts/check-pr-text.py`, get the user's approval, and set the merge commit message explicitly to that text.
- The PR needs a review, a linked work item, resolved comments and a green build (typecheck, `docker build`, the suite without `@shopify`). A red build can be CMS data (a seed path), not code.
- Everything on `main` is public and mirrored read-only to GitHub (never push there): no addresses, accounts, tracker numbers or secrets in files or commit messages. No tags, no version numbers.
- Pushing, merging and tagging need explicit approval.

## Deployment

The site is one container (`Dockerfile`, port 3000) with no state of its own: the media cache refills by itself. Where and how it is hosted is the operator's choice. It only needs its environment (see NovaDB) from the platform's secrets, with `SITE_URL` set to the public origin. Never push images, deploy or change DNS without explicit approval.
