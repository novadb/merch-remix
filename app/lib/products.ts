/** Products from the PIM: read from the Delivery API with their released articles, pictures and claims, and the full-text search over them. */
import { list, type NovaObject } from './delivery.ts'
import { CULTURE, MARKET, type Region } from './i18n.ts'
import { toPictures, type Picture } from './images.ts'
import { ARTICLE, CLAIM, MARKET_VARIANT, PRODUCT, SET_ITEM, TYPE, WORKFLOW_RELEASED } from './schema.ts'

/** The sellable variant of a product: SKU, colour, stock and delivery time. */
export type Article = {
  id: number
  productId: number
  name: string
  sku: string
  /** A PIM object (`merchColor`) held by ID as a string: the value of its facet checkbox. Its name and swatch come with the labels (`text.value(id)`). */
  color?: string
  /** Pieces in stock; 0 is sold out. */
  stock: number
  deliveryDays?: number
}

export type Product = {
  id: number
  name: string
  url: string
  /** The URL without the region, e.g. `shop/t-shirts/we-build-value`. */
  path: string
  /** The released articles; a product that has none is shown as available, but no filter counts it. */
  articles: Article[]
  /** Materials and finishes are PIM objects (`merchMaterial`, `merchFinish`), held by ID as a string like an article's colour. */
  materials: string[]
  /** Cup volume in ml. */
  volume?: number
  /** Sticker finishes, pieces per set, laptop sleeve screen size in inches. */
  finishes: string[]
  pieces?: number
  screenSize?: number
  /** In the currency of the region's market. */
  price?: number
  image?: Picture
  groupId?: number
  descriptionHtml?: string
  /** Object IDs of products: similar ones, accessories and spare parts, as an editor ordered them. */
  similar: number[]
  accessories: number[]
  spareParts: number[]
  /** The texts of the claims the product makes. */
  claims: string[]
  /** The rows of a set product: an article (by object ID) and how many of it. */
  setItems: { articleId: number; quantity: number }[]
  seo: { title?: string; description?: string; noIndex: boolean; noFollow: boolean }
  shopifyId?: string
}

/** The colours of a product's articles, without repeats. */
export const colorsOf = (p: Product): string[] => [...new Set(p.articles.flatMap((a) => a.color ?? []))]

/** `false` is sold out (no article in stock); `undefined`: no article, shown as available, but not counted by the in-stock filter. */
export const inStockOf = (p: Product): boolean | undefined => (p.articles.length ? p.articles.some((a) => a.stock > 0) : undefined)

/** Removes the XHTML namespace the CMS stores with rich text. */
export const cleanHtml = (html: string) => html.replace(/\sxmlns="[^"]*"/g, '')

/** Only what the workflow has released is on the site: `filter` narrows the released objects further. */
const releasedWith = (workflow: string, filter?: string) => [`${workflow} = ${WORKFLOW_RELEASED}`, filter].filter(Boolean).join(' && ')

const toArticle = (o: NovaObject): Article => ({
  id: o.meta.id,
  productId: o.props[ARTICLE.product],
  name: o.props[ARTICLE.name],
  sku: o.props[ARTICLE.number],
  color: o.props[ARTICLE.color] ? String(o.props[ARTICLE.color]) : undefined,
  stock: o.props[ARTICLE.stock] ?? 0,
  deliveryDays: o.props[ARTICLE.deliveryDays],
})

/** All released articles. */
async function loadArticles(region: Region): Promise<Article[]> {
  let { objs } = await list(TYPE.article, { lang: CULTURE[region], filter: releasedWith(ARTICLE.workflow) })
  return objs.map(toArticle)
}

