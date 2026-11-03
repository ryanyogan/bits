import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { keycapFace, Keycap } from '@bits/ui/keycap'
import { LiveDot } from '@bits/ui/live-dot'
import { Panel } from '@bits/ui/panel'

import { routes } from '../../../../routes.ts'
import { VideoUpload as VideoUploadIsland } from '../../public/video-upload.tsx'
import { counts, plural, type AuthorCourse, type CourseVersion, type ValidationItem, type VideoUpload } from '../../data.ts'
import { StatusTag } from '../../ui/status-tag.tsx'

export interface ValidationReportProps {
  item: AuthorCourse
  /** The draft preview, when the newest clean build isn't live yet. */
  previewHref?: string
  /** The live course page, once a version is published. */
  liveHref?: string
  /** Notice after publish / rollback, or a refused one. */
  notice?: { tone: 'ok' | 'error'; text: string }
}

const SR_PREFIX = { ok: 'Passed:', warning: 'Warning:', error: 'Error:' } as const
const GLYPH = { ok: '✓', warning: '!', error: '✕' } as const
const ORDER = { error: 0, warning: 1, ok: 2 } as const

/**
 * The level a check is shown at. The build reports "0 of 2 videos uploaded
 * and ready" as a pass (it never blocks publishing), but with videos missing
 * it isn't one: show it with the warnings it sums up. Counts and publishing
 * still follow the stored level.
 */
export function shownLevel(check: ValidationItem): ValidationItem['level'] {
  let videos = /^(\d+) of (\d+) videos? uploaded and ready$/.exec(check.text)
  if (check.level === 'ok' && videos && Number(videos[1]) < Number(videos[2])) return 'warning'
  return check.level
}

/**
 * Validation report for the latest build (Authoring spec §2c): header with
 * Preview draft, View live and Publish, then the checks in one column,
 * errors first, then warnings, with the passes folded into one line.
 * Errors block publishing; warnings don't (handoff "Validation"). Rolling
 * back lives in Versions, once, behind the same confirm as Publish.
 */
export function ValidationReport(handle: Handle<ValidationReportProps>) {
  return () => {
    let { item, previewHref, liveHref, notice } = handle.props
    let { errors } = counts(item.items)
    let { course } = item
    let isLive = item.live === item.build
    let checks = item.items.map((check) => ({ ...check, level: shownLevel(check) }))
    let problems = checks.filter((check) => check.level !== 'ok').sort((a, b) => ORDER[a.level] - ORDER[b.level])
    let passes = checks.filter((check) => check.level === 'ok')

    return (
      <section aria-labelledby="report-title" mix={cardStyle}>
        <div mix={headStyle}>
          <h2 id="report-title" mix={pathStyle}>
            {item.folder}/
          </h2>
          <span mix={metaStyle}>
            v{item.build} · {plural(item.files, 'file')} · last push {item.lastPush}
          </span>
          {isLive ? <LiveDot>{`live · v${item.build}`}</LiveDot> : null}
          <span mix={actionsStyle}>
            {previewHref ? (
              <Keycap variant="ghost-mono" href={previewHref} mix={previewKey}>
                Preview draft
              </Keycap>
            ) : null}
            {liveHref ? (
              <Keycap variant="ghost-mono" href={liveHref} mix={previewKey}>
                View live →
              </Keycap>
            ) : null}
            {isLive ? null : errors ? (
              <span mix={blockedWrap}>
                <button type="button" aria-disabled="true" aria-describedby="publish-blocked" mix={[...keycapFace, publishKey]}>
                  Publish v{item.build}
                </button>
                <span id="publish-blocked" mix={blockedText}>
                  Fix {plural(errors, 'error')} to publish
                </span>
              </span>
            ) : (
              <ConfirmFlip
                id="publish-confirm"
                label={`Publish v${item.build}`}
                title={`Publish v${item.build}?`}
                text={`Learners get v${item.build} on their next page load.${item.live !== undefined ? ` You can roll back to v${item.live} any time.` : ''}`}
                action={routes.author.course.publish.href({ course: course.slug })}
                version={item.build}
                primary
              />
            )}
          </span>
        </div>

        {notice ? (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} mix={[noticeStyle, notice.tone === 'error' ? noticeError : undefined]}>
            {notice.text}
          </p>
        ) : null}

        {problems.length ? (
          <ul aria-label={`Errors and warnings in v${item.build}`} mix={itemsList}>
            {problems.map((check, index) => (
              <ValidationRow key={index} check={check} />
            ))}
          </ul>
        ) : null}
        {passes.length ? (
          <details mix={passesStyle} open={problems.length === 0 ? true : undefined}>
            <summary mix={passesSummary}>
              <span aria-hidden="true" mix={passGlyph}>
                ✓
              </span>{' '}
              {plural(passes.length, 'check')} passed
            </summary>
            <ul aria-label={`Checks passed in v${item.build}`} mix={itemsList}>
              {passes.map((check, index) => (
                <ValidationRow key={index} check={check} />
              ))}
            </ul>
          </details>
        ) : null}
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
        </span>
        <span>
          <span class="sr-only">{SR_PREFIX[level]} </span>
          {text}
        </span>
      </li>
    )
  }
}

interface ConfirmFlipProps {
  /** id of the popover; unique on the page. */
  id: string
  /** The key that opens the confirm, and the confirm's submit. */
  label: string
  title: string
  text: string
  action: string
  version: number
  /** Primary key (Publish); otherwise the small ghost-mono key of a version row. */
  primary?: boolean
}

