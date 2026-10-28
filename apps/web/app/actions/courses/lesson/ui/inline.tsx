import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Inline, Paragraph } from '../content.ts'

/**
 * Inline markdown as JSX. `plain` output carries no mixins, so it can be
 * passed into an island (TerminalLog entries), which styles `strong`, `code`
 * and `mark` itself. Links: a same-origin path is a normal client-routed
 * link that prefetches on intent (decision 042); an https URL leaves the
 * site with rel="noopener noreferrer".
 */
export function inlineNodes(paragraph: Paragraph, plain = false): RemixNode[] {
  return paragraph.map((part: Inline, i) => {
    if (typeof part === 'string') return part
    if ('strong' in part) return <strong key={i}>{part.strong}</strong>
    if ('code' in part) return <code key={i}>{part.code}</code>
    if ('link' in part) return inlineLink(part.href, part.link, i)
    return plain ? (
      <mark key={i}>{part.mark}</mark>
    ) : (
      <mark key={i} mix={markStyle}>
        {part.mark}
      </mark>
    )
  })
}

function inlineLink(href: string, text: string, key: number) {
  let external = !href.startsWith('/')
  return (
    <a key={key} href={href} rel={external ? 'noopener noreferrer' : undefined} data-rmx-prefetch={prefetchFor(href)}>
      {text}
    </a>
  )
}

/** Plain text of a paragraph (aria labels, quiz legends). */
export function inlineText(paragraph: Paragraph): string {
  return paragraph
    .map((part) => {
      if (typeof part === 'string') return part
      if ('strong' in part) return part.strong
      if ('code' in part) return part.code
      if ('link' in part) return part.link
      return part.mark
    })
    .join('')
}

// The CodeLesson "line 31" chip, for Read mode.
const markStyle = css({
  color: 'var(--text)',
  background: 'var(--volt-a14)',
  padding: '0 var(--space-1)',
  borderRadius: 'var(--radius-4)',
  // Forced colours keep the tint's alpha on the Mark colour, which leaves
  // MarkText unreadable: paint the system pair solid (decision 025).
  '@media (forced-colors: active)': { forcedColorAdjust: 'none', background: 'Mark', color: 'MarkText' },
})
