import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface EmptyStateProps {
  title: RemixNode
  hint?: RemixNode
  /** Usually a ghost Keycap ("Clear filters"). */
  action?: RemixNode
  mix?: MixInput<HTMLElement>
}

/** Dashed empty state (components §8.7): "0 results for “x”". Static. */
export function EmptyState(handle: Handle<EmptyStateProps>) {
  return () => {
    let { title, hint, action, mix } = handle.props
    return (
      <div mix={[boxStyle, mix]}>
        <p mix={titleStyle}>{title}</p>
        {hint ? <p mix={hintStyle}>{hint}</p> : null}
        {action ? <div mix={actionStyle}>{action}</div> : null}
      </div>
    )
  }
}

const boxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-12)',
  borderRadius: 'var(--radius-20)',
  border: '1px dashed var(--line-dashed)',
  textAlign: 'center',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--space-4_5)' },
})
const titleStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', color: 'var(--text)' })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-15)', color: 'var(--muted)' })
const actionStyle = css({ marginTop: 'var(--space-1_5)' })
