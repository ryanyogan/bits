import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CodeSample } from '@bits/ui/code-sample'

import { formatDay } from '../../course/course-data.ts'
import type { LessonContent } from '../content.ts'

/**
 * The lesson's metadata above its first block (decision 073): a quiet line
 * saying when its code was last verified and with which packages, and, for
 * a build-along lesson, the repo tag it starts from with the git commands.
 * Renders nothing when the lesson has neither. Static.
 */
export function LessonMeta(handle: Handle<{ content: LessonContent }>) {
  return () => {
    let { freshness, start } = handle.props.content
    let versions = freshness?.versions ?? []
    if (!freshness && !start) return null
    return (
      <div mix={metaStyle}>
        {freshness ? (
          <p mix={lineStyle}>
            {freshness.verified ? (
              <span>
                {'Verified '}
                <time datetime={freshness.verified}>{formatDay(freshness.verified)}</time>
              </span>
            ) : null}
            {versions.map(([name, version]) => (
              <span key={name}>
                <span mix={nameStyle}>{name}</span> {version}
              </span>
            ))}
          </p>
        ) : null}
        {start ? (
          <div mix={startStyle}>
            <p mix={startLine}>
              {'Start from '}
              {/* GitHub is another origin: a document load, never prefetched (decisions 020, 042). */}
              <a href={start.href} rel="noopener" data-rmx-document mix={tagLink}>
                <code>{start.tag}</code>
                <span aria-hidden="true"> ↗</span>
                <span class="sr-only"> on GitHub</span>
              </a>
              {'. Starting here, or behind? Get the code at that tag:'}
            </p>
            <CodeSample lines={start.lines} language={start.language} />
          </div>
        ) : null}
      </div>
    )
  }
}

const metaStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const lineStyle = css({
  margin: 0,
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: 'var(--space-2)',
  rowGap: 'var(--space-1)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1.5,
  color: 'var(--muted)',
  '& > * + *::before': { content: '"·"', marginRight: 'var(--space-2)', color: 'var(--dim)' },
})
const nameStyle = css({ color: 'var(--text-quiet)' })
const startStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 })
const startLine = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })
const tagLink = css({
  color: 'var(--volt)',
  '& code': { fontFamily: 'var(--font-mono)', fontSize: '0.93em' },
})
