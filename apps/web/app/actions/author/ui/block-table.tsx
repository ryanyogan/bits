import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { blocks } from '../data.ts'

/**
 * BlockTable (components §13.4): the `:::block` reference. Flush in its
 * ruled band (decision 047): hairline rows, the first column at the section
 * inset. Scrolls sideways inside its wrapper below 760px, which is a
 * focusable, labelled region.
 */
export function BlockTable(handle: Handle<{ label?: string }>) {
  return () => (
    <div tabIndex={0} role="region" aria-label={handle.props.label ?? 'Block reference'} mix={wrapStyle}>
      <table mix={tableStyle}>
        <thead>
          <tr mix={headRow}>
            <th scope="col" mix={thStyle}>Block</th>
            <th scope="col" mix={thStyle}>Attributes</th>
            <th scope="col" mix={thStyle}>Renders as</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.name} mix={bodyRow}>
              <th scope="row" mix={[tdStyle, nameStyle]}>{block.name}</th>
              <td mix={[tdStyle, attrsStyle]}>{block.attrs}</td>
              <td mix={[tdStyle, whatStyle]}>{block.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const wrapStyle = css({
  overflowX: 'auto',
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
})
const tableStyle = css({ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: 'var(--fs-14)' })
const headRow = css({ textAlign: 'left', borderBottom: 'var(--border-w) solid var(--line-cell)' })
const thStyle = css({
  padding: 'var(--space-3_5) var(--space-4_5)',
  // The outer columns sit at the section inset, in line with the bands above.
  '&:first-child': { paddingLeft: 'var(--section-pad-x)' },
  '&:last-child': { paddingRight: 'var(--section-pad-x)' },
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  textAlign: 'left',
})
const bodyRow = css({ borderTop: 'var(--border-w) solid var(--line-cell)', '&:hover': { background: 'var(--fill-hover)' } })
const tdStyle = css({
  padding: 'var(--space-3_5) var(--space-4_5)',
  textAlign: 'left',
  '&:first-child': { paddingLeft: 'var(--section-pad-x)' },
  '&:last-child': { paddingRight: 'var(--section-pad-x)' },
})

const nameStyle = css({ fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--volt)', whiteSpace: 'nowrap' })
const attrsStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--synapse-soft)' })
const whatStyle = css({ color: 'var(--text-body)', lineHeight: 1.5 })
