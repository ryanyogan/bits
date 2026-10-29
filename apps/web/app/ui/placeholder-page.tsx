import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../auth/identity.ts'
import { Layout } from './layout.tsx'

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
          <RuledSection rule={false} label={artboard ? `${pattern} · ${artboard}` : pattern} aria-labelledby="page-title">
            <div mix={sectionStyle}>
              <h1 id="page-title" mix={titleStyle}>
                {title}
              </h1>
              <p mix={summaryStyle}>{summary}</p>
              {children}
            </div>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

const sectionStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  maxWidth: '760px',
})

const titleStyle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
})

const summaryStyle = css({
  maxWidth: 'var(--type-body-measure)',
  fontSize: 'var(--type-body-size)',
  lineHeight: 'var(--type-body-leading)',
  color: 'var(--muted)',
})
