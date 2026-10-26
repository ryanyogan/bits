import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Eyebrow } from './eyebrow.tsx'
import { Icon } from './icon.tsx'
import { ToolButton } from './tool-button.tsx'

export interface VideoChapter {
  title: string
  /** Start in seconds. */
  start: number
}

export interface TranscriptCue {
  /** Start in seconds. */
  start: number
  text: string
}

export interface VideoPlayerProps {
  /** Accessible name of the player region, e.g. the lesson title. */
  title: string
  /** Total length in seconds. */
  duration: number
  chapters: VideoChapter[]
  cues?: TranscriptCue[]
  /** Starting position in seconds (style guide: 112 → "1:52"). */
  initialTime?: number
  /** Show the transcript panel beside the player initially. */
  transcriptOpen?: boolean
}

const SPEEDS = [1, 1.25, 1.5, 2, 0.75]

export function formatTime(seconds: number): string {
  let s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The Watch-mode player shell (components §10.17–10.18). There is no real
 * media yet: playback is simulated with a clock so the chapter scrubber,
 * play/pause, speed cycle, captions toggle, keyboard shortcuts and the
 * synced transcript all behave as specified. Swap the clock for a `<video>`
 * (hls.js) later. Client entry; with JS off the poster and the full
 * transcript render.
 */
export const VideoPlayer = clientEntry(
  import.meta.url,
  function VideoPlayer(handle: Handle<VideoPlayerProps>) {
    let time = handle.props.initialTime ?? 0
    let playing = false
    let speedIndex = 0
    let captions = false
    let transcript = handle.props.transcriptOpen ?? true
    let timer: ReturnType<typeof setInterval> | undefined

    handle.signal.addEventListener('abort', () => clearInterval(timer))

    function setPlaying(next: boolean) {
      playing = next
      clearInterval(timer)
      if (playing) {
        if (time >= handle.props.duration) time = 0
        timer = setInterval(() => {
          time = Math.min(handle.props.duration, time + 0.25 * SPEEDS[speedIndex]!)
          if (time >= handle.props.duration) setPlaying(false)
          handle.update()
        }, 250)
      }
      handle.update()
    }

    function seek(to: number) {
      time = Math.max(0, Math.min(handle.props.duration, to))
      handle.update()
    }

    function chapterIndexAt(t: number) {
      let { chapters } = handle.props
      let index = 0
      chapters.forEach((chapter, i) => {
        if (t >= chapter.start) index = i
      })
      return index
    }

    function onKey(event: KeyboardEvent) {
      let target = event.target as HTMLElement
      let onRange = target instanceof HTMLInputElement && target.type === 'range'
      let { chapters } = handle.props
      let key = event.key.toLowerCase()
      if (key === ' ' && target.tagName === 'BUTTON') return
      if (key === ' ' || key === 'k') setPlaying(!playing)
      else if (!onRange && key === 'arrowleft') seek(time - 5)
      else if (!onRange && key === 'arrowright') seek(time + 5)
      else if (key === 'j') seek(time - 10)
      else if (key === 'l') seek(time + 10)
      else if (key === 'c') captions = !captions
      else if (key === '[') seek(chapters[Math.max(0, chapterIndexAt(time) - 1)]?.start ?? 0)
      else if (key === ']') seek(chapters[Math.min(chapters.length - 1, chapterIndexAt(time) + 1)]?.start ?? time)
      else return
      event.preventDefault()
      handle.update()
    }

    return () => {
      let { title, duration, chapters, cues = [] } = handle.props
      let current = chapterIndexAt(time)
      let chapter = chapters[current]
      let activeCue = -1
      cues.forEach((cue, i) => {
        if (time >= cue.start) activeCue = i
      })
      let valueText = `${formatTime(time)} of ${formatTime(duration)}, Chapter ${current + 1}: ${chapter?.title ?? ''}`
      return (
        <div mix={watchStyle}>
          <section aria-label={`Video: ${title}`} mix={[playerStyle, ref((node, signal) => node.addEventListener('keydown', onKey, { signal }))]}>
            <div aria-hidden="true" mix={posterStyle}>
              {[78, 44, 26, 12].map((width, i) => (
                <span key={width} mix={posterBar} style={{ width: `${width}%`, opacity: [0.85, 0.6, 0.45, 0.3][i] }} />
              ))}
            </div>
            {captions && activeCue >= 0 ? <p mix={captionStyle}>{cues[activeCue]!.text}</p> : null}
            {playing ? null : (
              <button type="button" aria-label="Play video" mix={[bigPlay, on('click', () => setPlaying(true))]}>
                <Icon name="play" />
              </button>
            )}
            <div mix={controlsStyle}>
              <div mix={scrubberStyle}>
                <div aria-hidden="true" mix={segmentsStyle}>
                  {chapters.map((c, i) => {
                    let end = chapters[i + 1]?.start ?? duration
                    let fraction = Math.max(0, Math.min(1, (time - c.start) / (end - c.start)))
                    let pct = (fraction * 100).toFixed(1)
                    return (
                      <span
                        key={c.title}
                        mix={segmentStyle}
                        style={{
                          flex: String(end - c.start),
                          background: `linear-gradient(90deg, var(--ion) ${pct}%, var(--line-drop) ${pct}%)`,
                        }}
                      />
                    )
                  })}
                </div>
                <input
                  type="range"
                  aria-label="Seek"
                  min="0"
                  max={String(duration)}
                  step="1"
                  value={String(Math.floor(time))}
                  aria-valuetext={valueText}
                  mix={[rangeStyle, on('input', (event) => seek(Number(event.currentTarget.value)))]}
                />
              </div>
              <div mix={rowStyle}>
                <ToolButton
                  variant="video"
                  square
                  label={playing ? 'Pause' : 'Play'}
                  mix={on('click', () => setPlaying(!playing))}
                >
                  <Icon name={playing ? 'pause' : 'play-inline'} />
                </ToolButton>
                <span mix={timeStyle}>
                  {`${formatTime(time)} / ${formatTime(duration)}`}
                </span>
                <span mix={chapterStyle}>{`Chapter ${current + 1} · ${chapter?.title ?? ''}`}</span>
                <ToolButton
                  variant="video"
                  label={`Playback speed ${SPEEDS[speedIndex]}×`}
                  mix={on('click', () => {
                    speedIndex = (speedIndex + 1) % SPEEDS.length
                    handle.update()
                  })}
                >
                  {`${SPEEDS[speedIndex]}×`}
                </ToolButton>
                <ToolButton
                  variant="video"
                  label="Captions"
                  pressed={captions}
                  mix={on('click', () => {
                    captions = !captions
                    handle.update()
                  })}
                >
                  CC
                </ToolButton>
                {cues.length ? (
                  <ToolButton
                    variant="video"
                    label="Transcript"
                    pressed={transcript}
                    mix={on('click', () => {
                      transcript = !transcript
                      handle.update()
                    })}
                  >
                    ≡
                  </ToolButton>
                ) : null}
              </div>
            </div>
          </section>
          {cues.length && transcript ? (
            <section aria-label="Transcript" mix={transcriptStyle}>
              <Eyebrow tone="muted" size="sm">
                Transcript · follows along
              </Eyebrow>
              <ol mix={cueList}>
                {cues.map((cue, i) => (
                  <li key={cue.start}>
                    <button
                      type="button"
                      aria-current={i === activeCue ? 'true' : undefined}
                      data-past={i < activeCue ? 'true' : undefined}
                      mix={[cueStyle, on('click', () => seek(cue.start))]}
                    >
                      <span class="sr-only">{`${formatTime(cue.start)}: `}</span>
                      {cue.text}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      )
    }
  },
)

const watchStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', alignItems: 'flex-start' })
const playerStyle = css({
  position: 'relative',
  flex: '1 1 560px',
  minWidth: 0,
  aspectRatio: '16 / 9',
  borderRadius: 'var(--radius-20)',
  overflow: 'hidden',
  background: 'var(--well)',
  border: '1px solid var(--line)',
  '@media (max-width: 480px)': { aspectRatio: 'auto', minHeight: '320px' },
})
const posterStyle = css({
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(var(--ion-a16) 1px, transparent 1px) 0 0 / 18px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: '12% 12% 0',
  paddingTop: 'calc(22% * 9 / 16)',
})
const posterBar = css({ display: 'block', height: '26px', borderRadius: 'var(--radius-xs)', background: 'var(--ion)' })
const captionStyle = css({
  position: 'absolute',
  left: '50%',
  bottom: '120px',
  transform: 'translateX(-50%)',
  maxWidth: '80%',
  margin: 0,
  padding: 'var(--space-1_5) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--ink-a86)',
  color: 'var(--text)',
  fontSize: 'var(--fs-16)',
  textAlign: 'center',
})
const bigPlay = css({
  position: 'absolute',
  left: '50%',
  top: '42%',
  transform: 'translate(-50%, -50%)',
  width: '84px',
  height: '84px',
  borderRadius: 'var(--radius-pill)',
  border: 0,
  background: 'var(--text)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: 'var(--shadow-play)',
  cursor: 'pointer',
  transition: 'transform var(--duration-fast) var(--ease)',
  '&:hover': { transform: 'translate(-50%, -50%) scale(1.04)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '3px' },
})
const controlsStyle = css({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: 'var(--space-4) var(--space-4_5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  background: 'var(--ink-a78)',
})
const scrubberStyle = css({ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' })
const segmentsStyle = css({ display: 'flex', gap: 'var(--space-1)', width: '100%' })
const segmentStyle = css({ display: 'block', height: '5px', borderRadius: 'var(--radius-3)' })
const rangeStyle = css({
  position: 'absolute',
  inset: '-12px 0',
  width: '100%',
  margin: 0,
  opacity: 0,
  cursor: 'pointer',
  '&:focus-visible': { opacity: 1, accentColor: 'var(--ion)' },
})
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text-body)',
})
const timeStyle = css({ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' })
const chapterStyle = css({
  marginLeft: 'auto',
  color: 'var(--muted)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@media (max-width: 560px)': { order: 3, flexBasis: '100%', marginLeft: 0 },
})
const transcriptStyle = css({
  flex: '999 1 320px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-5_5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
})
const cueList = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  maxHeight: '320px',
  overflowY: 'auto',
})
const cueStyle = css({
  display: 'block',
  width: '100%',
  padding: 'var(--space-2_5) var(--space-3)',
  border: 0,
  borderRadius: 'var(--radius-10)',
  background: 'transparent',
  color: 'var(--muted)',
  font: 'inherit',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.7,
  textAlign: 'left',
  cursor: 'pointer',
  '&[data-past]': { color: 'var(--dim)' },
  '&[aria-current="true"]': { background: 'var(--ion-a08)', color: 'var(--text)' },
  '&:hover': { color: 'var(--text)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
