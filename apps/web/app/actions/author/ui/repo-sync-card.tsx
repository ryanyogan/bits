import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { LiveDot } from '@bits/ui/live-dot'
import { TextField } from '@bits/ui/text-field'

import { routes } from '../../../routes.ts'

export interface RepoSyncCardProps {
  repo: { name: string; branch: string; connected: boolean }
  /** Set after a save (303 back to /author?repo=saved). */
  saved?: boolean
}

/**
 * RepoSyncCard (components §13.5): a native POST form, so it works with JS
 * off. Connected shows the drawn state; disconnected swaps the dot and offers
 * "Connect GitHub".
 */
export function RepoSyncCard(handle: Handle<RepoSyncCardProps>) {
  return () => {
    let { repo, saved } = handle.props
    return (
      <form method="post" action={routes.author.repo.href()} aria-labelledby="repo-title" mix={cardStyle}>
        <div mix={headStyle}>
          <Icon name="github" size={22} color="var(--text)" />
          <h2 id="repo-title" mix={titleStyle}>
            Or sync a repo
          </h2>
          {repo.connected ? (
            <LiveDot mix={pushRight}>connected</LiveDot>
          ) : (
            <LiveDot tone="dim" mix={pushRight}>
              not connected
            </LiveDot>
          )}
        </div>
        <div mix={fieldsStyle}>
          <TextField compact name="repository" label="Repository" value={repo.name} autoComplete="off" required />
          <TextField compact name="branch" label="Branch" value={repo.branch} autoComplete="off" required />
        </div>
        <div mix={footStyle}>
          <p mix={noteStyle}>
            Every push to <code>{repo.branch}</code> rebuilds changed courses. Pull requests get a preview link.
          </p>
          <Keycap variant="dark" size="sm" type="submit">
            {repo.connected ? 'Save' : 'Connect GitHub'}
          </Keycap>
        </div>
        <p role="status" mix={statusStyle}>
          {saved ? `Saved. The next push to ${repo.branch} rebuilds your courses.` : ''}
        </p>
      </form>
    )
  }
}

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  minWidth: 0,
  minHeight: '240px',
  margin: 0,
  padding: 'var(--space-7)',
  borderRadius: 'var(--radius-20)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  '@media (max-width: 480px)': { padding: 'var(--space-5)' },
})
const headStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' })
const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-19)',
  lineHeight: 'normal',
  letterSpacing: 'var(--tracking-title)',
})
const pushRight = css({ marginLeft: 'auto' })
const fieldsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
  gap: 'var(--space-2_5)',
})
const footStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' })
const noteStyle = css({
  flex: '1 1 240px',
  margin: 0,
  fontSize: 'var(--fs-14)',
  lineHeight: 1.55,
  color: 'var(--muted)',
  '& code': { fontFamily: 'var(--font-mono)', color: 'var(--text)' },
})
const statusStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  '&:empty': { display: 'none' },
})
