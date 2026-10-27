import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Icon, type IconName } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { Tag } from '@bits/ui/tag'

import { routes } from '../../../routes.ts'
import type { MethodKind, SignInMethod } from '../data.ts'
import { confirmButtonStyle, ConfirmDisclosure, summaryStyle } from './confirm-disclosure.tsx'

const icons: Record<MethodKind, IconName> = { email: 'mail', github: 'github', google: 'globe', passkey: 'key' }

/**
 * One sign-in method (Settings §3): the ProviderButton shell as a list row
 * with icon, name, meta and its action. Remove/Disconnect confirm inline in a
 * `<details>`, so they work without JS.
 */
export function MethodRow(handle: Handle<{ method: SignInMethod }>) {
  return () => {
    let { method } = handle.props
    let provider = method.kind === 'github' || method.kind === 'google' ? method.kind : null
    let labelId = `method-${method.id}`

    return (
      <li mix={rowStyle} aria-labelledby={labelId}>
        <span mix={iconStyle}>
          <Icon name={icons[method.kind]} size={18} color={method.kind === 'passkey' ? 'var(--volt)' : 'var(--text)'} />
        </span>
        <span mix={labelStyle}>
          <span id={labelId} mix={nameStyle}>
            {method.name}
          </span>
          <span mix={metaStyle}>{method.connected ? method.meta : 'Not connected'}</span>
        </span>
        <span mix={actionStyle}>
          {method.kind === 'email' ? (
            <Tag variant="meta" mix={alwaysOnStyle}>
              always on
            </Tag>
          ) : provider && !method.connected ? (
            <Keycap
              variant="dark"
              document
              href={routes.auth.oauth.start.href(
                { provider },
                { searchParams: { link: '1', next: routes.settings.index.href() } },
              )}
              aria-describedby={labelId}
            >
              Connect
            </Keycap>
          ) : method.kind === 'passkey' ? (
            <>
              <ConfirmDisclosure label="Rename" describedBy={labelId}>
                <form method="post" action={routes.settings.methods.href()} mix={renameFormStyle}>
                  <input
                    name="name"
                    aria-label={`New name for ${method.name}`}
                    value={method.name}
                    required
                    maxLength={60}
                    autoComplete="off"
                    mix={renameInputStyle}
                  />
                  <button type="submit" name="intent" value={`rename:${method.id}`} mix={saveButtonStyle}>
                    Save
                  </button>
                </form>
              </ConfirmDisclosure>
              <ConfirmDisclosure label="Remove" describedBy={labelId}>
                <form method="post" action={routes.settings.methods.href()}>
                  <button type="submit" name="intent" value={`remove:${method.id}`} mix={confirmButtonStyle}>
                    Remove passkey
                  </button>
                </form>
              </ConfirmDisclosure>
            </>
          ) : (
            <ConfirmDisclosure label={provider ? 'Disconnect' : 'Remove'} describedBy={labelId}>
              <form method="post" action={routes.settings.methods.href()}>
                <button
                  type="submit"
                  name="intent"
                  value={provider ? `disconnect:${provider}` : `remove:${method.id}`}
                  mix={confirmButtonStyle}
                >
                  {provider ? `Disconnect ${method.name}` : 'Remove passkey'}
                </button>
              </form>
            </ConfirmDisclosure>
          )}
        </span>
      </li>
    )
  }
}

const rowStyle = css({
  minHeight: '56px',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2) var(--space-3)',
  padding: 'var(--space-1_5) var(--space-2) var(--space-1_5) var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: '1px solid var(--line-strong)',
  background: 'var(--well)',
})

const iconStyle = css({ flex: 'none', display: 'grid', placeItems: 'center' })

const labelStyle = css({
  flex: '1 1 200px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0_5)',
})

const nameStyle = css({ fontSize: 'var(--fs-15)', fontWeight: 500, color: 'var(--text)' })

const metaStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1.5,
  color: 'var(--muted)',
  overflowWrap: 'anywhere',
})

const renameFormStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' })

const renameInputStyle = css({
  minHeight: 'var(--touch-target)',
  flex: '1 1 10rem',
  minWidth: 0,
  maxWidth: '14rem',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--line-control)',
  background: 'var(--ink)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-15)',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})

// Ghost-mono, like the summaries; a summary style reused on a real button.
const saveButtonStyle = summaryStyle

// The action wraps to its own line under the label on narrow rows (Settings, responsive).
const actionStyle = css({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  '@media (max-width: 480px)': { flexBasis: '100%', marginLeft: '30px', paddingBottom: 'var(--space-1_5)' },
})

const alwaysOnStyle = css({ marginRight: 'var(--space-2)', color: 'var(--muted)' })
