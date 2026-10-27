import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CourseCover } from '@bits/ui/course-cover'
import { EmptyState } from '@bits/ui/empty-state'
import { MonoHeading } from '@bits/ui/eyebrow'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { counts, plural, repo, type AuthorCourse } from './data.ts'
import { DropZone } from './public/drop-zone.tsx'
import { BlockTable } from './ui/block-table.tsx'
import { RepoSyncCard } from './ui/repo-sync-card.tsx'
import { AuthorHeader, authorMain } from './ui/shell.tsx'
import { StatusTag, type BuildStatus } from './ui/status-tag.tsx'

export interface AuthorPageProps {
  courses: AuthorCourse[]
  viewer: Viewer | null
  currentPath: string
  repoSaved?: boolean
}

/**
 * /author (Authoring spec): header, upload (DropZone + RepoSyncCard), the
 * author's courses (not drawn; composed per the spec) and the block reference.
 */
export function AuthorPage(handle: Handle<AuthorPageProps>) {
  return () => {
    let { courses, viewer, currentPath, repoSaved } = handle.props
    return (
      <Layout title="Write a course" viewer={viewer} currentPath={currentPath} bleed>
        <div mix={authorMain}>
          <AuthorHeader
            eyebrow="AUTHORS"
            title="Courses are just markdown."
            lead={
              <>
                A folder of <code>.md</code> files plus a few <code data-tone="volt">:::blocks</code> for the
                interactive bits. Push to GitHub or drop the folder here — it's validated, built and published.
              </>
            }
          />

          <section aria-label="Upload or sync" mix={uploadGrid}>
            <DropZone action={routes.api.authorUpload.href()} />
            <RepoSyncCard repo={repo} saved={repoSaved} />
          </section>

          <section aria-labelledby="your-courses" mix={sectionStyle}>
            <MonoHeading id="your-courses">YOUR COURSES</MonoHeading>
            {courses.length ? (
              <ul mix={listStyle}>
                {courses.map((item) => (
                  <li key={item.course.slug}>
                    <AuthorCourseRow item={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No courses yet." hint="Drop a folder above or connect a repo." />
            )}
          </section>

          <section aria-labelledby="the-blocks" mix={sectionStyle}>
            <MonoHeading id="the-blocks">THE BLOCKS</MonoHeading>
            <BlockTable />
          </section>
        </div>
      </Layout>
    )
  }
}

function statusOf(item: AuthorCourse): Array<{ status: BuildStatus; label: string }> {
  let { errors, warnings } = counts(item.items)
  let tags: Array<{ status: BuildStatus; label: string }> = []
  if (errors) tags.push({ status: 'error', label: plural(errors, 'error') })
  else if (warnings) tags.push({ status: 'warning', label: plural(warnings, 'warning') })
  if (item.live === undefined) tags.push({ status: 'draft', label: 'draft' })
  else if (item.live === item.build) tags.push({ status: 'live', label: 'live' })
  else tags.push({ status: 'draft', label: `v${item.build} draft` })
  return tags
}

/** A CourseRow-style link (components §9.9) to the course's build page. */
function AuthorCourseRow(handle: Handle<{ item: AuthorCourse }>) {
  return () => {
    let { item } = handle.props
    let { course } = item
    let meta = [
      item.live !== undefined ? `v${item.live} live` : 'not published',
      plural(item.files, 'file'),
      `last push ${item.lastPush}`,
    ].join(' · ')
    return (
      <a href={routes.author.course.index.href({ course: course.slug })} data-rmx-prefetch={prefetchFor(routes.author.course.index.href({ course: course.slug }))} mix={rowStyle}>
        <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="thumb" mix={thumbStyle} />
        <span mix={bodyStyle}>
          <span mix={titleStyle}>{course.title}</span>
          <span mix={metaStyle}>{meta}</span>
        </span>
        <span mix={tagsStyle}>
          {statusOf(item).map((tag) => (
            <StatusTag key={tag.label} status={tag.status}>
              {tag.label}
            </StatusTag>
          ))}
          <span aria-hidden="true" mix={arrowStyle}>
            →
          </span>
        </span>
      </a>
    )
  }
}

const uploadGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
  gap: 'var(--space-4)',
})
const sectionStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
const listStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4_5)',
  flexWrap: 'wrap',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-16)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
  color: 'var(--text)',
  textDecoration: 'none',
  transition: 'border-color var(--duration-fast)',
  '&:hover': { color: 'var(--text)', borderColor: 'var(--line-control)' },
  '@media (max-width: 480px)': { gap: 'var(--space-3_5)' },
})
const thumbStyle = css({ '@media (max-width: 480px)': { width: '48px', height: '48px', borderRadius: 'var(--radius-12)' } })
const bodyStyle = css({ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)' })
const titleStyle = css({ fontSize: 'var(--fs-16)', fontWeight: 600 })
const metaStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const tagsStyle = css({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' })
const arrowStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--volt)', marginLeft: 'var(--space-1)' })
