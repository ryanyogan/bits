import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { serveVideo } from '../../video/serve.ts'

// Uploaded media from R2 (decision 029).
export default createController(routes.media, {
  actions: {
    video: (context) => serveVideo(context),
  },
})
