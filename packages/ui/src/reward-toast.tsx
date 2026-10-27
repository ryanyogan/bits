import type { Handle, MixInput } from 'remix/component'
import { clientEntry, css } from 'remix/component'

import { Icon } from './icon.tsx'
import { Keycap } from './keycap.tsx'

export interface RewardNext {
  href: string
  label: string
}

export interface RewardToastProps {
  /** Neurons earned. */
  xp: number
  message: string
  next?: RewardNext
  /** `lesson` (inline after runs, 20px title, action) or `system` (compact sample). */
  variant?: 'lesson' | 'system'
  /** Play the pop-in animation (off under reduced motion). */
  animate?: boolean
  mix?: MixInput<HTMLElement>
}

/** The volt "+40 neurons" reward (components §10.13). Static markup; islands insert it. */
export function RewardToast(handle: Handle<RewardToastProps>) {
  return () => {
    let { xp, message, next, variant = 'lesson', animate, mix } = handle.props
    let system = variant === 'system'
    return (
      <div mix={[toastStyle, system ? systemStyle : lessonStyle, animate ? popStyle : undefined, mix]}>
        <Icon name="hex-check" size={system ? 36 : 40} />
        <div mix={textStyle}>
          <span mix={[titleStyle, system ? systemTitle : lessonTitle]}>{`+${xp} neurons`}</span>
          <span mix={system ? systemBody : lessonBody}>{message}</span>
        </div>
        {next ? (
          <Keycap variant="inverse" size="md" href={next.href} mix={nextStyle}>
            {next.label}
          </Keycap>
        ) : null}
      </div>
    )
  }
}

const toastStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  background: 'var(--volt)',
  color: 'var(--on-volt)',
})
const lessonStyle = css({
  gap: 'var(--space-4)',
  padding: 'var(--space-4) var(--space-5)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--glow-toast)',
})
const systemStyle = css({
  gap: 'var(--space-3_5)',
  padding: 'var(--space-3_5) var(--space-4_5)',
  borderRadius: 'var(--radius-16)',
  boxShadow: 'var(--glow-toast-s)',
})
const popStyle = css({
  animation: 'bits-pop var(--duration-pop) var(--ease-spring) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const textStyle = css({ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: 'var(--space-0_5)' })
// "Next: <long lesson title> →" wraps instead of widening the toast past a
// 360px column (it sits in the composer's run window).
const nextStyle = css({
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  lineHeight: 'var(--type-heading-leading)',
  paddingBlock: 'var(--space-2)',
})
const titleStyle = css({ fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1.2 })
const lessonTitle = css({ fontSize: 'var(--fs-20)' })
const systemTitle = css({ fontSize: 'var(--fs-18)' })
const lessonBody = css({ fontSize: 'var(--fs-15)' })
const systemBody = css({ fontSize: 'var(--fs-14)' })

/** Detail of the `bits:reward` window event that `RewardRegion` listens for. */
export interface RewardEventDetail {
  xp: number
  message: string
  next?: RewardNext
}

export const REWARD_EVENT = 'bits:reward'

/** Fire a reward from any island. */
export function announceReward(detail: RewardEventDetail) {
  window.dispatchEvent(new CustomEvent<RewardEventDetail>(REWARD_EVENT, { detail }))
}

export interface RewardRegionProps {
  /** Hide the toast after this many ms (0 keeps it). */
  dismissAfter?: number
}

/**
 * A polite live region that shows a RewardToast whenever an island fires
 * `bits:reward` (components §10.13: the `role="status"` container is in the
 * page before anything is inserted, so it is announced). It floats over the
 * page's bottom edge rather than taking space in the flow. Client entry.
 */
export const RewardRegion = clientEntry(
  import.meta.url,
  function RewardRegion(handle: Handle<RewardRegionProps>) {
    let current: (RewardEventDetail & { id: number }) | undefined
    let count = 0

    handle.queueTask(() => {
      window.addEventListener(
        REWARD_EVENT,
        (event) => {
          let detail = (event as CustomEvent<RewardEventDetail>).detail
          current = { ...detail, id: ++count }
          handle.update()
          let after = handle.props.dismissAfter ?? 0
          if (after > 0) {
            let id = current.id
            setTimeout(() => {
              if (current?.id !== id || handle.signal.aborted) return
              current = undefined
              handle.update()
            }, after)
          }
        },
        { signal: handle.signal },
      )
    })

    return () => (
      <div role="status" mix={regionStyle}>
        {current ? (
          <RewardToast key={current.id} xp={current.xp} message={current.message} next={current.next} animate />
        ) : null}
      </div>
    )
  },
)

// An overlay, not a block in the flow: a reward arriving (or leaving)
// never moves the lesson under the reader (decision 023).
const regionStyle = css({
  position: 'fixed',
  insetInline: 'var(--page-gutter)',
  bottom: 'var(--space-6)',
  zIndex: 'var(--z-toast)',
  display: 'flex',
  justifyContent: 'flex-end',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto', width: '100%', maxWidth: 'var(--toast-width)' },
  '&:empty': { display: 'none' },
})
