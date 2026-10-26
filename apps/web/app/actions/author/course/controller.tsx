import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { EmptyState } from '@bits/ui/empty-state'

import type { User } from '@bits/db'

import type { AppContext } from '../../../router.ts'
import { requireUser, toViewer } from '../../../auth/identity.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { ForbiddenPage } from '../../../ui/not-found-page.tsx'
import { canManageCourse, counts, firstLessonSlug, getAuthoredCourse, plural, type AuthorCourse } from '../data.ts'
import { CourseBuildPage } from './course-build-page.tsx'
import { LessonPage } from '../../courses/lesson/lesson-page.tsx'
import { buildLessonView } from '../../courses/lesson/lesson-view.ts'

// Every action needs a signed-in user who manages this course (owner or
// admin); everyone else gets the same 404 an unknown course gets, except
// signed-in non-owners of a real course, who get a 403.
export default createController(routes.author.course, {
  middleware: [requireUser()],
  actions: {
    index(context) {
      let item = managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let params = context.url.searchParams
      let live = Number(params.get('live'))
      // UI build: publish/rollback "flip the pointer" by redirecting with ?live=N.
      if (live && item.versions.some((v) => v.n === live)) {
        item = withLive(item, live)
      }
      let done = params.get('done')
      let notice =
        done === 'published'
          ? { tone: 'ok' as const, text: `v${live} is live. Learners get it on their next page load.` }
          : done === 'rolledback'
            ? { tone: 'ok' as const, text: `Rolled back: v${live} is live again.` }
            : undefined
      return context.render(
        <CourseBuildPage
          item={item}
          previewHref={routes.author.course.preview.href({ course: item.course.slug, lesson: firstLessonSlug(item.course.slug) })}
          notice={notice}
          viewer={toViewer(context.auth.identity)}
        />,
      )
    },
    // Stubs until the build pipeline lands: they validate, then redirect with the new live pointer.
    publish(context) {
      let item = managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let { errors } = counts(item.items)
      if (errors) {
        return context.render(
          <CourseBuildPage
            item={item}
            previewHref={routes.author.course.preview.href({ course: item.course.slug, lesson: firstLessonSlug(item.course.slug) })}
            notice={{ tone: 'error', text: `v${item.build} has ${plural(errors, 'error')}. Fix them and push again to publish.` }}
            viewer={toViewer(context.auth.identity)}
          />,
          { status: 422 },
        )
      }
      return redirect(
        routes.author.course.index.href({ course: item.course.slug }, { searchParams: { live: String(item.build), done: 'published' } }),
        303,
      )
    },
    rollback(context) {
      let item = managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let version = Number(context.formData.get('version'))
      if (!item.versions.some((v) => v.n === version)) {
        return redirect(routes.author.course.index.href({ course: item.course.slug }), 303)
      }
      return redirect(
        routes.author.course.index.href({ course: item.course.slug }, { searchParams: { live: String(version), done: 'rolledback' } }),
        303,
      )
    },
    // The lesson page (courses/lesson) rendering the draft build under a Draft banner.
    preview(context) {
      let item = managedCourse(context, context.auth.identity)
      if (item instanceof Response) return item
      let view = buildLessonView(context.params.course, context.params.lesson, context.url, {
        draft: { version: `v${item.build}` },
        viewer: toViewer(context.auth.identity),
      })
      if (!view) return notFound(context, context.auth.identity)
      return context.render(<LessonPage view={view} />)
    },
  },
})

type CourseContext = Pick<AppContext, 'render'> & { params: { course: string } }

/** The course if this user manages it; otherwise the 404 or 403 response to send. */
function managedCourse(context: CourseContext, user: User): AuthorCourse | Response {
  let item = getAuthoredCourse(context.params.course)
  if (!item) return notFound(context, user)
  if (!canManageCourse(user, item)) {
    return context.render(
      <ForbiddenPage viewer={toViewer(user)} hint="Only this course's authors and admins can open its builds and drafts." />,
      { status: 403 },
    )
  }
  return item
}

function withLive(item: AuthorCourse, live: number): AuthorCourse {
  return {
    ...item,
    live,
    versions: item.versions.map((v) => ({
      ...v,
      state: v.n === live ? 'live' : v.n === item.build ? 'draft' : 'previous',
    })),
  }
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
