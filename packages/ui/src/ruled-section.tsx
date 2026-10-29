import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { Crosshair } from './crosshair.tsx'
import { FORCED_COLORS } from './lib/states.ts'

export type RuledSectionTone = 'volt' | 'ion' | 'synapse' | 'muted'
export type RuledSectionPad = 'default' | 'tight' | 'none'

export interface RuledSectionProps {
  /** `section` (default; give it `aria-labelledby`), or a plain `div`, `header` or `footer`. */
  as?: 'section' | 'div' | 'header' | 'footer'
  id?: string
  'aria-labelledby'?: string
  'aria-label'?: string
  /**
   * The section's place in a sequence, e.g. `"02"`. Only for content that
   * really is a sequence (the landing's path); shown in `tone`.
   */
  index?: string
  /** A short mono name for the section, after the index: `02 / How it works`. */
  label?: RemixNode
  /** Right-hand end of the header strip: a count, a link, a status. */
  aside?: RemixNode
  /** Colour of the index (default `volt`). */
  tone?: RuledSectionTone
  /**
   * Body padding: `default` is `--section-pad-y` / `--section-pad-x`,
   * `tight` a third of the height, `none` for a flush `CellGrid` (rail to
   * rail) or a component that pads itself.
   */
  pad?: RuledSectionPad
  /** The full-bleed rule above the section (default). Off for the first section under a ruled header. */
  rule?: boolean
  /** The `+` marks where the rule crosses the rails (default, with the rule). */
  marks?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * One band of a ruled page (decision 047): a hairline rule above it that
 * runs the full width of the screen, `+` marks where that rule crosses the
 * `PageFrame` rails, an optional mono header strip (`02 / How it works`,
 * with an `aside` at the far end) and a padded body.
 *
 * Use it inside a `PageFrame`, one after another; the next section's rule
 * closes the one before, so sections never draw a bottom border. Static.
 */
export function RuledSection(handle: Handle<RuledSectionProps>) {
  return () => {
    let {
      as = 'section',
      id,
      index,
      label,
      aside,
      tone = 'volt',
      pad = 'default',
      rule = true,
      marks = true,
      mix,
      children,
    } = handle.props
    let hasHead = index !== undefined || label !== undefined || aside !== undefined
    let content = (
      <>
        {rule && marks ? (
          <>
            <Crosshair placement="top-start" />
            <Crosshair placement="top-end" />
          </>
        ) : null}
        {hasHead ? (
          <div mix={headStyle}>
            <p mix={headLabelStyle}>
              {index !== undefined ? (
                <>
                  <span mix={toneStyles[tone]}>{index}</span>
                  <span aria-hidden="true" mix={slashStyle}>
                    {' / '}
                  </span>
                </>
              ) : null}
              {label}
            </p>
            {aside !== undefined ? <div mix={asideStyle}>{aside}</div> : null}
          </div>
        ) : null}
        <div mix={padStyles[pad]}>{children}</div>
      </>
    )
    let styles = [sectionStyle, rule ? ruleStyle : undefined, mix]
    let a11y = { id, 'aria-labelledby': handle.props['aria-labelledby'], 'aria-label': handle.props['aria-label'] }
    if (as === 'div') return <div {...a11y} mix={styles}>{content}</div>
    if (as === 'header') return <header {...a11y} mix={styles}>{content}</header>
    if (as === 'footer') return <footer {...a11y} mix={styles}>{content}</footer>
    return <section {...a11y} mix={styles}>{content}</section>
  }
}

const sectionStyle = css({ position: 'relative', boxSizing: 'border-box' })

// The rule is wider than the column: 100vw, centred on it (the column is
// centred on the page). body clips horizontal overflow (base.css), so the
// part under a classic scrollbar never makes the page scroll sideways.
const ruleStyle = css({
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '50%',
    width: '100vw',
    height: 'var(--border-w)',
    transform: 'translateX(-50%)',
    background: 'var(--line-section)',
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: { '&::before': { forcedColorAdjust: 'none', background: 'GrayText' } },
})

const headStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--section-pad-x)',
  boxSizing: 'border-box',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
})

const headLabelStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1.4,
  color: 'var(--muted)',
})

const slashStyle = css({ color: 'var(--dim)' })

const toneStyles: Record<RuledSectionTone, ReturnType<typeof css>> = {
  volt: css({ color: 'var(--volt)' }),
  ion: css({ color: 'var(--ion)' }),
  synapse: css({ color: 'var(--synapse)' }),
  muted: css({ color: 'var(--muted)' }),
}

const asideStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})

const padStyles: Record<RuledSectionPad, ReturnType<typeof css>> = {
  default: css({ padding: 'var(--section-pad-y) var(--section-pad-x)' }),
  tight: css({ padding: 'calc(var(--section-pad-y) / 3) var(--section-pad-x)' }),
  none: css({}),
}
