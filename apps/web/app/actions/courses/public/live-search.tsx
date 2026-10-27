import type { Handle } from 'remix/component'
import { clientEntry, navigate } from 'remix/component'

export interface LiveSearchProps {
  /** id of the search `<input>`; its form supplies the action and the other params. */
  target: string
  /** Debounce in ms (Catalog.md: 250). */
  delay?: number
}

/**
 * Progressive enhancement for the catalog search (Catalog.md "SearchField ·
 * typing"). Without JS the field is a plain GET form. With JS, typing
 * debounces and then navigates the top frame to the same GET URL, so the
 * server re-renders the results in place: the URL stays shareable, history is
 * replaced rather than stacked per keystroke, and focus and scroll stay put.
 * Renders nothing visible.
 */
export const LiveSearch = clientEntry(import.meta.url, function LiveSearch(handle: Handle<LiveSearchProps>) {
  handle.queueTask(() => {
    let input = document.getElementById(handle.props.target)
    if (!(input instanceof HTMLInputElement) || !input.form) return
    let field = input
    let form = input.form
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = field.value.trim()

    let go = () => {
      let value = field.value.trim()
      if (value === last) return
      last = value
      let url = new URL(form.action, location.href)
      url.search = ''
      for (let [name, entry] of new FormData(form)) {
        if (typeof entry === 'string' && entry.trim()) url.searchParams.set(name, entry.trim())
      }
      void navigate(url.pathname + url.search, {
        history: 'replace',
        resetFocus: 'manual',
        resetScroll: 'manual',
      })
    }

    field.addEventListener(
      'input',
      () => {
        clearTimeout(timer)
        timer = setTimeout(go, handle.props.delay ?? 250)
      },
      { signal: handle.signal },
    )
    // Enter submits the form itself: drop the queued keystroke navigation,
    // which would otherwise repeat the same search a moment later.
    form.addEventListener(
      'submit',
      () => {
        clearTimeout(timer)
        last = field.value.trim()
      },
      { signal: handle.signal },
    )
    handle.signal.addEventListener('abort', () => clearTimeout(timer))
  })

  return () => <span hidden />
})
