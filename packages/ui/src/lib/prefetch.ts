/**
 * Link prefetch (decision 042). Remix's browser runtime prefetches a link's
 * page when it carries `data-rmx-prefetch` (`intent`: on hover, focus or
 * press; `viewport`: when the link scrolls into view). Every link component
 * in this package asks this one rule, so the policy lives in one place:
 *
 * - same-origin page links prefetch on `intent` by default;
 * - a link that leaves the client router never does: `document`
 *   (`data-rmx-document`: OAuth starts, JSON answers), `download`, an
 *   absolute or protocol-relative URL, a non-http scheme (`mailto:`), or a
 *   same-page `#fragment`;
 * - a caller can opt out with `prefetch={false}` (a GET with side effects
 *   must never be a plain link in the first place, but this is the escape
 *   hatch) or ask for `viewport`.
 *
 * Remix itself skips automatic prefetch under Save-Data and on 2g.
 */
export type PrefetchMode = 'intent' | 'viewport'

/** The `prefetch` prop every link component accepts. Defaults to `'intent'`. */
export type PrefetchProp = PrefetchMode | false

export interface PrefetchContext {
  /** A full-document navigation (`data-rmx-document`). */
  document?: boolean
  /** A file download (`download`). */
  download?: boolean | string
}

/**
 * The value for `data-rmx-prefetch`, or `undefined` when the link must not
 * prefetch. Spread it as `data-rmx-prefetch={prefetchFor(href, prefetch)}`.
 */
export function prefetchFor(
  href: string | undefined,
  prefetch: PrefetchProp | undefined = 'intent',
  context: PrefetchContext = {},
): PrefetchMode | undefined {
  if (prefetch === false || href === undefined || href === '') return undefined
  if (context.document || (context.download !== undefined && context.download !== false)) return undefined
  if (!isSameOriginPath(href)) return undefined
  return prefetch
}

/**
 * True for a path the client router can serve: `/x`, `./x`, `x`, `?q=`.
 * False for `https://…`, `//host/…`, `mailto:…` and a bare `#fragment`.
 */
export function isSameOriginPath(href: string): boolean {
  if (href.startsWith('#')) return false
  if (href.startsWith('//')) return false
  // A scheme: letters, digits, + - . followed by ":" before any / ? #.
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return false
  return true
}
