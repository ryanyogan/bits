import { css, type Handle } from 'remix/component'
import { CellGrid, cellLinkStyle } from '@bits/ui/cell-grid'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { RuledSection } from '@bits/ui/ruled-section'
import { Tag } from '@bits/ui/tag'

import { trackHref } from './links.ts'
import { cardDesc, cardTitle, cellLabel, FORCED, h2Style, introStyle, leadStyle, REDUCED } from './styles.ts'

type TrackKey = 'foundations' | 'prompting' | 'tools' | 'agents'

/**
 * A course row in a track (decision 048): the same `access` / `owned` shape
 * as `CourseCard`. Every course is free today; a pro row shows a `Pro` tag,
 * and an owned one shows none. Nothing is gated.
 */
export interface PathCourse {
  title: string
  access: 'free' | 'pro'
  owned?: boolean
}

const free = (title: string): PathCourse => ({ title, access: 'free' })

const tracks: {
  key: TrackKey
  n: string
  track: string
  title: string
  desc: string
  color: string
  courses: PathCourse[]
}[] = [
  { key: 'foundations', n: '01', track: 'Foundations', title: 'How LLMs think', desc: 'Tokens, next-word prediction, temperature and the context window — no math degree required.', color: 'var(--volt)', courses: [free('What is an LLM, really?'), free('Tokens & temperature')] },
  { key: 'prompting', n: '02', track: 'Prompting', title: 'Talk like you mean it', desc: 'Roles, examples, structure and how to tell if a prompt actually got better.', color: 'var(--ion)', courses: [free('Prompting that works'), free('Context is everything')] },
  { key: 'tools', n: '03', track: 'Tools & context', title: 'Give the model hands', desc: 'Tool calls, retrieval and memory — the pieces every agent is built from.', color: 'var(--synapse)', courses: [free('Give your model tools'), free('Retrieval without tears')] },
  { key: 'agents', n: '04', track: 'Agents', title: 'Close the loop', desc: 'Plan, act, observe, repeat. Then ship your agent to the edge.', color: 'var(--volt)', courses: [free('Your first agent loop'), free('Ship an agent to the edge')] },
]

/**
 * "The path" (Main.md §4): four tracks in a row of linked cells. A volt
 * trace draws along the row's top edge as it scrolls in: the path, in order.
 * Each course row says whether it is free or pro (decision 048). The strip
 * gets its "N courses · M free" aside once the rows come from the catalog.
 */
export function ThePath(_handle: Handle) {
  return () => (
    <RuledSection id="path" aria-labelledby="path-title" label="The path" pad="none" mix={timeline}>
      <div mix={introCell}>
        <div mix={introStyle}>
          <h2 id="path-title" mix={h2Style}>
            From one prompt to a team of agents.
          </h2>
          <p mix={leadStyle}>
            Four tracks, each one building on the last. The foundations are free; go deeper with the
            pro courses when you're ready.
          </p>
        </div>
      </div>
      <div mix={trackWrap}>
        <div aria-hidden="true" mix={traceStyle} />
        <CellGrid as="ol" cols={4} fill="ink">
          {tracks.map((t) => (
            <li key={t.key} mix={itemStyle}>
              <a
                href={trackHref(t.key)}
                style={{ '--track': t.color }}
                data-rmx-prefetch={prefetchFor(trackHref(t.key))}
                mix={[cellLinkStyle, cardLink]}
              >
                <span mix={topRow}>
                  <span aria-hidden="true" mix={numberStyle}>
                    {t.n}
                  </span>
                  <span mix={[cellLabel, trackName]}>{t.track}</span>
                </span>
                <h3 mix={cardTitle}>{t.title}</h3>
                <span mix={cardDesc}>{t.desc}</span>
                <span mix={coursesStyle}>
                  {t.courses.map((c) => (
                    <span key={c.title} mix={courseRow}>
                      <span aria-hidden="true" mix={dotStyle} />
                      <span mix={courseTitle}>{c.title}</span>
                      <PathCourseTag course={c} />
                    </span>
                  ))}
                </span>
              </a>
            </li>
          ))}
        </CellGrid>
      </div>
    </RuledSection>
  )
}

/** `Free` or `Pro`; nothing for a pro course the viewer owns. */
export function PathCourseTag(handle: Handle<{ course: PathCourse }>) {
  return () => {
    let { access, owned } = handle.props.course
    if (access === 'pro' && owned) return null
    return <Tag variant={access}>{access === 'pro' ? 'Pro' : 'Free'}</Tag>
  }
}

// Names the view timeline the header's "The path" link follows (decision 040).
const timeline = css({ viewTimelineName: '--path' })

const introCell = css({ padding: 'var(--section-pad-y) var(--cell-pad-lg) calc(var(--section-pad-y) / 2)' })

const trackWrap = css({ position: 'relative' })

// The trace sits on the row's top border and draws itself left to right as
// the cells scroll into view: tied to the reader's scroll, never
// autonomous (decision 040). Without view timelines it is simply drawn.
const traceStyle = css({
  position: 'absolute',
  zIndex: 1,
  left: 0,
  right: 0,
  top: 0,
  height: 'var(--border-w)',
  background: 'var(--volt-a60)',
  transformOrigin: 'left',
  '@supports (animation-timeline: view())': {
    animation: 'landing-trace linear both',
    animationTimeline: 'view()',
    animationRange: 'entry 10% cover 45%',
  },
  [REDUCED]: { animation: 'none' },
  [FORCED]: { display: 'none' },
})

const itemStyle = css({ display: 'flex' })

// The cell lights its top edge in the track's colour on hover and focus.
const cardLink = css({
  gap: 'var(--space-4)',
  minHeight: 'var(--track-cell-min)',
  boxShadow: 'inset 0 0 0 0 transparent',
  transition: 'background-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease)',
  '&:hover, &:focus-visible': { boxShadow: 'inset 0 var(--border-w-strong) 0 var(--track)' },
  '@media (max-width: 759.98px)': { minHeight: 'auto' },
  [REDUCED]: { transition: 'none' },
})

const topRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' })

// The track's number: a square tile with a hairline in the track colour.
const numberStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: 'var(--control-compact)',
  height: 'var(--control-compact)',
  border: 'var(--border-w) solid var(--track)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  fontWeight: 500,
  color: 'var(--track)',
  [FORCED]: { borderColor: 'CanvasText' },
})
const trackName = css({ color: 'var(--track)' })
const coursesStyle = css({
  marginTop: 'auto',
  paddingTop: 'var(--space-4)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1_5)',
})
const courseRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text-body)',
})
// The title takes the room; the tag sits at the row's end.
const courseTitle = css({ flex: 1, minWidth: 0 })
const dotStyle = css({ flex: 'none', width: '5px', height: '5px', background: 'var(--track)' })
