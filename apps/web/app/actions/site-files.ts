// /robots.txt and /sitemap.xml: public, non-HTML, the same for every visitor.
// The router answers them from middleware (app/middleware/site-files.ts)
// before the session is read (decision 035); the root controller serves the
// same responses if that middleware is ever bypassed.
import type { RequestContext } from 'remix/router'

import { platform } from '#platform'

import { isPreview } from '../auth/config.ts'
import { getCatalog } from '../content/request.ts'
import { routes } from '../routes.ts'

/** Paths crawlers have no business in: signed-in, write-only or author/admin areas. */
const DISALLOW = ['/settings', '/me', '/auth', '/api', '/author', '/admin']

/** The origin sitemap URLs are built on: production's canonical one, else this request's. */
function siteOrigin(url: URL): string {
  return platform.env.CANONICAL_ORIGIN ?? url.origin
}

/**
 * Allow everything public, keep crawlers out of the private areas, point at
 * the sitemap. A Workers Preview (decision 038) disallows everything: it is a
 * throwaway copy of the site.
 */
export function robotsResponse(url: URL): Response {
  let lines = isPreview()
    ? ['User-agent: *', 'Disallow: /']
    : [
        'User-agent: *',
        'Allow: /',
        ...DISALLOW.map((path) => `Disallow: ${path}`),
        '',
        `Sitemap: ${new URL(routes.sitemap.href(), siteOrigin(url)).href}`,
      ]
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  })
}

interface SitemapEntry {
  path: string
  lastmod?: string
}

/** Every public page: the landing, the catalog, each published course and lesson, the policies. */
export async function sitemapResponse(context: RequestContext<any, any>): Promise<Response> {
  let catalog = await getCatalog(context)
  let entries: SitemapEntry[] = [{ path: routes.home.href() }, { path: routes.courses.index.href() }]
  for (let { slug } of catalog.courses) {
    let course = catalog.getCourse(slug)!
    let lastmod = course.updated
    entries.push({ path: routes.courses.course.index.href({ course: slug }), lastmod })
    for (let module of course.modules) {
      for (let lesson of module.lessons) {
        entries.push({ path: routes.courses.lesson.index.href({ course: slug, lesson: lesson.slug }), lastmod })
      }
    }
  }
  entries.push({ path: routes.legal.terms.href() }, { path: routes.legal.privacy.href() })

  let origin = siteOrigin(context.url)
  let urls = entries.map(({ path, lastmod }) => {
    let loc = `<loc>${escapeXml(new URL(path, origin).href)}</loc>`
    return `  <url>${loc}${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`
  })
  let body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
