import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { IllustrativeTag, toyContextStyle, toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'

export interface CompareRow {
  /** The shared prompt both sides answered (optional). */
  prompt?: string
  left: string
  right: string
}

export interface ComparePanelProps {
  /** Column labels, e.g. "Base model" / "Assistant". */
  left: string
  right: string
  rows: CompareRow[]
  illustrative?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * `:::compare` (lesson toy): the same prompt answered two ways, side by side
 * on desktop and stacked under 640px. A ruled panel (decision 047): a mono
 * header strip, then per row the prompt strip and the two answers as cells
 * sharing one hairline. Static, no JS.
 */
export function ComparePanel(handle: Handle<ComparePanelProps>) {
  return () => {
    let { left, right, rows, illustrative, mix } = handle.props
    return (
      <div role="group" aria-label={`${left} vs ${right}`} mix={[toyPanelStyle, mix]}>
        <div mix={toyHeaderStyle}>
          <span mix={toyContextStyle}>{`${left} vs ${right}`}</span>
          <span mix={tagRow}>
            {illustrative ? <IllustrativeTag /> : null}
            <span mix={toyLabelStyle}>compare</span>
          </span>
        </div>
        {rows.map((row, i) => (
          <div key={i} mix={rowStyle}>
            {row.prompt ? (
              <p mix={promptStyle}>
                <span mix={promptLabel}>prompt</span>
                <span mix={promptText}>{row.prompt}</span>
              </p>
            ) : null}
            <div mix={columns}>
              <Side label={left} text={row.left} tone="muted" />
              <Side label={right} text={row.right} tone="ion" />
            </div>
          </div>
        ))}
      </div>
    )
  }
}

function Side(handle: Handle<{ label: string; text: string; tone: 'muted' | 'ion' }>) {
  return () => {
    let { label, text, tone } = handle.props
    return (
      <figure data-tone={tone} mix={sideStyle}>
        <figcaption mix={metaStyle}>{label}</figcaption>
        <p mix={textStyle}>{text}</p>
      </figure>
    )
  }
}

const tagRow = css({ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' })
// Rows are bands of the panel, split by hairlines.
const rowStyle = css({ display: 'flex', flexDirection: 'column', '& + &': { borderTop: 'var(--border-w) solid var(--line-cell)' } })
const promptStyle = css({
  margin: 0,
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'baseline',
  padding: 'var(--space-3) var(--space-5)',
  background: 'var(--bubble)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 480px)': { paddingInline: 'var(--space-4)' },
})
const promptLabel = css({ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const promptText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
// Two cells sharing one hairline: the 1px gap shows the line-coloured ground.
const columns = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--border-w)',
  background: 'var(--line-cell)',
  '@media (max-width: 639px)': { gridTemplateColumns: '1fr' },
  '@media (forced-colors: active)': { background: 'CanvasText' },
})
const sideStyle = css({
  margin: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-4) var(--space-5)',
  background: 'var(--surface)',
  // The answer the lesson is about gets the ion signal on its top edge.
  '&[data-tone="ion"]': { background: 'var(--ion-a04)', boxShadow: 'inset 0 2px 0 var(--ion-a55)' },
  '&[data-tone="muted"] figcaption': { color: 'var(--muted)' },
  '@media (max-width: 480px)': { paddingInline: 'var(--space-4)' },
})
const metaStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const textStyle = css({ margin: 0, fontSize: 'var(--fs-16)', lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
