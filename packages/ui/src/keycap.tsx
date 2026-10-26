import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export type KeycapVariant = 'primary' | 'dark' | 'ghost'

export interface KeycapProps {
  /** Visual style. `primary` is the volt "do this" key; `dark` and `ghost` are secondary. */
  variant?: KeycapVariant
  /** `md` is the 44px app-bar size; `lg` is the 48px hero/system size. */
  size?: 'md' | 'lg'
  /** Renders an `<a>` when set, otherwise a `<button>`. */
  href?: string
  type?: 'button' | 'submit' | 'reset'
  name?: string
  value?: string
  disabled?: boolean
  'aria-label'?: string
  /** Extra mixins from the caller, typically layout (margins, width). */
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The keycap button: a raised key that travels 3px when pressed.
 *
 * Server-only (no clientEntry): hover and press are pure CSS, so it ships no JS.
 */
export function Keycap(handle: Handle<KeycapProps>) {
  return () => {
    let {
      variant = 'primary',
      size = 'md',
      href,
      type = 'button',
      name,
      value,
      disabled,
      mix,
      children,
    } = handle.props
    let label = handle.props['aria-label']
    let styles = [baseStyle, sizeStyles[size], variantStyles[variant], mix]

    if (href !== undefined) {
      return (
        <a href={href} aria-label={label} mix={styles}>
          {children}
        </a>
      )
    }

    return (
      <button
        type={type}
        name={name}
        value={value}
        disabled={disabled}
        aria-label={label}
        mix={styles}
      >
        {children}
      </button>
    )
  }
}

const baseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  minHeight: 'var(--touch-target)',
  border: 0,
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: '14px',
  lineHeight: 1,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  transition:
    'transform var(--duration-press) var(--ease), box-shadow var(--duration-press) var(--ease), filter var(--duration-press) var(--ease), background-color var(--duration-press) var(--ease)',
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
})

const sizeStyles = {
  md: css({ minHeight: 'var(--touch-target)', padding: '0 18px' }),
  lg: css({ minHeight: '48px', padding: '0 20px', borderRadius: 'var(--radius-keycap)' }),
}

const variantStyles: Record<KeycapVariant, ReturnType<typeof css>> = {
  primary: css({
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    boxShadow: 'var(--shadow-keycap-volt)',
    '&:hover': {
      color: 'var(--on-volt)',
      background: 'var(--volt-hover)',
      boxShadow: 'var(--shadow-keycap-volt-hover)',
      transform: 'translateY(-1px)',
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-volt-pressed)',
    },
    // Components that set box-shadow must compose the focus ring themselves.
    '&:focus-visible': {
      boxShadow: 'var(--shadow-keycap-volt), var(--focus-ring)',
    },
  }),
  dark: css({
    background: 'var(--raised)',
    color: 'var(--text)',
    border: '1px solid var(--line-strong)',
    boxShadow: 'var(--shadow-keycap-dark)',
    '&:hover': {
      color: 'var(--text)',
      transform: 'translateY(-1px)',
      filter: 'brightness(1.12)',
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-dark-pressed)',
    },
    '&:focus-visible': {
      boxShadow: 'var(--shadow-keycap-dark), var(--focus-ring)',
    },
  }),
  ghost: css({
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--line-ghost)',
    borderRadius: '10px',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--type-ui-size)',
    fontWeight: 400,
    '&:hover': {
      color: 'var(--text)',
      background: 'var(--fill-faint)',
      borderColor: 'var(--line-dashed)',
    },
  }),
}
