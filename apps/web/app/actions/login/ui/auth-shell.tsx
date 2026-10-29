import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Document } from '@bits/ui/document'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { Logo } from '@bits/ui/logo'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'
import { SegmentedTabs } from '@bits/ui/segmented-tabs'

import { platform } from '#platform'

import { APP_NAME, pageTitle } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { lessonOneHref } from '../../home/links.ts'
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

    return (
      <Document
        assets={platform.assets}
        title={pageTitle(title)}
        description="Sign in or create a free bits account to save your progress, streaks and prompts."
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        {/*
          The squared grid (decision 047): one PageFrame, a header band with
          the logo, then one ruled band of two cells sharing a hairline: the
          brain and the form. Stacked under 1040px (brain first), and under
          760px the form comes first (resolutions §8).
        */}
        <PageFrame mix={rootStyle}>
          {/*
            One logo for every breakpoint and every auth state, in the same
            spot the app bar puts it (decision 044): an --appbar-h row,
            top-left, at the section inset. It is the only href="/" here.
          */}
          <RuledSection as="header" rule={false} pad="none">
            <div mix={brandRowStyle}>
              <Logo brand={APP_NAME} href={routes.home.href()} variant="app" />
            </div>
          </RuledSection>
          {/* One block with the brand row (decision 050): its rule closes the row. */}
          <RuledSection as="div" rule={false} pad="none" mix={bodyStyle}>
            <div mix={cellsStyle}>
              <BrainPane />
              <main id="main" tabIndex={-1} mix={[skipTargetStyle, formPaneStyle]}>
                <div mix={columnStyle}>
                  <SegmentedTabs
                    label="Account"
                    flavour="account"
                    keepPlace
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
                    <a href={lessonOneHref()} data-rmx-prefetch={prefetchFor(lessonOneHref())} mix={exploreLinkStyle}>
                      Just exploring? Start lesson 1 without an account →
                    </a>
                    <p mix={legalStyle}>
                      By continuing you agree to the <a href={routes.legal.terms.href()} data-rmx-prefetch={prefetchFor(routes.legal.terms.href())}>Terms</a> and{' '}
                      <a href={routes.legal.privacy.href()} data-rmx-prefetch={prefetchFor(routes.legal.privacy.href())}>Privacy Policy</a>.
                    </p>
                  </footer>
                </div>
              </main>
            </div>
          </RuledSection>
        </PageFrame>
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
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  '&:focus': { top: 'var(--space-4)' },
})

const rootStyle = css({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
})

// The band (and its body box) grows to the foot of the screen, so the two
// cells and the rails end together.
const bodyStyle = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  '& > div:last-child': { flex: 1, display: 'flex', flexDirection: 'column' },
})

// Two cells sharing one hairline: side by side from 1040px, stacked below.
const cellsStyle = css({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
  '@media (max-width: 1039px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

// The skip link's target takes focus (tabIndex -1) without drawing a ring round the pane (decision 031).
const skipTargetStyle = css({ '&:focus': { outline: 'none' } })
// The column hangs from a fixed top instead of being centred: sign-up is
// ~240px taller than sign-in, so a centred column moved the tabs (and
// everything under them) by half that on every switch (decision 044).
const formPaneStyle = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 'clamp(var(--space-12), 10vh, var(--space-24)) var(--section-pad-x) var(--space-12)',
  // Stacked under the brain pane (760–1039px): a fixed gap below it.
  '@media (max-width: 1039px)': { paddingTop: 'var(--space-12)' },
  // resolutions §8: below 760px the form comes first, under the logo row,
  // and the brain pane follows it.
  '@media (max-width: 759px)': { order: -1, padding: 'var(--space-8) var(--section-pad-x)' },
})

const columnStyle = css({
  width: '100%',
  maxWidth: 'var(--form-width)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6_5)',
  '@media (max-width: 759px)': { maxWidth: '100%' },
})

const brandRowStyle = css({
  boxSizing: 'border-box',
  height: 'var(--appbar-h)',
  padding: '0 var(--section-pad-x)',
  display: 'flex',
  alignItems: 'center',
})

const footerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  paddingTop: 'var(--space-5)',
  borderTop: 'var(--border-w) solid var(--line-cell)',
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
