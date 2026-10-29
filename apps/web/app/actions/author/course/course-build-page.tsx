import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid } from '@bits/ui/cell-grid'
import { MonoHeading } from '@bits/ui/eyebrow'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../../auth/identity.ts'
import { Layout } from '../../../ui/layout.tsx'
import { PageHead } from '../../../ui/page-head.tsx'
import type { AuthorCourse } from '../data.ts'
import { BlockTable } from '../ui/block-table.tsx'
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
      <Layout title={`${item.course.title} · Authoring`} viewer={viewer} currentPath="/author">
        <PageFrame>
          <PageHead label={`Authors / ${item.folder}`} title={item.course.title} />
          <RuledSection as="div" pad="none">
            <ValidationReport item={item} previewHref={previewHref} notice={notice} />
          </RuledSection>
          <RuledSection as="div" pad="none">
            <CellGrid cols={2} colsMid={1} pad={false}>
              <VersionList item={item} />
              <VideoList item={item} />
            </CellGrid>
          </RuledSection>
          {item.source ? (
            <RuledSection as="div" pad="none">
              <SourcePreview {...item.source} />
            </RuledSection>
          ) : null}
          <RuledSection as="div" pad="none">
            <details mix={blocksDetails}>
              <summary mix={blocksSummary}>
                <MonoHeading level={2} uppercase={false}>The blocks</MonoHeading>
                <span aria-hidden="true" mix={chevron}>
                  ▾
                </span>
              </summary>
              <BlockTable />
            </details>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

const blocksDetails = css({ display: 'flex', flexDirection: 'column', '&[open] > summary span': { transform: 'rotate(180deg)' } })
const blocksSummary = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minHeight: 'var(--control-field)',
  padding: '0 var(--section-pad-x)',
  cursor: 'pointer',
  '[open] > &': { borderBottom: 'var(--border-w) solid var(--line-cell)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  '&:hover h2': { color: 'var(--text)' },
})
const chevron = css({
  color: 'var(--muted)',
  fontSize: 'var(--fs-12)',
  transition: 'transform var(--duration-fast)',
})
