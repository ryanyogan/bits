import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { focusOutline } from './lib/states.ts'
import { Ghost, stackStyle } from './lib/stable.tsx'
import { OddsList } from './odds-list.tsx'
import { toyBodyStyle, toyContextStyle, toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'

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
        <div mix={toyPanelStyle}>
          <div mix={toyHeaderStyle}>
            <span mix={toyContextStyle}>
              {context} <span mix={blankStyle}>{blank}</span>
            </span>
            <span mix={toyLabelStyle}>next-token odds</span>
          </div>
          <div mix={toyBodyStyle}>
            <OddsList rows={candidates.map(([token], index) => ({ token, p: probs[index] ?? 0 }))} />
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
            {/* All four notes reserve the slot, so dragging never moves the page. */}
            <div mix={stackStyle}>
              <p aria-live="polite" mix={noteStyle}>
                {temperatureNote(t)}
              </p>
              {NOTE_TEMPS.map((at) => (
                <Ghost key={at}>
                  <p mix={noteStyle}>{temperatureNote(at)}</p>
                </Ghost>
              ))}
            </div>
          </div>
        </div>
      )
    }
  },
)

/** One temperature per `temperatureNote` band. */
const NOTE_TEMPS = [0, 0.3, 0.8, 1.2]

const NARROW = '@media (max-width: 480px)'

const blankStyle = css({ color: 'var(--text)' })
const labelStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const sliderRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
})
const sliderLabel = css({ paddingTop: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const sliderStyle = css({
  flex: 1,
  minWidth: '180px',
  height: '32px',
  marginTop: 'var(--space-3)',
  accentColor: 'var(--volt)',
  cursor: 'pointer',
  '&:focus-visible': focusOutline,
  [NARROW]: { minWidth: 0, flexBasis: '100%', order: 3 },
})
const badgeStyle = css({
  padding: 'var(--space-1_5) var(--space-2_5)',
  marginTop: 'var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-panel)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  color: 'var(--volt)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '44px',
  textAlign: 'center',
})
const noteStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.5, color: 'var(--muted)' })
