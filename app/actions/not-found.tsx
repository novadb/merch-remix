import type { Handle } from 'remix/component'

import { isRegion } from '../lib/i18n.ts'
import type { AppContext } from '../router.ts'
import { Document, loadShell, type Shell } from './document.tsx'

/** The 404 page, in the language of the region; a first segment that is no region (`/en/…`) gets the US texts. */
export async function notFound(context: AppContext, region: string | undefined) {
  let shell = await loadShell(isRegion(region) ? region : 'us')
  return context.render(<NotFoundPage shell={shell} />, { status: 404 })
}

function NotFoundPage(handle: Handle<{ shell: Shell }>) {
  return () => {
    let { shell } = handle.props
    let { text, home } = shell
    return (
      <Document shell={shell} title={text.notFound}>
        <section class="merchHero not-found">
          <h1 class="merchDisplay">{text.notFound}</h1>
          <p class="merchLead" innerHTML={text.notFoundText} />
          <p class="merchCta"><a href={home.url}>{text.home}</a></p>
        </section>
      </Document>
    )
  }
}
