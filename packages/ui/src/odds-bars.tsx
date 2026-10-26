import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

export const TEMPERATURE_EVENT = 'bits:temperature'

export interface OddsBarsProps {
  /** Context shown in the header, e.g. "Moon café tagline:". */
  context: string
  /** Text after the context in `--text`, e.g. "“___". */
  blank?: string
  /** `[token, logit]` candidates, top first. */
  candidates: [token: string, logit: number][]
  /** Slider value 0–150 (T × 100). */
  defaultValue?: number
  /** Unique id for the slider. */
  id?: string
}

export function oddsAt(candidates: [string, number][], t: number): number[] {
  if (t < 0.05) return candidates.map((_, i) => (i === 0 ? 1 : 0))
  let exps = candidates.map(([, logit]) => Math.exp(logit / t))
  let sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

export function temperatureNote(t: number): string {
  if (t < 0.05) return 'At 0 the favourite wins every time. Same prompt → same answer.'
  if (t < 0.6) return 'Sharp: the top token dominates, but a runner-up sneaks in now and then.'
  if (t < 1.05) return 'Balanced: plausible variety. Most chat apps live around here.'
  return 'Flat: long shots get real odds. Creative — and occasionally unhinged.'
}

/**
 * `:::odds` block (components §10.12): next-token probabilities that reshape
 * as the temperature slider moves (softmax of logit / T). Server-renders at
 * the default temperature; as a client entry the slider is live and follows
 * the composer's temperature picker (`bits:temperature`).
 */
export const OddsBars = clientEntry(
  import.meta.url,
  function OddsBars(handle: Handle<OddsBarsProps>) {
    let value = handle.props.defaultValue ?? 70

    handle.queueTask(() => {
      window.addEventListener(
        TEMPERATURE_EVENT,
        (event) => {
          value = (event as CustomEvent<number>).detail
          handle.update()
        },
        { signal: handle.signal },
      )
    })

    return () => {
      let { context, blank = '“___', candidates, id = 'odds-temp' } = handle.props
      let t = value / 100
      let probs = oddsAt(candidates, t)
      return (
        <div mix={panelStyle}>
          <div mix={headerStyle}>
            <span mix={contextStyle}>
              {context} <span mix={blankStyle}>{blank}</span>
            </span>
            <span mix={labelStyle}>next-token odds</span>
          </div>
          <ul aria-label="Next-token probabilities" mix={barsStyle}>
            {candidates.map(([token], index) => {
              let p = probs[index] ?? 0
              return (
                <li key={token} mix={rowStyle}>
                  <span mix={tokenStyle}>{token}</span>
                  <span aria-hidden="true" mix={trackStyle}>
                    <span
                      mix={[fillStyle, index === 0 ? topFill : otherFill]}
                      style={{ width: `${Math.max(1, p * 100).toFixed(1)}%` }}
                    />
                  </span>
                  <span mix={pctStyle}>{`${(p * 100).toFixed(p >= 0.1 || p === 0 ? 0 : 1)}%`}</span>
                </li>
              )
            })}
          </ul>
          <div mix={sliderRow}>
            <label for={id} mix={sliderLabel}>
              temperature
            </label>
            <input
              id={id}
              type="range"
              min="0"
              max="150"
              step="5"
              value={String(value)}
              aria-valuetext={t.toFixed(2)}
              mix={[
                sliderStyle,
                on('input', (event) => {
                  value = Number(event.currentTarget.value)
                  handle.update()
                }),
              ]}
            />
            <output for={id} mix={badgeStyle}>
              {t.toFixed(2)}
            </output>
          </div>
          <p aria-live="polite" mix={noteStyle}>
            {temperatureNote(t)}
          </p>
        </div>
      )
    }
  },
)

const NARROW = '@media (max-width: 480px)'

const panelStyle = css({
  padding: 'var(--space-5_5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: '1px solid var(--ion-a28)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  [NARROW]: { padding: 'var(--space-4)' },
})
const headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
})
const contextStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const blankStyle = css({ color: 'var(--text)' })
const labelStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const barsStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2_5)' })
const rowStyle = css({
  display: 'grid',
  gridTemplateColumns: '88px 1fr 56px',
  gap: 'var(--space-3)',
  alignItems: 'center',
  [NARROW]: { gridTemplateColumns: '64px 1fr 44px' },
})
const tokenStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', whiteSpace: 'pre', color: 'var(--text)' })
const trackStyle = css({ display: 'block', height: '22px', borderRadius: 'var(--radius-xs)', background: 'var(--fill-seg)', overflow: 'hidden' })
const fillStyle = css({
  display: 'block',
  height: '100%',
  borderRadius: 'var(--radius-xs)',
  transition: 'width var(--duration-sigil) var(--ease-out)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const topFill = css({ background: 'var(--ion)' })
const otherFill = css({ background: 'var(--ion-a45)' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text-quiet)', textAlign: 'right' })
const sliderRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
  borderTop: '1px solid var(--line-hair)',
})
const sliderLabel = css({ paddingTop: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const sliderStyle = css({
  flex: 1,
  minWidth: '180px',
  height: '32px',
  marginTop: 'var(--space-3)',
  accentColor: 'var(--volt)',
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  [NARROW]: { minWidth: 0, flexBasis: '100%', order: 3 },
})
const badgeStyle = css({
  padding: 'var(--space-1_5) var(--space-2_5)',
  marginTop: 'var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--well)',
  border: '1px solid var(--line-panel)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  color: 'var(--volt)',
  minWidth: '44px',
  textAlign: 'center',
})
const noteStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.5, color: 'var(--muted)' })
