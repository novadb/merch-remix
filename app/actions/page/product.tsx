/** The product page: PIM data (price per market, stock, specs, claims, set contents) plus similar products, accessories and spare parts. */
import { unsafeHTML, type Handle } from 'remix/component'

import { formatPrice, type Region } from '../../lib/i18n.ts'
import { colorsOf, inStockOf, type Product } from '../../lib/products.ts'
import type { Seo } from '../../lib/seo.ts'
import { Crumbs } from '../../ui/content.tsx'
import { ProductCard, type Card } from '../../ui/product-card.tsx'
import { BuyButton } from '../../ui/public/shop.tsx'
import { Document, type Shell } from '../document.tsx'

type Props = {
  shell: Shell
  product: Product
  groupName?: string
  /** The rows of a set product (`setContents`). */
  contents: { quantity: number; name: string; url?: string }[]
  /** Similar products, accessories and spare parts: a heading and its cards each; an empty one is left out. */
  bands: [string, Card[]][]
  crumbs: { url: string; title: string }[]
  seo: Seo
  alternates: Partial<Record<Region, string>>
}

export function ProductPage(handle: Handle<Props>) {
  return () => {
    let { shell, product: p, groupName, contents, bands, crumbs, seo, alternates } = handle.props
    let { text, region, shop } = shell
    let inStock = inStockOf(p)
    let deliveryDays = p.articles.filter((a) => a.stock > 0).flatMap((a) => a.deliveryDays ?? [])
    let specs: [string, string][] = [
      [text.sku, p.articles.map((a) => a.sku).join(', ')],
      [text.colour, colorsOf(p).map(text.value).join(', ')],
      [text.material, p.materials.map(text.value).join(', ')],
      [text.volume, p.volume ? `${p.volume} ml` : ''],
      [text.screenSize, p.screenSize ? `${p.screenSize}″` : ''],
      [text.finish, p.finishes.map(text.value).join(', ')],
      [text.pieces, p.pieces ? text.pieceCount(p.pieces) : ''],
      [text.delivery, deliveryDays.length ? String(Math.min(...deliveryDays)) : ''],
    ]
    return (
      <Document shell={shell} title={p.seo.title ?? p.name} seo={seo} alternates={alternates}>
        <Crumbs items={crumbs} label={text.breadcrumb} />
        <article class="pdp">
          <div class="pdp__media">
            {p.image && <img src={p.image.src} srcset={p.image.srcset} sizes="(min-width: 760px) 55vw, 100vw" alt={p.name} width={400} height={400} />}
          </div>
          <div class="pdp__info">
            {groupName && <p class="merchKicker">{groupName}</p>}
            <h1 class="pdp__name">{p.name}</h1>
            <p class="pdp__price">
              {formatPrice(p.price, region)}
              <span class={inStock === false ? 'badge badge--muted' : 'badge'}>{inStock === false ? text.soldOut : text.available}</span>
            </p>
            {p.shopifyId && inStock !== false && <BuyButton shop={shop} shopifyId={p.shopifyId} />}
            {p.descriptionHtml && <div class="pdp__description" innerHTML={unsafeHTML(p.descriptionHtml)} />}
            <dl class="specs">
              {specs.filter(([, value]) => value).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {contents.length > 0 && (
              <>
                <h2 class="pdp__subhead">{text.setContents}</h2>
                <ul class="pdp__list">
                  {contents.map((row) => <li key={row.name}>{row.quantity} × {row.url ? <a href={row.url}>{row.name}</a> : row.name}</li>)}
                </ul>
              </>
            )}
            {p.claims.length > 0 && (
              <>
                <h2 class="pdp__subhead">{text.claims}</h2>
                <ul class="pdp__list">{p.claims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
              </>
            )}
          </div>
        </article>
        {bands.filter(([, cards]) => cards.length > 0).map(([title, cards]) => (
          <section class="merchBand" key={title}>
            <h2 class="headline">{title}</h2>
            <div class="grid">{cards.map((card) => <ProductCard key={card.id} card={card} />)}</div>
          </section>
        ))}
      </Document>
    )
  }
}
