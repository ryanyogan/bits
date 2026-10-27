import { cop } from 'remix/middleware/cop'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { createRouter, type RouterContext } from 'remix/router'

// `#platform` resolves to platform.node.ts on Node and platform.worker.ts on
// Workers (package.json "imports" conditions).
import { platform } from '#platform'

import controller from './actions/controller.tsx'
import apiController from './actions/api/controller.tsx'
import authEmailController from './actions/auth/email/controller.tsx'
import authEmailRevertController from './actions/auth/email-revert/controller.tsx'
import authOauthController from './actions/auth/oauth/controller.tsx'
import authVerifyController from './actions/auth/verify/controller.tsx'
import authorController from './actions/author/controller.tsx'
import authorCourseController from './actions/author/course/controller.tsx'
import coursesController from './actions/courses/controller.tsx'
import courseController from './actions/courses/course/controller.tsx'
import lessonController from './actions/courses/lesson/controller.tsx'
import loginController from './actions/login/controller.tsx'
import loginCheckController from './actions/login/check/controller.tsx'
import logoutController from './actions/logout/controller.tsx'
import mediaController from './actions/media/controller.tsx'
import meController from './actions/me/controller.tsx'
import profileController from './actions/profile/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import styleguideController from './actions/styleguide/controller.tsx'
import webhooksController from './actions/webhooks/controller.tsx'
import legalController from './actions/legal/controller.tsx'
import certificatesController from './actions/certificates/controller.tsx'
import cardsController from './actions/cards/controller.tsx'
import { loadAuth } from './auth/identity.ts'
import { loadSession } from './auth/session.ts'
import { errorFields, log } from './log.ts'
import { loadDatabase } from './middleware/database.ts'
import { cspNonce } from './middleware/csp-nonce.tsx'
import { responseHeaders } from './middleware/headers.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    // Outermost, so every response gets the security and cache headers. It
    // also makes the request's CSP nonce (decision 027).
    responseHeaders(),
    platform.middleware,
    // Rejects cross-origin POSTs (Sec-Fetch-Site, then Origin). Webhooks are
    // server-to-server and verify their own signatures. See decision 015.
    // CSP reports come from the browser's reporting machinery, which may not
    // look same-origin, and only get logged (decision 027).
    cop({ insecureBypassPatterns: ['POST /webhooks/{provider}', 'POST /csp-report'] }),
    loadDatabase(platform.env.DB),
    // Course pages show progress: a GET there reads the viewer's completed
    // lessons with the session, in one D1 round trip (decision 026).
    loadSession({ withCompleted: (context) => context.method === 'GET' && /^\/courses(?:\/|$)/.test(context.url.pathname) }),
    // A course folder upload is many small text files (POST /api/author/upload;
    // the DropZone sends media as names only, so videos never come through here).
    formData({ maxFiles: 300, maxFileSize: 1024 * 1024, maxTotalSize: 8 * 1024 * 1024 }),
    loadAuth(),
    // Streaming render failures happen after the first byte, past worker.ts's
    // catch, so they are reported here (guide 12).
    render({
      assets: platform.assets,
      onError: (error) => log('error', 'Render failed', errorFields(error)),
    }),
    // Every page renders inside <CspNonce>, so Document can nonce its scripts.
    cspNonce(),
  ],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
router.map(routes.courses, coursesController)
router.map(routes.courses.course, courseController)
router.map(routes.courses.lesson, lessonController)
router.map(routes.login, loginController)
router.map(routes.login.check, loginCheckController)
router.map(routes.auth.verify, authVerifyController)
router.map(routes.auth.oauth, authOauthController)
router.map(routes.auth.email, authEmailController)
router.map(routes.auth.emailRevert, authEmailRevertController)
router.map(routes.logout, logoutController)
router.map(routes.me, meController)
router.map(routes.profile, profileController)
router.map(routes.settings, settingsController)
router.map(routes.styleguide, styleguideController)
router.map(routes.author, authorController)
router.map(routes.author.course, authorCourseController)
router.map(routes.api, apiController)
router.map(routes.webhooks, webhooksController)
router.map(routes.legal, legalController)
router.map(routes.certificates, certificatesController)
router.map(routes.cards, cardsController)
router.map(routes.media, mediaController)
