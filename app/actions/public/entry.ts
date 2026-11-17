import { detectMultipleImportMapSupport, importModule, preloadShim } from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

import { preloadPictures } from '../../ui/public/range-behaviour.tsx'

// Hydrates the client entries (range, search box, shop) and lets links and forms navigate without a page load.
const app = run({
  // The default resolver (a same-origin fetch of the page as HTML), plus one wait: the answer to another query of the page
  // in view is shown once the pictures of its first cards have loaded, so none pops in. Any other page is shown at once.
  async resolveFrame(src, { signal } = {}) {
    let response = await fetch(src, { headers: { Accept: 'text/html', 'X-Remix-Frame': 'true' }, mode: 'same-origin', signal })
    if (response.status >= 500) throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
    if (new URL(src, location.href).pathname === location.pathname) await preloadPictures(await response.clone().text())
    return response
  },
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})

app.addEventListener('error', (event) => console.error(event.error))
