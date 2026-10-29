import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { RewardRegion } from '@bits/ui/reward-toast'

import type { RewardNotice } from '../progress/reward.ts'

/** How long the badge toast stays once the page is interactive. */
const BADGE_TOAST_MS = 8000

/**
 * The badge toast on the page a lesson completion lands on (decision 028).
 * A RewardRegion whose first toast came from the server, so it renders
 * without JS. The `data-rmx-key` is the award's id: client navigation makes
 * a fresh region for every award instead of reusing the last one.
 */
export function BadgeNotice(handle: Handle<{ reward: RewardNotice }>) {
  return () => {
    let { reward } = handle.props
    let badge = Boolean(reward.glyph && reward.color)
    return (
      <div
        data-rmx-key={`reward-${reward.id}`}
        data-badge-notice={badge ? '' : undefined}
        data-saved-notice={badge ? undefined : ''}
        mix={contentsStyle}
      >
        <RewardRegion
          dismissAfter={BADGE_TOAST_MS}
          initial={{
            xp: 0,
            title: reward.title,
            message: reward.message,
            // A plain "+N neurons" notice (a saved lesson, decision 052) keeps the check icon.
            badge: reward.glyph && reward.color ? { name: reward.title, glyph: reward.glyph, color: reward.color } : undefined,
            next: reward.next,
          }}
        />
      </div>
    )
  }
}

const contentsStyle = css({ display: 'contents' })
