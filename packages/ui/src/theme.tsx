import type { Handle, RemixNode } from 'remix/component'

/** A theme the learner can pin (decision 062). */
export type PinnedTheme = 'dark' | 'light'
/** What the learner chose: a pinned theme, or `system` to follow the device. */
export type ThemePreference = 'system' | PinnedTheme

export const themePreferences = ['system', 'dark', 'light'] as const satisfies readonly ThemePreference[]

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (themePreferences as readonly string[]).includes(value)
}

/**
 * The browser-chrome colour (`<meta name="theme-color">`) per theme: the
 * `--ink` ground. The light value is a placeholder until the light tokens
 * (decision 062, lane L) settle the paper ground; keep the two in step.
 */
export const themeColors: Record<PinnedTheme, string> = {
  dark: '#0F131A',
  light: '#f6f7f9',
}

export interface ThemeScopeProps {
  /** The learner's choice, resolved on the server. */
  preference: ThemePreference
  children?: RemixNode
}

/**
 * Provides the learner's theme to the server-rendered tree (decision 062).
 * The app wraps every rendered page in it; `Document` reads it with
 * `themePreference(handle)` and sets `<html data-theme>` and the
 * `color-scheme` / `theme-color` metas, so the first paint is already right
 * (no client script picks the theme; the strict CSP wouldn't run one early).
 */
export function ThemeScope(handle: Handle<ThemeScopeProps, { preference: ThemePreference }>) {
  return () => {
    handle.context.set({ preference: handle.props.preference })
    return handle.props.children
  }
}

/** The preference from the nearest `ThemeScope`; `system` outside one (tests, bare renders). */
export function themePreference(handle: Handle<any, any>): ThemePreference {
  let value = handle.context.get(ThemeScope) as { preference: ThemePreference } | undefined
  return value?.preference ?? 'system'
}
