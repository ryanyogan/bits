import { clientEntry, css, on, type Handle } from 'remix/component'
import { Icon } from '@bits/ui/icon'
import { ToolButton } from '@bits/ui/tool-button'

import { fieldMotion, onFieldMotion, setFieldPaused } from './field-motion.ts'

/**
 * Pause/play for the landing field's autonomous motion (WCAG 2.2.2,
 * decision 034). A toggle button: the name stays "Pause animation" and
 * `aria-pressed` says whether it is paused.
 *
 * Server-rendered `visibility: hidden`, so it holds its space (no layout
 * shift) but can't be seen or focused. It shows once the field is live:
 * without JS or WebGL 2 nothing moves, so there is nothing to pause.
 */
export const FieldMotionToggle = clientEntry(import.meta.url, function FieldMotionToggle(handle: Handle) {
  let motion = { paused: false, live: false }
  if (typeof window !== 'undefined') {
    motion = fieldMotion()
    onFieldMotion((next) => {
      motion = next
      handle.update()
    }, handle.signal)
  }

  return () => (
    <span data-ready={motion.live ? 'true' : undefined} mix={slotStyle}>
      <ToolButton
        pressed={motion.live ? motion.paused : undefined}
        mix={[toggleStyle, on('click', () => setFieldPaused(!fieldMotion().paused))]}
      >
        <Icon name={motion.paused ? 'play-inline' : 'pause'} size={10} color="currentColor" />
        Pause animation
      </ToolButton>
    </span>
  )
})

// Hidden, not removed: the slot keeps its size from the first paint.
const slotStyle = css({
  display: 'inline-flex',
  visibility: 'hidden',
  '&[data-ready="true"]': { visibility: 'visible' },
})

const toggleStyle = css({
  // Glass behind the label, since the field moves underneath it; the
  // pressed tint (ToolButton outline) is laid over the glass as an image.
  backgroundColor: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(10px)',
  backdropFilter: 'blur(10px)',
  borderRadius: 'var(--radius-pill)',
  '&:hover': { backgroundColor: 'var(--fill-btn)' },
  '&[aria-pressed="true"]': {
    backgroundColor: 'var(--ink-a60)',
    backgroundImage: 'linear-gradient(var(--volt-a14), var(--volt-a14))',
  },
  // Forced colours: ToolButton paints pressed as Highlight; keep the tint off it.
  '@media (forced-colors: active)': {
    '&[aria-pressed="true"]': { backgroundColor: 'Highlight', backgroundImage: 'none' },
  },
})
