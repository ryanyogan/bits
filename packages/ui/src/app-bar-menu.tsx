import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

export interface AppBarLink {
  href: string
  label: string
}

export interface AppBarMenuProps {
  links: AppBarLink[]
  currentPath?: string
}

/**
 * The narrow-screen navigation menu.
 *
 * A native `<details>` disclosure, so it works with JavaScript off. As a
 * client entry it hydrates to add the behavior a menu needs: Escape closes it
 * and returns focus to the toggle, and a click outside closes it.
 *
 * Props cross the server/browser boundary, so they must stay serializable.
 */
export const AppBarMenu = clientEntry(
  import.meta.url,
  function AppBarMenu(handle: Handle<AppBarMenuProps>) {
    let details: HTMLDetailsElement | undefined

    function close(returnFocus: boolean) {
      if (!details?.open) return
      details.open = false
      if (returnFocus) details.querySelector('summary')?.focus()
    }

    return () => {
      let { links, currentPath } = handle.props

      return (
        <details
          mix={[
            menuStyle,
            ref((node, signal) => {
              details = node as HTMLDetailsElement
              document.addEventListener(
                'click',
                (event) => {
                  if (!node.contains(event.target as Node)) close(false)
                },
                { signal },
              )
            }),
            on('keydown', (event) => {
              if (event.key === 'Escape') close(true)
            }),
          ]}
        >
          <summary mix={summaryStyle}>
            <span class="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </summary>
          <nav aria-label="Primary" mix={panelStyle}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === currentPath ? 'page' : undefined}
                mix={linkStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </details>
      )
    }
  },
)

const menuStyle = css({
  position: 'relative',
  display: 'none',
  '@media (max-width: 760px)': { display: 'block' },
})

const summaryStyle = css({
  listStyle: 'none',
  display: 'grid',
  placeItems: 'center',
  width: 'var(--touch-target)',
  height: 'var(--touch-target)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--line-ghost)',
  color: 'var(--text)',
  cursor: 'pointer',
  '&::-webkit-details-marker': { display: 'none' },
  '&:hover': { background: 'var(--fill-faint)' },
})

const panelStyle = css({
  position: 'absolute',
  right: 0,
  top: 'calc(100% + var(--space-2))',
  minWidth: '220px',
  display: 'flex',
  flexDirection: 'column',
  padding: 'var(--space-2)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  boxShadow: 'var(--shadow-float)',
})

const linkStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-nav)',
  textDecoration: 'none',
  '&:hover, &[aria-current="page"]': { color: 'var(--text)', background: 'var(--fill-faint)' },
})
