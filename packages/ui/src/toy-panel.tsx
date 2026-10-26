import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

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
 * The lesson-toy frame (components §10.12, the `OddsBars` panel): surface,
 * ion hairline, mono header. Used by the `:::nexttoken`, `:::training` and
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
        {children}
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

export const toyPanelStyle = css({
  padding: 'var(--space-5_5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: '1px solid var(--ion-a28)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  minWidth: 0,
  [NARROW]: { padding: 'var(--space-4)' },
})
export const toyHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
})
export const toyContextStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)', overflowWrap: 'anywhere' })
export const toyLabelStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const labelRow = css({ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' })
const illustrativeStyle = css({
  padding: 'var(--space-0_5) var(--space-1_5)',
  borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--line-strong)',
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
    borderBottom: '1px solid var(--line)',
  },
  '& td': { padding: 'var(--space-1_5) var(--space-2)', borderBottom: '1px solid var(--line-hair)', color: 'var(--text-body)', verticalAlign: 'top' },
  '& td[data-mono]': { fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' },
})
