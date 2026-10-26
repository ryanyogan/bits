import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Tag } from '@bits/ui/tag'

export type BuildStatus = 'live' | 'draft' | 'warning' | 'error'

/**
 * MetaTag tinted by build status (Authoring spec, "/author course list"):
 * volt live, ion draft, warn warnings, danger errors.
 */
export function StatusTag(handle: Handle<{ status: BuildStatus; children: string }>) {
  return () => (
    <Tag variant="meta" mix={[tagStyle, tones[handle.props.status]]}>
      {handle.props.children}
    </Tag>
  )
}

const tagStyle = css({ fontSize: 'var(--fs-12)', padding: 'var(--space-1) var(--space-2_25)' })
const tones = {
  live: css({ color: 'var(--volt)', borderColor: 'var(--volt-a35)' }),
  draft: css({ color: 'var(--ion)', borderColor: 'var(--ion-a35)' }),
  warning: css({ color: 'var(--warn)', borderColor: 'var(--warn-line)', background: 'var(--warn-tint)' }),
  error: css({ color: 'var(--danger)', borderColor: 'var(--danger-line)', background: 'var(--danger-tint)' }),
}
