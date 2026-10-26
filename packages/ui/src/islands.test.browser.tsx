import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'

import { OddsBars } from './odds-bars.tsx'
import { PromptComposer } from './prompt-composer.tsx'

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
