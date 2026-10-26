import type { Handle } from 'remix/component'
import { clientEntry, css } from 'remix/component'

import { kbdStyle } from './kbd.tsx'

export interface SearchShortcutProps {
  /** id of the input to focus. */
  target: string
}

/**
 * The ⌘K hint inside SearchField. As a client entry it binds ⌘K / Ctrl K to
 * focus the target input and shows "Ctrl K" off Apple platforms. Server
 * render shows "⌘ K". Decorative to assistive tech (the input has its label).
 */
export const SearchShortcut = clientEntry(
  import.meta.url,
  function SearchShortcut(handle: Handle<SearchShortcutProps>) {
    let label = '⌘ K'

    handle.queueTask(() => {
      let apple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
      if (!apple) {
        label = 'Ctrl K'
        handle.update()
      }
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key.toLowerCase() !== 'k' || !(apple ? event.metaKey : event.ctrlKey)) return
          let input = document.getElementById(handle.props.target)
          if (!(input instanceof HTMLInputElement)) return
          event.preventDefault()
          input.focus()
          input.select()
        },
        { signal: handle.signal },
      )
    })

    return () => (
      <kbd aria-hidden="true" mix={[kbdStyle, narrowStyle]}>
        {label}
      </kbd>
    )
  },
)

// Components §7.2: hide the hint at ≤480px. Lives here (not in SearchField)
// because each mixin is its own cascade layer, so an outer rule loses to kbdStyle.
const narrowStyle = css({ '@media (max-width: 480px)': { display: 'none' } })
