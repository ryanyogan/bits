import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { busyCaret } from '../../../ui/busy-caret.ts'

export interface ConfirmDisclosureProps {
  /** Closed-state label, e.g. "Remove". Open, the summary reads "Cancel". */
  label: string
  /** Id of the row label, so "Remove" is announced with what it removes. */
  describedBy?: string
  children?: RemixNode
}

/**
 * Inline confirmation without a modal (Settings §3): a `<details>` whose
 * summary is the ghost-mono action; opening it turns the summary into
 * "Cancel" beside the danger-outline confirm button. No JS.
 */
export function ConfirmDisclosure(handle: Handle<ConfirmDisclosureProps>) {
  return () => {
    let { label, describedBy, children } = handle.props
    return (
      <details mix={detailsStyle}>
        <summary aria-describedby={describedBy} mix={summaryStyle}>
          <span data-closed="">{label}</span>
          <span data-open="">Cancel</span>
        </summary>
        {children}
      </details>
    )
  }
}

const detailsStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  '&:not([open]) [data-open], &[open] [data-closed]': { display: 'none' },
})

/** Ghost-mono `sm` (44px, radius 10, 14px) as a summary. */
export const summaryStyle = css({
  listStyle: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '&::-webkit-details-marker': { display: 'none' },
  '&::marker': { content: '""' },
  '&:hover': { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  '@media (max-width: 480px)': { padding: '0 var(--space-3)' },
})

/** Danger-outline confirm (Settings §3, proposed danger recipe). */
export const confirmButtonStyle = [
  css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'var(--touch-target)',
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-10)',
    border: '1px solid var(--danger-line)',
    background: 'transparent',
    color: 'var(--danger)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-14)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
    '&:hover': { background: 'var(--danger-tint)', borderColor: 'var(--danger)' },
    '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
    '@media (max-width: 480px)': { padding: '0 var(--space-3)' },
  }),
  // While the removal is in flight (the navigation runtime sets aria-busy).
  busyCaret,
]
