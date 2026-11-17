/**
 * A live product range: facet filters as a POST form (the URL stays the page's), sorting and the product grid. Every
 * change posts the form to the page, which answers with itself. In the browser `RangeBehaviour` posts it in the
 * background and reconciles the answer into the page.
 */
import type { Handle } from 'remix/component'

import type { Region, Texts } from '../lib/i18n.ts'
import { SORTS, type FacetValue, type RangeData } from '../lib/range.ts'
import { cardOf, ProductCard } from './product-card.tsx'
import { RANGE_BATCH, RangeBehaviour } from './public/range-behaviour.tsx'

type Props = {
  range: RangeData
  text: Texts
  region: Region
  /** Product group ID → name; a group without a name in this language is left out of the facet. */
  groups: Map<number, string>
  /** Hidden fields that must survive a filter change, e.g. the search query. */
  keep?: Record<string, string>
}

export function Range(handle: Handle<Props>) {
  return () => {
    let { range, text, region, groups, keep = {} } = handle.props
    let { items, total, facets, selection, defaultSort } = range
    let sort = selection.sort ?? defaultSort
    let sortLabel = { relevance: text.sortRelevance, name: text.sortName, 'price-asc': text.sortPriceAsc, 'price-desc': text.sortPriceDesc }
    let next = selection.shown + RANGE_BATCH

    return (
      <section class="range" id="range" aria-label={text.filter}>
        {/* `#range`: without JavaScript the answer opens at the range. */}
        <form class="facets" id="facets" method="post" action="#range">
          {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          {facets.group.length > 1 && <FacetGroup legend={text.group} name="group" values={facets.group} labelOf={(id) => groups.get(Number(id))} />}
          <FacetGroup legend={text.colour} name="color" values={facets.color} labelOf={text.value} swatchOf={text.swatch} />
          <FacetGroup legend={text.material} name="material" values={facets.material} labelOf={text.value} />
          <fieldset class="facet">
            <legend>{text.availability}</legend>
            <label class="facet__option">
              <input type="checkbox" name="stock" value="1" checked={selection.stock} />
              <span>{text.inStock}</span>
              <span class="facet__count">{facets.inStock}</span>
            </label>
          </fieldset>
          <fieldset class="facet facet--price">
            <legend>{text.price}</legend>
            <label>
              <span>{text.from}</span>
              <input type="number" name="min" inputMode="numeric" min={0} placeholder={String(facets.priceMin)} value={selection.min} />
            </label>
            <label>
              <span>{text.to}</span>
              <input type="number" name="max" inputMode="numeric" min={0} placeholder={String(facets.priceMax)} value={selection.max} />
            </label>
          </fieldset>
          <div class="facets__actions">
            <button type="submit" class="button">{text.apply}</button>
            <button type="submit" name="reset" value="1" class="button button--ghost">{text.reset}</button>
          </div>
        </form>
        <div class="range__main">
          <div class="range__bar">
            <p class="range__count" aria-live="polite">{text.results(total)}</p>
            <label class="range__sort">
              <span>{text.sort}</span>
              {/* The default sort is the first option: "Reset" in the browser relies on it (`RangeBehaviour`). */}
              <select name="sort" form="facets">
                {SORTS.filter((s) => s !== 'relevance' || defaultSort === 'relevance').map((s) => <option key={s} value={s} selected={s === sort}>{sortLabel[s]}</option>)}
              </select>
            </label>
          </div>
          {total ? (
            <div class="grid">
              {items.map((p) => <ProductCard key={p.id} card={cardOf(p, text, region)} />)}
            </div>
          ) : (
            <p class="range__empty">{text.noResults}</p>
          )}
          {total > items.length && (
            <button type="submit" form="facets" name="shown" value={next} class="button button--ghost range__more">{text.showMore}</button>
          )}
        </div>
        <RangeBehaviour />
      </section>
    )
  }
}

function FacetGroup(handle: Handle<{ legend: string; name: string; values: FacetValue[]; labelOf: (value: string) => string | undefined; swatchOf?: (value: string) => string | undefined }>) {
  return () => {
    let { legend, name, values, labelOf, swatchOf } = handle.props
    let options = values.flatMap((v) => {
      let label = labelOf(v.value)
      return label === undefined ? [] : [{ ...v, label, swatch: swatchOf?.(v.value) }]
    })
    if (!options.length) return null
    return (
      <fieldset class="facet">
        <legend>{legend}</legend>
        {options.map((o) => (
          <label key={o.value} class="facet__option">
            {/* No hit with the other filters: stays listed (the list never changes), but cannot be chosen. */}
            <input type="checkbox" name={name} value={o.value} checked={o.selected} disabled={o.count === 0 && !o.selected} />
            {o.swatch && <span class="swatch" style={{ '--swatch': o.swatch }} aria-hidden="true" />}
            <span>{o.label}</span>
            <span class="facet__count">{o.count}</span>
          </label>
        ))}
      </fieldset>
    )
  }
}
