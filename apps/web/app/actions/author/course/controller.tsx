import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { EmptyState } from '@bits/ui/empty-state'

import type { User } from '@bits/db'

import { platform } from '#platform'

import type { AppContext } from '../../../router.ts'
import { requireUser, toViewer } from '../../../auth/identity.ts'
import { contentBucket } from '../../../content/request.ts'
import { loadVersionCatalog, publishVersion } from '../../../content/store.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { ForbiddenPage } from '../../../ui/not-found-page.tsx'
import { canManageCourse, counts, getAuthoredCourse, plural, type AuthorCourse } from '../data.ts'
import { CourseBuildPage, type BuildNotice } from './course-build-page.tsx'
import { publishForm, rollbackForm } from './schema.ts'
import { buildLessonView } from '../../courses/lesson/lesson-view.ts'

/** The session flash a publish or rollback leaves for the build page (decision 068). */
const DONE_KEY = 'author:done'
type Done = 'published' | 'rolledback'

// Every action needs a signed-in user who manages this course (owner or
// admin); everyone else gets the same 404 an unknown course gets, except
// signed-in non-owners of a real course, who get a 403.
export default createController(routes.author.course, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let item = await managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let done = context.session.get(DONE_KEY) as Done | undefined
      let notice: BuildNotice | undefined =
        done === 'published' && item.live
          ? { tone: 'ok', text: `v${item.live} is live. Learners get it on their next page load.` }
          : done === 'rolledback' && item.live
            ? { tone: 'ok', text: `Rolled back: v${item.live} is live again.` }
            : undefined
      return renderBuildPage(context, item, notice)
    },

    // Publish and rollback are the same pointer flip (courses.current_version_id);
    // only a clean build can go live. Each rewrites catalog/live.json and purges
    // the colo cache, so both are burst limited.
    publish: {
      middleware: [rateLimit('RL_PUBLISH')],
      async handler(context) {
        let item = await managedCourse(context, context.auth.identity)
        if (item instanceof Response) return item
        let parsed = s.parseSafe(publishForm, context.formData)
        let n = (parsed.success && parsed.value.version) || item.build
        let target = item.versions.find((v) => v.n === n)
        if (!parsed.success || !target || target.failed) {
          let { errors } = counts(item.items)
          let text =
            n === item.build && errors
              ? `v${n} has ${plural(errors, 'error')}. Fix them and upload again to publish.`
              : `v${n} can’t go live: it didn’t build cleanly.`
          return renderBuildPage(context, item, { tone: 'error', text }, 422)
        }
        await publishVersion(context.db, contentBucket(), item.course.slug, n, { cache: platform.sharedCache })
        return done(context, item, 'published')
      },
    },

    rollback: {
      middleware: [rateLimit('RL_PUBLISH')],
      async handler(context) {
        let item = await managedCourse(context, context.auth.identity)
        if (item instanceof Response) return item
        let parsed = s.parseSafe(rollbackForm, context.formData)
        let n = parsed.success ? parsed.value.version : undefined
        let target = item.versions.find((v) => v.n === n)
        if (!n || !target || target.failed || n === item.live) {
          let text = n ? `v${n} can’t go live again: it isn’t a clean, older version.` : 'Pick a version to roll back to.'
          return renderBuildPage(context, item, { tone: 'error', text }, 422)
        }
        await publishVersion(context.db, contentBucket(), item.course.slug, n, { cache: platform.sharedCache })
        return done(context, item, 'rolledback')
      },
    },

    // The lesson page rendering the newest clean build under a Draft banner.
    async preview(context) {
      let user = context.auth.identity
      let item = await managedCourse(context, user)
      if (item instanceof Response) return item
      let catalog = item.preview
        ? await loadVersionCatalog(context.db, item.course.slug, item.preview.n, contentBucket())
        : undefined
      let view =
        catalog &&
        (await buildLessonView(catalog, context.params.course, context.params.lesson, context.url, {
          draft: { version: `v${item.preview!.n}` },
          viewer: toViewer(user),
        }))
      if (!view) return notFound(context, user)
      let { LessonPage } = await import('../../courses/lesson/lesson-page.tsx')
      return context.render(<LessonPage view={view} />)
    },
  },
})

type CourseContext = Pick<AppContext, 'render' | 'db'> & { params: { course: string } }

/** 303 back to the build page, with the outcome in the session flash (not the URL). */
function done(context: Pick<AppContext, 'session'>, item: AuthorCourse, what: Done) {
  context.session.flash(DONE_KEY, what)
  return redirect(routes.author.course.index.href({ course: item.course.slug }), 303)
}

function renderBuildPage(
  context: CourseContext & { auth: { identity: User } },
  item: AuthorCourse,
  notice?: BuildNotice,
  status = 200,
) {
  return context.render(
    <CourseBuildPage
      item={item}
      // Only a build that isn't live yet has a draft to preview; the live one is "View live".
      previewHref={
        item.preview && item.preview.n !== item.live
          ? routes.author.course.preview.href({ course: item.course.slug, lesson: item.preview.lesson })
          : undefined
      }
      liveHref={item.live !== undefined ? routes.courses.course.index.href({ course: item.course.slug }) : undefined}
      notice={notice}
      viewer={toViewer(context.auth.identity)}
    />,
    { status },
  )
}

/** The course if this user manages it; otherwise the 404 or 403 response to send. */
async function managedCourse(context: CourseContext, user: User): Promise<AuthorCourse | Response> {
  let item = await getAuthoredCourse(context.db, contentBucket(), context.params.course)
  if (!item) return notFound(context, user)
  if (!canManageCourse(user, item)) {
    return context.render(
      <ForbiddenPage viewer={toViewer(user)} hint="Only this course's authors and admins can open its builds and drafts." />,
      { status: 403 },
    )
  }
  return item
}

function notFound(context: CourseContext, user: User) {
  return context.render(
    <Layout title="Course not found" viewer={toViewer(user)} currentPath={routes.author.index.href()}>
      <h1 class="sr-only">Course not found</h1>
      <EmptyState title="No course with that name." hint="It may have been renamed, or never uploaded." />
    </Layout>,
    { status: 404 },
  )
}
