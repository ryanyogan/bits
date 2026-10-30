import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { CodeSample } from '@bits/ui/code-sample'

import type { Prose, ProseList } from '../content.ts'
import { inlineNodes } from './inline.tsx'

/**
 * The parts of a tutor turn (decision 061): paragraphs, `###` subheadings,
 * lists one level deep and static ``` code samples, in source order. Rendered
 * inside `TutorMessage`, whose column spaces them and styles inline text.
 */
export function proseNodes(parts: readonly Prose[]): RemixNode[] {
  return parts.map((part, i) => {
    if (Array.isArray(part)) return <p key={i}>{inlineNodes(part)}</p>
    if ('heading' in part) {
      // The lesson title is the page's h1, so a subheading is the body's
      // top level: an h2 (decision 061).
      return (
        <h2 key={i} mix={headingStyle}>
          {inlineNodes(part.heading)}
        </h2>
      )
    }
    if ('sample' in part) return <CodeSample key={i} lines={part.sample} language={part.language} mix={sampleStyle} />
    return listNode(part, i)
  })
}

function listNode(list: ProseList, key: number, nested = false): RemixNode {
  let items = list.items.map((item, i) => (
    <li key={i} mix={itemStyle}>
      {item.paragraphs.map((paragraph, n) => (
        <p key={n}>{inlineNodes(paragraph)}</p>
      ))}
      {item.list ? listNode(item.list, item.paragraphs.length, true) : null}
    </li>
  ))
  let style = [listStyle, nested ? nestedStyle : undefined]
  return list.list === 'ordered' ? (
    <ol key={key} start={list.start} mix={[...style, orderedStyle]}>
      {items}
    </ol>
  ) : (
    <ul key={key} mix={[...style, bulletStyle]}>
      {items}
    </ul>
  )
}

const headingStyle = css({
  margin: 0,
  maxWidth: 'var(--type-prose-measure)',
  paddingTop: 'var(--space-0_75)',
  fontSize: 'var(--fs-19)',
  fontWeight: 600,
  lineHeight: 'var(--type-heading-leading)',
  letterSpacing: 'var(--tracking-title)',
  color: 'var(--text)',
  textWrap: 'balance',
})
const listStyle = css({
  margin: 0,
  paddingLeft: 'var(--space-5)',
  maxWidth: 'var(--type-prose-measure)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1_5)',
})
// Squared markers (decision 047), quiet so the text leads.
const bulletStyle = css({ listStyleType: 'square', '& > li::marker': { color: 'var(--dim)' } })
const orderedStyle = css({
  listStyleType: 'decimal',
  '& > li::marker': { color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.88em', fontVariantNumeric: 'tabular-nums' },
})
const nestedStyle = css({ marginTop: 'var(--space-1_5)' })
const itemStyle = css({
  paddingLeft: 'var(--space-1)',
  '& > p + p': { marginTop: 'var(--space-2)' },
})
const sampleStyle = css({ margin: 'var(--space-1) 0' })
