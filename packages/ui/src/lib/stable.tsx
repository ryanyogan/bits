// Layout-stability helpers (decision 023): fixed windows that follow their
// newest content, and stacks that reserve the tallest state up front.
import type { Handle, RemixNode } from 'remix/component'
import { css, ref } from 'remix/component'

/** How close to the bottom (px) still counts as "reading the newest". */
const FOLLOW_SLACK = 32

export interface Follower {
  /** Put on the scroll container. */
  mixin: ReturnType<typeof ref>
  /** Follow from now on (the learner just acted), and jump to the end. */
  pin(): void
}

/**
 * Keeps a fixed-height scroll container pinned to its bottom while content
 * streams in, but only while the reader is already at (or near) the bottom:
 * scrolling up to reread stops the follow, scrolling back down resumes it.
 * `pin()` re-arms it when the learner acts (Run, Enter). The jump is
 * instant, so there is no motion to reduce.
 */
export function createFollower(options: { startPinned?: boolean } = {}): Follower {
  let node: HTMLElement | undefined
  let pinned = options.startPinned ?? true
  let follow = () => {
    if (node && pinned) node.scrollTop = node.scrollHeight
  }
  let mixin = ref((element, signal) => {
    let el = element as HTMLElement
    node = el
    el.addEventListener(
      'scroll',
      () => {
        pinned = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK
      },
      { passive: true, signal },
    )
    let observer = new MutationObserver(follow)
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    signal.addEventListener('abort', () => {
      observer.disconnect()
      if (node === el) node = undefined
    })
    follow()
  })
  return {
    mixin,
    pin() {
      pinned = true
      follow()
    },
  }
}

/**
 * A fixed-size window that scrolls inside: the scroll chain stops at its
 * edges (`overscroll-behavior: contain`) and the bar keeps its gutter, so
 * content appearing never changes the width either.
 */
export const scrollWindowStyle = css({
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--line-drop) transparent',
})

/**
 * Stacks its children in one grid cell, so the box is as tall as the
 * tallest child. Pair the live state with `<Ghost>` copies of the other
 * states (the finished sentence, the longest note) and switching between
 * them never moves the page.
 */
export const stackStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  '& > *': { gridArea: '1 / 1' },
})

const ghostStyle = css({ visibility: 'hidden', pointerEvents: 'none' })

/**
 * An invisible copy that only reserves space inside a `stackStyle` box.
 * `visibility: hidden` also drops it from the accessibility tree and the
 * tab order. Static.
 */
export function Ghost(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <div aria-hidden="true" mix={ghostStyle}>
      {handle.props.children}
    </div>
  )
}
