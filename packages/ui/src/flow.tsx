import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { BitCells } from './bit-cells.tsx'
import { Icon } from './icon.tsx'
import { Ghost, stackStyle } from './lib/stable.tsx'
import { FORCED_COLORS, forcedSelected } from './lib/states.ts'
import { ToolButton } from './tool-button.tsx'
import { needsScriptStyle, NoScript, ToyPanel, toyTableStyle } from './toy-panel.tsx'

export interface FlowItem {
  name: string
  /** How much of the window it takes, in `unit`. */
  size: number
}

export interface FlowWindowProps {
  title?: string
  /** The window's size, in `unit` (2–32: one bit cell each). */
  capacity: number
  /** What the sizes count ("tokens"). */
  unit: string
  /** In arrival order. */
  items: FlowItem[]
  illustrative?: boolean
}

export type FlowState = 'pending' | 'in' | 'out'

/**
 * The window after the first `arrived` items: which are in it, which fell
 * out (oldest first, until the newest fits), and how much is used.
 */
export function flowAt(items: FlowItem[], capacity: number, arrived: number): { states: FlowState[]; used: number; dropped: number[] } {
  let states: FlowState[] = items.map(() => 'pending')
  let window: number[] = []
  let used = 0
  let dropped: number[] = []
  for (let i = 0; i < Math.min(arrived, items.length); i++) {
    window.push(i)
    used += items[i]!.size
    states[i] = 'in'
    dropped = []
    while (used > capacity && window.length > 1) {
      let oldest = window.shift()!
      used -= items[oldest]!.size
      states[oldest] = 'out'
      dropped.push(oldest)
    }
  }
  return { states, used, dropped }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Autoplay: one arrival at a time. */
const ARRIVE_MS = 1400

const quote = (name: string) => `“${name}”`

/**
 * `:::flow` (decision 060): things flowing through a box of fixed size.
 * Every item is a chip on one track, in arrival order; a chip is empty
 * until its item arrives, lit while the item is in the window, and struck
 * once it has fallen out the far side. A bit row shows the fill, one cell
 * per unit of capacity, and a caption says what each arrival did. Prev /
 * Play / Next / Restart; it plays once when most of it is on screen, never
 * under `prefers-reduced-motion`. The server renders the first arrival
 * (the client's first state); the track never changes size, and the
 * caption sits on a `Ghost` of the longest one (decision 023). Without JS
 * a `<noscript>` table lists every arrival. Client entry.
 */
export const FlowWindow = clientEntry(
  import.meta.url,
  function FlowWindow(handle: Handle<FlowWindowProps>) {
    // Items arrived so far (1 = the first is in the window).
    let arrived = 1
    let playing = false
    let timer: ReturnType<typeof setTimeout> | undefined

    let stop = () => {
      clearTimeout(timer)
      playing = false
    }
    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    function beat() {
      let total = handle.props.items.length
      if (arrived >= total) {
        stop()
      } else {
        arrived++
        if (arrived >= total) stop()
        else timer = setTimeout(beat, ARRIVE_MS)
      }
      handle.update()
    }

    function play() {
      if (reducedMotion()) return
      if (arrived >= handle.props.items.length) arrived = 1
      clearTimeout(timer)
      playing = true
      timer = setTimeout(beat, ARRIVE_MS)
      handle.update()
    }

    function go(to: number) {
      stop()
      arrived = Math.max(1, Math.min(handle.props.items.length, to))
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
          if (arrived === 1 && !playing) play()
        },
        { threshold: 0.6 },
      )
      observer.observe(node)
      signal.addEventListener('abort', () => observer.disconnect())
    })

    return () => {
      let { title, capacity, unit, items, illustrative } = handle.props
      let total = items.length
      let captionAt = (n: number) => {
        let { used, dropped } = flowAt(items, capacity, n)
        let item = items[n - 1]!
        let arrival = `${quote(item.name)} arrives (${item.size} ${unit}).`
        if (!dropped.length) return `${arrival} ${used} of ${capacity} used.`
        let names = dropped.map((i) => quote(items[i]!.name))
        let list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
        return `${arrival} The window is full, so ${list} ${dropped.length > 1 ? 'fall' : 'falls'} out. ${used} of ${capacity} used.`
      }
      let { states, used } = flowAt(items, capacity, arrived)
      let caption = captionAt(arrived)
      let longestCaption = items.map((_, i) => captionAt(i + 1)).reduce((a, b) => (b.length > a.length ? b : a))
      let fill = '1'.repeat(used) + '0'.repeat(Math.max(0, capacity - used))
      let status = `${arrived} of ${total} arrived`
      return (
        <ToyPanel context={title} label="context window" illustrative={illustrative} mix={watch}>
          <ol aria-label="Items, in arrival order" mix={[trackStyle, needsScriptStyle]}>
            {items.map((item, i) => (
              <li key={i} data-state={states[i]} mix={chipStyle}>
                <span mix={chipName}>{item.name}</span>
                <span mix={chipSize}>{`${item.size} ${unit}`}</span>
                {states[i] === 'out' ? <span class="sr-only"> (fell out)</span> : states[i] === 'pending' ? <span class="sr-only"> (not yet)</span> : null}
              </li>
            ))}
          </ol>
          <div mix={[fillRow, needsScriptStyle]}>
            <BitCells bits={fill} tone={used >= capacity ? 'ion' : 'volt'} size={capacity > 16 ? 6 : 10} label={`${used} of ${capacity} ${unit} used`} mix={fillBits} />
            <span mix={fillLabel}>{`${used} / ${capacity} ${unit}`}</span>
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
              <caption>{`A window of ${capacity} ${unit}: each arrival, and what fell out to make room.`}</caption>
              <thead>
                <tr>
                  <th scope="col">arrives</th>
                  <th scope="col">size</th>
                  <th scope="col">used</th>
                  <th scope="col">falls out</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  let { used, dropped } = flowAt(items, capacity, i + 1)
                  return (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td data-mono>{`${item.size} ${unit}`}</td>
                      <td data-mono>{`${used} / ${capacity}`}</td>
                      <td>{dropped.map((d) => items[d]!.name).join(', ') || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </NoScript>
          <div mix={[controlsStyle, needsScriptStyle]}>
            <ToolButton variant="video" square label="Restart" mix={on('click', () => { go(1); play() })}>
              <span aria-hidden="true">↺</span>
            </ToolButton>
            <ToolButton variant="video" square label="Previous arrival" disabled={arrived <= 1} mix={on('click', () => go(arrived - 1))}>
              <span aria-hidden="true">‹</span>
            </ToolButton>
            <ToolButton variant="video" square label={playing ? 'Pause' : 'Play'} mix={[playStyle, on('click', toggle)]}>
              <Icon name={playing ? 'pause' : 'play-inline'} color="var(--text)" />
            </ToolButton>
            <ToolButton variant="video" square label="Next arrival" disabled={arrived >= total} mix={on('click', () => go(arrived + 1))}>
              <span aria-hidden="true">›</span>
            </ToolButton>
            <div mix={[stackStyle, statusSlot]}>
              <p mix={statusStyle}>{status}</p>
              <Ghost>
                <p mix={statusStyle}>{`${total} of ${total} arrived`}</p>
              </Ghost>
            </div>
          </div>
        </ToyPanel>
      )
    }
  },
)

const trackStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
})
// One chip per item: empty until it arrives, lit in the window, struck once out.
const chipStyle = css({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  padding: 'var(--space-1_5) var(--space-3)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'transparent',
  color: 'var(--dim)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.4,
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast), opacity var(--duration-fast)',
  '&[data-state="in"]': { borderColor: 'var(--volt)', background: 'var(--volt-tint-on)', color: 'var(--text)' },
  '&[data-state="out"]': { borderStyle: 'dashed', color: 'var(--dim)', textDecoration: 'line-through', opacity: 0.7 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { '&[data-state="in"]': forcedSelected, '&[data-state="out"]': { opacity: 1 } },
})
const chipName = css({ overflowWrap: 'anywhere' })
const chipSize = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--muted)', whiteSpace: 'nowrap' })
const fillRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', minWidth: 0 })
const fillBits = css({ maxWidth: '100%' })
const fillLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' })
const captionStyle = css({
  margin: 0,
  padding: 'var(--space-3_5) var(--space-4)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-panel)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  overflowWrap: 'anywhere',
})
const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-3)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
  '& > button': { width: 'var(--touch-target)', minHeight: 'var(--touch-target)', fontSize: 'var(--fs-18)' },
})
const playStyle = css({ '@media (prefers-reduced-motion: reduce)': { display: 'none' } })
const statusSlot = css({ flex: '1 1 160px' })
const statusStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
