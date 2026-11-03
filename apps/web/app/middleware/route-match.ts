import { joinPatterns } from 'remix/route-pattern/join'
import { createMultiMatcher } from 'remix/route-pattern/match'
import type { RoutePattern } from 'remix/route-pattern'

// URL tests for middleware, built from the route map (`routes.ts`) instead of
// hand-written regexes, so renaming a route can't silently drop a fast path
// or a cache policy.

/** A pattern (or its source), or a route (`routes.x.y`) that carries one. */
type PatternSource = string | RoutePattern | { pattern: RoutePattern }

function patternOf(source: PatternSource): string | RoutePattern {
  return typeof source === 'object' && 'pattern' in source ? source.pattern : source
}

/**
 * Matches a path and everything below it: `under(pathPrefix(routes.settings))`
 * matches `/settings`, `/settings/` and `/settings/anything/else`, but not
 * `/settingsx`.
 */
export function under(source: PatternSource): RoutePattern {
  return joinPatterns(patternOf(source), '(/*rest)')
}

/** True when a URL matches any of the patterns. */
export function anyOf(...sources: PatternSource[]): { test(url: URL): boolean } {
  let matcher = createMultiMatcher<true>()
  for (let source of sources) matcher.add(patternOf(source), true)
  return { test: (url) => matcher.match(url) !== null }
}

/** Every route in a route map (nested maps and `form()` pairs included). */
export function routesIn(map: object): { pattern: RoutePattern }[] {
  if ('pattern' in map && 'method' in map) return [map as { pattern: RoutePattern }]
  return Object.values(map).flatMap((value) => (value && typeof value === 'object' ? routesIn(value) : []))
}

/**
 * The fixed path every route in a map starts with, up to the first variable
 * segment: `/auth` for `routes.auth`, `/settings` for `routes.settings`.
 */
export function pathPrefix(map: object): string {
  let paths = routesIn(map).map((route) => {
    let fixed: string[] = []
    for (let segment of String(route.pattern).split('/').filter(Boolean)) {
      if (/[:*()]/.test(segment)) break
      fixed.push(segment)
    }
    return fixed
  })
  let [first = [], ...rest] = paths
  let length = first.length
  for (let path of rest) {
    let i = 0
    while (i < length && i < path.length && path[i] === first[i]) i++
    length = i
  }
  return `/${first.slice(0, length).join('/')}`
}
