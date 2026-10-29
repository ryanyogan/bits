/**
 * App-wide feedback for client navigations (decision 024). Two pieces, both
 * driven by the top frame's `reloadStart` / `reloadComplete` events, the same
 * events Remix's guide uses for a pending save button (guide 09, "Add pending
 * feedback"), so they work for every page without an island per button:
 *
 * - Pending forms. When a native form submits, the form gets `data-pending`
 *   and its submitter `aria-busy="true"` (Keycap draws its busy caret from
 *   that attribute). A second submit of a pending POST form is dropped, so a
 *   double click can't send two sign-in emails or spend a code twice. Both
 *   reset when the navigation settles, whatever the outcome (a 422 re-render
 *   included), and on `pageshow` (back/forward cache).
 * - A navigation progress bar. A thin bar along the top edge for any
 *   navigation that takes longer than a moment; fast ones show nothing.
 *
 * Forms the browser submits itself (`data-rmx-document`, including the
 * entry's resubmit-after-error fallback) are left alone.
 */

const PENDING = 'data-pending'
/** Navigations quicker than this show no bar (avoids a flash on every click). */
const SHOW_AFTER_MS = 150

interface Frame extends EventTarget {}

export function installNavigationFeedback(top: Frame): void {
  let pendingForms = new Set<HTMLFormElement>()
  let busySubmitters = new Set<HTMLElement>()

  let clearPending = () => {
    for (let form of pendingForms) form.removeAttribute(PENDING)
    for (let el of busySubmitters) el.removeAttribute('aria-busy')
    pendingForms.clear()
    busySubmitters.clear()
  }

  // Bubble phase on document: the form's own submit listeners (islands such
  // as DropZone that take over with fetch) have already run, so a submit
  // they prevented is not marked.
  document.addEventListener('submit', (event) => {
    let form = event.target
    if (!(form instanceof HTMLFormElement)) return
    if (form.hasAttribute('data-rmx-document')) return
    let post = (event.submitter?.getAttribute('formmethod') ?? form.method).toLowerCase() === 'post'
    if (form.hasAttribute(PENDING) && post) {
      event.preventDefault()
      return
    }
    if (event.defaultPrevented) return
    form.setAttribute(PENDING, '')
    pendingForms.add(form)
    let submitter = event.submitter
    if (submitter instanceof HTMLElement) {
      submitter.setAttribute('aria-busy', 'true')
      busySubmitters.add(submitter)
    }
  })

  let bar = createBar()
  top.addEventListener('reloadStart', () => bar.start())
  top.addEventListener('reloadComplete', () => {
    clearPending()
    bar.done()
  })
  window.addEventListener('pageshow', (event) => {
    clearPending()
    if (event.persisted) bar.done()
  })
}

function createBar() {
  let el: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let trickle: Animation | undefined
  let reduced = matchMedia('(prefers-reduced-motion: reduce)')

  function mount(): HTMLElement {
    // A child of <html> after <body>: the top frame's reconcile diffs <head>
    // and <body>, so a bar inside <body> would be removed mid-navigation.
    let node = document.createElement('bits-progress')
    node.setAttribute('role', 'progressbar')
    node.setAttribute('aria-label', 'Loading page')
    Object.assign(node.style, {
      position: 'fixed',
      insetInline: '0',
      top: '0',
      height: 'var(--nav-progress-h)',
      zIndex: 'var(--z-nav-progress)',
      background: 'var(--volt)',
      transformOrigin: 'left center',
      transform: 'scaleX(0)',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>)
    document.documentElement.append(node)
    return node
  }

  return {
    start() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        el?.getAnimations().forEach((a) => a.cancel())
        el?.remove()
        el = mount()
        if (reduced.matches) {
          el.style.transform = 'scaleX(1)'
          el.style.opacity = '0.6'
          return
        }
        // Creep towards 90% and wait there: we can't know the real progress.
        trickle = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(0.9)' }], {
          duration: 8000,
          easing: 'cubic-bezier(0.1, 0.7, 0.2, 1)',
          fill: 'forwards',
        })
      }, SHOW_AFTER_MS)
    },
    done() {
      clearTimeout(timer)
      let node = el
      el = null
      if (!node) return
      trickle?.pause()
      if (reduced.matches) {
        node.remove()
        return
      }
      let finish = node.animate(
        [
          { transform: getComputedStyle(node).transform, opacity: 1 },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.5 },
          { transform: 'scaleX(1)', opacity: 0 },
        ],
        { duration: 300, easing: 'ease-out', fill: 'forwards' },
      )
      finish.finished.then(() => node.remove(), () => node.remove())
    },
  }
}
