import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

function notImplemented(endpoint: string) {
  return Response.json(
    { error: 'not_implemented', endpoint },
    { status: 501, headers: { 'Cache-Control': 'no-store' } },
  )
}

// JSON endpoints. Each is a 501 stub until its milestone lands.
export default createController(routes.api, {
  actions: {
    progress: () => notImplemented('progress'),
    run: () => notImplemented('run'),
    passkey: (context) => notImplemented(`passkey/${context.params.step}`),
    authorUpload: () => notImplemented('author/upload'),
    authorVideoUploadUrl: () => notImplemented('author/video-upload-url'),
  },
})
