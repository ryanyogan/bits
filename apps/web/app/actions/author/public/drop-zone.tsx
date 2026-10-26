import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { ProgressBar } from '@bits/ui/progress-bar'

export interface DropZoneProps {
  /** POST target (`/api/author/upload`). */
  action: string
}

interface Picked {
  file: File
  /** Path inside the course folder, e.g. "tokens/06-temperature.md". */
  path: string
}

type Phase = 'idle' | 'picked' | 'uploading' | 'done' | 'failed'

/**
 * DropZone (components §7.6). Without JS it is a plain multipart form: pick a
 * folder (or a .zip) and press Upload. Hydrated, it accepts drag-and-drop
 * (walking dropped folders), shows what was picked, uploads with progress and
 * announces each step through a polite live region. On touch screens folder
 * picking isn't available (mobile Safari), so the main target picks a .zip.
 */
export const DropZone = clientEntry(
  import.meta.url,
  function DropZone(handle: Handle<DropZoneProps>) {
    let hydrated = false
    let dragging = false
    let phase: Phase = 'idle'
    let picked: Picked[] = []
    let pct = 0
    let message = ''
    let folderInput: HTMLInputElement | undefined

    handle.queueTask(() => {
      hydrated = true
      if (folderInput && matchMedia('(pointer: coarse)').matches) {
        folderInput.removeAttribute('webkitdirectory')
        folderInput.accept = '.zip,application/zip'
      } else {
        folderInput?.setAttribute('webkitdirectory', '')
      }
      handle.update()
    })

    function setPicked(next: Picked[]) {
      picked = next.filter((p) => !p.path.split('/').some((part) => part.startsWith('.')))
      phase = picked.length ? 'picked' : 'idle'
      let bytes = picked.reduce((sum, p) => sum + p.file.size, 0)
      message = picked.length ? `${picked.length} ${picked.length === 1 ? 'file' : 'files'} ready · ${formatBytes(bytes)}` : ''
      handle.update()
    }

    function fromInput(event: Event) {
      let input = event.currentTarget as HTMLInputElement
      setPicked(Array.from(input.files ?? [], (file) => ({ file, path: file.webkitRelativePath || file.name })))
    }

    async function onDrop(event: DragEvent) {
      event.preventDefault()
      dragging = false
      let items = Array.from(event.dataTransfer?.items ?? [])
      let entries = items.map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => Boolean(e))
      let files: Picked[] = []
      if (entries.length) {
        for (let entry of entries) await walk(entry, '', files)
      } else {
        for (let file of Array.from(event.dataTransfer?.files ?? [])) files.push({ file, path: file.name })
      }
      setPicked(files)
    }

    function upload(event: SubmitEvent) {
      if (!picked.length) return // Let an empty submit fall through to native validation.
      event.preventDefault()
      let body = new FormData()
      for (let { file, path } of picked) body.append('files', file, path)
      let xhr = new XMLHttpRequest()
      xhr.open('POST', handle.props.action)
      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return
        pct = Math.round((e.loaded / e.total) * 100)
        let done = Math.min(picked.length, Math.max(1, Math.ceil((pct / 100) * picked.length)))
        message = `Uploading ${done} of ${picked.length} files…`
        handle.update()
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          phase = 'done'
          message = 'Uploaded. Building and validating…'
        } else if (xhr.status === 501) {
          phase = 'done'
          message = `Uploaded ${picked.length} files. Builds aren’t switched on in this preview yet.`
        } else {
          phase = 'failed'
          message = `Upload failed (${xhr.status}). Try again.`
        }
        handle.update()
      })
      xhr.addEventListener('error', () => {
        phase = 'failed'
        message = 'Upload failed: the connection dropped. Try again.'
        handle.update()
      })
      handle.signal.addEventListener('abort', () => xhr.abort())
      phase = 'uploading'
      pct = 0
      message = `Uploading 0 of ${picked.length} files…`
      xhr.send(body)
      handle.update()
    }

    return () => {
      let { action } = handle.props
      let busy = phase === 'uploading'
      return (
        <form
          method="post"
          action={action}
          enctype="multipart/form-data"
          data-js={hydrated ? '' : undefined}
          data-files={picked.length ? '' : undefined}
          data-drag={dragging ? '' : undefined}
          aria-label="Upload a course"
          aria-busy={busy ? 'true' : undefined}
          mix={[
            zoneStyle,
            on('submit', (event) => upload(event as SubmitEvent)),
            on('dragover', (event) => {
              event.preventDefault()
              if (!dragging) {
                dragging = true
                handle.update()
              }
            }),
            on('dragleave', (event) => {
              let related = (event as DragEvent).relatedTarget as Node | null
              if (related && event.currentTarget.contains(related)) return
              dragging = false
              handle.update()
            }),
            on('drop', (event) => void onDrop(event as DragEvent)),
          ]}
        >
          <label for="course-folder" mix={targetStyle}>
            <Icon name="folder-upload" size={44} color="var(--volt)" />
            <span mix={titleStyle}>Drop a course folder or .zip</span>
            <span mix={hintStyle}>markdown + images + videos · videos go to storage, the rest is parsed</span>
            <input
              id="course-folder"
              type="file"
              name="files"
              multiple
              {...folderPicker}
              class="sr-only"
              mix={[ref((node) => (folderInput = node)), on('change', (event) => fromInput(event))]}
            />
          </label>
          <div mix={footStyle}>
            <label for="course-zip" mix={zipLabel}>
              or choose a .zip
              <input id="course-zip" type="file" name="files" accept=".zip,application/zip" class="sr-only" mix={on('change', (event) => fromInput(event))} />
            </label>
            <Keycap type="submit" size="sm" loading={busy} disabled={busy} mix={submitStyle}>
              Upload &amp; build
            </Keycap>
          </div>
          {phase === 'uploading' ? (
            <ProgressBar pct={pct} variant="row" label="Upload progress" mix={progressStyle} />
          ) : null}
          <p role="status" aria-live="polite" mix={[statusStyle, phase === 'failed' ? failedStyle : undefined]}>
            {message}
          </p>
        </form>
      )
    }
  },
)

