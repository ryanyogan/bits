import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'
import { stripAsideStyle, stripLabelStyle, stripLinkStyle, stripStyle } from './lib/strip.ts'

export interface PanelProps {
  /** The heading's id; the panel is labelled by it. */
  id: string
  /** Short mono heading, sentence case: "Prompt journal". */
  title: RemixNode
  /** Heading level (default 2). */
  level?: 2 | 3
  /** Right-hand end of the strip: a count, a link (`panelLinkStyle`). */
  aside?: RemixNode
  /**
   * No body padding: for a list (`panelListStyle`) or a `CellGrid`
   * (`top={false}`) whose rows reach the cell's edges. The strip already
   * draws the hairline above the first row.
   */
  flush?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * One block inside a grid cell (decision 047): the `RuledSection` strip,
 * with a real heading in it, then the body. Panels stacked in one cell
 * share a hairline, like the cells of a one-column `CellGrid`. Where
 * `RuledSection` is a band of the whole frame, a Panel is a part of a
 * column (the profile's columns, the course page's aside). Static.
 */
export function Panel(handle: Handle<PanelProps>) {
  return () => {
    let { id, title, level = 2, aside, flush, mix, children } = handle.props
    return (
      <section aria-labelledby={id} mix={[panelStyle, mix]}>
        <div mix={stripStyle}>
          {level === 3 ? (
            <h3 id={id} mix={stripLabelStyle}>
              {title}
            </h3>
          ) : (
            <h2 id={id} mix={stripLabelStyle}>
              {title}
            </h2>
          )}
          {aside !== undefined ? <div mix={stripAsideStyle}>{aside}</div> : null}
        </div>
        <div mix={flush ? flushStyle : bodyStyle}>{children}</div>
      </section>
    )
  }
}

const panelStyle = css({
  minWidth: 0,
  '& + &': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  [FORCED_COLORS]: { '& + &': { borderColor: 'GrayText' } },
})
const bodyStyle = css({ padding: 'var(--space-6) var(--cell-pad) var(--space-8)' })
const flushStyle = css({ minWidth: 0 })

/** A mono link for a panel's (or a section strip's) aside: "All 12 →". */
export const panelLinkStyle = stripLinkStyle

/**
 * A flush list whose items are rows of the panel, with a hairline between
 * rows (the strip draws the one above the first).
 */
export const panelListStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& > li + li': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  [FORCED_COLORS]: { '& > li + li': { borderColor: 'GrayText' } },
})
