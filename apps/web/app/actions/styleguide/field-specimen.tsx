import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import {
  fieldActiveStyle,
  fieldBoxStyle,
  fieldFrameStyle,
  fieldGlyphStyle,
  fieldGlyphTopStyle,
  fieldInputStyle,
  fieldKeyedStyle,
  fieldMultiStyle,
} from '@bits/ui/lib/field'
import { SearchField } from '@bits/ui/search-field'
import { TextField } from '@bits/ui/text-field'

/**
 * The shared field (decision 051) in every host, at rest and focused
 * (`data-force="focus"` draws the frame's focus statically). The real
 * islands (PromptComposer, TerminalLog, the hero bar, the tokenizer) are
 * built from these same mixins; here their field rows stand alone so the
 * rows line up and one page compares them all.
 */
export function FieldSpecimen() {
  return () => (
    <div id="field-specimen" mix={gridStyle}>
      <span mix={headStyle} aria-hidden="true" />
      <span mix={headStyle}>rest</span>
      <span mix={headStyle}>focus</span>

      <Host label="TextField (sans)">
        <TextField name="sg-field-name" label="Display name" placeholder="Jamie" />
        <TextField name="sg-field-name-f" label="Display name" value="Jamie" forceFocus />
      </Host>

      <Host label="TextField mono">
        <TextField name="sg-field-email" label="Email" type="email" placeholder="you@somewhere.dev" mono />
        <TextField name="sg-field-email-f" label="Email" type="email" value="jamie@somewhere.dev" mono forceFocus />
      </Host>

      <Host label="SearchField">
        <SearchField action="#sg-inputs" id="sg-field-search" label="Search courses (field specimen)" shortcut={false} />
        <SearchField action="#sg-inputs" id="sg-field-search-f" label="Search courses (field specimen, focused)" value="agents" shortcut={false} forceFocus />
      </Host>

      <Host label="PromptComposer prompt">
        <Prompt id="sg-field-prompt" />
        <Prompt id="sg-field-prompt-f" focus value="Write a tagline for a coffee shop on the moon." />
      </Host>

      <Host label="TerminalLog input">
        <KeyedRow id="sg-field-term" label="Answer or ask the tutor" placeholder="answer, ask, or type “hint”" keyLabel="Send ↵" />
        <KeyedRow id="sg-field-term-f" label="Answer or ask the tutor (focused)" value="hint" keyLabel="Send ↵" focus />
      </Host>

      <Host label="Hero bar">
        <KeyedRow id="sg-field-hero" label="Ask your first question" placeholder="Explain tokens like I'm ten" keyLabel="Ask ↵" />
        <KeyedRow id="sg-field-hero-f" label="Ask your first question (focused)" value="Why do models make things up?" keyLabel="Ask ↵" focus />
      </Host>

      <Host label="Tokenizer toy">
        <input aria-label="Text to tokenize" value="How many r's in strawberry?" mix={fieldBoxStyle} />
        <input aria-label="Text to tokenize (focused)" value="How many r's in strawberry?" data-force="focus" mix={fieldBoxStyle} />
      </Host>

      <Host label="“Your turn” frame">
        <Prompt id="sg-field-turn" active />
        <Prompt id="sg-field-turn-f" active focus value="Hi Claude!" />
      </Host>
    </div>
  )
}

function Host(handle: Handle<{ label: string; children?: RemixNode }>) {
  return () => (
    <>
      <span mix={labelStyle}>{handle.props.label}</span>
      {handle.props.children}
    </>
  )
}

/** The PromptComposer's field: the volt › on the first line, a three-line prompt. */
function Prompt(handle: Handle<{ id: string; value?: string; focus?: boolean; active?: boolean }>) {
  return () => {
    let { id, value, focus, active } = handle.props
    return (
      <div data-force={focus ? 'focus' : undefined} mix={[fieldFrameStyle, active ? fieldActiveStyle : undefined, stretch]}>
        <span aria-hidden="true" mix={[fieldGlyphStyle, fieldGlyphTopStyle]}>
          ›
        </span>
        <textarea
          id={id}
          aria-label={focus ? 'Your prompt (focused)' : 'Your prompt'}
          rows={3}
          placeholder="Write a tagline for…"
          value={value ?? ''}
          mix={[fieldInputStyle, fieldMultiStyle]}
        />
      </div>
    )
  }
}

/** A one-line field with an md Keycap inside: the TerminalLog's input row and the hero bar. */
function KeyedRow(handle: Handle<{ id: string; label: string; placeholder?: string; value?: string; keyLabel: string; focus?: boolean }>) {
  return () => {
    let { id, label, placeholder, value, keyLabel, focus } = handle.props
    return (
      <div data-force={focus ? 'focus' : undefined} mix={[fieldFrameStyle, fieldKeyedStyle]}>
        <span aria-hidden="true" mix={fieldGlyphStyle}>
          ›
        </span>
        <input id={id} aria-label={label} placeholder={placeholder} value={value ?? ''} autocomplete="off" mix={fieldInputStyle} />
        <Keycap size="md" type="button" mix={keyStyle}>
          {keyLabel}
        </Keycap>
      </div>
    )
  }
}

// Host label · rest · focus; one column under 760px, each host's label above its pair.
const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(9rem, auto) minmax(0, 1fr) minmax(0, 1fr)',
  gap: 'var(--space-4) var(--space-5)',
  alignItems: 'center',
  '@media (max-width: 759.98px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})
const headStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
  '@media (max-width: 759.98px)': { display: 'none' },
})
const labelStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)', '@media (max-width: 759.98px)': { marginTop: 'var(--space-3)' } })
const stretch = css({ alignItems: 'stretch' })
const keyStyle = css({ flex: 'none' })
