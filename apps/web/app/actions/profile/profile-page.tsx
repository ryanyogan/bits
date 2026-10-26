import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { ActivityGrid } from '@bits/ui/activity-grid'
import { Card } from '@bits/ui/card'
import { EmptyState } from '@bits/ui/empty-state'
import { BadgeTile, badgeGridStyle } from '@bits/ui/hex-badge'
import { MonoHeading } from '@bits/ui/eyebrow'
import { Keycap } from '@bits/ui/keycap'
import { KeyValueList } from '@bits/ui/key-value-list'
import { ProgressBar } from '@bits/ui/progress-bar'
import { StatTile } from '@bits/ui/stat-tile'

import type { Viewer } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { activityTitles, RECENT_JOURNAL, type Profile } from './data.ts'
import { ShareButton } from './public/share-button.tsx'
import { GeneratedAvatar } from './ui/generated-avatar.tsx'
import { CourseRow } from './ui/course-row.tsx'
import { JournalList } from './ui/journal-entry.tsx'

export interface ProfilePageProps {
  profile: Profile
  /** `own` is /me (private dashboard); `public` is /u/:handle. */
  variant: 'own' | 'public'
  /** /me?tab=journal shows the full prompt journal in the main column. */
  tab?: 'overview' | 'journal'
  /** Absolute URL of the public profile, for Share. */
  shareUrl: string
  viewer: Viewer | null
  currentPath: string
  title: string
}

/**
 * Profile (docs/design/spec/pages/Profile.md): identity band, then stats,
 * activity, courses and the prompt journal beside badges and the account
 * card. The public variant drops Edit, the journal, the account card and the
 * email. Server-rendered; Share is the only island.
 */