/** `webkitdirectory` isn't in the JSX input types; it is in every current browser. */
const folderPicker = { webkitdirectory: 'true' } as Record<string, string>

async function walk(entry: FileSystemEntry, prefix: string, out: Picked[]): Promise<void> {
  let path = prefix + entry.name
  if (entry.isFile) {
    let file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    out.push({ file, path })
    return
  }
  let reader = (entry as FileSystemDirectoryEntry).createReader()
  // readEntries returns batches; keep reading until it returns none.
  for (;;) {
    let batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (let child of batch) await walk(child, `${path}/`, out)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const DROP_ACTIVE = { borderColor: 'var(--volt-a70)', background: 'var(--volt-a04)' }

const zoneStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3_5)',
  minWidth: 0,
  minHeight: '240px',
  margin: 0,
  padding: 'var(--space-7)',
  borderRadius: 'var(--radius-20)',
  border: '1.5px dashed var(--line-drop)',
  background: 'var(--well)',
  textAlign: 'center',
  transition: 'border-color 0.2s, background-color 0.2s',
  '&:hover, &[data-drag]': DROP_ACTIVE,
  '&:has(:focus-visible)': { ...DROP_ACTIVE, boxShadow: 'var(--focus-ring)' },
  '@media (max-width: 480px)': { minHeight: '180px', padding: 'var(--space-5)' },
})
const targetStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3_5)',
  alignSelf: 'stretch',
  flex: 1,
  cursor: 'pointer',
  // The label covers the card so a click anywhere opens the picker.
  '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: 'inherit' },
})
const titleStyle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-19)',
  lineHeight: 'normal',
  letterSpacing: 'var(--tracking-title)',
  color: 'var(--text)',
})
const hintStyle = css({ fontSize: 'var(--fs-14)', lineHeight: 1.5, color: 'var(--muted)' })
// Secondary controls sit above the full-card label.
const footStyle = css({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
})
const zipLabel = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  cursor: 'pointer',
  '&:hover': { textDecoration: 'underline' },
  '@media (pointer: coarse)': { display: 'none' },
})
// With JS, Upload appears once something is picked; without JS it's always there.
const submitStyle = css({ '[data-js]:not([data-files]) &': { display: 'none' } })
const progressStyle = css({ position: 'relative', zIndex: 1, alignSelf: 'stretch', flex: 'none', maxWidth: '320px', margin: '0 auto', width: '100%' })
const statusStyle = css({
  position: 'relative',
  zIndex: 1,
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  // Out of the flow while empty, but still rendered so it can announce.
  '&:empty': { position: 'absolute' },
})
const failedStyle = css({ color: 'var(--danger)' })
