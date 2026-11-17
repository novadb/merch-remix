import { clientEntry, type Handle } from 'remix/component'

/**
 * While a link or a form loads the next page, the current one is marked busy (`aria-busy` on `main`) until the answer
 * has replaced it. `main` itself is server-rendered, so this entry renders nothing and follows the page's own frame.
 */
export const PageBusy = clientEntry(import.meta.url, function PageBusy(handle: Handle) {
  let busy = (on: boolean) => document.getElementById('main')?.toggleAttribute('aria-busy', on)
  handle.frames.top.addEventListener('reloadStart', () => busy(true), { signal: handle.signal })
  handle.frames.top.addEventListener('reloadComplete', () => busy(false), { signal: handle.signal })
  return () => null
})
