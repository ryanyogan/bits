import type { Handle, RemixNode } from 'remix/component'

import { PageFrame } from '@bits/ui/page-frame'

import type { Viewer } from '../auth/identity.ts'
import { Layout } from './layout.tsx'
import { PageHead } from './page-head.tsx'

export interface PlaceholderPageProps {
  /** Page name, also used for the document title. */
  title: string
  /** Route pattern this page answers, e.g. "/courses/:course". */
  pattern: string
  /** Design artboard in docs/design/artboards, if any. */
  artboard?: string
  /** What the finished page will do. */
  summary: string
  currentPath?: string
  /** The signed-in viewer (`getViewer(context)`), so the bar shows their account. */
  viewer?: Viewer | null
  children?: RemixNode
}

/**
 * Scaffolding for pages that have not been built yet. Each page agent
 * replaces its controller's use of this with the real page.
 */
export function PlaceholderPage(handle: Handle<PlaceholderPageProps>) {
  return () => {
    let { title, pattern, artboard, summary, currentPath, viewer, children } = handle.props

    return (
      <Layout title={title} currentPath={currentPath} viewer={viewer}>
        <PageFrame>
          <PageHead label={artboard ? `${pattern} · ${artboard}` : pattern} title={title} lead={summary}>
            {children}
          </PageHead>
        </PageFrame>
      </Layout>
    )
  }
}
