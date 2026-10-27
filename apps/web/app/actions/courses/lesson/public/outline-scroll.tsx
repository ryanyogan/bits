import type { Handle } from 'remix/component'
import { clientEntry, ref } from 'remix/component'

/**
 * Scrolls the sticky lesson outline (not the page) so the open lesson is in
 * view when the outline is taller than the screen. CSS can't set a scroll
 * container's starting position, so this is the outline's only JS; without
 * it the outline starts at the top and scrolls by hand. Renders a hidden
 * marker inside the outline's `<nav>`. Key it per lesson so it re-runs after
 * a client navigation (decision 022).
 */
export const OutlineScroll = clientEntry(import.meta.url, function OutlineScroll(_handle: Handle) {
  return () => (
    <span
      hidden
      mix={ref((node) => {
        let nav = node.closest('nav')
        let current = nav?.querySelector('[aria-current="page"]')
        if (!nav || !current || nav.scrollHeight <= nav.clientHeight) return
        let box = nav.getBoundingClientRect()
        let item = current.getBoundingClientRect()
        if (item.top >= box.top && item.bottom <= box.bottom) return
        // Centre it; instant, so there's no motion to reduce.
        nav.scrollTop += item.top - box.top - (box.height - item.height) / 2
      })}
    />
  )
})
