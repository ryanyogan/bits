import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { keycapFace, Keycap } from '@bits/ui/keycap'
import { LiveDot } from '@bits/ui/live-dot'
import { MonoHeading } from '@bits/ui/eyebrow'

import { routes } from '../../../../routes.ts'
import { VideoUpload as VideoUploadIsland } from '../../public/video-upload.tsx'
import { counts, plural, type AuthorCourse, type CourseVersion, type ValidationItem, type VideoUpload } from '../../data.ts'
import { StatusTag } from '../../ui/status-tag.tsx'

export interface ValidationReportProps {
  item: AuthorCourse
  /** The draft preview, when a build is clean. */
  previewHref?: string
  /** Notice after publish / rollback, or a refused publish. */
  notice?: { tone: 'ok' | 'error'; text: string }
}

const SR_PREFIX = { ok: 'Passed:', warning: 'Warning:', error: 'Error:' } as const
const GLYPH = { ok: '✓', warning: '!', error: '✕' } as const

/**
 * Validation report for the latest build (Authoring spec §2c): header with
 * Preview draft + Publish, then ValidationItems (components §13.1). Errors
 * block publishing; warnings don't (handoff "Validation").
 */
export function ValidationReport(handle: Handle<ValidationReportProps>) {
  return () => {
    let { item, previewHref, notice } = handle.props
    let { errors } = counts(item.items)
    let { course } = item
    let isLive = item.live === item.build
    let previous = item.versions.find((v) => v.n < item.build && v.state !== 'draft' && !v.failed)

    return (
      <section aria-labelledby="report-title" mix={cardStyle}>
        <div mix={headStyle}>
          <h2 id="report-title" mix={pathStyle}>
            {item.folder}/
          </h2>
          <span mix={metaStyle}>
            {plural(item.files, 'file')} · last push {item.lastPush}
          </span>
          {isLive ? <LiveDot>{`live · v${item.build}`}</LiveDot> : null}
          <span mix={actionsStyle}>
            {previewHref ? (
              <Keycap variant="ghost-mono" href={previewHref} mix={previewKey}>
                Preview draft
              </Keycap>
            ) : null}
            {isLive ? (
              previous ? (
                <form method="post" action={routes.author.course.rollback.href({ course: course.slug })} mix={inlineForm}>
                  <input type="hidden" name="version" value={String(previous.n)} />
                  <Keycap variant="ghost-mono" type="submit" mix={previewKey}>
                    Roll back to v{previous.n}
                  </Keycap>
                </form>
              ) : null
            ) : errors ? (
              <span mix={blockedWrap}>
                <button type="button" aria-disabled="true" aria-describedby="publish-blocked" mix={[...keycapFace, publishKey]}>
                  Publish v{item.build}
                </button>
                <span id="publish-blocked" mix={blockedText}>
                  Fix {plural(errors, 'error')} to publish
                </span>
              </span>
            ) : (
              <>
                <button type="button" popovertarget="publish-confirm" mix={[...keycapFace, publishKey]}>
                  Publish v{item.build}
                </button>
                <div id="publish-confirm" popover="auto" role="dialog" aria-labelledby="publish-confirm-title" mix={confirmStyle}>
                  <p id="publish-confirm-title" mix={confirmTitle}>
                    Publish v{item.build}?
                  </p>
                  <p mix={confirmText}>
                    Learners get v{item.build} on their next page load.
                    {item.live !== undefined ? ` You can roll back to v${item.live} any time.` : ''}
                  </p>
                  <form method="post" action={routes.author.course.publish.href({ course: course.slug })} mix={confirmActions}>
                    <input type="hidden" name="version" value={String(item.build)} />
                    <button type="button" popovertarget="publish-confirm" popovertargetaction="hide" mix={cancelKey}>
                      Cancel
                    </button>
                    <button type="submit" mix={[...keycapFace, publishKey]}>
                      Publish v{item.build}
                    </button>
                  </form>
                </div>
              </>
            )}
          </span>
        </div>

        {notice ? (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} mix={[noticeStyle, notice.tone === 'error' ? noticeError : undefined]}>
            {notice.text}
          </p>
        ) : null}

        <ul aria-label={`Validation for v${item.build}`} mix={itemsGrid}>
          {item.items.map((check, index) => (
            <ValidationRow key={index} check={check} />
          ))}
        </ul>
      </section>
    )
  }
}

