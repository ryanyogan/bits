import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface CheckChipProps {
  passed?: boolean
  /** Authoring preview: 12px, tighter. */
  compact?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** A live prompt check (components §10.10), rendered as an `<li>`. Static; the composer island re-renders it. */
export function CheckChip(handle: Handle<CheckChipProps>) {
  return () => {
    let { passed, compact, mix, children } = handle.props
    return (
      <li data-passed={passed ? 'true' : 'false'} mix={[chipStyle, compact ? compactStyle : undefined, mix]}>
        <span aria-hidden="true" mix={markStyle}>
          {passed ? '✓' : '○'}
        </span>
        {children}
        <span class="sr-only">{passed ? ', passed' : ', not yet'}</span>
      </li>
    )
  }
}

/** Wrap CheckChips in `<ul aria-label="Checks">` with this style. */
export const checkListStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })

const chipStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-1_5) var(--space-2_5)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--fs-13)',
  border: 'var(--border-w) solid var(--line-strong)',
  color: 'var(--muted)',
  transition: 'background-color var(--duration-focus), border-color var(--duration-focus), color var(--duration-focus)',
  '&[data-passed="true"]': { background: 'var(--volt-tint-on)', borderColor: 'var(--volt-a45)', color: 'var(--volt-soft)' },
})
const compactStyle = css({ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-12)' })
const markStyle = css({ fontFamily: 'var(--font-mono)' })
