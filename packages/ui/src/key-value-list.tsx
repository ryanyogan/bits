import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface KeyValueItem {
  term: RemixNode
  value: RemixNode
  /** Term colour for the `course` variant numerals, e.g. `var(--ion)`. */
  color?: string
  /** Render the value in Geist Mono 13px (emails, handles). */
  mono?: boolean
}

export interface KeyValueListProps {
  items: KeyValueItem[]
  /** `default` (Profile / Settings) or `course` ("How you'll learn": mono numerals). */
  variant?: 'default' | 'course'
  mix?: MixInput<HTMLElement>
}

/** A two-column `<dl>` (components §8.6). Static. */
export function KeyValueList(handle: Handle<KeyValueListProps>) {
  return () => {
    let { items, variant = 'default', mix } = handle.props
    let course = variant === 'course'
    return (
      <dl mix={[listStyle, course ? courseList : undefined, mix]}>
        {items.map((item, index) => (
          <div key={index} mix={rowStyle}>
            <dt mix={course ? courseTerm : termStyle} style={item.color ? { color: item.color } : undefined}>
              {item.term}
            </dt>
            <dd mix={[course ? courseValue : valueStyle, item.mono ? monoStyle : undefined]}>{item.value}</dd>
          </div>
        ))}
      </dl>
    )
  }
}

const listStyle = css({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 'var(--space-2_5) var(--space-4)',
  fontSize: 'var(--fs-14)',
})
const courseList = css({ gap: 'var(--space-2_5) var(--space-3_5)' })
const rowStyle = css({ display: 'contents' })
const termStyle = css({ color: 'var(--muted)' })
const valueStyle = css({ margin: 0, color: 'var(--text)', minWidth: 0, overflowWrap: 'anywhere' })
const courseTerm = css({ fontFamily: 'var(--font-mono)', color: 'var(--volt)' })
const courseValue = css({ margin: 0, color: 'var(--text-body)' })
const monoStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)' })
