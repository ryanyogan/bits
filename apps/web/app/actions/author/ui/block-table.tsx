import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { blocks } from '../data.ts'

/**
 * BlockTable (components §13.4): the `:::block` reference. Scrolls inside its
 * rounded wrapper below 760px, which is a focusable, labelled region.
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
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--line)',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
const tableStyle = css({ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: 'var(--fs-14)' })
const headRow = css({ background: 'var(--surface)', textAlign: 'left' })
const thStyle = css({
  padding: 'var(--space-3_5) var(--space-4_5)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  textAlign: 'left',
})
const bodyRow = css({ borderTop: '1px solid var(--line-bar)' })
const tdStyle = css({ padding: 'var(--space-3_5) var(--space-4_5)', textAlign: 'left' })
const nameStyle = css({ fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--volt)', whiteSpace: 'nowrap' })
const attrsStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--synapse-soft)' })
const whatStyle = css({ color: 'var(--text-body)', lineHeight: 1.5 })
