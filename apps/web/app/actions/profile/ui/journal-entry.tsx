import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { EmptyState } from '@bits/ui/empty-state'

import type { JournalEntry } from '../data.ts'
import { panelListStyle } from './panel.tsx'

/**
 * The prompt journal (components §11.4) as rows of a ruled panel (decision
 * 047): the prompt in mono, then where it was written and how it went.
 * Private: never on the public profile.
 */
export function JournalList(handle: Handle<{ entries: JournalEntry[] }>) {
  return () => {
    let { entries } = handle.props
    if (!entries.length) {
      return (
        <div mix={emptyStyle}>
          <EmptyState title="Prompts you write in lessons land here." />
        </div>
      )
    }
    return (
      <ol mix={panelListStyle}>
        {entries.map((entry, index) => (
          <li key={index} mix={entryStyle}>
            <p mix={promptStyle}>
              <span aria-hidden="true" mix={caretStyle}>
                ›{' '}
              </span>
              {entry.prompt}
            </p>
            <p mix={metaStyle}>
              <span>{entry.lesson}</span>
              <span style={{ color: entry.tone === 'passed' ? 'var(--volt)' : 'var(--ion)' }}>{entry.result}</span>
            </p>
          </li>
        ))}
      </ol>
    )
  }
}

const emptyStyle = css({
  padding: 'var(--space-6) var(--cell-pad)',
  borderTop: 'var(--border-w) solid var(--line-cell)',
})
const entryStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-4) var(--cell-pad)',
})
const promptStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.6,
  color: 'var(--text)',
  overflowWrap: 'anywhere',
})
const caretStyle = css({ color: 'var(--volt)' })
const metaStyle = css({
  margin: 0,
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
