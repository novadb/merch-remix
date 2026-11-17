import type { Handle } from 'remix/component'

import type { Region } from '../../lib/i18n.ts'
import type { Seo } from '../../lib/seo.ts'
import type { Page } from '../../lib/site.ts'
import { Crumbs, VisualDocument, type Ctx } from '../../ui/content.tsx'
import type { RangeData } from '../../lib/range.ts'
import { Range } from '../../ui/range.tsx'
import { Document, type Shell } from '../document.tsx'

type Props = {
  shell: Shell
  page: Page
  ctx: Ctx
  crumbs: { url: string; title: string }[]
  seo: Seo
  alternates: Partial<Record<Region, string>>
  /** The live range of a category page, for the query's fields; null for a page without one. */
  range: RangeData | null
  groups: Map<number, string>
}

/** A CMS page: its Visual Document, with the live range right after the first component (the hero). */
export function CmsPage(handle: Handle<Props>) {
  return () => {
    let { shell, page, ctx, crumbs, seo, alternates, range, groups } = handle.props
    return (
      <Document shell={shell} title={page.title} seo={seo} alternates={alternates}>
        <Crumbs items={crumbs} label={shell.text.breadcrumb} />
        <VisualDocument node={page.content} ctx={ctx} afterFirst={range && <Range range={range} text={shell.text} region={shell.region} groups={groups} />} />
      </Document>
    )
  }
}
