/** Renders a Visual Document (the page content), the teasers it embeds, and the breadcrumb. */
import { unsafeHTML, type Handle, type RemixNode } from 'remix/component'

import type { Picture } from '../lib/images.ts'
import { cleanHtml } from '../lib/products.ts'
import type { VNode } from '../lib/site.ts'
import { ProductCard, type Card } from './product-card.tsx'

/** Everything a link or teaser in content can point at: pages and products, by object ID. */
export type Target = { url: string; title: string; image?: Picture }
/**
 * `cards`: the products the document embeds, by object ID. `images`: the picture of each image object it embeds.
 * `firstImage`: the first picture of the document, which `VisualDocument` sets; it loads at once, as the others do not.
 */
export type Ctx = { cards: Record<number, Card>; targets: Record<number, Target>; images: Record<number, Picture>; firstImage?: VNode }

/** Object IDs a document refers to: embedded objects and links inside rich text. */
export function referencedIds(node: VNode | undefined, into = new Set<number>()): Set<number> {
  if (!node) return into
  if (node.objectId && node.type === 'object') into.add(node.objectId)
  for (let m of node.content?.matchAll(/objectId=(\d+)/g) ?? []) into.add(Number(m[1]))
  node.children?.forEach((child) => referencedIds(child, into))
  return into
}

/** Object IDs of the images a document embeds. */
export function imageIds(node: VNode | undefined, into = new Set<number>()): Set<number> {
  if (!node) return into
  if (node.objectId && node.type === 'image') into.add(node.objectId)
  node.children?.forEach((child) => imageIds(child, into))
  return into
}

/** The first image node in document order that `ContentNode` renders. */
function firstImage(node: VNode, images: Ctx['images']): VNode | undefined {
  if (node.type === 'image' && node.objectId && images[node.objectId]) return node
  for (let child of node.children ?? []) {
    let found = firstImage(child, images)
    if (found) return found
  }
}

/** Turns CMS links (`object?branch=…&objectId=N`) into site URLs and drops editor-only attributes. */
function rewriteLinks(html: string, targets: Record<number, Target>): string {
  return cleanHtml(html)
    .replace(/href="\/?object\?branch=[^&"]+&amp;objectId=(\d+)"/g, (_, id) => `href="${targets[Number(id)]?.url ?? '#'}"`)
    .replace(/\sdata-nova-[a-z]+="[^"]*"/g, '')
}

/** The breadcrumb of a page or product: the trail from the home page, the last item being the page itself. The home page has none. */
export function Crumbs(handle: Handle<{ items: { url: string; title: string }[]; label: string }>) {
  return () => {
    let { items, label } = handle.props
    if (items.length < 2) return null
    return (
      <nav class="crumbs" aria-label={label}>
        <ol>
          {items.map((item, i) => (
            <li key={item.url}>{i === items.length - 1 ? <span aria-current="page">{item.title}</span> : <a href={item.url}>{item.title}</a>}</li>
          ))}
        </ol>
      </nav>
    )
  }
}

/** A CMS component renders as the element the CMS names for it (`div`, `section`, `figure`, …). */
const tagOf = (node: VNode) => (node.element || 'div') as 'div'

/** Renders the document; `afterFirst` (the live range) goes right after its first component, the hero. */
export function VisualDocument(handle: Handle<{ node?: VNode; ctx: Ctx; afterFirst?: RemixNode }>) {
  return () => {
    let { node, afterFirst } = handle.props
    if (!node) return afterFirst
    let ctx = { ...handle.props.ctx, firstImage: firstImage(node, handle.props.ctx.images) }
    let [first, ...rest] = node.children ?? []
    let Tag = tagOf(node)
    // The root node (`visualComponentRoot`) comes from the CMS as `<div class="main">`: the `.main` of site.css.
    return (
      <Tag class={node.class}>
        {first && <ContentNode node={first} ctx={ctx} />}
        {afterFirst}
        {rest.map((child) => <ContentNode node={child} ctx={ctx} />)}
      </Tag>
    )
  }
}

/** `sizes` of a content picture: half a page beside text; the chapter's text column when it stands straight in a chapter, where site.css shows it wide. */
const CONTENT_SIZES = '(min-width: 760px) 50vw, 100vw'
const CHAPTER_SIZES = '(min-width: 1280px) 1024px, (min-width: 760px) 78vw, 100vw'

function ContentNode(handle: Handle<{ node: VNode; ctx: Ctx; sizes?: string }>) {
  return () => {
    let { node, ctx, sizes = CONTENT_SIZES } = handle.props
    let Tag = tagOf(node)
    switch (node.type) {
      case 'group': {
        // A chapter hands its own `sizes` to its children, and the picture's figure on to the picture; any other group starts again.
        let childSizes = node.class === 'merchChapter' ? CHAPTER_SIZES : node.class === 'imageWithCaption' ? sizes : CONTENT_SIZES
        return <Tag class={node.class}>{node.children?.map((child) => <ContentNode node={child} ctx={ctx} sizes={childSizes} />)}</Tag>
      }
      case 'image': {
        let image = node.objectId ? ctx.images[node.objectId] : undefined
        if (!image) return null
        // The first picture is on screen at once (the hero): lazy loading would delay the largest contentful paint.
        let first = node === ctx.firstImage
        return <img class={node.class} src={image.src} srcset={image.srcset} sizes={sizes} alt="" loading={first ? 'eager' : 'lazy'} fetchpriority={first ? 'high' : undefined} />
      }
      case 'object': {
        // Like the CMS, which wraps what an object component renders in the component's own element: the editor's
        // stylesheet (built from site.css) then matches the same DOM as the site.
        let card = node.objectId ? ctx.cards[node.objectId] : undefined
        let target = node.objectId ? ctx.targets[node.objectId] : undefined
        if (card) return <Tag class={node.class}><ProductCard card={card} /></Tag>
        return target ? <Tag class={node.class}><PageTeaser target={target} /></Tag> : null
      }
      default:
        return <Tag class={node.class} innerHTML={unsafeHTML(rewriteLinks(node.content ?? '', ctx.targets))} />
    }
  }
}

function PageTeaser(handle: Handle<{ target: Target }>) {
  return () => {
    let { target } = handle.props
    return (
      <a class="page-teaser" href={target.url}>
        {target.image && <img src={target.image.src} srcset={target.image.srcset} sizes="(min-width: 760px) 33vw, 100vw" alt="" loading="lazy" />}
        <span class="page-teaser__title">{target.title}</span>
      </a>
    )
  }
}
