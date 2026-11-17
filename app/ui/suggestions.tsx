/**
 * The options of the typeahead's list (`POST /api/suggest`): the search box in the browser shows them as they come.
 * Option IDs are `{list}-{index}` (`list`: the ID of the box's list), so the box can name the highlighted one.
 */
import type { Handle } from 'remix/component'

import type { Texts } from '../lib/i18n.ts'

type Props = {
  list: string
  q: string
  products: { name: string; url: string; image: string | null; price: string }[]
  pages: { title: string; url: string }[]
  text: Pick<Texts, 'products' | 'pagesFound' | 'searchAll'>
}

export function Suggestions(handle: Handle<Props>) {
  return () => {
    let { list, q, products, pages, text } = handle.props
    let id = (index: number) => `${list}-${index}`
    return (
      <>
        {products.length > 0 && <li class="suggest__heading" role="presentation">{text.products}</li>}
        {products.map((p, i) => (
          <li id={id(i)} class="suggest__option" role="option" data-href={p.url}>
            {p.image && <img src={p.image} alt="" width={40} height={40} />}
            <span class="suggest__name">{p.name}</span>
            <span class="suggest__price">{p.price}</span>
          </li>
        ))}
        {pages.length > 0 && <li class="suggest__heading" role="presentation">{text.pagesFound}</li>}
        {pages.map((p, i) => <li id={id(products.length + i)} class="suggest__option" role="option" data-href={p.url}><span class="suggest__name">{p.title}</span></li>)}
        {/* "Search all": no address, it submits the search form. */}
        <li id={id(products.length + pages.length)} class="suggest__option" role="option"><span class="suggest__name suggest__all">{`${text.searchAll} “${q}”`}</span></li>
      </>
    )
  }
}