/**
 * A pointer flip behind a confirm (publish or roll back): the key opens a
 * native popover (no JS), whose form posts the version. Both change what
 * every learner sees, so both ask first.
 */
function ConfirmFlip(handle: Handle<ConfirmFlipProps>) {
  return () => {
    let { id, label, title, text, action, version, primary } = handle.props
    let keyStyle = primary ? [...keycapFace, publishKey] : [cancelKey, smallFlipKey]
    return (
      <>
        <button type="button" popovertarget={id} mix={keyStyle}>
          {label}
        </button>
        <div id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} mix={confirmStyle}>
          <p id={`${id}-title`} mix={confirmTitle}>
            {title}
          </p>
          <p mix={confirmText}>{text}</p>
          <form method="post" action={action} mix={confirmActions}>
            <input type="hidden" name="version" value={String(version)} />
            <button type="button" popovertarget={id} popovertargetaction="hide" mix={cancelKey}>
              Cancel
            </button>
            <button type="submit" mix={[...keycapFace, publishKey]}>
              {label}
            </button>
          </form>
        </div>
      </>
    )
  }
}

/** Version history with rollback (handoff: publish and rollback are pointer flips). */
export function VersionList(handle: Handle<{ item: AuthorCourse }>) {
  return () => {
    let { item } = handle.props
    return (
      <Panel id="versions-title" title="Versions">
        <ol mix={rowsStyle}>
          {item.versions.map((version) => (
            <VersionRow key={version.n} item={item} version={version} />
          ))}
        </ol>
      </Panel>
    )
  }
}

function VersionRow(handle: Handle<{ item: AuthorCourse; version: CourseVersion }>) {
  return () => {
    let { item, version } = handle.props
    let live = item.live === version.n
    let isBuild = version.n === item.build
    let back = item.live !== undefined && version.n < item.live
    let label = back ? `Roll back to v${version.n}` : `Make v${version.n} live`
    let action =
      live || isBuild || version.failed ? null : (
        <ConfirmFlip
          id={`rollback-confirm-v${version.n}`}
          label={label}
          title={`${label}?`}
          text={`Learners get v${version.n} on their next page load.${item.live !== undefined ? ` v${item.live} stays in this list, so you can make it live again.` : ''}`}
          action={routes.author.course.rollback.href({ course: item.course.slug })}
          version={version.n}
        />
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
      <Panel
        id="videos-title"
        title="Videos"
        aside={item.videos.length ? <span mix={ready < item.videos.length ? asideWarn : undefined}>{`${ready} of ${item.videos.length} ready`}</span> : undefined}
      >
        <div mix={panelBody}>
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
        </div>
      </Panel>
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

// The report and the panels are cells of the ruled column (decision 047):
// the band and the grid draw the hairlines; each pads itself to the inset.
const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  minWidth: 0,
  padding: 'var(--space-8) var(--section-pad-x)',
  '@media (max-width: 480px)': { padding: 'var(--space-6) var(--section-pad-x)' },
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
// "Preview draft": ghost-mono at 44px, 13px (spec §2c).
const previewKey = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
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
const blockedWrap = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1_5)' })
const blockedText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--danger)', whiteSpace: 'nowrap' })

const confirmStyle = css({
  margin: 'auto',
  width: 'min(420px, calc(100vw - 32px))',
  padding: 'var(--space-6)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-control)',
  color: 'var(--text)',
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
  background: 'var(--volt-a08)',
  border: 'var(--border-w) solid var(--volt-edge)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
})
const noticeError = css({ background: 'var(--danger-tint)', borderColor: 'var(--danger-line)', color: 'var(--danger)' })

// The checks as one column of rows sharing hairlines (decision 047): long
// warnings get the full width, and errors and warnings come first.
const itemsList = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  border: 'var(--border-w) solid var(--line-cell)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.55,
  '& > li + li': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText', '& > li + li': { borderColor: 'GrayText' } },
})
const itemStyle = css({
  display: 'grid',
  gridTemplateColumns: 'var(--space-4) minmax(0, 1fr)',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-3) var(--space-3_5)',
  background: 'var(--well)',
  color: 'var(--text-body)',
  overflowWrap: 'anywhere',
  '&[data-level="warning"]': {
    background: 'var(--warn-tint)',
    boxShadow: 'inset var(--border-w-strong) 0 0 var(--warn-line)',
    color: 'var(--warn)',
  },
  '&[data-level="error"]': {
    background: 'var(--danger-tint)',
    boxShadow: 'inset var(--border-w-strong) 0 0 var(--danger-line)',
    color: 'var(--danger)',
  },
})
const glyphStyle = css({ textAlign: 'center', '[data-level="ok"] > &': { color: 'var(--volt)' } })
const passesStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const passesSummary = css({
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  minHeight: 'var(--touch-target)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text-body)',
  cursor: 'pointer',
  '&:hover': { color: 'var(--text)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset)' },
})
const passGlyph = css({ color: 'var(--volt)' })
const asideWarn = css({ color: 'var(--warn)' })
// A version row's flip key: the ghost-mono look at the small size.
const smallFlipKey = css({ fontSize: 'var(--fs-13)' })

// A panel's body when it holds more than one block (decision 047: `Panel` pads it).
const panelBody = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)', minWidth: 0 })
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
const fileName = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text)', overflowWrap: 'anywhere' })
const videoStatus = css({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const emptyText = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
