import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'

import { AttentionMap } from './attention-map.tsx'
import { NextTokenPlayer } from './next-token.tsx'
import { OddsBars } from './odds-bars.tsx'
import { PromptComposer } from './prompt-composer.tsx'
import { TrainingScrubber } from './training-scrubber.tsx'

describe('OddsBars', () => {
  it('reshapes the odds when the temperature slider moves', async (t) => {
    let { $, act, cleanup } = render(
      <OddsBars
        id="t-odds"
        context="Tagline:"
        candidates={[
          [' Brew', 3.1],
          [' One', 2.4],
        ]}
      />,
    )
    t.after(cleanup)

    let slider = $('#t-odds')
    assert.ok(slider instanceof HTMLInputElement)
    assert.equal($('output')?.textContent, '0.70')

    await act(() => {
      slider.value = '0'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })

    assert.equal($('output')?.textContent, '0.00')
    assert.match($('[aria-live]')?.textContent ?? '', /favourite wins/)
    assert.match($('li')?.textContent ?? '', /100%/)
  })
})

describe('PromptComposer', () => {
  it('evaluates live checks and runs on Enter (Shift+Enter is a newline)', async (t) => {
    try {
      window.localStorage.removeItem('bits:draft:t-composer')
    } catch {}
    let { $, $$, act, cleanup } = render(
      <PromptComposer
        id="t-composer"
        task="Write it"
        checks={[{ label: 'Asks for a tagline', patterns: [{ source: 'tagline', flags: 'i' }] }]}
        examples={{ '0': ['Brew among the stars.'] }}
      />,
    )
    t.after(cleanup)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    let textarea = $('textarea')
    assert.ok(textarea instanceof HTMLTextAreaElement)
    assert.equal($('li[data-passed]')?.getAttribute('data-passed'), 'false')

    await act(() => {
      textarea.value = 'Write a tagline'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal($('li[data-passed]')?.getAttribute('data-passed'), 'true')

    let shift = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })
    await act(() => textarea.dispatchEvent(shift))
    assert.equal(shift.defaultPrevented, false)

    let enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    await act(() => textarea.dispatchEvent(enter))
    assert.equal(enter.defaultPrevented, true)
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)))

    assert.equal($$('[aria-label="Your runs"] > li').length, 1)
    assert.match($('[aria-label="Your runs"]')?.textContent ?? '', /Brew among the stars/)
  })

  it('streams a server run, labels canned output, and only then ticks the run check', async (t) => {
    try {
      window.localStorage.removeItem('bits:draft:t-live')
    } catch {}
    let realFetch = window.fetch
    let sent: FormData[] = []
    window.fetch = async (_input, init) => {
      let body = init?.body as FormData
      sent.push(body)
      if (body.get('temperature') === '100') {
        let stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Lunar '))
            controller.enqueue(new TextEncoder().encode('lattes.'))
            controller.close()
          },
        })
        return new Response(stream, { headers: { 'X-Run-Source': 'live' } })
      }
      return new Response('Brewed beyond gravity.', { headers: { 'X-Run-Source': 'fallback', 'X-Run-Reason': 'limit' } })
    }
    t.after(() => (window.fetch = realFetch))
    let { $, $$, act, cleanup } = render(
      <PromptComposer
        id="t-live"
        task="Write it"
        defaultDraft="Write a tagline"
        checks={[{ label: 'Ran at 0 and 1.0', ranAt: [0, 100] }]}
        temperatures={[
          { value: 0, label: '0' },
          { value: 100, label: '1.0' },
        ]}
        run={{ action: '/api/run', fields: { course: 'c', lesson: 'l', exercise: 'e' } }}
      />,
    )
    t.after(cleanup)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    let settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)))

    await act(() => ($('form') as HTMLFormElement).requestSubmit())
    await settle()
    assert.equal(sent[0]?.get('exercise'), 'e')
    assert.equal(sent[0]?.get('temperature'), '0')
    let runs = () => $('[aria-label="Your runs"]')?.textContent ?? ''
    assert.match(runs(), /Brewed beyond gravity/)
    assert.match(runs(), /hourly run limit/)
    assert.equal($('li[data-passed]')?.getAttribute('data-passed'), 'false')

    let hot = $$('input[name="temperature"]')[1] as HTMLInputElement
    await act(() => {
      hot.checked = true
      hot.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(() => ($('form') as HTMLFormElement).requestSubmit())
    await settle()
    assert.match(runs(), /Lunar lattes\./)
    assert.match(runs(), /model · T=1\.0/)
    assert.equal($('li[data-passed]')?.getAttribute('data-passed'), 'true')
  })
})

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const button = (root: ParentNode, label: string) => root.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement

