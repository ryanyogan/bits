import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { BitCells } from './bit-cells.tsx'
import { Icon } from './icon.tsx'
import { Ghost, stackStyle } from './lib/stable.tsx'
import { FORCED_COLORS, focusOutline, forcedSelected } from './lib/states.ts'
import { ToolButton } from './tool-button.tsx'
import { needsScriptStyle, NoScript, ToyPanel } from './toy-panel.tsx'

export interface Step {
  /** Short mono label on the node ("Read"). */
  label: string
  /** One line about this move, shown under the chain while it is current. */
  caption: string
}

export interface StepsPlayerProps {
  /** Mono context in the header ("One reply, five moves"). */
  title?: string
  steps: Step[]
  /** The last step leads back to the first. */
  loop?: boolean
  illustrative?: boolean
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Autoplay: one move at a time. */
const STEP_MS = 1500

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * `:::steps` (decision 060): a sequence played one move at a time. The
 * steps are a chain of numbered nodes; the current one is lit, the ones
 * before it are filled bits, the ones after it empty bits, and a bit row
 * under the chain keeps count. The caption of the current step reads out
 * under it (`aria-live`, while not playing). Prev / Play / Next / Restart,
 * and each node is a button that jumps to its step. It plays once, the
 * first time most of it is on screen; under `prefers-reduced-motion` there
 * is no Play and no autoplay. The server renders step 1 (the client's
 * first state) and every caption sits on a `Ghost` of the longest one, so
 * nothing moves (decision 023). Without JS the chain and controls hide and
 * a `<noscript>` holds the steps as an ordered list. Client entry.
 */
export const StepsPlayer = clientEntry(
  import.meta.url,
  function StepsPlayer(handle: Handle<StepsPlayerProps>) {
    let pos = 0
    let playing = false
    let timer: ReturnType<typeof setTimeout> | undefined

    let stop = () => {
      clearTimeout(timer)
      playing = false
    }
    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    function beat() {
      let last = handle.props.steps.length - 1
      if (pos >= last) {
        stop()
      } else {
        pos++
        if (pos >= last) stop()
        else timer = setTimeout(beat, STEP_MS)
      }
      handle.update()
    }

    function play() {
      if (reducedMotion()) return
      if (pos >= handle.props.steps.length - 1) pos = 0
      clearTimeout(timer)
      playing = true
      timer = setTimeout(beat, STEP_MS)
      handle.update()
    }

    function go(to: number) {
      stop()
      pos = Math.max(0, Math.min(handle.props.steps.length - 1, to))
      handle.update()
    }

    function toggle() {
      if (!playing) return play()
      stop()
      handle.update()
    }

    // Autoplay once, the first time most of the toy is on screen.
    let watch = ref((node, signal) => {
      if (typeof IntersectionObserver === 'undefined' || reducedMotion()) return
      let observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer.disconnect()
          if (pos === 0 && !playing) play()
        },
        { threshold: 0.6 },
      )
      observer.observe(node)
      signal.addEventListener('abort', () => observer.disconnect())
    })

