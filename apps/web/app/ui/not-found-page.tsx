import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'

import type { Viewer } from '../auth/identity.ts'
import { routes } from '../routes.ts'
import { Layout } from './layout.tsx'
import { PageHead } from './page-head.tsx'

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
        code="404"
        eyebrow="Nothing here"
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
      code="403"
      eyebrow="Not yours"
      heading="You can't open this one."
      viewer={handle.props.viewer}
      hint={handle.props.hint}
    />
  )
}

/** 429 from a burst limit (app/middleware/rate-limit.ts). */
export function TooManyRequestsPage(handle: Handle<{ viewer: Viewer | null }>) {
  return () => (
    <StatusPage
      title="Slow down"
      code="429"
      eyebrow="Too many requests"
      heading="That was a lot, very fast."
      viewer={handle.props.viewer}
      hint="Wait a minute, then go back and try again."
    />
  )
}

export interface StatusPageProps {
  title: string
  /** The HTTP status, shown as the band's index. */
  code: string
  eyebrow: string
  heading: string
  hint: RemixNode
  viewer: Viewer | null
  /** Marks the bar's nav link for the area the missing page belongs to. */
  currentPath?: string
}

/**
 * A ruled status page (decision 047): one PageHead band with the HTTP status
 * as its index, the message, and the way back (courses, home). For any 4xx
 * that has nothing else to show.
 */
export function StatusPage(handle: Handle<StatusPageProps>) {
  return () => {
    let { title, code, eyebrow, heading, hint, viewer, currentPath } = handle.props
    return (
      <Layout title={title} viewer={viewer} currentPath={currentPath}>
        <PageFrame>
          <PageHead index={code} tone="ion" label={eyebrow} title={heading} titleId="status-title" lead={hint}>
            <div mix={actionsStyle}>
              <Keycap size="lg" href={routes.courses.index.href()}>
                Browse courses →
              </Keycap>
              <Keycap size="lg" variant="ghost" href={routes.home.href()}>
                Home
              </Keycap>
            </div>
          </PageHead>
        </PageFrame>
      </Layout>
    )
  }
}

const codeStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', color: 'var(--text-quiet)', overflowWrap: 'anywhere' })
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', paddingTop: 'var(--space-3)' })
