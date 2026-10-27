// The badge toast (decision 028). The server decides: completeLesson returns
// the badges it just awarded, the complete action flashes a notice into the
// session, and the page the 303 lands on takes it (once) and shows it through
// Layout's reward region. Nothing the browser sends can raise one.
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { routes } from '../routes.ts'
import type { BadgeDefinition } from './badges.ts'

/** Session flash key. */
const REWARD_KEY = 'reward'

export interface RewardNotice {
  /** Changes per award, so a repeat toast is a new one. */
  id: string
  title: string
  message: string
  /** The first badge's hex glyph and fill. */
  glyph: string
  color: string
  next: { href: string; label: string }
}

type AnyContext = RequestContext<any, any>

/**
 * The notice for freshly awarded badges. A finished course links to its
 * certificate (`certificate` is the user's handle); other badges to /me.
 */
export function rewardNotice(badges: BadgeDefinition[], handle: string): RewardNotice | undefined {
  let first = badges[0]
  if (!first) return undefined
  let course = badges.find((badge) => badge.id.startsWith('course:'))
  let names = badges.map((badge) => badge.name)
  return {
    id: crypto.randomUUID(),
    title: badges.length === 1 ? `Badge earned: ${first.name}` : `${badges.length} badges earned`,
    message: course
      ? `You finished every lesson${badges.length > 1 ? ` and earned ${names.join(', ')}` : ''}. Your certificate is ready.`
      : badges.length === 1
        ? 'It’s on your profile now.'
        : `${names.join(', ')}. They’re on your profile now.`,
    glyph: (course ?? first).glyph,
    color: (course ?? first).color,
    next: course
      ? {
          href: routes.certificates.show.href({ handle, course: course.id.slice('course:'.length) }),
          label: 'View certificate →',
        }
      : { href: routes.me.index.href(), label: 'See your badges →' },
  }
}

/** Shows `notice` on the next page this browser loads (the redirect target). */
export function flashReward(context: AnyContext, notice: RewardNotice | undefined): void {
  if (notice) context.get(Session)?.flash(REWARD_KEY, notice)
}

/** The notice flashed by the previous request, if any. */
export function takeReward(context: AnyContext): RewardNotice | undefined {
  let value = context.get(Session)?.get(REWARD_KEY) as Partial<RewardNotice> | undefined
  if (!value || typeof value !== 'object') return undefined
  let { id, title, message, glyph, color, next } = value
  if (![id, title, message, glyph, color].every((field) => typeof field === 'string')) return undefined
  if (!next || typeof next.href !== 'string' || typeof next.label !== 'string') return undefined
  return { id, title, message, glyph, color, next } as RewardNotice
}
