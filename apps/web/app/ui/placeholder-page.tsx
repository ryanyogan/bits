import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

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
  children?: RemixNode
}

/**
 * Scaffolding for pages that have not been built yet. Each page agent
 * replaces its controller's use of this with the real page.
 */
export function PlaceholderPage(handle: Handle<PlaceholderPageProps>) {
  return () => {
    let { title, pattern, artboard, summary, currentPath, children } = handle.props

    return (
      <Layout title={title} currentPath={currentPath}>
        <section mix={sectionStyle} aria-labelledby="page-title">
          <p mix={eyebrowStyle}>
            {pattern}
            {artboard ? ` · ${artboard}` : null}
          </p>
          <h1 id="page-title" mix={titleStyle}>
            {title}
          </h1>
          <p mix={summaryStyle}>{summary}</p>
          {children}
        </section>
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

const eyebrowStyle = css({
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--type-eyebrow-size)',
  letterSpacing: 'var(--type-eyebrow-tracking)',
  textTransform: 'uppercase',
  color: 'var(--ion)',
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
