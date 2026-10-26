import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { toyNoteStyle, ToyPanel } from './toy-panel.tsx'

export interface TrainingSnapshot {
  /** Training step. */
  step: number
  /** Loss at that step. */
  loss: number
  /** What the model wrote for the prompt at that step. */
  text: string
}

export interface TrainingScrubberProps {
  /** Unique id for the slider. */
  id: string
  prompt: string
  snapshots: TrainingSnapshot[]
  illustrative?: boolean
}

const W = 240
const H = 56
const PAD = 5

/** Sparkline points (snapshots evenly spaced, loss scaled to the box). */
export function sparkPoints(losses: number[]): [x: number, y: number][] {
  let max = Math.max(...losses)
  let min = Math.min(...losses)
  let span = max - min || 1
  let n = Math.max(1, losses.length - 1)
  return losses.map((loss, i) => [PAD + (i / n) * (W - 2 * PAD), PAD + (1 - (loss - min) / span) * (H - 2 * PAD)])
}

const formatStep = (step: number) => step.toLocaleString('en-US')
const formatLoss = (loss: number) => loss.toFixed(loss < 10 ? 2 : 1)

/**
 * `:::training` (lesson toy): a scrubber over training snapshots. Each stop
 * shows what the model wrote for the prompt at that step, with a loss
 * sparkline (SVG) and the current point marked. Server render (no JS): an
 * ordered list of the snapshots. Client entry.
 */
export const TrainingScrubber = clientEntry(
  import.meta.url,
  function TrainingScrubber(handle: Handle<TrainingScrubberProps>) {
    let live = false
    let index = 0

    handle.queueTask(() => {
      live = true
      handle.update()
    })

    return () => {
      let { id, prompt, snapshots, illustrative } = handle.props
      let header = { context: `prompt: “${prompt}”`, label: 'training snapshots', illustrative }

      if (!live) {
        return (
          <ToyPanel {...header}>
            <ol aria-label="Training snapshots" mix={listStyle}>
              {snapshots.map((snap) => (
                <li key={snap.step} mix={itemStyle}>
                  <span mix={metaStyle}>{`step ${formatStep(snap.step)} · loss ${formatLoss(snap.loss)}`}</span>
                  <span mix={outputStyle}>
                    <span mix={promptStyle}>{prompt}</span>
                    {snap.text}
                  </span>
                </li>
              ))}
            </ol>
          </ToyPanel>
        )
      }

      let at = Math.min(index, snapshots.length - 1)
      let snap = snapshots[at]!
      let points = sparkPoints(snapshots.map((s) => s.loss))
      let [cx, cy] = points[at]!
      let first = snapshots[0]!
      let last = snapshots[snapshots.length - 1]!
      return (
        <ToyPanel {...header}>
          <div mix={outputBox}>
            <p mix={metaStyle}>{`model output at step ${formatStep(snap.step)}`}</p>
            <p aria-live="polite" mix={outputStyle}>
              <span mix={promptStyle}>{prompt}</span>
              {snap.text}
            </p>
          </div>
          <div mix={chartRow}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Loss falls from ${formatLoss(first.loss)} at step ${formatStep(first.step)} to ${formatLoss(last.loss)} at step ${formatStep(last.step)}`}
              mix={sparkStyle}
            >
              <polyline points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} mix={lineStyle} />
              <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="4" mix={dotStyle} />
            </svg>
            <p mix={lossStyle}>
              <span mix={lossLabel}>loss</span>
              <span>{formatLoss(snap.loss)}</span>
            </p>
          </div>
          <div mix={sliderRow}>
            <label for={id} mix={sliderLabel}>
              training step
            </label>
            <input
              id={id}
              type="range"
              min="0"
              max={String(snapshots.length - 1)}
              step="1"
              value={String(at)}
              aria-valuetext={`step ${formatStep(snap.step)}, loss ${formatLoss(snap.loss)}`}
              mix={[
                sliderStyle,
                on('input', (event) => {
                  index = Number(event.currentTarget.value)
                  handle.update()
                }),
              ]}
            />
            <output for={id} mix={badgeStyle}>
              {formatStep(snap.step)}
            </output>
          </div>
          <p mix={toyNoteStyle}>Lower loss means the model’s guesses for the next token got better. Drag to watch it learn.</p>
        </ToyPanel>
      )
    }
  },
)

const listStyle = css({ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const itemStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const metaStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const outputStyle = css({
  margin: 0,
  fontSize: 'var(--fs-16)',
  lineHeight: 1.5,
  color: 'var(--text)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
})
const promptStyle = css({ color: 'var(--muted)', '&::after': { content: '" "' } })
const outputBox = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  minHeight: '6.5em',
  padding: 'var(--space-3_5) var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--well)',
  border: '1px solid var(--line-panel)',
})
const chartRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' })
const sparkStyle = css({ flex: 1, minWidth: 0, height: '56px', maxWidth: '360px', overflow: 'visible' })
const lineStyle = css({ fill: 'none', stroke: 'var(--ion-a60)', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' })
const dotStyle = css({
  fill: 'var(--volt)',
  stroke: 'var(--surface)',
  strokeWidth: 2,
  transition: 'cx var(--duration-sigil) var(--ease-out), cy var(--duration-sigil) var(--ease-out)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const lossStyle = css({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-20)',
  color: 'var(--volt)',
})
const lossLabel = css({ fontSize: 'var(--fs-11)', color: 'var(--muted)' })
const sliderRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--line-hair)',
})
const sliderLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const sliderStyle = css({
  flex: 1,
  minWidth: '180px',
  height: 'var(--touch-target)',
  accentColor: 'var(--volt)',
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  '@media (max-width: 480px)': { minWidth: 0, flexBasis: '100%', order: 3 },
})
const badgeStyle = css({
  padding: 'var(--space-1_5) var(--space-2_5)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--well)',
  border: '1px solid var(--line-panel)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  color: 'var(--volt)',
  minWidth: '64px',
  textAlign: 'center',
})
