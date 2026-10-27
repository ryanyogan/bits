import { css, type Handle } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'

import { trackHref } from './links.ts'
import { cardDesc, cardTitle, h2Style, leadStyle, PHONE, prefetch, REDUCED, sectionStyle, stackSection } from './styles.ts'

type TrackKey = 'foundations' | 'prompting' | 'tools' | 'agents'

const tracks: {
  key: TrackKey
  n: string
  track: string
  title: string
  desc: string
  color: string
  ring: string
  courses: string[]
}[] = [
  { key: 'foundations', n: '01', track: 'Foundations', title: 'How LLMs think', desc: 'Tokens, next-word prediction, temperature and the context window — no math degree required.', color: 'var(--volt)', ring: 'var(--volt-a55)', courses: ['What is an LLM, really?', 'Tokens & temperature'] },
  { key: 'prompting', n: '02', track: 'Prompting', title: 'Talk like you mean it', desc: 'Roles, examples, structure and how to tell if a prompt actually got better.', color: 'var(--ion)', ring: 'var(--ion-a55)', courses: ['Prompting that works', 'Context is everything'] },
  { key: 'tools', n: '03', track: 'Tools & context', title: 'Give the model hands', desc: 'Tool calls, retrieval and memory — the pieces every agent is built from.', color: 'var(--synapse)', ring: 'var(--syn-a60)', courses: ['Give your model tools', 'Retrieval without tears'] },
  { key: 'agents', n: '04', track: 'Agents', title: 'Close the loop', desc: 'Plan, act, observe, repeat. Then ship your agent to the edge.', color: 'var(--volt)', ring: 'var(--volt-a55)', courses: ['Your first agent loop', 'Ship an agent to the edge'] },
]

/** "03 — The path" (Main.md §4): four TrackCards on a dashed trace. */
export function ThePath(_handle: Handle) {
  return () => (
    <section id="path" aria-labelledby="path-title" mix={[sectionStyle, stackSection, timeline]}>
      <div mix={introStyle}>
        <Eyebrow tone="synapse" as="p">
          03 — The path
        </Eyebrow>
        <h2 id="path-title" mix={h2Style}>
          From one prompt to a team of agents.
        </h2>
        <p mix={leadStyle}>
          Four tracks, each one building on the last. Start at the beginning or jump to wherever
          you're curious — every course is free.
        </p>
      </div>
      <div mix={trackWrap}>
        <div aria-hidden="true" mix={traceStyle} />
        <ol mix={gridStyle}>
          {tracks.map((t) => (
            <li key={t.key} mix={itemStyle}>
              <a href={trackHref(t.key)} style={{ '--track': t.color, '--ring': t.ring }} mix={[cardLink, prefetch]}>
                <span aria-hidden="true" mix={discStyle}>
                  {t.n}
                </span>
                <div mix={bodyStyle}>
                  <span mix={trackName}>{t.track}</span>
                  <h3 mix={[cardTitle, titleStyle]}>{t.title}</h3>
                  <span mix={cardDesc}>{t.desc}</span>
                  <div mix={coursesStyle}>
                    {t.courses.map((c) => (
                      <span key={c} mix={courseRow}>
                        <span aria-hidden="true" mix={dotStyle} />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// Names the view timeline the header's "The path" link follows (decision 040).
const timeline = css({ viewTimelineName: '--path' })

const introStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 'var(--read-width)' })
const trackWrap = css({ position: 'relative' })
const traceStyle = css({
  position: 'absolute',
  left: '36px',
  right: '36px',
  top: '35px',
  height: 0,
  borderTop: '1px dashed var(--volt-a40)',
  transformOrigin: 'left',
  // The trace draws itself left to right as the cards scroll into view:
  // tied to the reader's scroll, never autonomous (decision 040).
  '@supports (animation-timeline: view())': {
    animation: 'landing-trace linear both',
    animationTimeline: 'view()',
    animationRange: 'entry 10% cover 50%',
  },
  [REDUCED]: { animation: 'none' },
  '@media (max-width: 820px)': { display: 'none' },
})
const gridStyle = css({
  position: 'relative',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
  gap: 'var(--space-5)',
})
const itemStyle = css({ display: 'flex' })
const cardLink = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  color: 'var(--text)',
  textDecoration: 'none',
  borderRadius: 'var(--radius-xl)',
  transition: 'transform var(--duration-card) var(--ease)',
  '&:hover': { color: 'var(--text)', transform: 'translateY(-4px)', '--card-line': 'var(--volt-a35)' },
  '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
})
const discStyle = css({
  width: '72px',
  height: '72px',
  borderRadius: 'var(--radius-pill)',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--ink)',
  border: '1px solid var(--ring)',
  boxShadow: 'var(--ring-sigil)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-20)',
  color: 'var(--track)',
})
const bodyStyle = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--glass)',
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
  // The link sets --card-line on hover (each css() mixin is its own cascade
  // sublayer, so a descendant rule on the link would lose to this one).
  border: '1px solid var(--card-line, var(--line-glass))',
  minHeight: '260px',
  boxSizing: 'border-box',
  transition: 'border-color var(--duration-card) var(--ease)',
  [PHONE]: { minHeight: 'auto' },
})
const trackName = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  letterSpacing: 'var(--tracking-eyebrow-s)',
  textTransform: 'uppercase',
  color: 'var(--track)',
})
const titleStyle = css({ lineHeight: 1.15 })
const coursesStyle = css({ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)' })
const courseRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text-body)',
})
const dotStyle = css({ flex: 'none', width: '5px', height: '5px', borderRadius: '99px', background: 'var(--track)' })
