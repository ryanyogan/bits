import type { Handle } from 'remix/component'
import { EmptyState } from '@bits/ui/empty-state'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../../../routes.ts'
import { Layout } from '../../../../ui/layout.tsx'

/** 404 for an unknown course or lesson slug. */
export function LessonNotFoundPage(handle: Handle<{ course: string; currentPath: string }>) {
  return () => {
    let { course, currentPath } = handle.props
    return (
      <Layout title="Lesson not found" currentPath={currentPath}>
        <h1 class="sr-only">Lesson not found</h1>
        <EmptyState
          title="That lesson doesn’t exist."
          hint="It may have moved, or the link has a typo."
          action={
            <Keycap href={routes.courses.course.index.href({ course })} size="md">
              Back to the course
            </Keycap>
          }
        />
      </Layout>
    )
  }
}