/** `refs`: the objects the product read resolved (pictures, claims, set rows), by object ID. */
function toProduct(o: NovaObject, region: Region, articles: Article[], refs: Map<number, NovaObject>, pictures: Map<number, Picture>): Product {
  let p = o.props
  return {
    id: o.meta.id,
    name: p[PRODUCT.name],
    path: p[PRODUCT.urlSegment],
    url: `/${region}/${p[PRODUCT.urlSegment]}`,
    articles,
    materials: (p[PRODUCT.materials] ?? []).map(String),
    volume: p[PRODUCT.volume],
    finishes: (p[PRODUCT.finishes] ?? []).map(String),
    pieces: p[PRODUCT.pieces],
    screenSize: p[PRODUCT.screenSize],
    price: p[PRODUCT.price],
    image: pictures.get(p[PRODUCT.images]?.[0]),
    groupId: p[PRODUCT.group],
    descriptionHtml: p[PRODUCT.description]?.XML ? cleanHtml(p[PRODUCT.description].XML) : undefined,
    similar: p[PRODUCT.related] ?? [],
    accessories: p[PRODUCT.accessories] ?? [],
    spareParts: p[PRODUCT.spareParts] ?? [],
    claims: (p[PRODUCT.claims] ?? []).map((id: number) => refs.get(id)?.props[CLAIM.text]).filter(Boolean),
    setItems: (p[PRODUCT.setItems] ?? []).flatMap((id: number) => {
      let row = refs.get(id)?.props
      return row ? [{ articleId: row[SET_ITEM.article], quantity: row[SET_ITEM.quantity] }] : []
    }),
    seo: {
      title: p[PRODUCT.seoTitle],
      description: p[PRODUCT.seoDescription],
      noIndex: p[PRODUCT.seoNoIndex] === true,
      noFollow: p[PRODUCT.seoNoFollow] === true,
    },
    shopifyId: p[PRODUCT.shopifyId],
  }
}

/** Every released product matching a Delivery filter, or the first `take`, priced in the region's market; pictures, claims and set rows arrive in the same response (`resolve`). */
export async function loadProducts(region: Region, filter?: string, sort?: string, take?: number): Promise<Product[]> {
  let [{ objs, refs }, articles] = await Promise.all([
    list(TYPE.product, {
      lang: CULTURE[region], variants: MARKET_VARIANT[MARKET[region]], filter: releasedWith(PRODUCT.workflow, filter), sort, take,
      resolve: [PRODUCT.images, PRODUCT.claims, PRODUCT.setItems].join(','),
    }),
    loadArticles(region),
  ])
  let pictures = toPictures(refs)
  let refsById = new Map(refs.map((o) => [o.meta.id, o]))
  let articlesOf = Map.groupBy(articles, (a) => a.productId)
  return objs
    .filter((o) => o.props[PRODUCT.name] && o.props[PRODUCT.urlSegment])
    .map((o) => toProduct(o, region, articlesOf.get(o.meta.id) ?? [], refsById, pictures))
}

/** Products by ID, in the order of `ids` (the order an editor chose). */
export async function productsByIds(ids: number[], region: Region): Promise<Product[]> {
  if (!ids.length) return []
  let byId = new Map((await loadProducts(region, `meta.id = ${ids.join(', ')}`)).map((p) => [p.id, p]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

export async function productByPath(region: Region, path: string): Promise<Product | undefined> {
  let [product] = await loadProducts(region, `${PRODUCT.urlSegment} = "${path.replace(/["\\]/g, '')}"`)
  return product
}

/** The rows of a set product: how many of which article, linked to the article's product page (none if that is not on the site). */
export async function setContents(product: Product, region: Region): Promise<{ quantity: number; name: string; url?: string }[]> {
  if (!product.setItems.length) return []
  let all = new Map((await loadArticles(region)).map((a) => [a.id, a]))
  let rows = product.setItems.flatMap(({ articleId, quantity }) => {
    let article = all.get(articleId)
    return article ? [{ quantity, article }] : []
  })
  let products = await productsByIds([...new Set(rows.map((r) => r.article.productId))], region)
  return rows.map(({ quantity, article }) => ({ quantity, name: article.name, url: products.find((p) => p.id === article.productId)?.url }))
}

/** Lucene-safe prefix terms (`+term*`) from the first 100 characters a visitor typed; empty when nothing usable is left. */
function searchTerms(query: string): string[] {
  return query
    .slice(0, 100)
    .toLowerCase()
    .replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .slice(0, 6)
    .map((term) => `+${term}*`)
}

/** Full-text filter over the given text fields: every term must match within one field. */
export function searchFilter(query: string, fields: string[]): string | undefined {
  let terms = searchTerms(query).join(' ')
  return terms ? '(' + fields.map((f) => `${f}: ${terms}`).join(' || ') + ')' : undefined
}
