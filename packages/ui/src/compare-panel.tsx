import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { IllustrativeTag } from './toy-panel.tsx'
import { modelPanelStyle } from './tutor.tsx'

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
 * on desktop and stacked under 640px. Each answer uses the `ModelOutput`
 * panel look. Static, no JS.
 */
export function ComparePanel(handle: Handle<ComparePanelProps>) {
  return () => {
    let { left, right, rows, illustrative, mix } = handle.props
    return (
      <div role="group" aria-label={`${left} vs ${right}`} mix={[wrapStyle, mix]}>
        {illustrative ? (
          <p mix={tagRow}>
            <IllustrativeTag />
          </p>
        ) : null}
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
      <figure mix={[modelPanelStyle, sideStyle, tone === 'muted' ? mutedSide : undefined]}>
        <figcaption mix={[metaStyle, tone === 'muted' ? mutedMeta : undefined]}>{label}</figcaption>
        <p mix={textStyle}>{text}</p>
      </figure>
    )
  }
}

const wrapStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
const tagRow = css({ margin: 0, display: 'flex', justifyContent: 'flex-end' })
const rowStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const promptStyle = css({
  margin: 0,
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'baseline',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bubble)',
})
const promptLabel = css({ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const promptText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
const columns = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-3)',
  '@media (max-width: 639px)': { gridTemplateColumns: '1fr' },
})
const sideStyle = css({ margin: 0, minWidth: 0 })
const mutedSide = css({ borderColor: 'var(--line-strong)', background: 'var(--well)' })
const metaStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const mutedMeta = css({ color: 'var(--muted)' })
const textStyle = css({ margin: 0, fontSize: 'var(--fs-16)', lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
