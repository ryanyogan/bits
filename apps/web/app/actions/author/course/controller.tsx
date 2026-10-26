import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { EmptyState } from '@bits/ui/empty-state'

import type { User } from '@bits/db'

import type { AppContext } from '../../../router.ts'
import { requireUser, toViewer } from '../../../auth/identity.ts'
import { contentBucket } from '../../../content/request.ts'
import { loadVersionCatalog, publishVersion } from '../../../content/store.ts'
import { getDatabase } from '../../../middleware/database.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { ForbiddenPage } from '../../../ui/not-found-page.tsx'
import { canManageCourse, counts, getAuthoredCourse, plural, type AuthorCourse } from '../data.ts'
import { CourseBuildPage } from './course-build-page.tsx'
import { versionForm } from './schema.ts'
import { LessonPage } from '../../courses/lesson/lesson-page.tsx'
import { buildLessonView } from '../../courses/lesson/lesson-view.ts'

// Every action needs a signed-in user who manages this course (owner or
// admin); everyone else gets the same 404 an unknown course gets, except
// signed-in non-owners of a real course, who get a 403.
export default createController(routes.author.course, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let item = await managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let done = context.url.searchParams.get('done')
      let notice =
        done === 'published' && item.live
          ? { tone: 'ok' as const, text: `v${item.live} is live. Learners get it on their next page load.` }
          : done === 'rolledback' && item.live
            ? { tone: 'ok' as const, text: `Rolled back: v${item.live} is live again.` }
            : undefined
      return renderBuildPage(context, item, notice)
    },

    // Publish and rollback are the same pointer flip (courses.current_version_id);
    // only a clean build can go live.
    async publish(context) {
      let item = await managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let version = s.parseSafe(versionForm, context.formData)
      let n = (version.success && version.value.version) || item.build
      let target = item.versions.find((v) => v.n === n)
      if (!target || target.failed) {
        let { errors } = counts(item.items)
        let text =
          n === item.build && errors
            ? `v${n} has ${plural(errors, 'error')}. Fix them and upload again to publish.`
            : `v${n} can’t go live: it didn’t build cleanly.`
        return renderBuildPage(context, item, { tone: 'error', text }, 422)
      }
      await publishVersion(getDatabase(context), item.course.slug, n)
      return redirect(routes.author.course.index.href({ course: item.course.slug }, { searchParams: { done: 'published' } }), 303)
    },

    async rollback(context) {
      let item = await managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let version = s.parseSafe(versionForm, context.formData)
      let n = version.success ? version.value.version : undefined
      let target = item.versions.find((v) => v.n === n)
      if (!n || !target || target.failed) {
        return redirect(routes.author.course.index.href({ course: item.course.slug }), 303)
      }
      await publishVersion(getDatabase(context), item.course.slug, n)
      return redirect(routes.author.course.index.href({ course: item.course.slug }, { searchParams: { done: 'rolledback' } }), 303)
    },

    // The lesson page rendering the newest clean build under a Draft banner.
    async preview(context) {
      let user = context.auth.identity
      let item = await managedCourse(context, user)
      if (item instanceof Response) return item
      let catalog = item.preview
        ? await loadVersionCatalog(getDatabase(context), item.course.slug, item.preview.n, contentBucket())
        : undefined
      let view =
        catalog &&
        (await buildLessonView(catalog, context.params.course, context.params.lesson, context.url, {
          draft: { version: `v${item.preview!.n}` },
          viewer: toViewer(user),
        }))
      if (!view) return notFound(context, user)
      return context.render(<LessonPage view={view} />)
    },
  },
})

type CourseContext = Pick<AppContext, 'render'> & { params: { course: string } } & Parameters<typeof getDatabase>[0]

function renderBuildPage(
  context: CourseContext & { auth: { identity: User } },
  item: AuthorCourse,
  notice?: { tone: 'ok' | 'error'; text: string },
  status = 200,
) {
  return context.render(
    <CourseBuildPage
      item={item}
      previewHref={
        item.preview ? routes.author.course.preview.href({ course: item.course.slug, lesson: item.preview.lesson }) : undefined
      }
      notice={notice}
      viewer={toViewer(context.auth.identity)}
    />,
    { status },
  )
}

/** The course if this user manages it; otherwise the 404 or 403 response to send. */
async function managedCourse(context: CourseContext, user: User): Promise<AuthorCourse | Response> {
  let item = await getAuthoredCourse(getDatabase(context), contentBucket(), context.params.course)
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
    <Layout title="Course not found" viewer={toViewer(user)} currentPath="/author">
      <h1 class="sr-only">Course not found</h1>
      <EmptyState title="No course with that name." hint="It may have been renamed in the repo." />
    </Layout>,
    { status: 404 },
  )
}
