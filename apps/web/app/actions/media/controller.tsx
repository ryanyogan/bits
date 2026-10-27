import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { serveVideo } from '../../video/serve.ts'

// Uploaded media from R2 (decision 029). In practice the `serveMedia()`
// router middleware answers these URLs first, before the session and D1
// (decision 035); this controller keeps the route map whole and serves the
// same response if that middleware is ever bypassed.
export default createController(routes.media, {
  actions: {
    video: (context) => serveVideo(context.request, context.params.id),
  },
})
