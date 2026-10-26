import { createD1Database } from '@bits/db'
import { cop } from 'remix/middleware/cop'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { createRouter, type RouterContext } from 'remix/router'

// `#platform` resolves to platform.node.ts on Node and platform.worker.ts on
// Workers (package.json "imports" conditions).
import { platform } from '#platform'

import controller from './actions/controller.tsx'
import apiController from './actions/api/controller.tsx'
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
import meController from './actions/me/controller.tsx'
import profileController from './actions/profile/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import styleguideController from './actions/styleguide/controller.tsx'
import webhooksController from './actions/webhooks/controller.tsx'
import { loadAuth } from './auth/identity.ts'
import { loadSession } from './auth/session.ts'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'

// One data-table wrapper per isolate; it holds no per-request state.
const db = createD1Database(platform.env.DB)

export const router = createRouter({
  middleware: [
    platform.middleware,
    // Rejects cross-origin POSTs (Sec-Fetch-Site, then Origin). Webhooks are
    // server-to-server and verify their own signatures. See decision 015.
    cop({ insecureBypassPatterns: ['POST /webhooks/{provider}'] }),
    loadDatabase(db),
    loadSession(db),
    // A course folder upload is many small text files (POST /api/author/upload;
    // the DropZone sends media as names only, so videos never come through here).
    formData({ maxFiles: 300, maxFileSize: 1024 * 1024, maxTotalSize: 8 * 1024 * 1024 }),
    loadAuth(db),
    render({ assets: platform.assets }),
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
router.map(routes.logout, logoutController)
router.map(routes.me, meController)
router.map(routes.profile, profileController)
router.map(routes.settings, settingsController)
router.map(routes.styleguide, styleguideController)
router.map(routes.author, authorController)
router.map(routes.author.course, authorCourseController)
router.map(routes.api, apiController)
router.map(routes.webhooks, webhooksController)
