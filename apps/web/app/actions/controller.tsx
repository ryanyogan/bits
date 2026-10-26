import { createController } from 'remix/router'

import { platform } from '#platform'

import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    // Node serves compiled assets on demand. On Workers, built assets are
    // served by the platform before the Worker runs, so this only sees misses.
    async assets(context) {
      return (
        (await platform.assets.fetch(context.request)) ??
        new Response('Not Found', { status: 404 })
      )
    },
    // Liveness plus a D1 round trip, so a deploy check proves the binding.
    async health(context) {
      let database: 'ok' | 'error' = 'ok'
      try {
        await context.db.d1.prepare('select 1').first()
      } catch (error) {
        console.error('health: D1 check failed', error)
        database = 'error'
      }
      return Response.json(
        { ok: database === 'ok', runtime: platform.runtime, database },
        { status: database === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
      )
    },
    home(context) {
      return context.render(<HomePage />)
    },
  },
})
