import type { Handle } from 'remix/component'

export interface BrandMarkProps {
  /** Rendered size in px. */
  size?: number
}

/** The node-graph brand mark from the Main artboard. Decorative; pair it with the wordmark. */
export function BrandMark(handle: Handle<BrandMarkProps>) {
  return () => {
    let size = handle.props.size ?? 30
    return (
      <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <path
          d="M7 7 L7 23 L23 23 M7 7 L23 13 L23 23"
          stroke="var(--text)"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.5"
        />
        <circle cx="7" cy="7" r="3" fill="var(--text)" />
        <circle cx="7" cy="23" r="3" fill="var(--text)" />
        <circle cx="23" cy="13" r="3" fill="var(--text)" />
        <circle cx="23" cy="23" r="3.6" fill="var(--volt)" />
      </svg>
    )
  }
}
