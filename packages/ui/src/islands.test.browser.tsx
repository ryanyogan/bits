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
})
