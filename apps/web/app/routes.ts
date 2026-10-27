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
  home: get('/'),

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
    check: route('/check', {
      index: get('/'), // actions/login/check/controller.tsx
    }),
  }),

  auth: {
    // GET ?token= (magic link), POST (6-digit code).
    verify: form('/auth/verify'), // actions/auth/verify/controller.tsx
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

  // JSON endpoints: actions/api/controller.tsx
  api: route('/api', {
    run: post('/run'),
    drafts: post('/drafts'), // a signed-in learner's lesson drafts and watch position (decision 029)
    passkey: post('/passkey/:step'),
    authorUpload: post('/author/upload'),
    // A lesson MP4 into R2, in parts through the Worker (decision 029): start
    // (or resume) the upload, PUT each part, then complete it.
    authorVideoStart: post('/author/videos'),
    authorVideoPart: put('/author/videos/:id/parts/:part'),
    authorVideoComplete: post('/author/videos/:id/complete'),
  }),

  // Uploaded lesson videos from R2, with Range support: actions/media/controller.tsx
  media: route('/media', {
    video: get('/videos/:id.mp4'),
  }),

  // Third-party callbacks: actions/webhooks/controller.tsx
  webhooks: route('/webhooks', {
    github: post('/github'),
  }),

  // Catch-all GET for unknown pages: the least specific pattern, so every
  // route above wins. Renders the app-styled 404 (root controller).
  notFound: get('/*path'),
})
