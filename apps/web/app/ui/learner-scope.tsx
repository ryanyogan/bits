import type { Handle, RemixNode } from 'remix/component'

export interface LearnerScopeProps {
  /** Signed out: the session holds lessons this visitor completed (decision 016). */
  hasProgress: boolean
  children?: RemixNode
}

/**
 * What the header needs to know about the learner beyond the viewer
 * (decision 070): whether a signed-out visitor has progress, so the bar
 * offers "Continue" instead of "Start free". The `learner()` middleware
 * wraps every render in it, like `ThemeScope`, so no page passes it.
 */
export function LearnerScope(handle: Handle<LearnerScopeProps, { hasProgress: boolean }>) {
  return () => {
    handle.context.set({ hasProgress: handle.props.hasProgress })
    return handle.props.children
  }
}

/** From the nearest `LearnerScope`; false outside one (tests, bare renders). */
export function learnerHasProgress(handle: Handle<any, any>): boolean {
  let value = handle.context.get(LearnerScope) as { hasProgress: boolean } | undefined
  return value?.hasProgress ?? false
}
