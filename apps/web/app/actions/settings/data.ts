// Sample account data for the Settings UI until auth and D1 land
// (docs/design/spec/pages/Settings.md). Swap for session + D1 queries later.
import type { Viewer } from '../../data/fixtures.ts'

export type MethodKind = 'email' | 'github' | 'google' | 'passkey'

export interface SignInMethod {
  /** Stable id used by the remove/disconnect forms. */
  id: string
  kind: MethodKind
  name: string
  /** Mono meta line; empty when not connected. */
  meta: string
  connected: boolean
}

export interface SessionRow {
  label: string
  when: string
  current?: boolean
}

export interface AccountSettings {
  verified: boolean
  methods: SignInMethod[]
  sessions: SessionRow[]
  export: { size: string; prompts: number }
}

export function getAccountSettings(viewer: Viewer): AccountSettings {
  return {
    verified: true,
    methods: [
      { id: 'email', kind: 'email', name: 'Email link + code', meta: viewer.email, connected: true },
      { id: 'github', kind: 'github', name: 'GitHub', meta: '@jamiepark · connected Mar 2026', connected: true },
      { id: 'google', kind: 'google', name: 'Google', meta: '', connected: false },
      {
        id: 'pk_macbook',
        kind: 'passkey',
        name: 'Passkey',
        meta: 'MacBook · iCloud Keychain · added 12 Oct 2026 · last used today',
        connected: true,
      },
      {
        id: 'pk_iphone',
        kind: 'passkey',
        name: 'Passkey',
        meta: 'iPhone · iCloud Keychain · added 3 Sep 2026 · last used 2 days ago',
        connected: true,
      },
    ],
    sessions: [
      { label: 'Chrome on macOS', when: 'active now', current: true },
      { label: 'Safari on iPhone', when: '2 days ago' },
      { label: 'Firefox on Linux', when: '3 weeks ago' },
    ],
    export: { size: 'About 40 KB', prompts: 37 },
  }
}

/** Handles nobody may take (stub for the uniqueness check). */
export const takenHandles = ['admin', 'bits', 'settings', 'taken', 'demo']
