import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Document } from '@bits/ui/document'
import { Logo } from '@bits/ui/logo'
import { SegmentedTabs } from '@bits/ui/segmented-tabs'

import { platform } from '#platform'

import { APP_NAME, pageTitle } from '../../../config.ts'
import { courses, getCourse } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'
import type { LoginMode } from '../schema.ts'
import { BrainPane } from './brain-pane.tsx'

export interface AuthShellProps {
  /** Page name for the document title ("Sign in", "Check your inbox"). */
  title: string
  /** Which account tab is current. */
  mode: LoginMode
  next?: string
  children?: RemixNode
}

/** The Auth artboard frame: the "living brain" pane and the form pane with the account tabs and footer. */
export function AuthShell(handle: Handle<AuthShellProps>) {
  return () => {
    let { title, mode, next, children } = handle.props
    let nextParam = next ? { next } : {}
    let firstCourse = getCourse(courses[0]!.slug)!
    let firstLesson = firstCourse.modules[0]!.lessons[0]!

    return (
      <Document
        assets={platform.assets}
        title={pageTitle(title)}
        description="Sign in or create a free bits account to save your progress, streaks and prompts."
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        <div mix={rootStyle}>
          <BrainPane brand={APP_NAME} homeHref={routes.home.href()} />
          <main id="main" mix={formPaneStyle}>
            <div mix={columnStyle}>
              <Logo brand={APP_NAME} href={routes.home.href()} variant="auth" mix={mobileLogoStyle} />
              <SegmentedTabs
                label="Account"
                flavour="account"
                items={[
                  {
                    label: 'Sign in',
                    href: routes.login.index.href(undefined, { searchParams: nextParam }),
                    current: mode === 'signin',
                  },
                  {
                    label: 'Create account',
                    href: routes.login.index.href(undefined, { searchParams: { mode: 'signup', ...nextParam } }),
                    current: mode === 'signup',
                  },
                ]}
              />
              {children}
              <footer mix={footerStyle}>
                <a
                  href={routes.courses.lesson.index.href({ course: firstCourse.slug, lesson: firstLesson.slug })}
                  mix={exploreLinkStyle}
                >
                  Just exploring? Start lesson 1 without an account →
                </a>
                <p mix={legalStyle}>
                  By continuing you agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
                </p>
              </footer>
            </div>
          </main>
        </div>
      </Document>
    )
  }
}

/** The 26px rise every auth block enters with (`.rise`, reduced-motion safe). */
export const riseStyle = css({
  animation: 'bits-rise var(--duration-reveal) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

/** `<h1>` + sub-copy pair at the top of every auth state. */
export const headingGroupStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2_5)' })

export const formHeadingStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-34)',
  lineHeight: 'normal',
  letterSpacing: 'var(--tracking-form)',
  '@media (max-width: 380px)': { fontSize: 'var(--fs-30)' },
})

export const subStyle = css({
  margin: 0,
  fontSize: 'var(--fs-16)',
  lineHeight: 1.55,
  color: 'var(--muted)',
})

const skipLinkStyle = css({
  position: 'absolute',
  left: 'var(--space-4)',
  top: '-100px',
  zIndex: 10,
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  '&:focus': { top: 'var(--space-4)' },
})

const rootStyle = css({
  minHeight: '100vh',
  display: 'flex',
  flexWrap: 'wrap',
  background: 'var(--ink)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
})

const formPaneStyle = css({
  flex: '1 1 480px',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-12) var(--space-6)',
  // resolutions §8: below 760px the form comes first, the brain pane after it.
  '@media (max-width: 759px)': { order: -1, flexBasis: '100%', padding: 'var(--space-8) var(--space-4)' },
})

const columnStyle = css({
  width: '100%',
  maxWidth: 'var(--form-width)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6_5)',
  '@media (max-width: 759px)': { maxWidth: '100%' },
})

const mobileLogoStyle = css({
  alignSelf: 'flex-start',
  '@media (min-width: 760px)': { display: 'none' },
})

const footerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  paddingTop: 'var(--space-5)',
  borderTop: '1px solid var(--line)',
})

const exploreLinkStyle = css({
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
  color: 'var(--volt)',
  textDecoration: 'none',
  '&:hover': { color: 'var(--volt-link-hover)' },
})

const legalStyle = css({
  margin: 0,
  fontSize: 'var(--fs-12)',
  lineHeight: 1.5,
  color: 'var(--dim)',
  '& a': { color: 'var(--muted)' },
  '& a:hover': { color: 'var(--volt-link-hover)' },
})
