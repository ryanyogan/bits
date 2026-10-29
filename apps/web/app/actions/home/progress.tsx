import { css, type Handle } from 'remix/component'
import { CellGrid, cellInkStyle, cellVeilStyle } from '@bits/ui/cell-grid'
import { BadgeChip } from '@bits/ui/hex-badge'
import { Keycap } from '@bits/ui/keycap'
import { ProgressRing } from '@bits/ui/progress-ring'
import { RuledSection } from '@bits/ui/ruled-section'
import { StatTile } from '@bits/ui/stat-tile'

import { profileHref } from './links.ts'
import { h2Style, introStyle, leadStyle, PHONE } from './styles.ts'

// Sample data on a marketing page: never personalised (Main.md §6).
const badges = [
  { name: 'First token', color: 'var(--volt)' },
  { name: 'Temperature tamer', color: 'var(--ion)' },
  { name: 'Few-shot', color: 'var(--synapse)' },
  { name: 'Streak ×7', color: 'var(--volt-soft)' },
  { name: 'Tool wielder', color: 'var(--code-gutter-faint)' },
]

/**
 * "Progress" (Main.md §6): the copy and a ProgressShowcase (components §12.5)
 * in two cells. The copy sits on the veil, over the field's galaxy; the
 * showcase keeps the ink slab (decision 048).
 */
export function Progress(_handle: Handle) {
  return () => (
    <RuledSection aria-labelledby="you-title" label="Progress" pad="none">
      <CellGrid cols={2} pad={false} top={false}>
        <div mix={[cellVeilStyle, copyCell]}>
          <div mix={introStyle}>
            <h2 id="you-title" mix={h2Style}>
              Progress you can feel.
            </h2>
            <p mix={leadStyle}>
              Sign in once and every prompt you write, every lesson you finish and every badge you
              earn follows you to any device. No card to start.
            </p>
          </div>
          <div>
            <Keycap variant="dark" href={profileHref()} mix={profileKey}>
              See your profile
            </Keycap>
          </div>
        </div>
        <div mix={[cellInkStyle, showcase]}>
          <div mix={ringRow}>
            <ProgressRing
              pct={62}
              size={132}
              color="var(--volt)"
              caption="CONTEXT"
              label="Context window 62 percent full"
              mix={ringStyle}
            />
            <div mix={ringText}>
              <span mix={ringEyebrow}>Your context window</span>
              <span mix={ringTitle}>Foundations track, 5 of 8 lessons</span>
              <span mix={ringNext}>Up next: Temperature &amp; randomness</span>
            </div>
          </div>
          <CellGrid cols={3} colsMid={3} colsPhone={3} edge="boxed" pad={false}>
            <StatTile variant="main" value={<span mix={statValue}>12</span>} label="day streak" color="var(--volt)" mix={statStyle} />
            <StatTile variant="main" value={<span mix={statValue}>1,240</span>} label="neurons earned" color="var(--ion)" mix={statStyle} />
            <StatTile variant="main" value={<span mix={statValue}>37</span>} label="prompts written" color="var(--text)" mix={statStyle} />
          </CellGrid>
          <ul aria-label="Badges" mix={badgeRow}>
            {badges.map((b) => (
              <li key={b.name} mix={badgeItem}>
                <BadgeChip name={b.name} color={b.color} />
              </li>
            ))}
          </ul>
        </div>
      </CellGrid>
    </RuledSection>
  )
}

const copyCell = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-8)',
  padding: 'var(--section-pad-y) var(--cell-pad-lg)',
  [PHONE]: { padding: 'var(--space-12) var(--section-pad-x)' },
})
const showcase = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-6)',
  padding: 'var(--cell-pad-lg)',
})
const ringRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' })
const ringStyle = css({ [PHONE]: { width: '112px', height: '112px' } })
const ringText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)', flex: 1, minWidth: '200px' })
const ringEyebrow = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const ringTitle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-22)',
  lineHeight: 1.2,
})
const ringNext = css({ fontSize: 'var(--fs-15)', color: 'var(--muted)' })
// The tiles are cells of a boxed grid: no fill of their own.
const statStyle = css({ background: 'transparent', [PHONE]: { paddingLeft: 'var(--space-2_5)', paddingRight: 'var(--space-2_5)' } })
const statValue = css({ [PHONE]: { fontSize: 'var(--fs-20)' } })
const badgeRow = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' })
const badgeItem = css({ display: 'flex' })
const profileKey = css({ minHeight: 'var(--space-12)', padding: '0 var(--space-5)', gap: 'var(--space-2_5)' })
