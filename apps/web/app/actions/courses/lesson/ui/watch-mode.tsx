import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { VideoPlayer } from '@bits/ui/video-player'

import { draftKey } from '../../../../progress/draft-keys.ts'
import type { LessonView } from '../lesson-view.ts'
import { draftPersist } from './exercise.ts'

/**
 * Watch mode (Lesson artboard): the VideoPlayer playing the lesson's MP4
 * (decision 029) with chapters and the synced transcript, resuming where the
 * learner stopped, then a card pointing back to the exercise. The player
 * island renders the player and transcript as siblings; the page's app-layer
 * styles let them join this flex row (`display: contents`) so the transcript
 * sits under the video beside the card, as drawn.
 */
export function WatchMode(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    let video = view.content.video!
    let hasExercise = view.content.blocks.some((block) => block.type === 'prompt')
    return (
      <div data-watch="" mix={watchStyle}>
        <VideoPlayer
          title={view.content.title}
          duration={video.duration}
          chapters={video.chapters.map((chapter) => ({ title: chapter.title, start: chapter.at }))}
          cues={video.cues}
          source={{ src: video.src }}
          initialTime={view.resumeAt}
          persist={draftPersist(view, draftKey.video)}
        />
        <aside aria-label="About this video" mix={sideCard}>
          <p mix={sideText}>
            {hasExercise
              ? 'Video is optional. The exercise still happens in text, and your draft is waiting.'
              : 'Video is optional. Everything here is in the text version too.'}
          </p>
          <Keycap size="md" block href={`${view.href.mode('read')}${hasExercise ? '#exercise' : ''}`} mix={sideKey}>
            {hasExercise ? 'Back to the exercise' : 'Read the lesson'}
          </Keycap>
        </aside>
      </div>
    )
  }
}

const watchStyle = css({
  maxWidth: 'var(--watch-width)',
  margin: '0 auto',
  display: 'flex',
  flexWrap: 'wrap',
  rowGap: 'var(--space-6)',
  columnGap: 'var(--space-5)',
  animation: 'bits-rise var(--duration-reveal) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  // The player island's layout overrides live in lesson-page.tsx (app layer).
})
const sideCard = css({
  flex: '1 1 260px',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  padding: 'var(--space-5_5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
})
const sideText = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })
const sideKey = css({ minHeight: '48px' })
