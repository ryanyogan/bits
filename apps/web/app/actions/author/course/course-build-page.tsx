import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid } from '@bits/ui/cell-grid'
import { MonoHeading } from '@bits/ui/eyebrow'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../../auth/identity.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { PageHead } from '../../../ui/page-head.tsx'
import type { AuthorCourse } from '../data.ts'
import { BlockTable } from '../ui/block-table.tsx'
import { stripLinkStyle } from '../ui/shell.tsx'
import { ValidationReport, VersionList, VideoList } from './ui/build-panels.tsx'
import { SourcePreview } from './ui/source-preview.tsx'

/** After a publish or rollback (session flash), or a refused one (422). */
export interface BuildNotice {
  tone: 'ok' | 'error'
  text: string
}

export interface CourseBuildPageProps {
  item: AuthorCourse
  previewHref?: string
  /** The live course page, once a version is published. */
  liveHref?: string
  notice?: BuildNotice
  viewer: Viewer | null
}

/**
 * /author/:course (Authoring spec): validation report with Preview draft and
 * Publish, versions with rollback, video uploads, source + preview of the
 * latest build, and the block reference (collapsed).
 */
export function CourseBuildPage(handle: Handle<CourseBuildPageProps>) {
  return () => {
    let { item, previewHref, liveHref, notice, viewer } = handle.props
    let authorHref = routes.author.index.href()
    return (
      <Layout title={`${item.course.title} · Authoring`} viewer={viewer} currentPath={authorHref}>
        <PageFrame>
          <PageHead
            label={
              <>
                <a href={authorHref} data-rmx-prefetch={prefetchFor(authorHref)} mix={[stripLinkStyle, crumbStyle]}>
                  Authors
                </a>
                <span aria-hidden="true"> / </span>
                {item.folder}
              </>
            }
            title={item.course.title}
          />
          <RuledSection as="div" pad="none">
            <ValidationReport item={item} previewHref={previewHref} liveHref={liveHref} notice={notice} />
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

// The strip's label is the breadcrumb: back to /author, then this folder.
// The link keeps the strip's mono size; the strip sets the line.
const crumbStyle = css({ fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' })
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
