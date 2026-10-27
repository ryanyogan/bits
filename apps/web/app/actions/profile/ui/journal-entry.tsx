import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { EmptyState } from '@bits/ui/empty-state'

import type { JournalEntry } from '../data.ts'

/** A list of JournalEntry cards (components §11.4). Private: never on the public profile. */
export function JournalList(handle: Handle<{ entries: JournalEntry[] }>) {
  return () => {
    let { entries } = handle.props
    if (!entries.length) {
      return <EmptyState title="Prompts you write in lessons land here." />
    }
    return (
      <ol mix={listStyle}>
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

const listStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })
const entryStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-4) var(--space-4_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-bar)',
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
