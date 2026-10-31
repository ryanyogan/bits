import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'
import { fieldFrameStyle, fieldInputStyle } from './lib/field.ts'
import { FOCUS_WITHIN, FORCED_COLORS, hiddenOutline } from './lib/states.ts'
import { SearchShortcut } from './search-shortcut.tsx'

export interface SearchFieldProps {
  /** GET target, e.g. `/courses`. */
  action: string
  name?: string
  value?: string
  placeholder?: string
  /** Visually hidden label. */
  label?: string
  /** Extra query params to keep (e.g. the current `track`). */
  hidden?: Record<string, string>
  /** Show the ⌘K hint; the hint is an island that focuses the field on ⌘K / Ctrl K. */
  shortcut?: boolean
  id?: string
  /**
   * `field` (default): the shared field (decision 051). `cell`: borderless,
   * filling a cell of a ruled toolbar (decision 047); focus fills it a step
   * and draws the field's 2px focus edge inside the cell.
   */
  variant?: 'field' | 'cell'
  forceFocus?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * Catalog search (components §7.2): a `role="search"` GET form, so filtering
 * happens on the server and works without JS. Static, except the optional
 * ⌘K shortcut hint.
 */
export function SearchField(handle: Handle<SearchFieldProps>) {
  return () => {
    let {
      action,
      name = 'q',
      value,
      placeholder = 'Search “agents”, “tokens”, “RAG”…',
      label = 'Search courses',
      hidden,
      shortcut = true,
      id = 'course-search',
      variant = 'field',
      forceFocus,
      mix,
    } = handle.props
    return (
      // Enter re-renders the results in place: keep focus in the field
      // (the navigation's default focus reset would drop it on <body>) and
      // the scroll where it is (the default would jump to the top; 049).
      <form
        method="get"
        action={action}
        role="search"
        data-rmx-reset-focus="manual"
        data-rmx-reset-scroll="manual"
        mix={[formStyle, variant === 'cell' ? cellFormStyle : undefined, mix]}>
        {hidden
          ? Object.entries(hidden).map(([key, val]) => <input key={key} type="hidden" name={key} value={val} />)
          : null}
        <label data-force={forceFocus ? 'focus' : undefined} mix={variant === 'cell' ? cellFieldStyle : [fieldFrameStyle, fieldStyle]}>
          <Icon name="search" />
          <span class="sr-only">{label}</span>
          <input
            id={id}
            type="search"
            name={name}
            defaultValue={value}
            placeholder={placeholder}
            enterkeyhint="search"
            autoCapitalize="none"
            mix={[fieldInputStyle, inputStyle]}
          />
          {shortcut ? <SearchShortcut target={id} /> : null}
        </label>
      </form>
    )
  }
}

const formStyle = css({ width: '100%', maxWidth: '440px', minWidth: 0 })

// The shared field (decision 051), sans: a search isn't sent to Claude.
const fieldStyle = css({
  gap: 'var(--space-3)',
  paddingRight: 'var(--space-3_5)',
  '@media (max-width: 480px)': { '& kbd': { display: 'none' } },
})

const inputStyle = css({
  fontFamily: 'var(--font-sans)',
  // The browser draws the × in the scheme's colour; the dark theme lifts it to a grey (decision 062).
  '&::-webkit-search-cancel-button': { filter: 'var(--search-cancel-filter)' },
})

const cellFormStyle = css({ maxWidth: 'none', display: 'flex' })

// A cell has no border of its own: the field's focus (a --focus-border edge
// as thick as border + ring) is drawn inside the cell's hairlines.
const cellFieldStyle = css({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 'var(--control-lg)',
  padding: '0 var(--space-4) 0 var(--section-pad-x)',
  cursor: 'text',
  transition: 'background-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:hover': { background: 'var(--fill-hover)' },
  [FOCUS_WITHIN]: {
    ...hiddenOutline,
    background: 'var(--fill-hover)',
    boxShadow: 'inset 0 0 0 var(--border-w-strong) var(--focus-border)',
  },
  '@media (max-width: 480px)': { '& kbd': { display: 'none' } },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: {
    [FOCUS_WITHIN]: { outline: 'var(--focus-outline-w) solid Highlight', outlineOffset: '-2px' },
  },
})
