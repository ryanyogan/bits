import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Icon } from './icon.tsx'
import { Ghost, stackStyle } from './lib/stable.tsx'
import { formatOdds, OddsList, type OddsRow, showToken } from './odds-list.tsx'
import { ToolButton } from './tool-button.tsx'
import { needsScriptStyle, NoScript, toyNoteStyle, ToyPanel, toyTableStyle } from './toy-panel.tsx'

export interface NextTokenStep {
  /** The token that was picked. */
  token: string
  /** Its probability, 0–1. */
  p: number
  /** The runners-up, `[token, p]`. */
  alternatives: [token: string, p: number][]
}

export interface NextTokenPlayerProps {
  prompt: string
  steps: NextTokenStep[]
  illustrative?: boolean
}

/** One step's bars: the pick and its runners-up, most likely first. */
export function stepRows(step: NextTokenStep): OddsRow[] {
  return [{ token: step.token, p: step.p, picked: true }, ...step.alternatives.map(([token, p]) => ({ token, p }))].sort(
    (a, b) => b.p - a.p,
  )
}

/** The prompt, plus a space when the reply's first token has none (a chat reply). */
export function promptText(prompt: string, steps: NextTokenStep[]): string {
  let first = steps[0]?.token ?? ''
  return /\s$/.test(prompt) || /^\s/.test(first) || !first ? prompt : `${prompt} `
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Autoplay beats: the odds show, then the pick lights up, then it lands.
const ODDS_MS = 900
const PICK_MS = 650

/**
 * `:::nexttoken` (lesson toy): the reply forms one token at a time. Each
 * step shows its candidate odds (the `OddsBars` look), the pick lights up
 * in volt and lands in the sentence. Play/pause, back, next and restart;
 * it starts playing when it scrolls into view, except under
 * `prefers-reduced-motion`, where there is no play button (hidden in CSS)
 * and no autoplay. The server renders the same first step the client starts
 * on (prompt, caret, step 1's odds), so hydration doesn't shift the page,
 * and every part that changes while it plays (the sentence, the odds, the
 * status line) sits on a `Ghost` of its largest state, so playing never
 * moves the page either (decision 023).
 * Without JS the controls hide and a `<noscript>` holds the final sentence
 * and a table of every step. Client entry.
 */
export const NextTokenPlayer = clientEntry(
  import.meta.url,
  function NextTokenPlayer(handle: Handle<NextTokenPlayerProps>) {
    let pos = 0
    let playing = false
    // During autoplay, false until the pick lights up.
    let shown = true
    let timer: ReturnType<typeof setTimeout> | undefined

    let stop = () => {
      clearTimeout(timer)
      playing = false
      shown = true
    }
    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    function beat() {
      let total = handle.props.steps.length
      if (pos >= total) {
        stop()
      } else if (!shown) {
        shown = true
        timer = setTimeout(beat, PICK_MS)
      } else {
        pos++
        shown = pos >= total
        if (pos >= total) stop()
        else timer = setTimeout(beat, ODDS_MS)
      }
      handle.update()
    }

    function play() {
      if (reducedMotion()) return
      if (pos >= handle.props.steps.length) pos = 0
      clearTimeout(timer)
      playing = true
      shown = false
      timer = setTimeout(beat, ODDS_MS)
      handle.update()
    }

    function go(to: number) {
      stop()
      pos = Math.max(0, Math.min(handle.props.steps.length, to))
      handle.update()
    }

    function restart() {
      go(0)
      play()
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
      let { prompt, steps, illustrative } = handle.props
      let total = steps.length
      let reply = steps.map((step) => step.token).join('')

      let done = pos >= total
      let step = steps[Math.min(pos, total - 1)]!
      let rows = stepRows(step).map((row) => (row.picked && !shown ? { ...row, picked: false } : row))
      let statusAt = (at: number) =>
        at >= total
          ? `Done: ${total} tokens, picked one at a time.`
          : `Step ${at + 1} of ${total}: picks “${showToken(steps[at]!.token)}” at ${formatOdds(steps[at]!.p)}.`
      let status = statusAt(pos)
      let longestStatus = steps.map((_, i) => statusAt(i)).concat(statusAt(total)).reduce((a, b) => (b.length > a.length ? b : a))
      // The step with the most candidates sets the height of the odds area.
      let tallest = steps.reduce((a, b) => (b.alternatives.length > a.alternatives.length ? b : a), steps[0]!)
      let doneNote = (
        <p mix={toyNoteStyle}>That’s the whole trick: score every possible next token, pick one, append it, repeat.</p>
      )
      return (
        <ToyPanel context="the reply, one token at a time" label="next-token prediction" illustrative={illustrative} mix={watch}>
          <div mix={stackStyle}>
            <p mix={sentenceStyle}>
              <span mix={promptStyle}>{promptText(prompt, steps)}</span>
              {steps.slice(0, pos).map((s, i) => (
                <span key={i} data-new={i === pos - 1 ? 'true' : undefined} mix={landedStyle}>
                  {s.token}
                </span>
              ))}
              {/* A fresh caret per step: a new node isn't a layout shift, a moved one is. */}
              {done ? null : (
                <span key={`caret-${pos}`} aria-hidden="true" mix={caretStyle}>
                  ▍
                </span>
              )}
            </p>
            <Ghost>
              <p mix={sentenceStyle}>
                {promptText(prompt, steps)}
                {reply}▍
              </p>
            </Ghost>
          </div>
          <div mix={stackStyle}>
            {done ? (
              doneNote
            ) : (
              <div mix={oddsBlock}>
                <p mix={stepLabel}>{`step ${pos + 1}/${total} · candidates for the next token`}</p>
                <OddsList rows={rows} label={`Candidates for step ${pos + 1}`} top={false} />
              </div>
            )}
            <Ghost>
              <div mix={oddsBlock}>
                <p mix={stepLabel}>{`step ${total}/${total} · candidates for the next token`}</p>
                <OddsList rows={stepRows(tallest)} top={false} />
              </div>
            </Ghost>
            {done ? null : <Ghost>{doneNote}</Ghost>}
          </div>
          <NoScript>
            <p mix={sentenceStyle}>
              <span mix={promptStyle}>{promptText(prompt, steps)}</span>
              {reply}
            </p>
            <table mix={toyTableStyle}>
              <caption>Each step picks one token from the model’s odds.</caption>
              <thead>
                <tr>
                  <th scope="col">step</th>
                  <th scope="col">picked</th>
                  <th scope="col">odds</th>
                  <th scope="col">other candidates</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i}>
                    <td data-mono>{String(i + 1)}</td>
                    <td data-mono>{showToken(step.token)}</td>
                    <td data-mono>{formatOdds(step.p)}</td>
                    <td data-mono>{step.alternatives.map(([token, p]) => `${showToken(token)} ${formatOdds(p)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </NoScript>
          <div mix={[controlsStyle, needsScriptStyle]}>
            <ToolButton variant="video" square label="Restart" mix={on('click', restart)}>
              <span aria-hidden="true">↺</span>
            </ToolButton>
            <ToolButton variant="video" square label="Previous token" disabled={pos === 0} mix={on('click', () => go(pos - 1))}>
              <span aria-hidden="true">‹</span>
            </ToolButton>
            <ToolButton variant="video" square label={playing ? 'Pause' : 'Play'} mix={[playStyle, on('click', toggle)]}>
              <Icon name={playing ? 'pause' : 'play-inline'} color="var(--text)" />
            </ToolButton>
            <ToolButton variant="video" square label="Next token" disabled={done} mix={on('click', () => go(pos + 1))}>
              <span aria-hidden="true">›</span>
            </ToolButton>
            <div mix={[stackStyle, statusSlot]}>
              <p aria-live={playing ? 'off' : 'polite'} mix={statusStyle}>
                {status}
              </p>
              <Ghost>
                <p mix={statusStyle}>{longestStatus}</p>
              </Ghost>
            </div>
          </div>
        </ToyPanel>
      )
    }
  },
)

const sentenceStyle = css({
  margin: 0,
  padding: 'var(--space-3_5) var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--well)',
  border: '1px solid var(--line-panel)',
  fontSize: 'var(--fs-18)',
  lineHeight: 1.5,
  color: 'var(--text)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  // Greedy wrapping while it grows: `pretty` would re-break earlier lines
  // as each token lands and move words the reader has already seen.
  textWrap: 'wrap',
})
const promptStyle = css({ color: 'var(--muted)' })
const landedStyle = css({
  '&[data-new]': {
    color: 'var(--volt-soft)',
    animation: 'bits-rise var(--duration-reveal) var(--ease-out)',
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
})
const caretStyle = css({
  color: 'var(--ion)',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const oddsBlock = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const stepLabel = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--line-hair)',
  '& > button': { width: 'var(--touch-target)', minHeight: 'var(--touch-target)', fontSize: 'var(--fs-18)' },
})
// Under reduced motion there is no Play: only the step buttons.
const playStyle = css({ '@media (prefers-reduced-motion: reduce)': { display: 'none' } })
const statusSlot = css({ flex: '1 1 200px' })
const statusStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  overflowWrap: 'anywhere',
})
