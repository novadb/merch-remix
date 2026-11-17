/** `/{region}/{path}`: a CMS page (with its live product range) or a product from the PIM. */
import { createAction } from 'remix/router'

import { alternatesOf, isRegion, OTHER_LANGUAGE_REGION, type Region } from '../../lib/i18n.ts'
import { picturesByIds, type Picture } from '../../lib/images.ts'
import { loadProducts, productByPath, productsByIds, setContents, type Product } from '../../lib/products.ts'
import { rangeOf } from '../../lib/range.ts'
import { PRODUCT } from '../../lib/schema.ts'
import { seoOf } from '../../lib/seo.ts'
import { breadcrumb, categoryPage, loadGroups, loadSite, type Page, type Site } from '../../lib/site.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { imageIds, referencedIds, type Ctx, type Target } from '../../ui/content.tsx'
import { cardOf } from '../../ui/product-card.tsx'
import { loadShell, type Shell } from '../document.tsx'
import { notFound } from '../not-found.tsx'
import { CmsPage } from './page.tsx'
import { ProductPage } from './product.tsx'

/** The page as opened, or with the range for the query's fields: the range form (facets, sorting, "Show more") is a GET form to the page itself. */
export default createAction(routes.page, async (context) => {
  let { region, path = '' } = context.params
  if (!isRegion(region)) return notFound(context, region)
  let [shell, site, groups] = await Promise.all([loadShell(region), loadSite(region), loadGroups(region)])
  let page = site.byPath.get(path)
  if (!page) return productResponse(context, shell, site, groups, path)

  let [range, data] = await Promise.all([pageRange(page, region, context.url.searchParams), pageData(shell, site, page)])
  return context.render(<CmsPage {...data} seo={seoOf(context.url, page.url, data.alternates)} range={range} groups={groups} />)
})

/** The live range of a category page: the products of its groups, for the filters in the query; null for a page without one. */
async function pageRange(page: Page, region: Region, query: URLSearchParams) {
  if (!page.groupRefs.length) return null
  let products = await loadProducts(region, `${PRODUCT.group} = ${page.groupRefs.join(', ')}`)
  return products.length ? rangeOf(products, query, 'name') : null
}

/** A page in the breadcrumb, named as in the navigation. */
const toCrumb = (p: { url: string; navTitle: string }) => ({ url: p.url, title: p.navTitle })

async function pageData(shell: Shell, site: Site, page: Page) {
  // An ID the content refers to is a page of the site, else a product.
  let refs = [...referencedIds(page.content)]
  let linked = refs.flatMap((ref) => site.pages.get(ref) ?? [])
  let wantedImages = imageIds(page.content) // plus the teaser picture of every page referred to
  for (let p of linked) if (p.imageId) wantedImages.add(p.imageId)
  // The other language's page tree is for the hreflang links and the region switch of a page.
  let [embedded, pictures, otherSite] = await Promise.all([
    productsByIds(refs.filter((ref) => !site.pages.has(ref)), shell.region),
    picturesByIds([...wantedImages]),
    loadSite(OTHER_LANGUAGE_REGION[shell.region]),
  ])

  let targets: Record<number, Target> = {}
  for (let p of linked) targets[p.id] = { url: p.url, title: p.title, image: p.imageId ? pictures.get(p.imageId) : undefined }
  for (let p of embedded) targets[p.id] = { url: p.url, title: p.name, image: p.image }
  let images: Record<number, Picture> = {}
  for (let id of imageIds(page.content)) {
    let picture = pictures.get(id)
    if (picture) images[id] = picture
  }
  let ctx: Ctx = { cards: Object.fromEntries(embedded.map((p) => [p.id, cardOf(p, shell.text, shell.region)])), targets, images }
  let alternates = alternatesOf(shell.region, page.path, otherSite.pages.get(page.id)?.path)
  return { shell, page, ctx, crumbs: breadcrumb(site, page).map(toCrumb), alternates }
}

async function productResponse(context: AppContext, shell: Shell, site: Site, groups: Map<number, string>, path: string) {
  let { region, text } = shell
  let product = path ? await productByPath(region, path) : undefined
  if (!product) return notFound(context, region)
  let [similar, accessories, spareParts, contents, [other]] = await Promise.all([
    productsByIds(product.similar, region),
    productsByIds(product.accessories, region),
    productsByIds(product.spareParts, region),
    setContents(product, region),
    productsByIds([product.id], OTHER_LANGUAGE_REGION[region]),
  ])
  let cards = (products: Product[]) => products.map((p) => cardOf(p, text, region))
  let category = product.groupId ? categoryPage(site, product.groupId) : undefined
  let variants = alternatesOf(region, product.path, other?.path)
  return context.render(
    <ProductPage
      shell={shell}
      product={product}
      groupName={product.groupId ? groups.get(product.groupId) : undefined}
      contents={contents}
      bands={[[text.similar, cards(similar)], [text.accessories, cards(accessories)], [text.spareParts, cards(spareParts)]]}
      crumbs={[...breadcrumb(site, category).map(toCrumb), { url: product.url, title: product.name }]}
      seo={seoOf(context.url, product.url, variants, product.seo)}
      alternates={variants}
    />,
  )
}
