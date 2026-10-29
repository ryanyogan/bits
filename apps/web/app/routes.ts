// The URL contract for the whole app, shared by server and browser modules.
//
// Each page area is its own nested route map so it gets its own controller
// directory under app/actions/<key>/ (see AGENTS.md). Build every URL with
// `routes.<name>.href(...)`; never hand-write paths.
import { form, get, post, put, route } from 'remix/routes'

export const routes = route({
  // Root controller: app/actions/controller.tsx
  assets: get('/assets/*path'),
  health: get('/health'),
  // Content-Security-Policy violation reports (decision 027), logged only.
  cspReport: post('/csp-report'),
  home: get('/'),
  // Answered by router middleware before the session (decision 035):
  // app/middleware/site-files.ts; the root controller keeps the map whole.
  robots: get('/robots.txt'),
  sitemap: get('/sitemap.xml'),

  // Catalog, course syllabus and lesson pages.
  courses: route('/courses', {
    index: get('/'), // actions/courses/controller.tsx
    course: route('/:course', {
      index: get('/'), // actions/courses/course/controller.tsx
    }),
    lesson: route('/:course/:lesson', {
      index: get('/'), // actions/courses/lesson/controller.tsx (?mode=read|watch|terminal)
      complete: post('/complete'), // re-checks the exercises, saves progress, 303 onward
    }),
  }),

  // Sign in / create account (?mode=signup, ?next=).
  login: route('/login', {
    index: get('/'), // actions/login/controller.tsx
    action: post('/'),
    passkey: post('/passkey'), // verify a passkey sign-in (decision 030)
    check: route('/check', {
      index: get('/'), // actions/login/check/controller.tsx
    }),
  }),

  auth: {
    // GET ?token= (magic link), POST (6-digit code).
    verify: form('/auth/verify'), // actions/auth/verify/controller.tsx
    // GET ?token= (confirm-new-email link), POST spends it. actions/auth/email/controller.tsx
    email: form('/auth/email'),
    // GET ?token= (the old address's 7-day undo link), POST spends it. actions/auth/email-revert/controller.tsx
    emailRevert: form('/auth/email/revert'),
    oauth: route('/auth/oauth/:provider', {
      start: get('/'), // actions/auth/oauth/controller.tsx
      callback: get('/callback'),
    }),
  },

  logout: route('/logout', {
    action: post('/'), // actions/logout/controller.tsx
  }),

  me: route('/me', {
    index: get('/'), // actions/me/controller.tsx
  }),

  profile: route('/u/:handle', {
    index: get('/'), // actions/profile/controller.tsx
  }),

  settings: route('/settings', {
    index: get('/'), // actions/settings/controller.tsx
    export: get('/export'), // JSON download
    profile: post('/profile'),
    email: post('/email'),
    emailConfirm: post('/email/confirm'), // the 6-digit code for a new email (decision 030)
    reauth: post('/reauth'), // mail a sign-in code to the current address to confirm it's you
    methods: post('/methods'),
    sessions: post('/sessions'),
    deleteAccount: post('/delete'),
  }),

  // Design-system style guide (noindex; available in production for review).
  styleguide: route('/styleguide', {
    index: get('/'), // actions/styleguide/controller.tsx
  }),

  author: route('/author', {
    index: get('/'), // actions/author/controller.tsx
    repo: post('/repo'), // save the GitHub sync settings
    course: route('/:course', {
      index: get('/'), // actions/author/course/controller.tsx
      preview: get('/preview/:lesson'),
      publish: post('/publish'), // flip the live pointer to the latest build
      rollback: post('/rollback'), // flip it back to an older version
    }),
  }),

  // Who may write courses (decision 037).
  admin: {
    // Admin only: authors, admins, open invites and course authors. actions/admin/authors/controller.tsx
    authors: route('/admin/authors', {
      index: get('/'),
      invite: post('/invite'), // mail an email address an invite link
      revoke: post('/revoke'), // withdraw an open invite
      role: post('/role'), // admin → author, author → learner
      course: post('/course'), // add or remove an author on a course
    }),
    // The invitee's link: GET ?token= shows it, POST accepts (signed in as the
    // invited address). actions/admin/invite/controller.tsx
    invite: form('/admin/invite'),
  },

  // JSON endpoints: actions/api/controller.tsx
  api: route('/api', {
    run: post('/run'),
    // An answer to a quick check (`:::ask`, decision 052): JSON for the
    // islands, a 303 back to the lesson for a native form.
    ask: post('/ask'),
    drafts: post('/drafts'), // a signed-in learner's lesson drafts and watch position (decision 029)
    passkey: post('/passkey/:step'),
    authorUpload: post('/author/upload'),
    // A lesson MP4 into R2, in parts through the Worker (decision 029): start
    // (or resume) the upload, PUT each part, then complete it.
    authorVideoStart: post('/author/videos'),
    authorVideoPart: put('/author/videos/:id/parts/:part'),
    authorVideoComplete: post('/author/videos/:id/complete'),
  }),

  // Uploaded lesson videos from R2, with Range support: answered by the
  // serveMedia() router middleware ahead of the session and D1 (decision 035);
  // actions/media/controller.tsx keeps the map whole.
  media: route('/media', {
    video: get('/videos/:id.mp4'),
  }),

  // Third-party callbacks: actions/webhooks/controller.tsx
  webhooks: route('/webhooks', {
    github: post('/github'),
  }),

  // Plain-language policies: actions/legal/controller.tsx (decision 028).
  legal: {
    terms: get('/terms'),
    privacy: get('/privacy'),
  },

  // A shareable page per finished course (decision 028):
  // actions/certificates/controller.tsx. Only exists once every lesson is done.
  certificates: route('/u/:handle/certificates', {
    show: get('/:course'),
  }),

  // Link-preview card pages, 1200×630, that `pnpm og` screenshots into
  // public/og/*.png (decision 028): actions/cards/controller.tsx.
  cards: route('/cards', {
    show: get('/:card'),
  }),

  // Catch-all GET for unknown pages: the least specific pattern, so every
  // route above wins. Renders the app-styled 404 (root controller).
  notFound: get('/*path'),
})
