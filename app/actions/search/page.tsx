import type { Handle } from 'remix/component'

import type { Region } from '../../lib/i18n.ts'
import type { RangeData } from '../../lib/range.ts'
import { Range } from '../../ui/range.tsx'
import { SearchBox } from '../../ui/public/search-box.tsx'
import { Document, searchBoxOf, type Shell } from '../document.tsx'

type Props = {
  shell: Shell
  q: string
  pages: { url: string; title: string }[]
  range: RangeData
  groups: Map<number, string>
  alternates: Partial<Record<Region, string>>
}

export function SearchPage(handle: Handle<Props>) {
  return () => {
    let { shell, q, pages, range, groups, alternates } = handle.props
    let { text } = shell
    // No canonical/hreflang: internal search results are not meant to be indexed.
    return (
      <Document shell={shell} title={text.search} alternates={alternates}>
        <section class="merchHero merchHero--compact">
          <p class="merchKicker">{text.search}</p>
          <h1 class="merchDisplay">{text.searchTitle(q)}</h1>
          {/* `key`: a new search starts a new form, so its field shows the query of the answer (a default value is read once). */}
          <SearchBox key={q} {...searchBoxOf(shell)} large query={q} />
          {pages.length > 0 && (
            <nav class="search-pages" aria-label={text.pagesFound}>
              <span>{text.pagesFound}:</span>
              {pages.map((p) => <a key={p.url} href={p.url}>{p.title}</a>)}
            </nav>
          )}
        </section>
        <Range range={range} text={text} region={shell.region} groups={groups} keep={q ? { q } : {}} />
      </Document>
    )
  }
}
