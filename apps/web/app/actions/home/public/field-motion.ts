// Shared motion state for the landing field (decision 034). Two islands use
// it: `NeuralField` (the canvas, in the sticky layer) and `FieldMotionToggle`
// (the button, in the hero). They hydrate separately, so the state lives in
// this module, which the browser loads once for both.
//
// `paused`: the viewer's stored choice, else `prefers-reduced-motion: reduce`.
// `live`: the scene is running on a canvas (WebGL 2 and three loaded). The
// toggle stays hidden until then, since there is nothing to pause.

const STORAGE_KEY = 'bits:field-motion'

export interface FieldMotion {
  paused: boolean
  live: boolean
}

let state: FieldMotion | undefined
let target: EventTarget | undefined

/** The current state. Reads storage and the media query once, in the browser. */
export function fieldMotion(): FieldMotion {
  if (!state) state = { paused: storedPaused() ?? prefersReducedMotion(), live: false }
  return state
}

/** Pauses or plays the field and remembers the choice for this viewer. */
export function setFieldPaused(paused: boolean) {
  state = { ...fieldMotion(), paused }
  try {
    localStorage.setItem(STORAGE_KEY, paused ? 'paused' : 'playing')
  } catch {
    // Private windows and blocked storage: the choice lasts for this page.
  }
  emit()
}

export function setFieldLive(live: boolean) {
  if (fieldMotion().live === live) return
  state = { ...fieldMotion(), live }
  emit()
}

/** Calls `listener` on every change until `signal` aborts. */
export function onFieldMotion(listener: (motion: FieldMotion) => void, signal: AbortSignal) {
  target ??= new EventTarget()
  target.addEventListener('change', () => listener(fieldMotion()), { signal })
}

function emit() {
  target?.dispatchEvent(new Event('change'))
}

function storedPaused(): boolean | undefined {
  try {
    let value = localStorage.getItem(STORAGE_KEY)
    return value === 'paused' ? true : value === 'playing' ? false : undefined
  } catch {
    return undefined
  }
}

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
