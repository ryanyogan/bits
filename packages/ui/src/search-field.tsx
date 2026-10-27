import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'
import { hiddenOutline } from './lib/states.ts'
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
      forceFocus,
      mix,
    } = handle.props
    return (
      // Enter re-renders the results in place: keep focus in the field
      // (the navigation's default focus reset would drop it on <body>).
      <form method="get" action={action} role="search" data-rmx-reset-focus="manual" mix={[formStyle, mix]}>
        {hidden
          ? Object.entries(hidden).map(([key, val]) => <input key={key} type="hidden" name={key} value={val} />)
          : null}
        <label data-force={forceFocus ? 'focus' : undefined} mix={fieldStyle}>
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
            mix={inputStyle}
          />
          {shortcut ? <SearchShortcut target={id} /> : null}
        </label>
      </form>
    )
  }
}

const formStyle = css({ width: '100%', maxWidth: '440px', minWidth: 0 })

const fieldStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: '0 var(--space-3_5) 0 var(--space-4_5)',
  minHeight: 'var(--control-lg)',
  borderRadius: 'var(--radius-16)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-strong)',
  cursor: 'text',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:focus-within, &[data-force="focus"]': {
    ...hiddenOutline,
    borderColor: 'var(--volt-a60)',
    boxShadow: 'var(--focus-ring-soft)',
  },
  '@media (max-width: 480px)': { '& kbd': { display: 'none' } },
})

const inputStyle = css({
  flex: 1,
  minWidth: 0,
  height: 'var(--control-search-input)',
  padding: 0,
  background: 'transparent',
  border: 0,
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-16)',
  '&::placeholder': { color: 'var(--dim)', opacity: 1 },
  '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
  '&::-webkit-search-cancel-button': { filter: 'invert(0.6)' },
})
