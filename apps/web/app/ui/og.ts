// Link-preview cards (decision 028). The PNGs are made ahead of time by
// `pnpm og` (scripts/og-images.ts screenshots the /cards/:card pages) into
// public/og/, served as static assets; the Worker only picks a file name.
// Courses without a card of their own (uploaded through /author since the
// last `pnpm og`) share the landing card.
import { platform } from '#platform'

import type { DocumentImage } from '@bits/ui/document'

import { APP_TAGLINE, APP_TITLE } from '../config.ts'
import { ogCards } from './og-cards.generated.ts'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export type CardName = 'home' | `course-${string}` | `certificate-${string}`

/** Every card `pnpm og` makes: the landing card, then a course and a certificate card per course. */
export function cardNames(courseSlugs: string[]): CardName[] {
  return ['home', ...courseSlugs.flatMap((slug): CardName[] => [`course-${slug}`, `certificate-${slug}`])]
}

/** The public path of a card's PNG. */
export function cardPath(name: CardName): string {
  return `/og/${name}.png`
}

/**
 * The preview image for a page: the named card when `pnpm og` made it, else
 * the landing card. The URL is absolute (link previews need that), on
 * CANONICAL_ORIGIN when set.
 */
export function ogImage(name: CardName, alt: string): DocumentImage | undefined {
  if (!ogCards[name]) return name === 'home' ? undefined : ogImage('home', HOME_ALT)
  let path = `${cardPath(name)}?v=${ogCards[name]}`
  let origin = platform.env.CANONICAL_ORIGIN
  return { url: origin ? new URL(path, origin).href : path, alt, width: OG_WIDTH, height: OG_HEIGHT }
}

/** Alt text of the landing card (also the fallback for pages without a card). */
export const HOME_ALT = `${APP_TITLE}: ${APP_TAGLINE} Free, short lessons in AI engineering.`
