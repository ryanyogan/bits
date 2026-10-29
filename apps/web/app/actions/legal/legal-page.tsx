import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageHead } from '../../ui/page-head.tsx'

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
        <PageFrame>
          <PageHead label="Policies" aside={`Updated ${updated}`} title={title} titleId="legal-title" lead={description} />
          <RuledSection pad="none" aria-label={`${title} in full`}>
            <div mix={bodyStyle}>
              <nav aria-label="Policies" mix={sideStyle}>
                <a href={terms} aria-current={path === terms ? 'page' : undefined} data-rmx-prefetch={prefetchFor(terms)}>
                  Terms
                </a>
                <a href={privacy} aria-current={path === privacy ? 'page' : undefined} data-rmx-prefetch={prefetchFor(privacy)}>
                  Privacy
                </a>
                <a href={routes.settings.index.href()} data-rmx-prefetch={prefetchFor(routes.settings.index.href())}>
                  Settings: export or delete your data
                </a>
              </nav>
              <div mix={proseStyle}>{children}</div>
            </div>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

// A side column of policy links beside the prose, sharing one hairline;
// stacked above it on phones.
const bodyStyle = css({
  display: 'grid',
  gridTemplateColumns: '260px minmax(0, 1fr)',
  '@media (max-width: 899.98px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})
const sideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'start',
  position: 'sticky',
  top: 'var(--shell-h)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  '& a': {
    display: 'flex',
    alignItems: 'center',
    minHeight: 'var(--control-field)',
    padding: 'var(--space-3) var(--section-pad-x)',
    boxSizing: 'border-box',
    borderBottom: 'var(--border-w) solid var(--line-cell)',
    color: 'var(--muted)',
    textDecoration: 'none',
  },
  '& a:hover': { color: 'var(--text)', background: 'var(--fill-hover)' },
  '& a:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '& a[aria-current="page"]': { color: 'var(--text)', boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt)' },
  '@media (forced-colors: active)': { '& a': { borderColor: 'GrayText' }, '& a[aria-current="page"]': { textDecoration: 'underline' } },
  '@media (max-width: 899.98px)': { position: 'static', borderBottom: 0 },
})
const proseStyle = css({
  maxWidth: 'calc(var(--read-width) + 2 * var(--section-pad-x))',
  padding: 'var(--space-14) var(--section-pad-x) var(--section-pad-y)',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 899.98px)': { borderLeft: 0, paddingTop: 'var(--space-10)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
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
