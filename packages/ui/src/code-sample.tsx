import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import type { CodeSegment } from './code-editor.tsx'
import { CopyButton } from './copy-button.tsx'
import { syntaxStyle } from './lib/syntax.ts'

export interface CodeSampleProps {
  /** Highlighted at build time (the same segments as the `:::code` editor). */
  lines: CodeSegment[][]
  /** Language name in the strip, e.g. "TypeScript". */
  language: string
  /** Show the Copy key (default true). */
  copy?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * A static, read-only code sample: a ``` fence in lesson prose (decision
 * 061). A mono strip with the language and a Copy key, then the code in a
 * `<pre>` that scrolls sideways (focusable, named). The editor's syntax
 * colours, none of its tabs, drafts or type mode. Static; only Copy is an
 * island.
 */
export function CodeSample(handle: Handle<CodeSampleProps>) {
  return () => {
    let { lines, language, copy = true, mix } = handle.props
    let text = lines.map((line) => line.map(([, part]) => part).join('')).join('\n')
    return (
      <figure mix={[frameStyle, mix]}>
        <figcaption mix={stripStyle}>
          <span>{language}</span>
          {copy ? <CopyButton text={text} label={`${language} sample`} /> : null}
        </figcaption>
        {/* No <code> inside: prose styles colour inline `code`, and these runs bring their own colours. */}
        <pre role="region" aria-label={`${language} sample`} tabIndex={0} mix={preStyle}>
          {lines.map((line, n) => (
            <span key={n}>
              {line.map(([kind, part], i) => (
                <span key={i} mix={syntaxStyle[kind]}>
                  {part}
                </span>
              ))}
              {n < lines.length - 1 ? '\n' : null}
            </span>
          ))}
        </pre>
      </figure>
    )
  }
}

// Squared and flat (decision 047): a hairline, the well fill, an ink strip.
const frameStyle = css({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  // Long lines scroll inside the sample, never widen the column.
  contain: 'inline-size',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-glass)',
})
const stripStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  minHeight: 'var(--control-md)',
  padding: '0 var(--space-1_5) 0 var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  background: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1,
  color: 'var(--muted)',
})
const preStyle = css({
  margin: 0,
  overflowX: 'auto',
  padding: 'var(--space-3_5) var(--space-4) var(--space-4)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.75,
  whiteSpace: 'pre',
  tabSize: 2,
  scrollbarWidth: 'thin',
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (max-width: 480px)': { fontSize: 'var(--fs-13)' },
})
