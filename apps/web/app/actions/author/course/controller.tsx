import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { EmptyState } from '@bits/ui/empty-state'

import type { AppContext } from '../../../router.ts'
import { getViewer } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { counts, firstLessonSlug, getAuthoredCourse, plural, type AuthorCourse } from '../data.ts'
import { CourseBuildPage } from './course-build-page.tsx'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'

export default createController(routes.author.course, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      if (!viewer) {
        let next = routes.author.course.index.href({ course: context.params.course })
        return redirect(routes.login.index.href(undefined, { searchParams: { next } }), 303)
      }
      let item = getAuthoredCourse(context.params.course)
      if (!item) return notFound(context)
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
          viewer={getViewer(context.url)}
        />,
      )
    },
    // Stubs until the build pipeline lands: they validate, then redirect with the new live pointer.
    publish(context) {
      let item = getAuthoredCourse(context.params.course)
      if (!item) return notFound(context)
      let { errors } = counts(item.items)
      if (errors) {
        return context.render(
          <CourseBuildPage
            item={item}
            previewHref={routes.author.course.preview.href({ course: item.course.slug, lesson: firstLessonSlug(item.course.slug) })}
            notice={{ tone: 'error', text: `v${item.build} has ${plural(errors, 'error')}. Fix them and push again to publish.` }}
            viewer={getViewer(context.url)}
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
      let item = getAuthoredCourse(context.params.course)
      if (!item) return notFound(context)
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
      return context.render(
        <PlaceholderPage
          title={`Draft: ${context.params.course} / ${context.params.lesson}`}
          pattern="/author/:course/preview/:lesson"
          artboard="Lesson"
          summary="Renders a draft version of the lesson under a Draft banner. Requires the author role."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})

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

function notFound(context: AppContext) {
  return context.render(
    <Layout title="Course not found" viewer={getViewer(context.url)} currentPath="/author">
      <h1 class="sr-only">Course not found</h1>
      <EmptyState title="No course with that name." hint="It may have been renamed in the repo." />
    </Layout>,
    { status: 404 },
  )
}
