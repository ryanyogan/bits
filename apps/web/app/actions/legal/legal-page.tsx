import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export interface LegalPageProps {
  title: string
  description: string
  /** "27 October 2026": when the text last changed. */
  updated: string
  /** This page's path (canonical, and the active link between the two pages). */
  path: string
  viewer: Viewer | null
  children?: RemixNode
}

/**
 * The shell for /terms and /privacy: one readable column of plain prose,
 * with a link to the other page. The text is in terms-page.tsx and
 * privacy-page.tsx (decision 028).
 */
export function LegalPage(handle: Handle<LegalPageProps>) {
  return () => {
    let { title, description, updated, path, viewer, children } = handle.props
    let terms = routes.legal.terms.href()
    let privacy = routes.legal.privacy.href()
    return (
      <Layout title={title} description={description} viewer={viewer} currentPath={path} canonicalPath={path}>
        <article mix={articleStyle} aria-labelledby="legal-title">
          <header mix={headerStyle}>
            <Eyebrow tone="dim" size="sm">{`Last updated ${updated}`}</Eyebrow>
            <h1 id="legal-title" mix={titleStyle}>
              {title}
            </h1>
            <p mix={leadStyle}>{description}</p>
          </header>
          <div mix={proseStyle}>{children}</div>
          <nav aria-label="Policies" mix={otherStyle}>
            <a href={terms} aria-current={path === terms ? 'page' : undefined} data-rmx-prefetch={prefetchFor(terms)}>
              Terms
            </a>
            <a href={privacy} aria-current={path === privacy ? 'page' : undefined} data-rmx-prefetch={prefetchFor(privacy)}>
              Privacy
            </a>
            <a href={routes.settings.index.href()} data-rmx-prefetch={prefetchFor(routes.settings.index.href())}>Settings: export or delete your data</a>
          </nav>
        </article>
      </Layout>
    )
  }
}

const articleStyle = css({
  maxWidth: 'var(--read-width)',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-10)',
})
const headerStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
})
const leadStyle = css({ margin: 0, fontSize: 'var(--fs-17)', lineHeight: 1.6, color: 'var(--text-lead)' })
const proseStyle = css({
  fontSize: 'var(--type-prose-size)',
  lineHeight: 'var(--type-prose-leading)',
  color: 'var(--text-body)',
  '& h2': {
    margin: 'var(--space-10) 0 var(--space-3)',
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--type-h3-size)',
    lineHeight: 'var(--type-h3-leading)',
    color: 'var(--text)',
  },
  '& h2:first-child': { marginTop: 0 },
  '& p, & ul': { margin: '0 0 var(--space-4)' },
  '& ul': { paddingLeft: 'var(--space-5)' },
  '& li + li': { marginTop: 'var(--space-2)' },
  '& strong': { color: 'var(--text)' },
  '& code': { fontFamily: 'var(--font-mono)', fontSize: '0.9em' },
  '& a': {
    color: 'var(--volt)',
    textUnderlineOffset: 'var(--link-underline-offset)',
    textDecorationThickness: 'var(--link-underline-thickness)',
  },
})
const otherStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2) var(--space-6)',
  paddingTop: 'var(--space-6)',
  borderTop: 'var(--border-w) solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  '& a': {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 'var(--touch-target)',
    color: 'var(--muted)',
  },
  '& a:hover, & a[aria-current="page"]': { color: 'var(--text)' },
})
