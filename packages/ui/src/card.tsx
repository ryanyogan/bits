import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export type CardVariant = 'default' | 'page' | 'compact' | 'dashed' | 'glass'

export interface CardProps {
  /**
   * `default` 24 / 18 / gap 20 (System cards), `page` 24 / 20 / gap 18
   * (page-level panels), `compact` 22 / 18 / gap 14 (Profile sections,
   * transcript), `dashed` (Source card, empty states), `glass` (over the
   * landing field).
   */
  variant?: CardVariant
  /** Element to render. */
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
  /** Labels a `section`/`aside` landmark. */
  labelledBy?: string
  label?: string
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The default panel (components §8.3 SectionCard, §8.4 GlassCard). Padding
 * drops to 18px at ≤480px. Static.
 */
export function Card(handle: Handle<CardProps>) {
  return () => {
    let { variant = 'default', as = 'div', labelledBy, label, mix, children } = handle.props
    let props = {
      'aria-labelledby': labelledBy,
      'aria-label': label,
      mix: [baseStyle, variantStyles[variant], mix],
    }
    switch (as) {
      case 'section':
        return <section {...props}>{children}</section>
      case 'article':
        return <article {...props}>{children}</article>
      case 'aside':
        return <aside {...props}>{children}</aside>
      case 'li':
        return <li {...props}>{children}</li>
      default:
        return <div {...props}>{children}</div>
    }
  }
}

const baseStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
  gap: 'var(--space-5)',
  '@media (max-width: 480px)': { padding: 'var(--space-4_5)' },
})

const variantStyles: Record<CardVariant, ReturnType<typeof css>> = {
  default: css({}),
  page: css({ borderRadius: 'var(--radius-20)', gap: 'var(--space-4_5)' }),
  compact: css({ padding: 'var(--space-5_5)', gap: 'var(--space-3_5)' }),
  dashed: css({
    borderRadius: 'var(--radius-20)',
    gap: 'var(--space-2_5)',
    background: 'none',
    border: 'var(--border-w) dashed var(--line-dashed)',
  }),
  glass: css({
    borderRadius: 'var(--radius-20)',
    background: 'var(--glass)',
    WebkitBackdropFilter: 'blur(var(--blur-glass))',
    backdropFilter: 'blur(var(--blur-glass))',
    border: 'var(--border-w) solid var(--line-glass)',
  }),
}
