import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Icon } from './icon.tsx'
import { Ghost, stackStyle } from './lib/stable.tsx'
import { FORCED_COLORS, focusOutline } from './lib/states.ts'
import { ToolButton } from './tool-button.tsx'
import { needsScriptStyle, NoScript, ToyPanel, toyTableStyle } from './toy-panel.tsx'

export interface MarbleEvent {
  /** When, in the timeline's unit. */
  at: number
  label: string
}

export interface MarbleLane {
  name: string
  /** In time order. */
  events: MarbleEvent[]
}

export interface MarblesTimelineProps {
  /** Unique id for the scrub slider. */
  id: string
  title?: string
  /** The timeline's length, in `unit`. */
  duration: number
  /** The time unit ("s"). */
  unit: string
  lanes: MarbleLane[]
  illustrative?: boolean
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The sweep takes the diagram's own time, kept between 2.5 and 8 real seconds. */
export function sweepMs(duration: number): number {
  return Math.min(8000, Math.max(2500, duration * 1000))
}

/** Slider steps across the timeline. */
const SCRUB_STEPS = 1000

const formatTime = (t: number, unit: string) => `${Number.isInteger(t) ? t : t.toFixed(1)} ${unit}`

/** The latest event at or before `time`, across every lane. */
export function latestEvent(lanes: MarbleLane[], time: number): { lane: string; event: MarbleEvent } | undefined {
  let latest: { lane: string; event: MarbleEvent } | undefined
  for (let lane of lanes) {
    for (let event of lane.events) {
      if (event.at <= time && (!latest || event.at >= latest.event.at)) latest = { lane: lane.name, event }
    }
  }
  return latest
}

/**
 * `:::marbles` (decision 060): a marble diagram. Each lane is a hairline
 * track with its events as bit cells at their time, labelled; a play head
 * sweeps the timeline once when most of it is on screen, lighting events
 * as it passes them, and a slider scrubs it. The caption reads the latest
 * event under the head (`aria-live` while not playing). The server renders
 * the head at 0 (the client's first state) and nothing changes size while
 * it plays; under `prefers-reduced-motion` there is no Play and no sweep,
 * the head starts at the end and the slider scrubs. Without JS the tracks
 * hide and a `<noscript>` table lists every event in time order. Client
 * entry.
 */
export const MarblesTimeline = clientEntry(
  import.meta.url,
  function MarblesTimeline(handle: Handle<MarblesTimelineProps>) {
    // Head position, 0–1 of the duration.
    let head = typeof window !== 'undefined' && reducedMotion() ? 1 : 0
    let playing = false
    let frame: number | undefined
    let startedAt = 0

    let stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      playing = false
    }
    handle.signal.addEventListener('abort', stop)

    function tick(now: number) {
      let ms = sweepMs(handle.props.duration)
      head = Math.min(1, (now - startedAt) / ms)
      if (head >= 1) stop()
      else frame = requestAnimationFrame(tick)
      handle.update()
    }

    function play() {
      if (reducedMotion()) return
      if (head >= 1) head = 0
      stop()
      playing = true
      startedAt = performance.now() - head * sweepMs(handle.props.duration)
      frame = requestAnimationFrame(tick)
      handle.update()
    }

    function scrub(to: number) {
      stop()
      head = Math.max(0, Math.min(1, to))
      handle.update()
    }

    function toggle() {
      if (!playing) return play()
      stop()
      handle.update()
    }

    let watch = ref((node, signal) => {
      if (typeof IntersectionObserver === 'undefined' || reducedMotion()) return
      let observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer.disconnect()
          if (head === 0 && !playing) play()
        },
        { threshold: 0.6 },
      )
      observer.observe(node)
      signal.addEventListener('abort', () => observer.disconnect())
    })

    return () => {
      let { id, title, duration, unit, lanes, illustrative } = handle.props
      let time = head * duration
      let latest = latestEvent(lanes, time)
      let caption = latest ? `${formatTime(latest.event.at, unit)} · ${latest.lane}: ${latest.event.label}` : `${formatTime(0, unit)} · nothing yet`
      let all = lanes.flatMap((lane) => lane.events.map((event) => ({ lane: lane.name, event }))).sort((a, b) => a.event.at - b.event.at)
      let longestCaption = all
        .map(({ lane, event }) => `${formatTime(event.at, unit)} · ${lane}: ${event.label}`)
        .reduce((a, b) => (b.length > a.length ? b : a), caption)
      let pct = (at: number) => `${((at / duration) * 100).toFixed(2)}%`
      return (
        <ToyPanel context={title} label="timeline" illustrative={illustrative} mix={watch}>
          <div mix={[diagramStyle, needsScriptStyle]} style={{ '--head': String(head) }}>
            <div mix={namesStyle}>
              {lanes.map((lane) => (
                <span key={lane.name} mix={laneName}>
                  {lane.name}
                </span>
              ))}
            </div>
            <div mix={tracksStyle}>
              {lanes.map((lane) => (
                <div key={lane.name} mix={trackStyle}>
                  {lane.events.map((event, i) => (
                    <span
                      key={i}
                      data-lit={event.at <= time + 1e-9 ? 'true' : undefined}
                      mix={markerStyle}
                      style={{ left: pct(event.at) }}
                      title={`${formatTime(event.at, unit)}: ${event.label}`}
                    >
                      <span mix={markerCell} />
                      <span mix={markerLabel}>{event.label}</span>
                    </span>
                  ))}
                </div>
              ))}
              <span aria-hidden="true" mix={headStyle} />
            </div>
            <span mix={axisStart}>{formatTime(0, unit)}</span>
            <span mix={axisEnd}>{formatTime(duration, unit)}</span>
          </div>
          <div mix={[stackStyle, needsScriptStyle]}>
            <p aria-live={playing ? 'off' : 'polite'} mix={captionStyle}>
              {caption}
            </p>
            <Ghost>
              <p mix={captionStyle}>{longestCaption}</p>
            </Ghost>
          </div>
          <NoScript>
            <table mix={toyTableStyle}>
              <caption>{`Every event, in time order, over ${formatTime(duration, unit)}.`}</caption>
              <thead>
                <tr>
                  <th scope="col">time</th>
                  <th scope="col">lane</th>
                  <th scope="col">event</th>
                </tr>
              </thead>
              <tbody>
                {all.map(({ lane, event }, i) => (
                  <tr key={i}>
                    <td data-mono>{formatTime(event.at, unit)}</td>
                    <td>{lane}</td>
                    <td>{event.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </NoScript>
          <div mix={[controlsStyle, needsScriptStyle]}>
            <ToolButton variant="video" square label="Restart" mix={on('click', () => { scrub(0); play() })}>
              <span aria-hidden="true">↺</span>
            </ToolButton>
            <ToolButton variant="video" square label={playing ? 'Pause' : 'Play'} mix={[playStyle, on('click', toggle)]}>
              <Icon name={playing ? 'pause' : 'play-inline'} color="var(--text)" />
            </ToolButton>
            <label for={id} mix={sliderLabel}>
              time
            </label>
            <input
              id={id}
              type="range"
              min="0"
              max={String(SCRUB_STEPS)}
              step="1"
              value={String(Math.round(head * SCRUB_STEPS))}
              aria-valuetext={formatTime(Math.round(time * 10) / 10, unit)}
              mix={[
                sliderStyle,
                on('input', (event) => scrub(Number(event.currentTarget.value) / SCRUB_STEPS)),
              ]}
            />
            <output for={id} mix={timeStyle}>
              {formatTime(Math.round(time * 10) / 10, unit)}
            </output>
          </div>
        </ToyPanel>
      )
    }
  },
)

const NARROW = '@media (max-width: 480px)'
/** Room on each side of a track, so the first and last labels don't clip. */
const INSET = 'var(--space-7)'
const ROW_H = '48px'

const diagramStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gridTemplateRows: 'auto auto',
  columnGap: 'var(--space-3)',
  minWidth: 0,
})
const namesStyle = css({ display: 'flex', flexDirection: 'column', gridRow: 1 })
const laneName = css({
  display: 'flex',
  alignItems: 'center',
  height: ROW_H,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  [NARROW]: { fontSize: 'var(--fs-11)' },
})
const tracksStyle = css({
  position: 'relative',
  gridRow: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  padding: `0 ${INSET}`,
})
const trackStyle = css({
  position: 'relative',
  height: ROW_H,
  // The lane's hairline, through the markers' centres.
  '&::before': {
    content: '""',
    position: 'absolute',
    left: `calc(-1 * ${INSET})`,
    right: `calc(-1 * ${INSET})`,
    top: '15px',
    height: 'var(--border-w)',
    background: 'var(--line-strong)',
  },
})
// An event: a bit cell on the line, its label under it, centred on its time.
const markerStyle = css({
  position: 'absolute',
  top: '10px',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  color: 'var(--dim)',
  '&[data-lit]': { color: 'var(--volt)' },
  [FORCED_COLORS]: { '&[data-lit]': { color: 'CanvasText' } },
})
const markerCell = css({
  display: 'block',
  width: '11px',
  height: '11px',
  boxSizing: 'border-box',
  border: 'var(--border-w) solid var(--line-drop)',
  background: 'var(--surface)',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '[data-lit] > &': { background: 'currentColor', borderColor: 'currentColor' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { borderColor: 'GrayText', '[data-lit] > &': { forcedColorAdjust: 'none', background: 'CanvasText', borderColor: 'CanvasText' } },
})
const markerLabel = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  whiteSpace: 'nowrap',
  color: 'var(--muted)',
  '[data-lit] > &': { color: 'var(--text-body)' },
  [NARROW]: { fontSize: '10px' },
})
// The play head: a volt hairline across every lane, at --head (0–1) of the track.
const headStyle = css({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: `calc(${INSET} + (100% - 2 * ${INSET}) * var(--head, 0))`,
  width: '2px',
  marginLeft: '-1px',
  background: 'var(--volt)',
  pointerEvents: 'none',
  [FORCED_COLORS]: { forcedColorAdjust: 'none', background: 'Highlight' },
})
const axisStart = css({
  gridColumn: 2,
  gridRow: 2,
  justifySelf: 'start',
  paddingLeft: INSET,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
})
const axisEnd = css({
  gridColumn: 2,
  gridRow: 2,
  justifySelf: 'end',
  paddingRight: INSET,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
})
const captionStyle = css({
  margin: 0,
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-panel)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  overflowWrap: 'anywhere',
})
const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2) var(--space-3)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-3)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
  '& > button': { width: 'var(--touch-target)', minHeight: 'var(--touch-target)', fontSize: 'var(--fs-18)' },
})
const playStyle = css({ '@media (prefers-reduced-motion: reduce)': { display: 'none' } })
const sliderLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const sliderStyle = css({
  flex: '1 1 140px',
  minWidth: '120px',
  minHeight: 'var(--touch-target)',
  margin: 0,
  accentColor: 'var(--volt)',
  '&:focus-visible': focusOutline,
})
const timeStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '6ch',
  textAlign: 'right',
})
