import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface PanelProps {
  /** The heading's id; the panel is labelled by it. */
  id: string
  /** Short mono heading, sentence case: "Prompt journal". */
  title: RemixNode
  /** Right-hand end of the strip: a count, a link. */
  aside?: RemixNode
  /**
   * The body has no padding and no rule of its own: for a list or
   * `CellGrid` whose rows draw their own top hairline.
   */
  flush?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * One block of the profile's ruled columns (decision 047): a mono strip with
 * an `<h2>` and an aside, then the body. Panels stack with a hairline
 * between them, like the cells of a one-column `CellGrid`; the strip is the
 * `RuledSection` header recipe, with a real heading in it. Static.
 */
export function Panel(handle: Handle<PanelProps>) {
  return () => {
    let { id, title, aside, flush, mix, children } = handle.props
    return (
      <section aria-labelledby={id} mix={[panelStyle, mix]}>
        <div mix={headStyle}>
          <h2 id={id} mix={titleStyle}>
            {title}
          </h2>
          {aside !== undefined ? <div mix={asideStyle}>{aside}</div> : null}
        </div>
        <div mix={flush ? flushStyle : bodyStyle}>{children}</div>
      </section>
    )
  }
}

const panelStyle = css({
  minWidth: 0,
  '& + &': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  '@media (forced-colors: active)': { '& + &': { borderColor: 'GrayText' } },
})
const headStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--cell-pad)',
  boxSizing: 'border-box',
})
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  fontWeight: 400,
  lineHeight: 1.4,
  color: 'var(--muted)',
})
const asideStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})
const bodyStyle = css({
  padding: 'var(--space-6) var(--cell-pad) var(--space-8)',
  borderTop: 'var(--border-w) solid var(--line-cell)',
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})
const flushStyle = css({ minWidth: 0 })

/** A mono link for a panel's aside: "All 12 →". Raised to the 44px touch target. */
export const panelLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  margin: 'calc((var(--touch-target) - 1lh) / -2) 0',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})

/**
 * A flush list whose items are rows of the panel: each draws the hairline
 * above it, so the strip's bottom and the rows' tops are one line each.
 */
export const panelListStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& > li': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  '@media (forced-colors: active)': { '& > li': { borderColor: 'GrayText' } },
})
