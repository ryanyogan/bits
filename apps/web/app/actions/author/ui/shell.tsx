import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'

/** The Authoring `<main>` column (spec §2): 1280 max, 56/32/96, gap 40. */
export const authorMain = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-10)',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--space-4) var(--space-16)', gap: 'var(--space-7)' },
})

export interface AuthorHeaderProps {
  eyebrow: string
  title: string
  lead?: RemixNode
}

/** Header (spec §2a): literal-caps volt eyebrow, display-l h1, optional lead. */
export function AuthorHeader(handle: Handle<AuthorHeaderProps>) {
  return () => {
    let { eyebrow, title, lead } = handle.props
    return (
      <div mix={headerStyle}>
        <Eyebrow as="p" uppercase={false}>
          {eyebrow}
        </Eyebrow>
        <h1 mix={titleStyle}>{title}</h1>
        {lead ? <p mix={leadStyle}>{lead}</p> : null}
      </div>
    )
  }
}

const headerStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)', maxWidth: '720px', minWidth: 0 })
// Type role `display-l` (tokens.md): Unbounded 800, clamp(36px, 5vw, 64px), lh 1, -0.04em.
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 5vw, 64px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
  overflowWrap: 'anywhere',
})
const leadStyle = css({
  margin: 0,
  fontSize: 'var(--fs-18)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
  '& code': { fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  '& code[data-tone="volt"]': { color: 'var(--volt)' },
})
