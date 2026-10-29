import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

export type TagVariant =
  | 'meta'
  | 'meta-ion'
  | 'format'
  | 'cover'
  | 'done'
  | 'your-turn'
  | 'your-turn-sm'
  | 'run-hint'
  | 'free'
  | 'pro'

export interface TagProps {
  /**
   * `meta` / `meta-ion` (Course hero), `format` (text · video · code on cards),
   * `cover` (track name on a cover; pass `color`), `done` ("✓ DONE"),
   * `your-turn` (composer header), `your-turn-sm` (Authoring preview),
   * `run-hint` (static composer "Run ↵"), `free` / `pro` (a course's access,
   * decision 048: free in the brand's colour, pro a small dark key). Write
   * them in sentence case: `Free`, `Pro`.
   */
  variant: TagVariant
  /** Text colour for `cover` tags, e.g. `var(--ion)`. */
  color?: string
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Small non-interactive labels (components §6.2d–i). Static. */
export function Tag(handle: Handle<TagProps>) {
  return () => {
    let { variant, color, mix, children } = handle.props
    return (
      <span mix={[baseStyle, variantStyles[variant], mix]} style={color ? { color } : undefined}>
        {children}
      </span>
    )
  }
}

const baseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  fontFamily: 'var(--font-mono)',
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
})

const variantStyles: Record<TagVariant, ReturnType<typeof css>> = {
  meta: css({
    padding: 'var(--space-1_75) var(--space-2_75)',
    borderRadius: 'var(--radius-sm)',
    border: 'var(--border-w) solid var(--line-strong)',
    color: 'var(--text-body)',
    fontSize: 'var(--fs-13)',
  }),
  'meta-ion': css({
    padding: 'var(--space-1_75) var(--space-2_75)',
    borderRadius: 'var(--radius-sm)',
    border: 'var(--border-w) solid var(--ion-a35)',
    color: 'var(--ion)',
    fontSize: 'var(--fs-13)',
  }),
  format: css({
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-xs)',
    border: 'var(--border-w) solid var(--line-panel)',
    color: 'var(--text-quiet)',
    fontSize: 'var(--fs-11)',
  }),
  cover: css({
    padding: 'var(--space-1_25) var(--space-2_25)',
    borderRadius: 'var(--radius-7)',
    background: 'var(--appbar-bg)',
    fontSize: 'var(--fs-11)',
    letterSpacing: 'var(--tracking-tag)',
    textTransform: 'uppercase',
  }),
  done: css({
    padding: 'var(--space-1_25) var(--space-2_25)',
    borderRadius: 'var(--radius-7)',
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    fontSize: 'var(--fs-11)',
  }),
  'your-turn': css({
    padding: 'var(--space-0_75) var(--space-2)',
    borderRadius: 'var(--radius-xs)',
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    fontSize: 'var(--fs-12)',
  }),
  'your-turn-sm': css({
    padding: 'var(--space-0_75) var(--space-1_75)',
    borderRadius: 'var(--radius-5)',
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    fontSize: 'var(--fs-11)',
  }),
  'run-hint': css({
    padding: 'var(--space-1_5) var(--space-2_5)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    fontSize: 'var(--fs-12)',
  }),
  // The XP pill's recipe: good news in the brand colour (--volt-soft 15.97:1 on ink).
  free: css({
    padding: 'var(--space-0_75) var(--space-2)',
    border: 'var(--border-w) solid var(--volt-a28)',
    background: 'var(--volt-a08)',
    color: 'var(--volt-soft)',
    fontSize: 'var(--fs-11)',
    [FORCED_COLORS]: { border: '1px solid CanvasText' },
  }),
  // A small dark key: solid, not an alert and not a lock.
  pro: css({
    padding: 'var(--space-0_75) var(--space-2)',
    border: 'var(--border-w) solid var(--line-strong)',
    background: 'var(--raised)',
    boxShadow: 'var(--shadow-keycap-dark)',
    color: 'var(--text)',
    fontSize: 'var(--fs-11)',
    [FORCED_COLORS]: { border: '1px solid CanvasText' },
  }),
}
