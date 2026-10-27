import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { ProgressBar } from '@bits/ui/progress-bar'

import { routes } from '../../../routes.ts'

export interface VideoUploadProps {
  course: string
  /** The lesson's `video:` path, e.g. assets/06-temperature.mp4. */
  path: string
  /** Progress of an unfinished upload (resumes when the same file is picked). */
  resumePct?: number
}

interface Started {
  id: string
  partSize: number
  parts: number
  done: number[]
}

type Phase = 'idle' | 'uploading' | 'done' | 'failed'

const RETRIES = 4

/**
 * Uploads one lesson MP4 to R2 through the Worker, in parts (decision 029):
 * start (or resume) the upload, PUT each 10 MiB part (retried with backoff),
 * then complete it with the duration the browser reads from the file.
 * Picking the same file again after a failure or a closed tab resumes from
 * the parts already stored. Needs JS: without it the Upload key stays
 * disabled with a note.
 */
export const VideoUpload = clientEntry(
  import.meta.url,
  function VideoUpload(handle: Handle<VideoUploadProps>) {
    let hydrated = false
    let phase: Phase = 'idle'
    let pct = handle.props.resumePct ?? 0
    let message = ''
    let file: File | undefined

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    function fail(text: string) {
      phase = 'failed'
      message = text
      handle.update()
    }

    async function upload() {
      if (!file || phase === 'uploading') return
      if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') return fail('Pick an MP4 file.')
      phase = 'uploading'
      message = 'Reading the video…'
      handle.update()
      let duration = await readDuration(file)

      let start = new FormData()
      start.append('course', handle.props.course)
      start.append('path', handle.props.path)
      start.append('size', String(file.size))
      let response = await fetch(routes.api.authorVideoStart.href(), { method: 'POST', body: start }).catch(() => undefined)
      if (!response?.ok) return fail(await errorText(response, 'The upload couldn’t start.'))
      let started = (await response.json()) as Started

      let done = new Set(started.done)
      for (let n = 1; n <= started.parts; n++) {
        if (handle.signal.aborted) return
        pct = Math.round((done.size / started.parts) * 100)
        message = `Uploading part ${n} of ${started.parts}…`
        handle.update()
        if (done.has(n)) continue
        let blob = file.slice((n - 1) * started.partSize, n * started.partSize)
        let ok = await putPart(routes.api.authorVideoPart.href({ id: started.id, part: String(n) }), blob)
        if (!ok) return fail(`Part ${n} didn’t upload. Pick the same file again to resume.`)
        done.add(n)
      }

      let complete = new FormData()
      if (duration) complete.append('duration', String(Math.round(duration)))
      response = await fetch(routes.api.authorVideoComplete.href({ id: started.id }), { method: 'POST', body: complete }).catch(
        () => undefined,
      )
      if (!response?.ok) return fail(await errorText(response, 'The upload didn’t finish.'))
      phase = 'done'
      pct = 100
      message = 'Uploaded. Upload the course folder again to link it to the lesson.'
      handle.update()
    }

    return () => {
      let { path } = handle.props
      let id = `video-${path.replace(/\W+/g, '-')}`
      if (phase === 'done') {
        return (
          <span role="status" mix={doneText}>
            {message}
          </span>
        )
      }
      return (
        <span mix={rowStyle}>
          {phase === 'uploading' || pct > 0 ? (
            <>
              <ProgressBar pct={pct} variant="row" color="var(--ion)" label={`${path} upload`} mix={barStyle} />
              <span mix={pctStyle}>{`${pct}%`}</span>
            </>
          ) : (
            <span mix={warnText}>! not uploaded</span>
          )}
          <label for={id} class="sr-only">
            {`Choose ${path}`}
          </label>
          <input
            id={id}
            type="file"
            accept="video/mp4"
            disabled={phase === 'uploading'}
            mix={[
              fileInput,
              on('change', (event) => {
                file = event.currentTarget.files?.[0]
                message = ''
                if (phase === 'failed') phase = 'idle'
                handle.update()
              }),
            ]}
          />
          <Keycap
            variant="dark"
            size="sm"
            type="button"
            disabled={!hydrated || !file || phase === 'uploading'}
            mix={on('click', () => void upload())}
          >
            {pct > 0 && phase !== 'uploading' ? 'Resume' : 'Upload'}
          </Keycap>
          <span role="status" mix={phase === 'failed' ? errorStyle : noteStyle}>
            {hydrated ? message : 'Uploading videos needs JavaScript.'}
          </span>
        </span>
      )
    }
  },
)

async function putPart(href: string, blob: Blob): Promise<boolean> {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    let response = await fetch(href, { method: 'PUT', body: blob, headers: { 'Content-Type': 'application/octet-stream' } }).catch(
      () => undefined,
    )
    if (response?.ok) return true
    // A 4xx other than a rate limit won't get better by retrying.
    if (response && response.status < 500 && response.status !== 429) return false
  }
  return false
}

/** The file's length in seconds, read by the browser (undefined if it can't tell). */
function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    let video = document.createElement('video')
    let url = URL.createObjectURL(file)
    let finish = (value?: number) => {
      URL.revokeObjectURL(url)
      resolve(value && Number.isFinite(value) ? value : undefined)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish(video.duration)
    video.onerror = () => finish()
    setTimeout(() => finish(), 10_000)
    video.src = url
  })
}

async function errorText(response: Response | undefined, fallback: string): Promise<string> {
  if (!response) return `${fallback} Check your connection and try again.`
  try {
    let body = (await response.json()) as { message?: string }
    return body.message ?? fallback
  } catch {
    return fallback
  }
}

const rowStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', flexWrap: 'wrap', minWidth: 0 })
const barStyle = css({ width: '120px', flex: 'none' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const warnText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--warn)' })
const noteStyle = css({ flexBasis: '100%', fontSize: 'var(--fs-12)', color: 'var(--muted)', '&:empty': { display: 'none' } })
const errorStyle = css({ flexBasis: '100%', fontSize: 'var(--fs-12)', color: 'var(--danger)' })
const doneText = css({ fontSize: 'var(--fs-13)', color: 'var(--text-body)' })
const fileInput = css({
  maxWidth: '220px',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  '&::file-selector-button': {
    minHeight: 'var(--touch-target)',
    marginRight: 'var(--space-2)',
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-10)',
    border: '1px solid var(--line-control)',
    background: 'transparent',
    color: 'var(--text)',
    font: 'inherit',
    cursor: 'pointer',
  },
})
