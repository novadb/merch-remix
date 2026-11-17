/**
 * What the server-rendered range (`app/ui/range.tsx`) does in the browser. A change posts the form at once, in the
 * background: the answer is the page itself, as without JavaScript, and is reconciled into the page as it stands (no
 * page load, the URL, the scroll position and the focused control stay, a card that stays is the same element).
 * "Show more" clicks itself as it comes near the window. Renders nothing.
 */
import { clientEntry, type Handle } from 'remix/component'

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
    let section = document.getElementById('range')!
    let form = document.getElementById('facets') as HTMLFormElement
    let more = () => section.querySelector<HTMLButtonElement>('.range__more')
    /** The running request; a newer one aborts it. */
    let pending: AbortController | undefined
    let nearEnd: IntersectionObserver | undefined

    // "Show more" clicks itself within 600 px of the window; observed anew after every answer, as an observer reports a
    // change of intersection only.
    function observe() {
      nearEnd?.disconnect()
      let button = more()
      if (!button) return
      nearEnd = new IntersectionObserver(([entry]) => entry.isIntersecting && !pending && button.click(), { rootMargin: '600px 0px' })
      nearEnd.observe(button)
    }
    observe()
    signal.addEventListener('abort', () => nearEnd?.disconnect())

    // Also the sort <select form="facets"> outside the form. A price applies on Enter or "Apply", not per keystroke.
    section.addEventListener('change', (event) => {
      let control = event.target as HTMLInputElement | HTMLSelectElement
      if (control.form === form && control.type !== 'number' && form.reportValidity()) form.requestSubmit()
    }, { signal })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      let submitter = event.submitter
      let appending = submitter === more()
      if (appending && pending) return // a filter change is running: its answer comes first
      post(submitter, appending)
    }, { signal })

    /** Posts the form with the control that submitted it (its name and value travel along, as in the browser's own submit). */
    async function post(submitter: HTMLElement | null, appending: boolean) {
      pending?.abort()
      let request = (pending = new AbortController())
      // A keyboard user who pressed "Show more" goes on with the first new card: its index.
      let focusFrom = appending && document.activeElement === submitter ? section.querySelectorAll('.product-card').length : undefined
      let scrolled = scrollY // the browser moves it when the page gets shorter
      let body = new FormData(form, submitter)
      ;(appending ? section.querySelector('.grid')! : section).setAttribute('aria-busy', 'true') // the answer brings the range without it
      let html: string
      try {
        let response = await fetch(form.action, { method: 'POST', body, signal: request.signal })
        if (!response.ok) throw new Error(`The range answered ${response.status}`)
        html = await response.text()
        await preloadPictures(html)
      } catch (error) {
        if (request.signal.aborted) return
        // The visitor sees what the server says: the browser posts the form itself and shows the answer.
        HTMLFormElement.prototype.submit.call(form)
        throw error
      }
      if (request.signal.aborted) return
      // The reconciler keeps a control as the visitor left it where the answer differs: "Reset" clears them first.
      if (body.has('reset')) for (let control of form.elements) if (control instanceof HTMLInputElement && control.type !== 'hidden') control.type === 'checkbox' ? (control.checked = false) : (control.value = '')
      if (body.has('reset')) section.querySelector('select')!.selectedIndex = 0 // the default sort is the first option (`app/ui/range.tsx`)
      await handle.frames.top.replace(html)
      pending = undefined
      // The scroll position stays. Only when it cannot (the page is now shorter than it) or shows no result any more
      // (they end above the window) the range is shown from its start.
      let start = parseFloat(getComputedStyle(section).scrollMarginTop) // where the range starts below the sticky header
      if (Math.abs(scrollY - scrolled) > 1 || section.querySelector('.range__main')!.getBoundingClientRect().bottom < start) section.scrollIntoView({ behavior: 'instant' })
      if (focusFrom !== undefined) section.querySelectorAll<HTMLElement>('.product-card__link')[focusFrom]?.focus()
      observe()
    }
  })
  return () => null
})

/**
 * Loads the pictures of the first cards of the range in `html`, at most 1.5 s: a filter or sorting that brings a card on
 * screen then shows its picture at once instead of popping it in. The browser picks the same file from `srcset` as for the card.
 */
async function preloadPictures(html: string) {
  let doc = new DOMParser().parseFromString(html, 'text/html')
  let pictures = [...doc.querySelectorAll<HTMLImageElement>('#range .product-card img')].slice(0, RANGE_BATCH)
    .map((img) => Object.assign(new Image(), { sizes: CARD_SIZES, srcset: img.getAttribute('srcset') ?? '', src: img.getAttribute('src')! }))
  await Promise.race([Promise.allSettled(pictures.map((img) => img.decode())), new Promise((done) => setTimeout(done, 1500))])
}
