import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'

import type { Inline, Paragraph } from '../content.ts'

/**
 * Inline markdown as JSX. `plain` output carries no mixins, so it can be
 * passed into an island (TerminalLog entries), which styles `strong`, `code`
 * and `mark` itself.
 */
export function inlineNodes(paragraph: Paragraph, plain = false): RemixNode[] {
  return paragraph.map((part: Inline, i) => {
    if (typeof part === 'string') return part
    if ('strong' in part) return <strong key={i}>{part.strong}</strong>
    if ('code' in part) return <code key={i}>{part.code}</code>
    return plain ? (
      <mark key={i}>{part.mark}</mark>
    ) : (
      <mark key={i} mix={markStyle}>
        {part.mark}
      </mark>
    )
  })
}

/** Plain text of a paragraph (aria labels, quiz legends). */
export function inlineText(paragraph: Paragraph): string {
  return paragraph.map((part) => (typeof part === 'string' ? part : Object.values(part)[0])).join('')
}

// The CodeLesson "line 31" chip, for Read mode.
const markStyle = css({
  color: 'var(--text)',
  background: 'var(--volt-a14)',
  padding: '0 var(--space-1)',
  borderRadius: 'var(--radius-4)',
})
