import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { Keycap } from './keycap.tsx'

export interface CopyButtonProps {
  /** What goes on the clipboard. */
  text: string
  /** Names what is copied, for the button's accessible name ("Copy TypeScript sample"); the visible label stays "Copy". */
  label?: string
}

/**
 * A small "Copy" key (Copy → Copied ✓ for 1.6s), the code sample's one
 * piece of JS (decision 061). Disabled until hydrated, like the `:::code`
 * editor's; a status region says when the copy landed. Client entry.
 */
export const CopyButton = clientEntry(
  import.meta.url,
  function CopyButton(handle: Handle<CopyButtonProps>) {
    let hydrated = false
    let copied = false
    let status = ''
    let timer: ReturnType<typeof setTimeout> | undefined

    handle.queueTask(() => {
      hydrated = Boolean(navigator.clipboard)
      handle.update()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    async function copy() {
      try {
        await navigator.clipboard.writeText(handle.props.text)
        copied = true
        status = 'Copied to the clipboard.'
      } catch {
        status = 'Copy failed: select the code to copy it.'
      }
      handle.update()
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied = false
        status = ''
        handle.update()
      }, 1600)
    }

    return () => {
      let { label } = handle.props
      let face = copied ? 'Copied ✓' : 'Copy'
      return (
        <span mix={wrapStyle}>
          <Keycap
            size="sm"
            variant={copied ? 'ion' : 'ghost-mono'}
            disabled={!hydrated}
            aria-label={label ? `${face} ${label}` : undefined}
            mix={on('click', () => void copy())}
          >
            {face}
          </Keycap>
          <span role="status" class="sr-only">
            {status}
          </span>
        </span>
      )
    }
  },
)

const wrapStyle = css({ display: 'inline-flex' })
