import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

export interface ShareButtonProps {
  /** Absolute URL of the public profile. */
  url: string
  /** Share-sheet title, e.g. "Jamie Park on bits". */
  title: string
  /** Stretch to fill its row (two actions share a row on phones). */
  grow?: boolean
}

/**
 * "Share ↗" on the profile (Profile spec §2.3). Server-rendered as a dark
 * keycap link to the public profile, so it still works with JS off. Once
 * hydrated it opens the Web Share sheet where there is one, otherwise copies
 * the link and confirms with the ion "Link copied ✓" face for 1.6s.
 */
export const ShareButton = clientEntry(
  import.meta.url,
  function ShareButton(handle: Handle<ShareButtonProps>) {
    let copied = false
    let status = ''
    let timer: ReturnType<typeof setTimeout> | undefined

    async function share(event: Event) {
      let { url, title } = handle.props
      let nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ url }))) {
        event.preventDefault()
        try {
          await nav.share({ title, url })
        } catch {
          // Dismissing the share sheet rejects with AbortError; nothing to do.
        }
        return
      }
      if (!navigator.clipboard) return // Fall back to following the link.
      event.preventDefault()
      try {
        await navigator.clipboard.writeText(url)
        copied = true
        status = 'Profile link copied to the clipboard.'
      } catch {
        status = `Copy failed. The link is ${url}`
      }
      handle.update()
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied = false
        status = ''
        handle.update()
      }, 1600)
    }

    handle.signal.addEventListener('abort', () => clearTimeout(timer))

    return () => {
      let { url, grow } = handle.props
      return (
        <span mix={[wrapStyle, grow ? growStyle : undefined]}>
          <Keycap
            variant={copied ? 'ion' : 'dark'}
            href={url}
            mix={[keyStyle, on('click', (event) => share(event))]}
          >
            {copied ? 'Link copied ✓' : 'Share ↗'}
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
const growStyle = css({ '@media (max-width: 480px)': { flex: '1 1 0' } })
// Profile draws the dark key at 16px side padding with Geist Mono 14px.
const keyStyle = css({ padding: '0 var(--space-4)', flex: '1 1 auto' })
