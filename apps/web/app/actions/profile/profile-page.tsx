import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { ActivityGrid } from '@bits/ui/activity-grid'
import { CellGrid } from '@bits/ui/cell-grid'
import { EmptyState } from '@bits/ui/empty-state'
import { BadgeTile } from '@bits/ui/hex-badge'
import { Keycap } from '@bits/ui/keycap'
import { KeyValueList } from '@bits/ui/key-value-list'
import { PageFrame } from '@bits/ui/page-frame'
import { ProgressBar } from '@bits/ui/progress-bar'
import { RuledSection } from '@bits/ui/ruled-section'
import { StatTile } from '@bits/ui/stat-tile'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { busyCaret } from '../../ui/busy-caret.ts'
import { Layout } from '../../ui/layout.tsx'
import { activityTitles, RECENT_JOURNAL, type Profile } from './data.ts'
import { ShareButton } from './public/share-button.tsx'
import { CourseRow } from './ui/course-row.tsx'
import { GeneratedAvatar } from './ui/generated-avatar.tsx'
import { JournalList } from './ui/journal-entry.tsx'
import { Panel, panelLinkStyle, panelListStyle } from '@bits/ui/panel'

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
 * Profile (docs/design/spec/pages/Profile.md) on the squared grid (decision
 * 047). One `PageFrame`, ruled into bands that share a 3:1 column line:
 *
 * 1. identity (avatar, name, handle) | level and actions;
 * 2. the four stats, a flush row of cells (the column line falls on a cell
 *    border);
 * 3. activity, courses and the prompt journal | badges and the account.
 *
 * The public variant drops Edit, the journal, the account panel and the
 * email. Server-rendered; Share is the only island. No region refreshes on
 * its own (the data comes in the session's one D1 batch, decision 035), so
 * there's no `<Frame>`: a frame would add a request and a round trip.
 */
export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    let { profile, variant, tab = 'overview', shareUrl, viewer, currentPath, title } = handle.props
    let own = variant === 'own'
    let earned = profile.badges.filter((b) => b.earned).length
    let activeDays = profile.activity.filter((level) => level > 0).length
    let journalHref = routes.me.index.href(undefined, { searchParams: { tab: 'journal' } })
    let settingsHref = routes.settings.index.href()
    let showJournal = own && tab === 'journal'
    let firstName = profile.name.split(' ')[0]!

    return (
      <Layout
        title={title}
        viewer={viewer}
        currentPath={currentPath}
        canonicalPath={own ? undefined : routes.profile.index.href({ handle: profile.handle })}
        bleed
      >
        <PageFrame>
          <RuledSection aria-label="Profile" rule={false} pad="none">
            <div mix={splitStyle}>
              <div mix={identityCell}>
                <GeneratedAvatar seed={profile.handle} name={firstName} />
                <div mix={identityText}>
                  <p mix={handleStyle}>@{profile.handle}</p>
                  <h1 mix={nameStyle}>{profile.name}</h1>
                  <p mix={sinceStyle}>
                    Learning since {profile.since}
                    {profile.goal ? <> · wants to “{profile.goal}”</> : null}
                  </p>
                </div>
              </div>
              <div mix={levelCell}>
                <div mix={levelBlock}>
                  <p mix={levelLabel}>
                    <span mix={levelNumber}>Level {profile.level}</span>
                    <span aria-hidden="true" mix={levelDot}>
                      {' · '}
                    </span>
                    {profile.levelName}
                  </p>
                  <ProgressBar
                    pct={profile.levelPct}
                    variant="level"
                    label={`Level ${profile.level}: ${profile.levelPct}% of the way to level ${profile.level + 1}`}
                    mix={levelBar}
                  />
                  <p mix={levelNext}>
                    {profile.toNextLevel.toLocaleString('en-US')} neurons to level {profile.level + 1}
                  </p>
                </div>
                <div mix={actionsStyle}>
                  {own ? (
                    <Keycap variant="ghost-mono" href={settingsHref} mix={actionKey}>
                      Edit profile
                    </Keycap>
                  ) : null}
                  <ShareButton url={shareUrl} title={`${profile.name} on bits`} />
                </div>
              </div>
            </div>
          </RuledSection>

          <RuledSection aria-label="Stats" pad="none">
            <CellGrid cols={4} colsMid={4} colsPhone={2} pad={false} mix={statsGrid}>
              <StatTile value={profile.neurons.toLocaleString('en-US')} label="neurons" color="var(--volt)" />
              <StatTile value={profile.streak} label={`day streak · best ${profile.bestStreak}`} color="var(--ion)" />
              <StatTile value={profile.lessonsFinished} label="lessons finished" color="var(--synapse)" />
              <StatTile value={profile.promptsWritten} label="prompts written" color="var(--muted)" />
            </CellGrid>
          </RuledSection>

          <RuledSection as="div" pad="none">
            <div mix={splitStyle}>
              <div mix={columnStyle}>
                {showJournal ? (
                  <Panel
                    id="journal-heading"
                    title={`Prompt journal · ${profile.journal.length} prompts`}
                    aside={
                      <a href={routes.me.index.href()} data-rmx-prefetch={prefetchFor(routes.me.index.href())} mix={panelLinkStyle}>
                        ← Overview
                      </a>
                    }
                    flush
                  >
                    <JournalList entries={profile.journal} />
                  </Panel>
                ) : (
                  <>
                    <Panel id="activity-heading" title="Activity" aside="Last 26 weeks">
                      <ActivityGrid
                        variant="bare"
                        levels={profile.activity}
                        end={profile.activityEnd}
                        titles={activityTitles(profile.activity, profile.activityEnd)}
                        label={`Activity heatmap: active ${activeDays} of the last 182 days; current streak ${profile.streak} ${profile.streak === 1 ? 'day' : 'days'}`}
                        caption={`Active ${activeDays} of 182 days · best streak ${profile.bestStreak}`}
                      />
                    </Panel>

                    <Panel
                      id="courses-heading"
                      title="Courses"
                      aside={profile.courses.length ? `${profile.courses.length} started` : undefined}
                      flush={profile.courses.length > 0}
                    >
                      {profile.courses.length ? (
                        <ul mix={panelListStyle}>
                          {profile.courses.map((course) => (
                            <li key={course.slug}>
                              <CourseRow course={course} own={own} handle={profile.handle} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyCourses />
                      )}
                    </Panel>

                    {own ? (
                      <Panel
                        id="journal-heading"
                        title="Prompt journal"
                        aside={
                          <a
                            href={journalHref}
                            data-rmx-prefetch={prefetchFor(journalHref)}
                            mix={panelLinkStyle}
                            aria-label={`All ${profile.journal.length} journal entries`}
                          >
                            All {profile.journal.length} →
                          </a>
                        }
                        flush
                      >
                        <JournalList entries={profile.journal.slice(0, RECENT_JOURNAL)} />
                      </Panel>
                    ) : null}
                  </>
                )}
              </div>

              <aside aria-label={own ? 'Badges and account' : 'Badges'} mix={columnStyle}>
                <Panel id="badges-heading" title="Badges" aside={`${earned} of ${profile.badges.length}`} flush>
                  <CellGrid as="ul" cols={3} colsMid={4} colsPhone={3} pad={false} top={false} aria-labelledby="badges-heading">
                    {profile.badges.map((badge) => (
                      <BadgeTile key={badge.name} name={badge.name} glyph={badge.glyph} color={badge.color} locked={!badge.earned} />
                    ))}
                  </CellGrid>
                </Panel>

                {own ? (
                  <Panel id="account-heading" title="Account">
                    <KeyValueList
                      items={[
                        { term: 'Email', value: profile.email, mono: true },
                        { term: 'Sign-in', value: profile.signIn },
                        { term: 'Profile', value: profile.isPublic ? 'Public' : 'Private' },
                      ]}
                    />
                    <div mix={accountLinks}>
                      <a href={`${settingsHref}#export`} data-rmx-prefetch={prefetchFor(`${settingsHref}#export`)} mix={accountLink}>
                        Download my data
                      </a>
                      <a href={settingsHref} data-rmx-prefetch={prefetchFor(settingsHref)} mix={[accountLink, quietLink]}>
                        Settings →
                      </a>
                      <form method="post" action={routes.logout.action.href()} mix={signOutForm}>
                        <button type="submit" mix={[accountLink, quietLink, signOutButton, busyCaret]}>
                          Sign out
                        </button>
                      </form>
                    </div>
                  </Panel>
                ) : null}
              </aside>
            </div>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

function EmptyCourses() {
  return () => (
    <EmptyState title="No courses yet." action={<Keycap href={routes.courses.index.href()}>Browse courses →</Keycap>} />
  )
}

const WIDE = '@media (min-width: 1024px)'
const NARROW = '@media (max-width: 1023.98px)'
const MID = '@media (min-width: 760px) and (max-width: 1023.98px)'
const MOBILE = '@media (max-width: 480px)'
const FORCED = '@media (forced-colors: active)'
const line = 'var(--border-w) solid var(--line-cell)'


// Two columns at 3:1 from 1024px, so the column line falls on the border
// between the third and fourth stat cells; stacked below that.
const splitStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  [WIDE]: {
    gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)',
    '& > :first-child': { borderRight: line },
  },
  [NARROW]: { '& > * + *': { borderTop: line } },
  [FORCED]: { '& > *': { borderColor: 'GrayText' } },
})
const columnStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column' })

// The section's rule already draws the line above the first row of stats.
const statsGrid = css({
  [WIDE]: { '& > :nth-child(-n + 4)': { borderTop: 0 } },
  [MID]: { '& > :nth-child(-n + 4)': { borderTop: 0 } },
  '@media (max-width: 759.98px)': { '& > :nth-child(-n + 2)': { borderTop: 0 } },
})

// Graph paper under the identity, the landing field's grid at half its step.
const identityCell = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-8)',
  minWidth: 0,
  padding: 'var(--space-14) var(--cell-pad) var(--space-12)',
  backgroundImage:
    'linear-gradient(var(--field-grid) var(--border-w), transparent var(--border-w)), linear-gradient(90deg, var(--field-grid) var(--border-w), transparent var(--border-w))',
  backgroundSize: 'calc(var(--field-grid-step) / 2) calc(var(--field-grid-step) / 2)',
  backgroundPosition: 'calc(var(--border-w) * -1) calc(var(--border-w) * -1)',
  [MOBILE]: { flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-5)', padding: 'var(--space-8) var(--cell-pad)' },
})
const identityText = css({ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const handleStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--volt)' })
// Type role `display-profile` (tokens.md): Unbounded 800, clamp(36px, 4.6vw, 60px), lh 1, -0.04em.
const nameStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 4.6vw, 60px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
  overflowWrap: 'anywhere',
  textWrap: 'balance',
  // Inside the rails a phone column is ~280px (decision 047, step 7).
  [MOBILE]: { fontSize: 'var(--fs-30)' },
})
const sinceStyle = css({ margin: 0, fontSize: 'var(--fs-16)', lineHeight: 1.5, color: 'var(--muted)' })

const levelCell = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 'var(--space-8)',
  minWidth: 0,
  padding: 'var(--space-8) var(--cell-pad)',
  [MOBILE]: { gap: 'var(--space-6)' },
})
const levelBlock = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const levelLabel = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text-quiet)' })
const levelNumber = css({ color: 'var(--volt)' })
const levelDot = css({ color: 'var(--dim)' })
const levelBar = css({ maxWidth: 'none' })
const levelNext = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  '& > *': { flex: '1 1 auto' },
})
const actionKey = css({ padding: '0 var(--space-4)' })

const accountLinks = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-2)',
  borderTop: line,
  [FORCED]: { borderColor: 'GrayText' },
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
