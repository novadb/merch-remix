// Class names and HTML are read outside this file (the test suite selects `.product-card__*`) and copied by the other demos: change them only together.
import type { Handle } from 'remix/component'

import { formatPrice, type Region, type Texts } from '../lib/i18n.ts'
import { colorsOf, inStockOf, type Product } from '../lib/products.ts'
import { CARD_SIZES } from './public/range-behaviour.tsx'

/**
 * A product as its card shows it, every text already in the region's language (`cardOf`).
 */
export type Card = {
  id: number
  url: string
  name: string
  image?: { src: string; srcset?: string }
  /** Colour, volume, size, materials, finishes and pieces, joined by " · ". */
  details: string
  price: string
  /** The badge of a sold-out product. */
  soldOut?: string
}

export function cardOf(p: Product, text: Texts, region: Region): Card {
  let details = [
    ...colorsOf(p).map(text.value), p.volume && `${p.volume} ml`, p.screenSize && `${p.screenSize}″`,
    ...p.materials.map(text.value), ...p.finishes.map(text.value),
    p.pieces && p.pieces > 1 && text.pieceCount(p.pieces),
  ].filter(Boolean)
  return {
    id: p.id,
    url: p.url,
    name: p.name,
    image: p.image,
    details: details.join(' · '),
    price: formatPrice(p.price, region),
    soldOut: inStockOf(p) === false ? text.soldOut : undefined,
  }
}

export function ProductCard(handle: Handle<{ card: Card }>) {
  return () => {
    let { card } = handle.props
    return (
      // `data-rmx-key`: when the range is reconciled with an answer, a card that stays keeps its element.
      <article class="product-card" data-rmx-key={card.id}>
        <a href={card.url} class="product-card__link">
          <div class="product-card__media">
            {card.image && <img src={card.image.src} srcset={card.image.srcset} sizes={CARD_SIZES} alt={card.name} loading="lazy" width={400} height={400} />}
          </div>
          <h3 class="product-card__name">{card.name}</h3>
          <p class="product-card__meta">{card.details}</p>
          <p class="product-card__price">
            {card.price}
            {card.soldOut && <span class="badge badge--muted">{card.soldOut}</span>}
          </p>
        </a>
      </article>
    )
  }
}
