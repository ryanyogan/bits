import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'

import { AttentionMap } from './attention-map.tsx'
import { CodeInput } from './code-input.tsx'
import { PendingSubmit } from './pending-submit.tsx'
import { createFollower } from './lib/stable.tsx'
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

    assert.equal($$('[aria-label="Your runs"] ol > li').length, 1)
    assert.match($('[aria-label="Your runs"]')?.textContent ?? '', /Brew among the stars/)
  })

  it('keeps the reward under the run that earned it, so later runs land below it', async (t) => {
    try {
      window.localStorage.removeItem('bits:draft:t-reward')
    } catch {}
    let { $, $$, act, cleanup } = render(
      <PromptComposer
        id="t-reward"
        task="Write it"
        defaultDraft="Write a tagline"
        checks={[{ label: 'Asks for a tagline', patterns: [{ source: 'tagline', flags: 'i' }] }]}
        examples={{ '0': ['Brew among the stars.'] }}
        reward={{ xp: 30, message: 'Nice.', next: { href: '#next', label: 'Next: a lesson with a long title →' } }}
      />,
    )
    t.after(cleanup)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    let runOnce = async () => {
      await act(() => ($('form') as HTMLFormElement).requestSubmit())
      await act(() => new Promise((resolve) => setTimeout(resolve, 600)))
    }
    await runOnce()
    await runOnce()

    let runs = $$('[aria-label="Your runs"] ol > li')
    assert.equal(runs.length, 2)
    assert.match(runs[0]!.textContent ?? '', /\+30 neurons/)
    assert.doesNotMatch(runs[1]!.textContent ?? '', /neurons/)
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

describe('PendingSubmit', () => {
  it('swaps its label, goes busy and locks the fields until the page is shown again', async (t) => {
    // Keep the test page from navigating; this runs after the island's own listener.
    let stop = (event: Event) => event.preventDefault()
    document.addEventListener('submit', stop)
    t.after(() => document.removeEventListener('submit', stop))
    let { $, act, cleanup } = render(
      <form method="post" action="/nowhere">
        <input name="email" />
        <PendingSubmit label="Send" pendingLabel="Sending…" />
      </form>,
    )
    t.after(cleanup)
    await act(() => tick())
    let key = () => $('button') as HTMLButtonElement
    let field = $('input[name="email"]') as HTMLInputElement

    await act(() => ($('form') as HTMLFormElement).requestSubmit())
    assert.equal(key().textContent, 'Sending…')
    assert.equal(key().getAttribute('aria-busy'), 'true')
    assert.equal(field.readOnly, true)

    await act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    assert.equal(key().textContent, 'Send')
    assert.equal(key().getAttribute('aria-busy'), null)
    assert.equal(field.readOnly, false)
  })

  it('ignores a submit that was already cancelled', async (t) => {
    let { $, act, cleanup } = render(
      <form method="post" action="/nowhere">
        <PendingSubmit label="Send" pendingLabel="Sending…" />
      </form>,
    )
    t.after(cleanup)
    await act(() => tick())
    let form = $('form') as HTMLFormElement
    form.addEventListener('submit', (event) => event.preventDefault(), { capture: true })
    await act(() => form.requestSubmit())
    assert.equal(($('button') as HTMLButtonElement).textContent, 'Send')
  })
})

describe('CodeInput', () => {
  it('describes every box by the error and fills all six from a paste', async (t) => {
    let { $, $$, act, cleanup } = render(<CodeInput name="code" error="Wrong code." />)
    t.after(cleanup)
    await act(() => tick())
    let boxes = Array.from($$('input[inputmode="numeric"]')) as HTMLInputElement[]
    assert.equal(boxes.length, 6)
    for (let box of boxes) {
      assert.equal(box.getAttribute('aria-describedby'), 'code-code-error')
      assert.equal(box.getAttribute('aria-invalid'), 'true')
    }
    assert.equal($('#code-code-error')?.textContent, 'Wrong code.')

    let data = new DataTransfer()
    data.setData('text', '123 456')
    await act(() => boxes[0]!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })))
    await act(() => tick())
    assert.equal(($('input[type="hidden"]') as HTMLInputElement).value, '123456')
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
    // The first render is already the interactive step 1 (no swap after hydration).
    assert.ok(button(container, 'Next token'))
    // The no-JS copy is server-only: the client leaves <noscript> empty.
    assert.equal($('noscript')?.childNodes.length, 0)
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
    // Autoplay may already have started it (the toy is on screen).
    let play = button(container, 'Play') ?? button(container, 'Pause')
    assert.ok(play)
    // Reduced motion hides Play (CSS) and play() does nothing.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert.equal(getComputedStyle(play).display, 'none')
      return
    }
    if (play.getAttribute('aria-label') === 'Play') await act(() => play.click())
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
    assert.ok($('#t-train'), 'the slider is there from the first render')
    assert.equal($('noscript')?.childNodes.length, 0)
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
    assert.equal($$('[role="toolbar"] button').length, 5, 'chips from the first render')
    assert.equal($('noscript')?.childNodes.length, 0)
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
    assert.match(chips()[1]?.getAttribute('aria-label') ?? '', /40% attention/)

    chips()[3]!.focus()
    await act(() => chips()[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    await act(() => tick())
    assert.equal(chips()[2]?.getAttribute('aria-pressed'), 'true')
    assert.equal(document.activeElement, chips()[2])
    assert.match($('[aria-live]')?.textContent ?? '', /no links/)
  })
})

describe('createFollower', () => {
  it('follows new content at the bottom, and stops while the reader has scrolled up', async (t) => {
    let follower = createFollower()
    let { $, act, cleanup } = render(
      <div id="t-window" style={{ height: '100px', overflowY: 'auto' }} mix={follower.mixin}>
        <p style={{ height: '300px', margin: '0' }}>tall</p>
      </div>,
    )
    t.after(cleanup)
    let box = $('#t-window') as HTMLElement
    let atBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 2
    let grow = async () => {
      let p = document.createElement('p')
      p.style.height = '50px'
      box.append(p)
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    }

    await grow()
    assert.ok(atBottom(), 'pinned: follows the new line')

    box.scrollTop = 0
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    await grow()
    assert.equal(box.scrollTop, 0, 'scrolled up: stays put')

    follower.pin()
    assert.ok(atBottom(), 'pin() jumps back to the newest')
  })
})
