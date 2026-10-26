import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Document } from '@bits/ui/document'
import { StreakPill } from '@bits/ui/streak-pill'
import { XpPill } from '@bits/ui/xp-pill'

import { platform } from '#platform'

import { APP_NAME, pageTitle } from '../../../config.ts'
import type { Viewer } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'

export interface SettingsShellProps {
  title: string
  viewer: Viewer
  children?: RemixNode
}

/**
 * The signed-in app frame for Settings (Settings spec, layout): sticky glass
 * `app` AppBar with Courses · My learning · Write a course and the XP,
 * streak and avatar pills. No nav item is current; the page is reached from
 * Profile. Replace with the shared Layout once it has a signed-in variant.
 */
export function SettingsShell(handle: Handle<SettingsShellProps>) {
  return () => {
    let { title, viewer, children } = handle.props
    return (
      <Document
        assets={platform.assets}
        title={pageTitle(title)}
        description="Your sign-in, your profile, your data."
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        <AppBar
          brand={APP_NAME}
          homeHref={routes.home.href()}
          variant="app"
          position="sticky"
          links={[
            { href: routes.courses.index.href(), label: 'Courses' },
            { href: routes.me.index.href(), label: 'My learning' },
            { href: routes.author.index.href(), label: 'Write a course' },
          ]}
          actions={
            <>
              <XpPill neurons={viewer.xp} />
              <StreakPill days={viewer.streak} />
              <AvatarButton initials={viewer.initials} href={routes.me.index.href()} label="Your profile" />
            </>
          }
        />
        <main id="main">{children}</main>
      </Document>
    )
  }
}

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
