import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { Crosshair } from './crosshair.tsx'
import { FORCED_COLORS } from './lib/states.ts'
import { stripAsideStyle, stripLabelStyle, stripStyle } from './lib/strip.ts'

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
  /**
   * The strip label's element: `p` (default) when the section's heading is
   * elsewhere, or `h2` / `h3` when the label *is* the heading. A heading
   * label takes `labelId`, and the section is labelled by it unless
   * `aria-labelledby` says otherwise.
   */
  labelAs?: 'p' | 'h2' | 'h3'
  /** id of the strip label, for `aria-labelledby`. */
  labelId?: string
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
  /**
   * A plate of its own (default): `--section-gap` of ground above it, then
   * its full-bleed top rule. Off, the section continues the block above
   * it (an app bar, a header, the section before): no gap and no top rule,
   * since that block drew the line.
   */
  rule?: boolean
  /** The `+` marks where the rules cross the rails (default). */
  marks?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * One framed plate of a ruled page (decisions 047, 050): its own two
 * hairline rails, a rule above and below it that runs the full width of
 * the screen, `+` marks where those rules cross the rails, an optional
 * mono header strip (`02 / How it works`, with an `aside` at the far end)
 * and a padded body.
 *
 * Use it inside a `PageFrame`, one after another. Each plate keeps
 * `--section-gap` of the page's ground above it, so the ground shows
 * between sections; `rule={false}` joins a section to the block above
 * instead (the first band under an app bar or header, or the grid under
 * its toolbar). The strip draws the hairline under itself, so a flush
 * `CellGrid` right under it takes `top={false}`. Static.
 */
export function RuledSection(handle: Handle<RuledSectionProps>) {
  return () => {
    let {
      as = 'section',
      id,
      index,
      label,
      labelAs = 'p',
      labelId,
      aside,
      tone = 'volt',
      pad = 'default',
      rule = true,
      marks = true,
      mix,
      children,
    } = handle.props
    let hasHead = index !== undefined || label !== undefined || aside !== undefined
    let labelContent = (
      <>
        {index !== undefined ? (
          <>
            <span mix={toneStyles[tone]}>{index}</span>
            <span aria-hidden="true" mix={slashStyle}>
              {' / '}
            </span>
          </>
        ) : null}
        {label}
      </>
    )
    let labelEl =
      labelAs === 'h2' ? (
        <h2 id={labelId} mix={stripLabelStyle}>{labelContent}</h2>
      ) : labelAs === 'h3' ? (
        <h3 id={labelId} mix={stripLabelStyle}>{labelContent}</h3>
      ) : (
        <p id={labelId} mix={stripLabelStyle}>{labelContent}</p>
      )
    let content = (
      <>
        {rule && marks ? (
          <>
            <Crosshair placement="top-start" />
            <Crosshair placement="top-end" />
          </>
        ) : null}
        {hasHead ? (
          <div mix={stripStyle}>
            {labelEl}
            {aside !== undefined ? <div mix={stripAsideStyle}>{aside}</div> : null}
          </div>
        ) : null}
        <div mix={padStyles[pad]}>{children}</div>
        {marks ? (
          <>
            <Crosshair placement="bottom-start" />
            <Crosshair placement="bottom-end" />
          </>
        ) : null}
      </>
    )
    let styles = [sectionStyle, rule ? plateStyle : undefined, mix]
    let labelledBy = handle.props['aria-labelledby'] ?? (labelAs !== 'p' ? labelId : undefined)
    let a11y = { id, 'aria-labelledby': labelledBy, 'aria-label': handle.props['aria-label'] }
    if (as === 'div') return <div {...a11y} mix={styles}>{content}</div>
    if (as === 'header') return <header {...a11y} mix={styles}>{content}</header>
    if (as === 'footer') return <footer {...a11y} mix={styles}>{content}</footer>
    return <section {...a11y} mix={styles}>{content}</section>
  }
}

// The rules are wider than the column: 100vw, centred on it (the column is
// centred on the page). html clips horizontal overflow (base.css), so the
// part under a classic scrollbar never makes the page scroll sideways.
const fullBleedRule = {
  content: '""',
  position: 'absolute',
  left: '50%',
  width: '100vw',
  height: 'var(--border-w)',
  transform: 'translateX(-50%)',
  background: 'var(--line-section)',
  pointerEvents: 'none',
} as const

// Every section draws its rails and the rule along its bottom edge: the
// plate is closed whatever follows it (a gap, the next plate, the page end).
const sectionStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  borderInline: 'var(--border-w) solid var(--line-rail)',
  '&::after': { ...fullBleedRule, bottom: 0 },
  [FORCED_COLORS]: {
    borderColor: 'GrayText',
    '&::after': { forcedColorAdjust: 'none', background: 'GrayText' },
  },
})

// A plate of its own: the ground shows above it, then its top rule.
const plateStyle = css({
  marginTop: 'var(--section-gap)',
  '&::before': { ...fullBleedRule, top: 0 },
  [FORCED_COLORS]: { '&::before': { forcedColorAdjust: 'none', background: 'GrayText' } },
})

const slashStyle = css({ color: 'var(--dim)' })

const toneStyles: Record<RuledSectionTone, ReturnType<typeof css>> = {
  volt: css({ color: 'var(--volt)' }),
  ion: css({ color: 'var(--ion)' }),
  synapse: css({ color: 'var(--synapse)' }),
  muted: css({ color: 'var(--muted)' }),
}

const padStyles: Record<RuledSectionPad, ReturnType<typeof css>> = {
  default: css({ padding: 'var(--section-pad-y) var(--section-pad-x)' }),
  tight: css({ padding: 'calc(var(--section-pad-y) / 3) var(--section-pad-x)' }),
  none: css({}),
}
