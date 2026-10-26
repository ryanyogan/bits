import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { ACTIVE, DISABLED, FOCUS, HOVER, type ForcedState } from './lib/states.ts'

export type KeycapVariant = 'primary' | 'dark' | 'ghost' | 'ghost-mono' | 'inverse' | 'ion' | 'danger'
export type KeycapSize = 'sm' | 'md' | 'lg'

export interface KeycapProps {
  /**
   * `primary` is the volt "do this" key, `dark` the secondary key, `ghost`
   * (Geist) and `ghost-mono` (Geist Mono) are flat outline buttons, `inverse`
   * is the dark key on a volt surface (reward toast), `ion` is the
   * "Copied ✓" confirmation face, `danger` the delete-account key
   * (Settings, proposed danger recipe, resolutions §1).
   */
  variant?: KeycapVariant
  /**
   * Resolutions §3: `sm` is a 36px key with a 44px hit area, `md` is 46px,
   * `lg` is the 56px CTA key.
   */
  size?: KeycapSize
  /** Adds the CTA glow under a primary `lg` key (Main closing CTA). */
  glow?: boolean
  /** Stretch to the container width. */
  block?: boolean
  /** Renders an `<a>` when set, otherwise a `<button>`. */
  href?: string
  /**
   * Links only: a full-document navigation (`data-rmx-document`), for links
   * that leave the app (OAuth) or return something other than a page.
   */
  document?: boolean
  /** Links only: a file download (`download`, optionally the file name). */
  download?: boolean | string
  type?: 'button' | 'submit' | 'reset'
  name?: string
  value?: string
  form?: string
  disabled?: boolean
  /** Shows a blinking caret after the label and sets `aria-busy`. */
  loading?: boolean
  'aria-label'?: string
  'aria-pressed'?: boolean
  'aria-describedby'?: string
  /** Style-guide only: render a pseudo-class state statically. */
  forceState?: ForcedState
  /** Extra mixins from the caller, typically layout (margins, width) or behaviour. */
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The keycap button: a raised key with a 4px edge that travels 3px when
 * pressed (resolutions §3).
 *
 * Server-only (no clientEntry): hover and press are pure CSS. Islands that
 * need a keycap (copy, run) import it and add behaviour through `mix`.
 */
export function Keycap(handle: Handle<KeycapProps>) {
  return () => {
    let {
      variant = 'primary',
      size = 'md',
      glow,
      block,
      href,
      document,
      download,
      type = 'button',
      name,
      value,
      form,
      disabled,
      loading,
      forceState,
      mix,
      children,
    } = handle.props
    let styles = [
      baseStyle,
      variant === 'ghost' || variant === 'ghost-mono' ? ghostSizeStyles[size] : sizeStyles[size],
      variantStyles[variant],
      glow && variant === 'primary' ? glowStyle : undefined,
      block ? blockStyle : undefined,
      mix,
    ]
    let content = (
      <>
        {children}
        {loading ? (
          <span aria-hidden="true" mix={caretStyle}>
            ▍
          </span>
        ) : null}
      </>
    )
    let common = {
      'aria-label': handle.props['aria-label'],
      'aria-describedby': handle.props['aria-describedby'],
      'aria-busy': loading ? ('true' as const) : undefined,
      'data-force': forceState,
    }

    if (href !== undefined) {
      return (
        <a
          {...common}
          href={disabled ? undefined : href}
          data-rmx-document={document ? '' : undefined}
          download={download === true ? '' : download || undefined}
          aria-disabled={disabled ? 'true' : undefined}
          role={disabled ? 'link' : undefined}
          mix={styles}
        >
          {content}
        </a>
      )
    }

    return (
      <button
        {...common}
        type={type}
        name={name}
        value={value}
        form={form}
        disabled={disabled}
        aria-pressed={handle.props['aria-pressed'] === undefined ? undefined : handle.props['aria-pressed'] ? 'true' : 'false'}
        mix={styles}
      >
        {content}
      </button>
    )
  }
}


const baseStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  border: 0,
  borderRadius: 'var(--radius-keycap)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  lineHeight: 1,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  transition:
    'transform var(--duration-press) var(--ease), box-shadow var(--duration-press) var(--ease), filter var(--duration-press) var(--ease), background-color var(--duration-press) var(--ease), border-color var(--duration-press) var(--ease)',
  [FOCUS]: {
    outline: '2px solid var(--focus-ring-color)',
    outlineOffset: '2px',
  },
  [DISABLED]: { cursor: 'not-allowed' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

/** Raised keys (primary, dark, inverse, ion). */
const sizeStyles: Record<KeycapSize, ReturnType<typeof css>> = {
  sm: css({
    minHeight: '36px',
    padding: '0 var(--space-3_5)',
    fontSize: 'var(--fs-12)',
    // 36px visual key, 44px hit area (resolutions §7).
    '&::before': { content: '""', position: 'absolute', inset: '-4px 0' },
  }),
  md: css({ minHeight: '46px', padding: '0 var(--space-5)', fontSize: 'var(--fs-14)' }),
  lg: css({ minHeight: '56px', padding: '0 var(--space-6_5)', fontSize: 'var(--fs-16)' }),
}

/** Flat ghost buttons keep the System 44px / radius 10 geometry at `sm`. */
const ghostSizeStyles: Record<KeycapSize, ReturnType<typeof css>> = {
  sm: css({ minHeight: 'var(--touch-target)', padding: '0 var(--space-4)', borderRadius: 'var(--radius-10)' }),
  md: css({ minHeight: '46px', padding: '0 var(--space-4_5)', borderRadius: 'var(--radius-10)' }),
  lg: css({ minHeight: '56px', padding: '0 var(--space-6_5)' }),
}

const variantStyles: Record<KeycapVariant, ReturnType<typeof css>> = {
  primary: css({
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    boxShadow: 'var(--shadow-keycap-volt)',
    [HOVER]: {
      background: 'var(--volt-hover)',
      boxShadow: 'var(--shadow-keycap-volt-hover)',
      transform: 'translateY(-1px)',
    },
    [ACTIVE]: {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-volt-pressed)',
    },
    [FOCUS]: { boxShadow: 'var(--shadow-keycap-volt), var(--focus-ring)' },
    // "Copy off" recipe (components §5.1); --muted, not --dim, on --selected (resolutions §6).
    [DISABLED]: {
      background: 'var(--selected)',
      color: 'var(--muted)',
      boxShadow: 'var(--shadow-keycap-dark)',
      transform: 'none',
      filter: 'none',
    },
  }),
  dark: css({
    background: 'var(--raised)',
    color: 'var(--text)',
    border: '1px solid var(--line-strong)',
    fontWeight: 400,
    boxShadow: 'var(--shadow-keycap-dark)',
    [HOVER]: { transform: 'translateY(-1px)', filter: 'brightness(1.06)' },
    [ACTIVE]: {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-dark-pressed)',
    },
    [FOCUS]: { boxShadow: 'var(--shadow-keycap-dark), var(--focus-ring)' },
    [DISABLED]: { opacity: 0.5, transform: 'none', filter: 'none', boxShadow: 'var(--shadow-keycap-dark)' },
  }),
  ghost: css({
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--line-control)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--fs-15)',
    fontWeight: 400,
    transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
    [HOVER]: { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
    [ACTIVE]: { background: 'var(--fill-btn)' },
    [DISABLED]: { background: 'transparent', color: 'var(--dim)', borderColor: 'var(--line)' },
  }),
  'ghost-mono': css({
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--line-control)',
    fontSize: 'var(--fs-14)',
    fontWeight: 400,
    transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
    [HOVER]: { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
    [ACTIVE]: { background: 'var(--fill-btn)' },
    [DISABLED]: { background: 'transparent', color: 'var(--dim)', borderColor: 'var(--line)' },
  }),
  inverse: css({
    background: 'var(--on-volt)',
    color: 'var(--volt)',
    fontWeight: 400,
    [HOVER]: { filter: 'brightness(1.3)' },
    [ACTIVE]: { transform: 'translateY(1px)' },
    [DISABLED]: { opacity: 0.5, filter: 'none', transform: 'none' },
  }),
  ion: css({
    background: 'var(--ion)',
    color: 'var(--ink)',
    boxShadow: 'var(--shadow-keycap-ion)',
    [HOVER]: { transform: 'translateY(-1px)', filter: 'brightness(1.06)' },
    [ACTIVE]: {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-ion-pressed)',
    },
    [FOCUS]: { boxShadow: 'var(--shadow-keycap-ion), var(--focus-ring)' },
    [DISABLED]: { background: 'var(--selected)', color: 'var(--muted)', boxShadow: 'var(--shadow-keycap-dark)', transform: 'none', filter: 'none' },
  }),
  danger: css({
    background: 'var(--danger)',
    color: 'var(--on-volt)',
    boxShadow: 'var(--shadow-keycap-danger)',
    [HOVER]: { transform: 'translateY(-1px)', filter: 'brightness(1.06)' },
    [ACTIVE]: {
      transform: 'translateY(var(--keycap-travel))',
      boxShadow: 'var(--shadow-keycap-danger-pressed)',
    },
    [FOCUS]: { boxShadow: 'var(--shadow-keycap-danger), var(--focus-ring)' },
    [DISABLED]: { background: 'var(--selected)', color: 'var(--muted)', boxShadow: 'var(--shadow-keycap-dark)', transform: 'none', filter: 'none' },
  }),
}

/**
 * The primary `md` keycap look for a non-interactive `<span>` inside a larger
 * link (ContinueBanner "Resume →"), where a nested button would be invalid.
 */
export const keycapFace = [baseStyle, sizeStyles.md, variantStyles.primary]

const glowStyle = css({
  boxShadow: 'var(--shadow-keycap-volt-cta)',
  [FOCUS]: { boxShadow: 'var(--shadow-keycap-volt-cta), var(--focus-ring)' },
})

const blockStyle = css({ width: '100%' })

const caretStyle = css({
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