    return () => {
      let { title, steps, loop, illustrative } = handle.props
      let total = steps.length
      let last = total - 1
      let current = steps[pos]!
      let bits = '1'.repeat(pos + 1) + '0'.repeat(Math.max(0, last - pos))
      let status = `step ${pos + 1} of ${total}${pos === last && loop ? ' · then back to 1' : ''}`
      let longestStatus = `step ${total} of ${total}${loop ? ' · then back to 1' : ''}`
      let longestCaption = steps.reduce((a, b) => (b.caption.length > a.caption.length ? b : a)).caption
      return (
        <ToyPanel context={title} label="step by step" illustrative={illustrative} mix={watch}>
          <ol aria-label="Steps" mix={[chainStyle, needsScriptStyle, loop ? loopStyle : undefined]}>
            {steps.map((step, i) => (
              <li key={step.label} data-state={i < pos ? 'done' : i === pos ? 'current' : 'next'} mix={nodeItem}>
                <button type="button" aria-current={i === pos ? 'step' : undefined} mix={[nodeStyle, on('click', () => go(i))]}>
                  <span mix={nodeIndex}>{pad(i + 1)}</span>
                  <span mix={nodeLabel}>{step.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div mix={[stackStyle, needsScriptStyle]}>
            <p aria-live={playing ? 'off' : 'polite'} mix={captionStyle}>
              <span mix={captionLabel}>{current.label}</span>
              {current.caption}
            </p>
            <Ghost>
              <p mix={captionStyle}>
                <span mix={captionLabel}>{steps.reduce((a, b) => (b.label.length > a.label.length ? b : a)).label}</span>
                {longestCaption}
              </p>
            </Ghost>
          </div>
          <NoScript>
            <ol mix={listStyle}>
              {steps.map((step, i) => (
                <li key={step.label} mix={listItem}>
                  <span mix={captionLabel}>{`${pad(i + 1)} ${step.label}`}</span>
                  {step.caption}
                </li>
              ))}
              {loop ? <li mix={listNote}>…then back to step 01.</li> : null}
            </ol>
          </NoScript>
          <div mix={[controlsStyle, needsScriptStyle]}>
            <ToolButton variant="video" square label="Restart" mix={on('click', () => { go(0); play() })}>
              <span aria-hidden="true">↺</span>
            </ToolButton>
            <ToolButton variant="video" square label="Previous step" disabled={pos === 0} mix={on('click', () => go(pos - 1))}>
              <span aria-hidden="true">‹</span>
            </ToolButton>
            <ToolButton variant="video" square label={playing ? 'Pause' : 'Play'} mix={[playStyle, on('click', toggle)]}>
              <Icon name={playing ? 'pause' : 'play-inline'} color="var(--text)" />
            </ToolButton>
            <ToolButton variant="video" square label="Next step" disabled={pos === last} mix={on('click', () => go(pos + 1))}>
              <span aria-hidden="true">›</span>
            </ToolButton>
            <div mix={[stackStyle, statusSlot]}>
              <p mix={statusStyle}>
                <BitCells bits={bits} tone="volt" />
                <span>{status}</span>
              </p>
              <Ghost>
                <p mix={statusStyle}>
                  <BitCells bits={'1'.repeat(total)} tone="volt" />
                  <span>{longestStatus}</span>
                </p>
              </Ghost>
            </div>
          </div>
        </ToyPanel>
      )
    }
  },
)

const NARROW = '@media (max-width: 480px)'

// The chain: nodes joined by a hairline, which the loop closes with a
// return glyph after the last node.
const chainStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'stretch',
  gap: 'var(--space-2) 0',
  [NARROW]: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
})
const nodeItem = css({
  position: 'relative',
  display: 'flex',
  // The connector: a hairline into the node, with a bit at its end.
  '& + &': { paddingLeft: 'var(--space-6)' },
  '& + &::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: '50%',
    width: 'var(--space-6)',
    height: 'var(--border-w)',
    background: 'var(--line-strong)',
  },
  [NARROW]: {
    '& + &': { paddingLeft: 0, paddingTop: 'var(--space-5)' },
    '& + &::before': { left: 'var(--space-5)', top: 0, width: 'var(--border-w)', height: 'var(--space-5)' },
  },
})
const nodeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3_5)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'var(--well)',
  color: 'var(--text-lead)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast)',
  '&:focus-visible': focusOutline,
  '[data-state="done"] &': { borderColor: 'var(--volt-a40)', color: 'var(--text-body)' },
  '[data-state="done"] & > span:first-child': { background: 'var(--volt)', color: 'var(--on-volt)', borderColor: 'var(--volt)' },
  '[data-state="current"] &': { borderColor: 'var(--volt)', background: 'var(--volt-tint-on)', color: 'var(--text)' },
  '[data-state="current"] & > span:first-child': { background: 'var(--volt)', color: 'var(--on-volt)', borderColor: 'var(--volt)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: {
    '[data-state="current"] &': forcedSelected,
    '[data-state="done"] & > span:first-child': { forcedColorAdjust: 'none', background: 'CanvasText', color: 'Canvas' },
  },
})
// The step's number as a bit cell: empty ahead, filled once reached.
const nodeIndex = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '22px',
  height: '22px',
  boxSizing: 'border-box',
  border: 'var(--border-w) solid var(--line-drop)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
  fontVariantNumeric: 'tabular-nums',
})
const nodeLabel = css({ whiteSpace: 'nowrap' })
const loopStyle = css({
  '& > li:last-child::after': {
    content: '"↺"',
    position: 'absolute',
    right: 'calc(-1 * var(--space-6))',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 'var(--space-6)',
    textAlign: 'center',
    color: 'var(--volt)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-14)',
  },
  '& > li:last-child': { marginRight: 'var(--space-6)' },
  [NARROW]: {
    '& > li:last-child::after': { right: 'auto', left: 'var(--space-5)', top: 'auto', bottom: 'calc(-1 * var(--space-5))', transform: 'translateX(-50%)', width: 'auto' },
    '& > li:last-child': { marginRight: 0, marginBottom: 'var(--space-5)' },
  },
})
const captionStyle = css({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  padding: 'var(--space-3_5) var(--space-4)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-panel)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  overflowWrap: 'anywhere',
})
const captionLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--volt)' })
const listStyle = css({ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const listItem = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--fs-16)', lineHeight: 1.5, color: 'var(--text-body)' })
const listNote = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-3)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
  '& > button': { width: 'var(--touch-target)', minHeight: 'var(--touch-target)', fontSize: 'var(--fs-18)' },
})
// Under reduced motion there is no Play: only the step buttons.
const playStyle = css({ '@media (prefers-reduced-motion: reduce)': { display: 'none' } })
const statusSlot = css({ flex: '1 1 200px' })
const statusStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
