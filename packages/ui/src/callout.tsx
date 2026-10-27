import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export type CalloutTone = 'ok' | 'warning' | 'danger' | 'info'

export interface CalloutProps {
  tone?: CalloutTone
  /**
   * `alert` announces immediately (validation summary after a failed submit);
   * `status` announces politely; omit for static content.
   */
  role?: 'alert' | 'status'
  /** Mono 13px row (Authoring validation) instead of a 15px message block. */
  compact?: boolean
  title?: RemixNode
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

const marks: Record<CalloutTone, string> = { ok: '✓', warning: '!', danger: '✕', info: 'i' }
const srPrefix: Record<CalloutTone, string> = { ok: 'OK:', warning: 'Warning:', danger: 'Error:', info: 'Note:' }

/**
 * Alert / validation callout (components §13.1 + resolutions §1 danger
 * recipe): ok, warning, danger (validation errors, wrong code, delete
 * account) and info. Static.
 */
export function Callout(handle: Handle<CalloutProps>) {
  return () => {
    let { tone = 'danger', role, compact, title, mix, children } = handle.props
    return (
      <div role={role} mix={[baseStyle, compact ? compactStyle : blockStyle, toneStyles[tone], mix]}>
        <span aria-hidden="true" mix={markStyle}>
          {marks[tone]}
        </span>
        <div mix={bodyStyle}>
          <span class="sr-only">{srPrefix[tone]} </span>
          {title ? <strong mix={titleStyle}>{title}</strong> : null}
          {children}
        </div>
      </div>
    )
  }
}

const baseStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-2_5)',
  borderRadius: 'var(--radius-10)',
  border: 'var(--border-w) solid transparent',
})

const blockStyle = css({
  padding: 'var(--space-3_5) var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
})

const compactStyle = css({
  padding: 'var(--space-2_5) var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
})

const toneStyles: Record<CalloutTone, ReturnType<typeof css>> = {
  ok: css({ background: 'var(--well)', color: 'var(--text-body)', '& > span:first-child': { color: 'var(--volt)' } }),
  warning: css({ background: 'var(--warn-tint)', borderColor: 'var(--warn-line)', color: 'var(--warn)' }),
  danger: css({ background: 'var(--danger-tint)', borderColor: 'var(--danger-line)', color: 'var(--danger)' }),
  info: css({ background: 'var(--ion-a04)', borderColor: 'var(--ion-a25)', color: 'var(--text-body)', '& > span:first-child': { color: 'var(--ion)' } }),
}

const markStyle = css({ flex: 'none', fontFamily: 'var(--font-mono)', fontWeight: 500 })
const bodyStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 })
const titleStyle = css({ fontWeight: 600, color: 'inherit' })
