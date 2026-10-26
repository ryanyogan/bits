import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'
import { Keycap } from '@bits/ui/keycap'

import type { Viewer } from '../auth/identity.ts'
import { routes } from '../routes.ts'
import { Layout } from './layout.tsx'

export interface NotFoundPageProps {
  path: string
  viewer: Viewer | null
}

/** App-wide 404 for unknown URLs, in the catalog's empty-state style. */
export function NotFoundPage(handle: Handle<NotFoundPageProps>) {
  return () => {
    let { path, viewer } = handle.props
    return (
      <StatusPage
        title="Page not found"
        eyebrow="404 · nothing here"
        heading="That page isn't here."
        viewer={viewer}
        hint={
          <>
            Nothing lives at <code mix={codeStyle}>{path}</code>. It may have moved, or the link has a typo.
          </>
        }
      />
    )
  }
}

export interface ForbiddenPageProps {
  viewer: Viewer | null
  /** What the viewer was trying to reach, in a sentence. */
  hint: string
}

/** 403 for signed-in viewers without the role or ownership a page needs. */
export function ForbiddenPage(handle: Handle<ForbiddenPageProps>) {
  return () => (
    <StatusPage
      title="No access"
      eyebrow="403 · not yours"
      heading="You can't open this one."
      viewer={handle.props.viewer}
      hint={handle.props.hint}
    />
  )
}

interface StatusPageProps {
  title: string
  eyebrow: string
  heading: string
  hint: RemixNode
  viewer: Viewer | null
}

function StatusPage(handle: Handle<StatusPageProps>) {
  return () => {
    let { title, eyebrow, heading, hint, viewer } = handle.props
    return (
      <Layout title={title} viewer={viewer} bleed>
        <div mix={pageStyle}>
          <div mix={boxStyle}>
            <Eyebrow tone="ion">{eyebrow}</Eyebrow>
            <h1 mix={h1Style}>{heading}</h1>
            <p mix={hintStyle}>{hint}</p>
            <div mix={actionsStyle}>
              <Keycap size="lg" href={routes.courses.index.href()}>
                Browse courses →
              </Keycap>
              <Keycap size="lg" variant="ghost" href={routes.home.href()}>
                Home
              </Keycap>
            </div>
          </div>
        </div>
      </Layout>
    )
  }
}

const pageStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--page-gutter) var(--space-16)' },
})
const boxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-16) var(--space-12)',
  borderRadius: 'var(--radius-20)',
  border: '1px dashed var(--line-dashed)',
  textAlign: 'center',
  '@media (max-width: 480px)': { padding: 'var(--space-10) var(--space-5)' },
})
const h1Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(32px, 4.4vw, 52px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
  textWrap: 'balance',
})
const hintStyle = css({ margin: 0, maxWidth: '52ch', fontSize: 'var(--fs-16)', lineHeight: 1.6, color: 'var(--muted)' })
const codeStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: 'var(--text-quiet)', overflowWrap: 'anywhere' })
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' })
