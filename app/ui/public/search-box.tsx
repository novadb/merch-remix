/**
 * The search form: a POST to /{region}/search, the query in the field `q`. In the browser the input becomes an ARIA
 * combobox over POST /api/suggest, which answers the options as HTML (products and pages while typing, keys ↑ ↓ Enter
 * Esc); without JavaScript it is a plain form.
 */
import { clientEntry, navigate, on, ref, unsafeHTML, type Handle } from 'remix/component'

type Props = {
  region: string
  /** `routes.search.action` and `routes.suggest` of the region. */
  action: string
  suggest: string
  text: Record<'search' | 'searchPlaceholder', string>
  /** The search page's own form, with a button and the query it was posted with. */
  large?: boolean
  query?: string
}

export const SearchBox = clientEntry(import.meta.url, function SearchBox(handle: Handle<Props>) {
  let listId = `suggest-${handle.id}`
  let form: HTMLFormElement
  let list: HTMLUListElement
  // The combobox exists only where it works: in the browser, after hydration.
  let ready = false
  /** The options' HTML (`app/ui/suggestions.tsx`); undefined: closed. */
  let shown: string | undefined
  let active = -1

  handle.queueTask(() => {
    ready = true
    handle.update()
  })

  /** The rendered options; one leads to a product or page (`data-href`), the last ("search all") submits the search form. */
  let options = () => (shown && list ? [...list.querySelectorAll<HTMLElement>('[role="option"]')] : [])

  function close() {
    shown = undefined
    active = -1
    handle.update()
  }

  function choose(option: HTMLElement | undefined) {
    let href = option?.dataset.href
    close() // the box stays in the header while the next page loads
    if (href) navigate(href)
    else form.requestSubmit()
  }

  function highlight(index: number) {
    active = index
    handle.update()
    // `aria-selected` on every option once one is highlighted; the options are the server's HTML, not this render's.
    options().forEach((option, i) => option.setAttribute('aria-selected', String(i === active)))
    options()[active]?.scrollIntoView({ block: 'nearest' })
  }

  return () => {
    let { region, action, suggest, text, large = false, query } = handle.props
    let open = shown !== undefined
    return (
      <form class={large ? 'search search--large' : 'search'} role="search" method="post" action={action} mix={[ref((node) => (form = node)), on('submit', close)]}>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={text.searchPlaceholder}
          aria-label={text.search}
          autocomplete="off"
          role={ready ? 'combobox' : undefined}
          list={undefined}
          aria-controls={ready ? listId : undefined}
          aria-autocomplete={ready ? 'list' : undefined}
          aria-expanded={ready ? open : undefined}
          aria-activedescendant={active >= 0 ? options()[active]?.id : undefined}
          mix={[
            on('input', async (event, signal) => {
              let typed = event.currentTarget.value.trim()
              if (typed.length < 2) return close()
              await new Promise((done) => setTimeout(done, 150)) // a newer keystroke aborts `signal` meanwhile
              if (signal.aborted) return
              let body = new URLSearchParams({ lang: region, q: typed, list: listId }) // POST: no URL carries a query string
              let html = await (await fetch(suggest, { method: 'POST', body, signal })).text()
              if (signal.aborted) return
              shown = html
              active = -1
              handle.update()
            }),
            on('keydown', (event) => {
              let count = options().length
              if (!count) return
              if (event.key === 'ArrowDown') highlight((active + 1) % count)
              else if (event.key === 'ArrowUp') highlight((active - 1 + count) % count)
              else if (event.key === 'Escape') close()
              else if (event.key === 'Enter' && active >= 0) choose(options()[active])
              else return
              event.preventDefault()
            }),
            // A click on an option is a mousedown first: the list stays long enough to receive it.
            on('blur', () => void setTimeout(close, 100)),
          ]}
        />
        {ready && (
          <ul
            id={listId}
            class="suggest"
            role="listbox"
            hidden={!open}
            innerHTML={unsafeHTML(shown ?? '')}
            mix={[
              ref((node) => (list = node)),
              on('mousedown', (event) => {
                let option = (event.target as Element).closest<HTMLElement>('[role="option"]')
                if (!option) return
                event.preventDefault()
                choose(option)
              }),
            ]}
          />
        )}
        {large && <button type="submit" class="button">{text.search}</button>}
      </form>
    )
  }
})