export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    let { profile, variant, tab = 'overview', shareUrl, viewer, currentPath, title } = handle.props
    let own = variant === 'own'
    let earned = profile.badges.filter((b) => b.earned).length
    let activeDays = profile.activity.filter((level) => level > 0).length
    let journalHref = routes.me.index.href(undefined, { searchParams: { tab: 'journal' } })
    let showJournal = own && tab === 'journal'

    return (
      <Layout title={title} viewer={viewer} currentPath={currentPath} bleed>
        <section aria-label="Profile" mix={bandStyle}>
          <div mix={bandInner}>
            <GeneratedAvatar seed={profile.handle} name={profile.name.split(' ')[0]!} />
            <div mix={identityStyle}>
              <span mix={levelStyle}>
                LEVEL {profile.level} · {profile.levelName.toUpperCase()}
              </span>
              <h1 mix={nameStyle}>{profile.name}</h1>
              <p mix={handleStyle}>
                @{profile.handle} · learning since {profile.since}
                {profile.goal ? <> · wants to “{profile.goal}”</> : null}
              </p>
              <div mix={levelRow}>
                <ProgressBar
                  pct={profile.levelPct}
                  variant="level"
                  label={`Level ${profile.level}: ${profile.levelPct}% of the way to level ${profile.level + 1}`}
                  mix={levelBar}
                />
                <span mix={levelNext}>
                  {profile.toNextLevel} to level {profile.level + 1}
                </span>
              </div>
            </div>
            <div mix={actionsStyle}>
              {own ? (
                <Keycap variant="ghost-mono" href={routes.settings.index.href()} mix={editStyle}>
                  Edit profile
                </Keycap>
              ) : null}
              <ShareButton url={shareUrl} title={`${profile.name} on bits`} grow={own} />
            </div>
          </div>
        </section>

        <div mix={bodyStyle}>
          <div mix={mainColumn}>
            {showJournal ? (
              <section aria-labelledby="journal-heading" mix={sectionStyle}>
                <div mix={sectionHeader}>
                  <MonoHeading id="journal-heading">PROMPT JOURNAL · {profile.journal.length} PROMPTS</MonoHeading>
                  <a href={routes.me.index.href()} mix={headerLink}>
                    ← Overview
                  </a>
                </div>
                <JournalList entries={profile.journal} />
              </section>
            ) : (
              <>
                <section aria-label="Stats" mix={statsGrid}>
                  <StatTile value={profile.neurons.toLocaleString('en-US')} label="neurons" color="var(--volt)" mix={statMix} />
                  <StatTile value={profile.streak} label={`day streak · best ${profile.bestStreak}`} color="var(--ion)" mix={statMix} />
                  <StatTile value={profile.lessonsFinished} label="lessons finished" mix={statMix} />
                  <StatTile value={profile.promptsWritten} label="prompts written" mix={statMix} />
                </section>

                <ActivityGrid
                  levels={profile.activity}
                  headingLevel={2}
                  titles={activityTitles(profile.activity)}
                  label={`Activity heatmap: active ${activeDays} of the last 182 days, most days in the last two weeks; current streak ${profile.streak} days`}
                />

                <section aria-labelledby="courses-heading" mix={sectionStyle}>
                  <MonoHeading id="courses-heading">COURSES</MonoHeading>
                  {profile.courses.length ? (
                    <ul mix={listStyle}>
                      {profile.courses.map((course) => (
                        <li key={course.slug}>
                          <CourseRow course={course} own={own} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyCourses />
                  )}
                </section>

                {own ? (
                  <section aria-labelledby="journal-heading" mix={sectionStyle}>
                    <div mix={sectionHeader}>
                      <MonoHeading id="journal-heading">PROMPT JOURNAL</MonoHeading>
                      <a href={journalHref} mix={headerLink} aria-label={`All ${profile.journal.length} journal entries`}>
                        All {profile.journal.length} →
                      </a>
                    </div>
                    <JournalList entries={profile.journal.slice(0, RECENT_JOURNAL)} />
                  </section>
                ) : null}
              </>
            )}
          </div>

          <aside aria-label={own ? 'Badges and account' : 'Badges'} mix={asideStyle}>
            <Card variant="compact" as="section" labelledBy="badges-heading" mix={badgesCard}>
              <MonoHeading id="badges-heading">
                BADGES · {earned} OF {profile.badges.length}
              </MonoHeading>
              <ul mix={badgeGridStyle}>
                {profile.badges.map((badge) => (
                  <BadgeTile key={badge.name} name={badge.name} glyph={badge.glyph} color={badge.color} locked={!badge.earned} />
                ))}
              </ul>
            </Card>

            {own ? (
              <Card variant="compact" as="section" labelledBy="account-heading">
                <MonoHeading id="account-heading">ACCOUNT</MonoHeading>
                <KeyValueList
                  items={[
                    { term: 'Email', value: profile.email, mono: true },
                    { term: 'Sign-in', value: profile.signIn },
                    { term: 'Profile', value: profile.isPublic ? 'Public' : 'Private' },
                  ]}
                />
                <div mix={accountLinks}>
                  <a href={`${routes.settings.index.href()}#export`} mix={accountLink}>
                    Download my data
                  </a>
                  <a href={routes.settings.index.href()} mix={[accountLink, quietLink]}>
                    Settings →
                  </a>
                  <form method="post" action={routes.logout.action.href()} mix={signOutForm}>
                    <button type="submit" mix={[accountLink, quietLink, signOutButton]}>
                      Sign out
                    </button>
                  </form>
                </div>
              </Card>
            ) : null}
          </aside>
        </div>
      </Layout>
    )
  }
}

function EmptyCourses() {
  return () => (
    <EmptyState title="No courses yet." action={<Keycap href={routes.courses.index.href()}>Browse courses →</Keycap>} />
  )
}

const MOBILE = '@media (max-width: 480px)'

const bandStyle = css({
  borderBottom: '1px solid var(--line-bar)',
  backgroundImage: 'radial-gradient(var(--dot-grid) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
})
const bandInner = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-12)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-9)',
  alignItems: 'center',
  [MOBILE]: { padding: 'var(--space-8) var(--space-4)', gap: 'var(--space-5)' },
})
const identityStyle = css({ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const levelStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--volt)' })
// Type role `display-profile` (tokens.md): Unbounded 800, clamp(36px, 4.6vw, 60px), lh 1, -0.04em.
const nameStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 4.6vw, 60px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
  overflowWrap: 'anywhere',
})
const handleStyle = css({ margin: 0, fontSize: 'var(--fs-16)', lineHeight: 1.5, color: 'var(--muted)' })
const levelRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  maxWidth: '420px',
  paddingTop: 'var(--space-1_5)',
  [MOBILE]: { maxWidth: 'none' },
})
const levelBar = css({ flex: 1 })
const levelNext = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)', whiteSpace: 'nowrap' })
const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  [MOBILE]: { width: '100%', flexWrap: 'nowrap' },
})
// Profile draws "Edit profile" at 16px side padding and radius 12 (spec §2.3).
const editStyle = css({
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-12)',
  [MOBILE]: { flex: '1 1 0' },
})

const bodyStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-10) var(--page-gutter) var(--space-24)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-8)',
  alignItems: 'flex-start',
  [MOBILE]: { padding: 'var(--space-6) var(--space-4) var(--space-16)', gap: 'var(--space-6)' },
})
const mainColumn = css({
  flex: '999 1 600px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
  [MOBILE]: { gap: 'var(--space-6)' },
})
const asideStyle = css({ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })

const statsGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
  gap: 'var(--space-3)',
  // At 360px two tiles share a row (each ≈158px), so 30px values shrink.
  '@media (max-width: 400px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})
const statMix = css({ [MOBILE]: { '& > span:first-child': { fontSize: '26px' /* Profile spec §Responsive: 30 → 26px at 360 */ } } })

const sectionStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)', minWidth: 0 })
const sectionHeader = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 'var(--space-3)',
})
const headerLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  margin: 'calc((var(--touch-target) - 1lh) / -2) 0',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})
const listStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })

const badgesCard = css({ gap: 'var(--space-4)' })

const accountLinks = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  paddingTop: 'var(--space-2)',
  borderTop: '1px solid var(--line-bar)',
})
// Drawn at 40px; raised to the 44px touch target (spec a11y).
const accountLink = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  fontSize: 'var(--fs-14)',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})
const quietLink = css({ color: 'var(--muted)', '&:hover': { color: 'var(--text)' } })
const signOutForm = css({ margin: 0, display: 'flex' })
const signOutButton = css({
  width: '100%',
  padding: 0,
  border: 0,
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
})