function ValidationRow(handle: Handle<{ check: ValidationItem }>) {
  return () => {
    let { level, text } = handle.props.check
    return (
      <li data-level={level} mix={itemStyle}>
        <span aria-hidden="true" mix={glyphStyle}>
          {GLYPH[level]}
        </span>{' '}
        <span class="sr-only">{SR_PREFIX[level]} </span>
        {text}
      </li>
    )
  }
}

/** Version history with rollback (handoff: publish and rollback are pointer flips). */
export function VersionList(handle: Handle<{ item: AuthorCourse }>) {
  return () => {
    let { item } = handle.props
    return (
      <section aria-labelledby="versions-title" mix={panelStyle}>
        <MonoHeading id="versions-title">VERSIONS</MonoHeading>
        <ol mix={rowsStyle}>
          {item.versions.map((version) => (
            <VersionRow key={version.n} item={item} version={version} />
          ))}
        </ol>
      </section>
    )
  }
}

function VersionRow(handle: Handle<{ item: AuthorCourse; version: CourseVersion }>) {
  return () => {
    let { item, version } = handle.props
    let live = item.live === version.n
    let isBuild = version.n === item.build
    let action =
      live || isBuild || version.failed ? null : (
        <form method="post" action={routes.author.course.rollback.href({ course: item.course.slug })} mix={inlineForm}>
          <input type="hidden" name="version" value={String(version.n)} />
          <Keycap variant="ghost-mono" size="sm" type="submit" mix={smallKey}>
            {item.live !== undefined && version.n < item.live ? `Roll back to v${version.n}` : `Make v${version.n} live`}
          </Keycap>
        </form>
      )
    return (
      <li mix={rowStyle}>
        <span mix={versionNo}>v{version.n}</span>
        <span mix={rowBody}>
          <span mix={rowMain}>
            {live ? <StatusTag status="live">live</StatusTag> : isBuild ? <StatusTag status="draft">latest build</StatusTag> : null}
            {version.failed ? <StatusTag status="error">failed</StatusTag> : null}
            <span mix={rowWhen}>{version.when}</span>
          </span>
          <span mix={rowMeta}>{version.source}</span>
        </span>
        {action}
      </li>
    )
  }
}

/** Lesson videos (decision 029): uploaded to R2 here, linked by the next build. */
export function VideoList(handle: Handle<{ item: AuthorCourse }>) {
  return () => {
    let { item } = handle.props
    let ready = item.videos.filter((v) => v.status === 'ready').length
    return (
      <section aria-labelledby="videos-title" mix={panelStyle}>
        <div mix={panelHead}>
          <MonoHeading id="videos-title">VIDEOS</MonoHeading>
          <span mix={rowMeta}>
            {ready} of {item.videos.length} ready
          </span>
        </div>
        {item.videos.length ? (
          <ul mix={rowsStyle}>
            {item.videos.map((video) => (
              <VideoRow key={video.file} slug={item.course.slug} video={video} />
            ))}
          </ul>
        ) : (
          <p mix={emptyText}>No lessons in this course have a video: they all publish text-only.</p>
        )}
        {item.videos.some((video) => video.status !== 'ready') ? (
          <p mix={emptyText}>
            Lessons without a ready video publish text-only. Upload the MP4 here, then upload the course folder again to link
            it.
          </p>
        ) : null}
      </section>
    )
  }
}

