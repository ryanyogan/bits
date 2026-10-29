import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

export interface ToyPanelProps {
  /** Mono text on the left of the header, e.g. the prompt. */
  context?: RemixNode
  /** Ion label on the right, e.g. "next-token odds". */
  label: string
  /** Adds an "illustrative" tag: the numbers are made up to teach, not measured. */
  illustrative?: boolean
  /** Accessible name of the region; defaults to the label. */
  name?: string
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The lesson-toy frame (components §10.12, the `OddsBars` panel): a ruled
 * panel (decision 047) with a mono header strip over a hairline, a small
 * square ion signal before the label, and a padded body. Used by the `:::nexttoken`, `:::training` and
 * `:::attention` islands. Static.
 */
export function ToyPanel(handle: Handle<ToyPanelProps>) {
  return () => {
    let { context, label, illustrative, name, mix, children } = handle.props
    return (
      <div role="group" aria-label={name ?? label} mix={[toyPanelStyle, mix]}>
        <div mix={toyHeaderStyle}>
          {context === undefined ? <span /> : <span mix={toyContextStyle}>{context}</span>}
          <span mix={labelRow}>
            {illustrative ? <IllustrativeTag /> : null}
            <span mix={toyLabelStyle}>{label}</span>
          </span>
        </div>
        <div mix={toyBodyStyle}>{children}</div>
      </div>
    )
  }
}

/**
 * The toys' no-JS content: the full table or list, inside `<noscript>`.
 * The children render on the server only. With scripting on, the browser
 * keeps `<noscript>` content as unparsed text and hydration ignores it, so
 * the client never builds a hidden copy. Static.
 */
export function NoScript(handle: Handle<{ children?: RemixNode }>) {
  return () => <noscript>{typeof document === 'undefined' ? handle.props.children : null}</noscript>
}

/** Hides a control that needs JS (play, step, slider) when scripting is off. */
export const needsScriptStyle = css({ '@media (scripting: none)': { display: 'none' } })

/** "illustrative" chip: toy numbers, not a real model's. Static. */
export function IllustrativeTag() {
  return () => (
    <span title="Made-up numbers that show the idea, not output from a real model" mix={illustrativeStyle}>
      illustrative<span class="sr-only">: made-up numbers that show the idea, not output from a real model</span>
    </span>
  )
}

const NARROW = '@media (max-width: 480px)'

/**
 * The ruled panel (decision 047): a flat surface with a hairline border, no
 * radius or shadow. Its first child is a `toyHeaderStyle` strip and the rest
 * sits in a `toyBodyStyle` body. Shared by every toy, the odds panel, the
 * quiz card and the prompt composer, so the lesson's blocks read as one set.
 */
export const toyPanelStyle = css({
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-panel)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})
/** The panel's header strip: mono, a hairline under it, one line tall at least. */
export const toyHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-1) var(--space-3)',
  flexWrap: 'wrap',
  minHeight: 'var(--control-compact)',
  boxSizing: 'border-box',
  padding: 'var(--space-2) var(--space-5)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  [NARROW]: { padding: 'var(--space-2) var(--space-4)' },
})
/** The panel's body: padded, a column of the toy's parts. */
export const toyBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  minWidth: 0,
  padding: 'var(--space-5)',
  [NARROW]: { padding: 'var(--space-4)' },
})
export const toyContextStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)', overflowWrap: 'anywhere' })
/** The ion label, led by a small square signal (the panel's one accent). */
export const toyLabelStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--ion)',
  '&::before': { content: '""', flex: 'none', width: '6px', height: '6px', background: 'currentColor' },
  [FORCED_COLORS]: { '&::before': { background: 'CanvasText' } },
})
const labelRow = css({ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' })
const illustrativeStyle = css({
  padding: 'var(--space-0_5) var(--space-1_5)',
  borderRadius: 'var(--radius-xs)',
  border: 'var(--border-w) solid var(--line-strong)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--muted)',
  cursor: 'help',
})
/** Mono note under a toy (the odds note). */
export const toyNoteStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.5, color: 'var(--muted)' })
/** Plain fallback table for the toys (no JS). */
export const toyTableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--fs-14)',
  '& caption': { textAlign: 'left', paddingBottom: 'var(--space-2)', color: 'var(--muted)', fontSize: 'var(--fs-13)' },
  '& th': {
    textAlign: 'left',
    fontFamily: 'var(--font-mono)',
    fontWeight: 400,
    fontSize: 'var(--fs-12)',
    color: 'var(--muted)',
    padding: 'var(--space-1_5) var(--space-2)',
    borderBottom: 'var(--border-w) solid var(--line)',
  },
  '& td': { padding: 'var(--space-1_5) var(--space-2)', borderBottom: 'var(--border-w) solid var(--line-hair)', color: 'var(--text-body)', verticalAlign: 'top' },
  '& td[data-mono]': { fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' },
})
