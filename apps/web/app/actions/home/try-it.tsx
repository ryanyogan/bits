// "Try it now" (decision 074): lesson 1's coached exercise on the landing,
// through the real /api/run and /api/coach. Loaded with `await import()` by
// the landing's action, only for a visitor with no progress, so the composer
// stays out of the Worker's startup chunk (decisions 026, 052).
import { css, type Handle } from 'remix/component'
import { CellGrid, cellInkStyle, cellVeilStyle } from '@bits/ui/cell-grid'
import { PromptComposer, type PromptComposerProps } from '@bits/ui/prompt-composer'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Catalog } from '../../content/catalog.ts'
import { draftKey } from '../../progress/draft-keys.ts'
import { routes } from '../../routes.ts'
import { exercisesOf, type PromptBlock } from '../courses/lesson/content.ts'
import { criteriaLabels, temperatureLabel } from '../courses/lesson/ui/exercise.ts'
import { lessonOne, lessonOneHref } from './links.ts'
import { h2Style, introStyle, leadStyle, monoNote, PHONE } from './styles.ts'

/**
 * The exercise the landing runs: lesson 1's `say-hi` (what-is-an-llm,
 * "Say hi to Claude"). It is the first thing the course asks, needs no
 * background, passes in one or two tries, and is coached (two `must` rubric
 * lines the judge reads, three prompt checks and a reply-length check as
 * the deterministic anchor), so a visitor sees all three parts: their
 * prompt, Claude's live reply and the coach's verdict.
 */
export const TRY_EXERCISE = { ...lessonOne(), exercise: 'say-hi' } as const

/** What the landing's composer needs: the island's props, plain data only. */
export type TryItProps = Pick<
  PromptComposerProps,
  'id' | 'task' | 'goal' | 'placeholder' | 'defaultDraft' | 'criteria' | 'coached' | 'optional' | 'temperatures' | 'examples' | 'reward' | 'run' | 'coach' | 'persist'
> & { id: string; criteria: NonNullable<PromptComposerProps['criteria']> }

/** The landing's exercise, from the published lesson; undefined if it's gone. */
export async function loadTryIt(catalog: Catalog): Promise<TryItProps | undefined> {
  let { course, lesson, exercise } = TRY_EXERCISE
  let content = await catalog.lessonContent(course, lesson)
  let block = content && exercisesOf(content).find((b) => b.id === exercise)
  return block ? tryItProps(block) : undefined
}

const hundredths = (t: number) => Math.round(t * 100)

/**
 * The composer's props, as the lesson builds them (`exerciseProps`), with
 * the same `id` and draft key: the draft, the last run and a pass made here
 * are the lesson's own when the visitor opens lesson 1 (the journal is the
 * same too, so the lesson's save counts this pass).
 */
export function tryItProps(block: PromptBlock): TryItProps {
  let { course, lesson } = TRY_EXERCISE
  let id = `${course}/${lesson}/${block.id}`
  let examples: Record<string, string[]> = {}
  for (let example of block.examples) (examples[String(hundredths(example.temperature))] ??= []).push(example.text)
  let fields = { course, lesson, exercise: block.id }
  let props: TryItProps = {
    id,
    persist: { id, key: draftKey.prompt(block.id) },
    task: block.task,
    placeholder: block.placeholder,
    defaultDraft: block.draft,
    criteria: criteriaLabels(block),
    temperatures: block.temperatures.map((t) => ({ value: hundredths(t), label: temperatureLabel(t) })),
    examples,
    // The one next step after a pass (decision 070): continue the course.
    // Here a link skips no save (decision 067): lesson 1 opens passed, and
    // its footer key saves it.
    reward: {
      xp: block.xp,
      message: block.success.message,
      note: 'Lesson 1 opens with this pass. Complete it there to save your progress.',
      next: { href: lessonOneHref(), label: 'Continue the course →' },
    },
    // `from=landing`: the landing's tighter live caps (decision 074).
    run: { action: routes.api.run.href(), fields: { ...fields, from: 'landing' } },
    coach: { action: routes.api.coach.href(), fields },
  }
  if (block.goal) props.goal = block.goal
  if (block.coach) props.coached = true
  if (block.gate === false) props.optional = true
  return props
}

/**
 * The section: the pitch beside the composer. A framed plate over the field
 * (decision 047): the copy on the veil, the composer on the ink slab. Its
 * size doesn't depend on what the composer holds: the run log is a fixed
 * window that scrolls inside (decision 023).
 */
export function TryIt(handle: Handle<{ exercise: TryItProps }>) {
  return () => (
    <RuledSection open id="try" aria-labelledby="try-title" label="Try it now" pad="none">
      <CellGrid cols={2} colsMid={1} pad={false} top={false}>
        <div mix={[cellVeilStyle, copyCell]}>
          <div mix={introStyle}>
            <h2 id="try-title" mix={[h2Style, titleStyle]}>
              Write a prompt. Claude answers. A coach grades it.
            </h2>
            <p mix={leadStyle}>
              Your prompt goes to Claude, live. Then a coach checks the reply against the goal and
              tells you what's missing. It's the first exercise of lesson 1, so a pass here carries
              into the course.
            </p>
            <p mix={monoNote}>
              No key · no sign-up · a few live runs an hour, then a labelled example
            </p>
          </div>
        </div>
        <div mix={[cellInkStyle, composerCell]}>
          <PromptComposer {...handle.props.exercise} keepRuns={3} />
        </div>
      </CellGrid>
    </RuledSection>
  )
}

// Two lines at 1440, like the other section heads; smaller than theirs so
// the composer stays in view beside it.
const titleStyle = css({ fontSize: 'clamp(var(--fs-28), 2.6vw, var(--fs-34))', [PHONE]: { fontSize: 'var(--fs-28)' } })

const copyCell = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: 'var(--cell-pad-lg)',
  [PHONE]: { padding: 'var(--space-8) var(--section-pad-x)' },
})

// The run window opens at its full (shorter) height, so the first run
// doesn't grow the section and push the rest of the landing down. In a
// lesson it starts compact and grows once (decision 025); here the window
// sits beside the copy, so the room is there anyway.
const composerCell = css({
  minWidth: 0,
  padding: 'var(--cell-pad-lg)',
  '--run-log-height': 'clamp(200px, 30svh, 300px)',
  '--run-log-empty-height': 'var(--run-log-height)',
  [PHONE]: { padding: 'var(--space-4) var(--space-3)' },
})
