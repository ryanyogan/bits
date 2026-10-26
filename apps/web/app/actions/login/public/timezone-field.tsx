import type { Handle } from 'remix/component'
import { clientEntry } from 'remix/component'

/**
 * Hidden `timezone` input for sign-up (handoff: store the timezone at
 * sign-up). Empty in the server HTML; the browser fills in its IANA zone, so
 * without JS the server simply falls back to UTC.
 */
export const TimezoneField = clientEntry(
  import.meta.url,
  function TimezoneField(handle: Handle<{ name?: string }>) {
    let zone = ''
    handle.queueTask(() => {
      try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
      } catch {
        zone = ''
      }
      if (zone) handle.update()
    })
    return () => <input type="hidden" name={handle.props.name ?? 'timezone'} value={zone} />
  },
)
