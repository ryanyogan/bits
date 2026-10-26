import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { MonoHeading } from '@bits/ui/eyebrow'

import type { Viewer } from '../../../auth/identity.ts'
import { Layout } from '../../../ui/layout.tsx'
import type { AuthorCourse } from '../data.ts'
import { BlockTable } from '../ui/block-table.tsx'
import { AuthorHeader, authorMain } from '../ui/shell.tsx'
import { ValidationReport, VersionList, VideoList } from './ui/build-panels.tsx'
import { SourcePreview } from './ui/source-preview.tsx'

export interface CourseBuildPageProps {
  item: AuthorCourse
  previewHref?: string
  notice?: { tone: 'ok' | 'error'; text: string }
  viewer: Viewer | null
}

/**
 * /author/:course (Authoring spec): validation report with Preview draft and
 * Publish, versions with rollback, video uploads, source + preview of the
 * latest build, and the block reference (collapsed).
 */
export function CourseBuildPage(handle: Handle<CourseBuildPageProps>) {
  return () => {
    let { item, previewHref, notice, viewer } = handle.props
    return (
      <Layout title={`${item.course.title} · Authoring`} viewer={viewer} currentPath="/author" bleed>
        <div mix={authorMain}>
          <AuthorHeader eyebrow={`AUTHORS / ${item.folder}`} title={item.course.title} />
          <ValidationReport item={item} previewHref={previewHref} notice={notice} />
          <div mix={panelsGrid}>
            <VersionList item={item} />
            <VideoList item={item} />
          </div>
          {item.source ? <SourcePreview {...item.source} /> : null}
          <details mix={blocksDetails}>
            <summary mix={blocksSummary}>
              <MonoHeading level={2}>THE BLOCKS</MonoHeading>
              <span aria-hidden="true" mix={chevron}>
                ▾
              </span>
            </summary>
            <BlockTable />
          </details>
        </div>
      </Layout>
    )
  }
}

const panelsGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
  gap: 'var(--space-4)',
  alignItems: 'start',
})
const blocksDetails = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', '&[open] > summary span': { transform: 'rotate(180deg)' } })
const blocksSummary = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minHeight: 'var(--touch-target)',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  '&:hover h2': { color: 'var(--text)' },
})
const chevron = css({
  color: 'var(--muted)',
  fontSize: 'var(--fs-12)',
  transition: 'transform var(--duration-fast)',
})
