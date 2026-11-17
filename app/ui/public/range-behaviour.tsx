/**
 * What the server-rendered range (`app/ui/range.tsx`) does in the browser. A change sends the form's fields as the query
 * of the page's own address, and the runtime navigates there: the answer is the page itself, reconciled into the page as
 * it stands (no page load, the scroll position and the focused control stay, a card that stays is the same element).
 * "Show more" clicks itself as it comes near the window. Renders nothing.
 */
import { clientEntry, navigate, type Handle } from 'remix/component'

/**
 * Cards a range shows at first and adds per "Show more": the grid has 1, 2 or 3 columns, so a multiple of 6 always
 * fills whole rows, and 12 cover the first screen and a half below the facets. The whole range is loaded all the same,
 * because the facets are counted over all of it: batches are a matter of rendering, not of Delivery paging.
 */
export const RANGE_BATCH = 12

/** `sizes` of a card's picture: also the picture `preloadPictures` loads ahead of an answer. */
export const CARD_SIZES = '(min-width: 700px) 320px, 100vw'

export const RangeBehaviour = clientEntry(import.meta.url, function RangeBehaviour(handle: Handle) {
  handle.queueTask(() => {
    let { signal } = handle
    let page = handle.frames.top
    let section = document.getElementById('range')!
    let form = document.getElementById('facets') as HTMLFormElement
    let more = () => section.querySelector<HTMLButtonElement>('.range__more')
    /** A navigation is loading. A new one aborts it, so the self-clicking "Show more" waits for the answer. */
    let busy = false
    /** The fields were sent by this form and so show what the answer is computed for; else (Back, "Reset") the address says what they show. */
    let sent = false
    let nearEnd: IntersectionObserver | undefined

    // "Show more" clicks itself within 600 px of the window; observed anew after every answer, as an observer reports a
    // change of intersection only.
    function observe() {
      nearEnd?.disconnect()
      let button = more()
      if (!button) return
      nearEnd = new IntersectionObserver(([entry]) => entry.isIntersecting && !busy && button.click(), { rootMargin: '600px 0px' })
      nearEnd.observe(button)
    }
    observe()
    signal.addEventListener('abort', () => nearEnd?.disconnect())

    page.addEventListener('reloadStart', () => (busy = true), { signal })
    page.addEventListener('reloadComplete', () => {
      busy = false
      // Where the answer differs from a control, the reconciler keeps the control as the visitor left it.
      if (!sent) showQuery()
      sent = false
      observe()
    }, { signal })

    // Also the sort <select form="facets"> outside the form. A price applies on Enter or "Apply", not per keystroke.
    section.addEventListener('change', (event) => {
      let control = event.target as HTMLInputElement | HTMLSelectElement
      if (control.form === form && control.type !== 'number' && form.reportValidity()) form.requestSubmit()
    }, { signal })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      let submitter = event.submitter as HTMLButtonElement | null
      let appending = submitter !== null && submitter === more()
      if (appending && busy) return // a filter change is running: its answer comes first
      send(submitter, appending)
    }, { signal })

    /** Sets the fields to what the address says, which is what the answer was computed for. */
    function showQuery() {
      let query = new URLSearchParams(location.search)
      for (let control of form.elements) {
        if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = query.getAll(control.name).includes(control.value)
        else if (control instanceof HTMLInputElement && control.type === 'number') control.value = query.get(control.name) ?? ''
        else if (control instanceof HTMLSelectElement) control.selectedIndex = Math.max(0, [...control.options].findIndex((option) => option.value === query.get(control.name))) // the default sort is the first option
      }
    }

    /**
     * Navigates to the page's address with the form's fields (and the control that submitted it) as the query, as the
     * browser's own submit would, but leaving out what says nothing: `#range`, an empty field and the default sort
     * (the first option). "Reset" sends only the hidden fields (the search query).
     */
    async function send(submitter: HTMLButtonElement | null, appending: boolean) {
      let resetting = submitter?.name === 'reset'
      let defaultSort = section.querySelector('select')!.options[0].value
      let fields: Iterable<[string, FormDataEntryValue]> = resetting
        ? [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input): [string, string] => [input.name, input.value])
        : new FormData(form, submitter)
      let query = new URLSearchParams()
      for (let [name, value] of fields) if (value && !(name === 'sort' && value === defaultSort)) query.append(name, String(value))
      // A keyboard user who pressed "Show more" goes on with the first new card: its index.
      let focusFrom = appending && document.activeElement === submitter ? section.querySelectorAll('.product-card').length : undefined
      let scrolled = scrollY // the browser moves it when the page gets shorter
      sent = !resetting
      try {
        // `replace` for "Show more": Back leaves the range instead of stepping through its batches.
        await navigate(`${location.pathname}${query.size ? `?${query}` : ''}`, { history: appending ? 'replace' : 'push', resetScroll: 'manual', resetFocus: 'manual' })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return // a newer navigation took over
        throw error
      }
      // The scroll position stays. Only when it cannot (the page is now shorter than it) or shows no result any more
      // (they end above the window) the range is shown from its start.
      let start = parseFloat(getComputedStyle(section).scrollMarginTop) // where the range starts below the sticky header
      if (Math.abs(scrollY - scrolled) > 1 || section.querySelector('.range__main')!.getBoundingClientRect().bottom < start) section.scrollIntoView({ behavior: 'instant' })
      if (focusFrom !== undefined) section.querySelectorAll<HTMLElement>('.product-card__link')[focusFrom]?.focus()
    }
  })
  return () => null
})

/**
 * Loads the pictures of the first cards of the range in `html`, at most 1.5 s: a filter or sorting that brings a card on
 * screen then shows its picture at once instead of popping it in. The browser picks the same file from `srcset` as for the card.
 */
export async function preloadPictures(html: string) {
  let doc = new DOMParser().parseFromString(html, 'text/html')
  let pictures = [...doc.querySelectorAll<HTMLImageElement>('#range .product-card img')].slice(0, RANGE_BATCH)
    .map((img) => Object.assign(new Image(), { sizes: CARD_SIZES, srcset: img.getAttribute('srcset') ?? '', src: img.getAttribute('src')! }))
  await Promise.race([Promise.allSettled(pictures.map((img) => img.decode())), new Promise((done) => setTimeout(done, 1500))])
}
