/** The page tree of the website: paths, navigation and the lookup of a URL. */
import { list, type Props } from './delivery.ts'
import { CULTURE, type Region } from './i18n.ts'
import { searchFilter } from './products.ts'
import { NAME, PAGE, PAGE_SEARCH_FIELDS, TYPE } from './schema.ts'

/** One node of a Visual Document as the Delivery API returns it. */
export type VNode = {
  type: 'group' | 'text' | 'image' | 'object' | 'unknown'
  /** API identifier of the component's definition. The site does not read it: it renders by `type`, `element` and `class` (`merchChapter`, `imageWithCaption`), and the set of classes is closed in the CMS (`COMPONENT_CLASSES` in `tests/site.spec.ts`). */
  definition: string
  element?: string
  class?: string
  content?: string
  objectId?: number
  children?: VNode[]
}

export type Page = {
  id: number
  title: string
  /** Short name for the navigation and the breadcrumb (`merchPageNavTitle`); the title where a page has none. */
  navTitle: string
  /** URL of the page including the language prefix, e.g. `/de/shop/tassen`. */
  url: string
  /** The URL without the region and outer slashes ("" for the home page): the key of `Site.byPath`. */
  path: string
  segment: string
  imageId?: number
  parentId?: number
  /** Product groups whose live range the page shows (category pages). */
  groupRefs: number[]
  content?: VNode
  children: Page[]
}

export type Site = { home: Page; pages: Map<number, Page>; byPath: Map<string, Page> }

function toPage(id: number, p: Props): Page {
  return {
    id, path: '', url: '', children: [],
    segment: p[PAGE.urlSegment] ?? '',
    title: p[PAGE.title],
    navTitle: p[PAGE.navTitle] ?? p[PAGE.title],
    imageId: p[PAGE.image],
    parentId: p[PAGE.parent],
    groupRefs: p[PAGE.productGroups] ?? [],
    content: p[PAGE.content],
  }
}

/** Loads every page of the site in one language and links them into a tree. */
export async function loadSite(region: Region): Promise<Site> {
  let { objs } = await list(TYPE.page, { lang: CULTURE[region], sort: `${PAGE.sortKey} asc` })
  // A page without a title in this language is untranslated and left out; only the home page (no parent) has no URL segment.
  let shown = objs.filter((o) => o.props[PAGE.title] && (o.props[PAGE.urlSegment] || !o.props[PAGE.parent]))
  let pages = new Map(shown.map((o) => [o.meta.id, toPage(o.meta.id, o.props)]))
  let home = [...pages.values()].find((p) => !p.parentId)
  if (!home) throw new Error('No home page: no page without a parent page')

  let pathOf = (p: Page): string => {
    if (p === home || !p.parentId) return ''
    let parent = pages.get(p.parentId)
    return [parent ? pathOf(parent) : '', p.segment].filter(Boolean).join('/')
  }
  for (let page of pages.values()) {
    page.path = pathOf(page)
    page.url = `/${region}/${page.path}`
    if (page.parentId) pages.get(page.parentId)?.children.push(page) // already sorted by sort key
  }
  let byPath = new Map([...pages.values()].map((p) => [p.path, p]))
  return { home, pages, byPath }
}

/** The first `take` pages that match what a visitor typed, best first. */
export async function searchPages(region: Region, q: string, take: number): Promise<Page[]> {
  let filter = searchFilter(q, PAGE_SEARCH_FIELDS)
  if (!filter) return []
  let [{ objs: hits }, site] = await Promise.all([list(TYPE.page, { lang: CULTURE[region], take, sort: '$score', filter }), loadSite(region)])
  return hits.flatMap((o) => site.pages.get(o.meta.id) ?? [])
}

/** Product groups (id → name) in one language. */
export async function loadGroups(region: Region): Promise<Map<number, string>> {
  let { objs } = await list(TYPE.group, { lang: CULTURE[region] })
  return new Map(objs.filter((o) => o.props[NAME]).map((o) => [o.meta.id, o.props[NAME]]))
}

/** The page that presents a product group on its own (its category page), else the first page listing it. */
export function categoryPage(site: Site, groupId: number): Page | undefined {
  let pages = [...site.pages.values()].filter((p) => p.groupRefs.includes(groupId))
  return pages.find((p) => p.groupRefs.length === 1) ?? pages[0]
}

/** The trail from the home page down to the page, the page included. */
export function breadcrumb(site: Site, page: Page | undefined): Page[] {
  let trail: Page[] = []
  for (let p = page; p; p = p.parentId ? site.pages.get(p.parentId) : undefined) trail.unshift(p)
  return trail
}