function VideoRow(handle: Handle<{ slug: string; video: VideoUpload }>) {
  return () => {
    let { slug, video } = handle.props
    return (
      <li mix={rowStyle} data-status={video.status}>
        <span mix={rowBody}>
          <span mix={fileName}>{video.file}</span>
          <span mix={rowMeta}>{video.lesson}</span>
        </span>
        <span mix={videoStatus}>
          {video.status === 'ready' ? <LiveDot>{`ready · ${video.duration}`}</LiveDot> : null}
          {video.status === 'uploaded' ? (
            <LiveDot tone="ion">{`uploaded · ${video.duration} · rebuild to link`}</LiveDot>
          ) : null}
          {video.status === 'uploading' || video.status === 'missing' ? (
            <VideoUploadIsland course={slug} path={video.file} resumePct={video.pct} />
          ) : null}
        </span>
      </li>
    )
  }
}

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  minWidth: 0,
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-20)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
  '@media (max-width: 480px)': { padding: 'var(--space-4_5)' },
})
const headStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3_5)', flexWrap: 'wrap' })
const pathStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontWeight: 400,
  fontSize: 'var(--fs-15)',
  lineHeight: 'normal',
  color: 'var(--text)',
  overflowWrap: 'anywhere',
})
const metaStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const actionsStyle = css({
  marginLeft: 'auto',
  display: 'flex',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  '@media (max-width: 480px)': { width: '100%', marginLeft: 0, '& > *': { flex: '1 1 0' } },
})
// "Preview draft": ghost-mono at 44px, radius 12, 13px (spec §2c).
const previewKey = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-12)',
  fontSize: 'var(--fs-13)',
  '@media (max-width: 480px)': { width: '100%' },
})
// Keycap primary `m-44`: 44px, 0 18px, Geist Mono 500 13px.
const publishKey = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4_5)',
  fontSize: 'var(--fs-13)',
  '@media (max-width: 480px)': { width: '100%' },
})
const inlineForm = css({ margin: 0, display: 'flex' })
const blockedWrap = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1_5)' })
const blockedText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--danger)', whiteSpace: 'nowrap' })

const confirmStyle = css({
  margin: 'auto',
  width: 'min(420px, calc(100vw - 32px))',
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-20)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-control)',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-float)',
  '&::backdrop': { background: 'var(--ink-a70)' },
})
const confirmTitle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-19)',
  letterSpacing: 'var(--tracking-title)',
})
const confirmText = css({ margin: 'var(--space-2_5) 0 var(--space-5)', fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
const confirmActions = css({ margin: 0, display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
// Ghost-mono look (Keycap has no popover target prop, so this is a plain button).
const cancelKey = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '&:hover': { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
})

const noticeStyle = css({
  margin: 0,
  padding: 'var(--space-2_5) var(--space-3)',
  borderRadius: 'var(--radius-10)',
  background: 'var(--volt-a08)',
  border: 'var(--border-w) solid var(--volt-a35)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
})
const noticeError = css({ background: 'var(--danger-tint)', borderColor: 'var(--danger-line)', color: 'var(--danger)' })

const itemsGrid = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
})
const itemStyle = css({
  padding: 'var(--space-2_5) var(--space-3)',
  borderRadius: 'var(--radius-10)',
  background: 'var(--well)',
  color: 'var(--text-body)',
  overflowWrap: 'anywhere',
  '&[data-level="warning"]': { background: 'var(--warn-tint)', border: 'var(--border-w) solid var(--warn-line)', color: 'var(--warn)' },
  '&[data-level="error"]': { background: 'var(--danger-tint)', border: 'var(--border-w) solid var(--danger-line)', color: 'var(--danger)' },
})
const glyphStyle = css({ '[data-level="ok"] > &': { color: 'var(--volt)' } })

const panelStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  minWidth: 0,
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-20)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
  '@media (max-width: 480px)': { padding: 'var(--space-4_5)' },
})
const panelHead = css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' })
const rowsStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' })
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3_5)',
  flexWrap: 'wrap',
  minHeight: '60px',
  padding: 'var(--space-2_5) 0',
  borderTop: 'var(--border-w) solid var(--line-bar)',
  '&:first-child': { borderTop: 0, paddingTop: 0 },
})
const versionNo = css({ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-16)', minWidth: '28px' })
const rowBody = css({ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const rowMain = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--fs-14)' })
const rowWhen = css({ color: 'var(--text)' })
const rowMeta = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const smallKey = css({ fontSize: 'var(--fs-13)' })
const fileName = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text)', overflowWrap: 'anywhere' })
const videoStatus = css({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const emptyText = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
