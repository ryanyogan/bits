import { css, type Handle } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'
import { BadgeChip } from '@bits/ui/hex-badge'
import { Keycap } from '@bits/ui/keycap'
import { ProgressRing } from '@bits/ui/progress-ring'
import { StatTile } from '@bits/ui/stat-tile'

import { sampleProfileHref } from './links.ts'
import { h2Style, leadStyle, PHONE, sectionStyle, splitGrid } from './styles.ts'

// Sample data on a marketing page: never personalised (Main.md §6).
const badges = [
  { name: 'First token', color: 'var(--volt)' },
  { name: 'Temperature tamer', color: 'var(--ion)' },
  { name: 'Few-shot', color: 'var(--synapse)' },
  { name: 'Streak ×7', color: 'var(--volt-soft)' },
  { name: 'Tool wielder', color: 'var(--code-gutter-faint)' },
]

/** "04 — You" (Main.md §6): ProgressShowcase (components §12.5) + copy. */
export function Progress(_handle: Handle) {
  return () => (
    <section aria-labelledby="you-title" mix={sectionStyle}>
      <div mix={splitGrid('480px')}>
        <div mix={showcase}>
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
          <div mix={stats}>
            <StatTile variant="main" value={<span mix={statValue}>12</span>} label="day streak" color="var(--volt)" mix={statStyle} />
            <StatTile variant="main" value={<span mix={statValue}>1,240</span>} label="neurons earned" color="var(--ion)" mix={statStyle} />
            <StatTile variant="main" value={<span mix={statValue}>37</span>} label="prompts written" color="var(--text)" mix={statStyle} />
          </div>
          <ul aria-label="Badges" mix={badgeRow}>
            {badges.map((b) => (
              <li key={b.name} mix={badgeItem}>
                <BadgeChip name={b.name} color={b.color} />
              </li>
            ))}
          </ul>
        </div>
        <div mix={copyColumn}>
          <Eyebrow tone="volt" as="p">
            04 — You
          </Eyebrow>
          <h2 id="you-title" mix={h2Style}>
            Progress you can feel.
          </h2>
          <p mix={leadStyle}>
            Sign in once and every prompt you write, every lesson you finish and every badge you
            earn follows you to any device. Free — no card, no trial, no catch.
          </p>
          <div>
            <Keycap variant="dark" href={sampleProfileHref()} mix={profileKey}>
              See a profile →
            </Keycap>
          </div>
        </div>
      </div>
    </section>
  )
}

const showcase = css({
  padding: 'var(--space-7)',
  borderRadius: 'var(--radius-24)',
  background: 'var(--glass-82)',
  WebkitBackdropFilter: 'blur(var(--blur-prompt))',
  backdropFilter: 'blur(var(--blur-prompt))',
  border: '1px solid var(--line-panel)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
  boxShadow: '0 40px 120px var(--shadow-a50)',
  minWidth: 0,
  [PHONE]: { padding: 'var(--space-5)' },
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
const stats = css({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2_5)' })
const statStyle = css({ minWidth: 0, [PHONE]: { paddingLeft: 'var(--space-2)', paddingRight: 'var(--space-2)' } })
const statValue = css({ [PHONE]: { fontSize: 'var(--fs-20)' } })
const badgeRow = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const badgeItem = css({ display: 'flex' })
const copyColumn = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' })
const profileKey = css({ minHeight: '48px', padding: '0 var(--space-5)', gap: 'var(--space-2_5)' })