describe('NextTokenPlayer', () => {
  it('steps the reply forward and back, showing each step’s odds', async (t) => {
    let { $, act, cleanup, container } = render(
      <NextTokenPlayer
        prompt="The capital of France is"
        steps={[
          { token: ' Paris', p: 0.92, alternatives: [[' the', 0.03]] },
          { token: '.', p: 0.7, alternatives: [[',', 0.2]] },
        ]}
        illustrative
      />,
    )
    t.after(cleanup)
    await act(() => tick())
    assert.match(container.textContent ?? '', /illustrative/)
    assert.match($('[aria-label="Candidates for step 1"]')?.textContent ?? '', /Paris.*92%.*the.*3\.0%/)
    assert.equal(button(container, 'Previous token').disabled, true)

    await act(() => button(container, 'Next token').click())
    assert.match($('p')?.textContent ?? '', /The capital of France is Paris/)
    assert.match($('[aria-live]')?.textContent ?? '', /Step 2 of 2/)

    await act(() => button(container, 'Next token').click())
    assert.match(container.textContent ?? '', /Done: 2 tokens/)
    assert.equal(button(container, 'Next token').disabled, true)

    await act(() => button(container, 'Previous token').click())
    assert.match($('[aria-live]')?.textContent ?? '', /Step 2 of 2/)
  })

  it('plays through on its own', async (t) => {
    let { act, cleanup, container } = render(
      <NextTokenPlayer prompt="Hi" steps={[{ token: ' there', p: 0.8, alternatives: [] }]} />,
    )
    t.after(cleanup)
    await act(() => tick())
    let play = button(container, 'Play')
    // Reduced motion hides Play; then there is nothing to autoplay.
    if (!play) return
    await act(() => play.click())
    assert.ok(button(container, 'Pause'))
    await act(() => tick(1800))
    assert.match(container.textContent ?? '', /Hi there/)
    assert.match(container.textContent ?? '', /Done/)
  })
})

describe('TrainingScrubber', () => {
  it('shows the snapshot under the slider', async (t) => {
    let { $, act, cleanup } = render(
      <TrainingScrubber
        id="t-train"
        prompt="Once upon a"
        snapshots={[
          { step: 0, loss: 10.8, text: 'qz# lorp' },
          { step: 5000, loss: 2.1, text: 'time there was' },
        ]}
      />,
    )
    t.after(cleanup)
    await act(() => tick())
    let slider = $('#t-train')
    assert.ok(slider instanceof HTMLInputElement)
    assert.match($('[aria-live]')?.textContent ?? '', /qz# lorp/)
    await act(() => {
      slider.value = '1'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.match($('[aria-live]')?.textContent ?? '', /time there was/)
    assert.equal($('output')?.textContent, '5,000')
    assert.equal(slider.getAttribute('aria-valuetext'), 'step 5,000, loss 2.10')
    assert.ok($('svg circle'))
  })
})

describe('AttentionMap', () => {
  it('highlights what the picked token attends to, with roving focus', async (t) => {
    let { $, $$, act, cleanup } = render(
      <AttentionMap
        tokens={['The', ' animal', ' was', ' tired', ' it']}
        links={[
          { from: 4, to: 1, weight: 0.6 },
          { from: 3, to: 1, weight: 0.4 },
          { from: 3, to: 2, weight: 0.3 },
        ]}
      />,
    )
    t.after(cleanup)
    await act(() => tick())
    let chips = () => [...$$('[role="toolbar"] button')] as HTMLButtonElement[]
    assert.equal(chips().length, 5)
    // Starts on the strongest link's token.
    assert.equal(chips()[4]?.getAttribute('aria-pressed'), 'true')
    assert.equal(chips()[4]?.tabIndex, 0)
    assert.equal(chips()[1]?.getAttribute('data-state'), 'to')
    assert.match($('[aria-live]')?.textContent ?? '', /“it” looks most at “animal” \(60%\)/)

    await act(() => chips()[3]!.click())
    assert.equal(chips()[2]?.getAttribute('data-state'), 'to')
    assert.match(chips()[1]?.getAttribute('aria-label') ?? '', /attention 40%/)

    chips()[3]!.focus()
    await act(() => chips()[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    await act(() => tick())
    assert.equal(chips()[2]?.getAttribute('aria-pressed'), 'true')
    assert.equal(document.activeElement, chips()[2])
    assert.match($('[aria-live]')?.textContent ?? '', /no links/)
  })
})
