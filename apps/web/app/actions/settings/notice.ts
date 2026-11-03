// Settings notices (decision 068): every Settings write ends in a 303 back to
// /settings#<section>, with what happened in the session flash, not the URL.
// The page shows it once, inside the section the learner was using (the hash
// scrolls there), and a reload or a shared link doesn't show it again.
import type { CalloutTone } from '@bits/ui/callout'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'

export type SettingsSection = 'profile' | 'appearance' | 'email' | 'sign-in' | 'data' | 'sessions' | 'danger'

export interface SettingsNotice {
  section: SettingsSection
  tone: CalloutTone
  text: string
}

/** What a write left for the next page: the outcome, plus the provider for connect/disconnect. */
export interface SavedFlash {
  saved: string
  method?: string
}

const SAVED_KEY = 'settings:saved'

export interface FlashSession {
  flash(key: string, value: unknown): void
  get(key: string): unknown
}

/** 303 to the section the outcome belongs to, with the outcome flashed. */
export function settingsRedirect(session: FlashSession, saved: string, extra: { method?: string } = {}): Response {
  session.flash(SAVED_KEY, { saved, ...extra } satisfies SavedFlash)
  let section = noticeFor({ saved, ...extra })?.section ?? 'profile'
  return redirect(`${routes.settings.index.href()}#${section}`, 303)
}

/** The flashed notice, if a write just redirected here. */
export function takeSettingsNotice(session: FlashSession): SettingsNotice | undefined {
  let value = session.get(SAVED_KEY) as Partial<SavedFlash> | undefined
  return typeof value?.saved === 'string' ? noticeFor({ saved: value.saved, method: value.method }) : undefined
}

const providerNames: Record<string, string> = { github: 'GitHub', google: 'Google' }

/** The Callout for an outcome, and the section it shows in. */
export function noticeFor({ saved, method }: SavedFlash): SettingsNotice | undefined {
  let provider = providerNames[method ?? ''] ?? 'Provider'
  switch (saved) {
    case 'profile':
      return { section: 'profile', tone: 'ok', text: 'Saved. Your profile is up to date.' }
    case 'appearance':
      return { section: 'appearance', tone: 'ok', text: 'Saved. Every page uses this theme now, on any device you sign in on.' }
    case 'email-sent':
      return { section: 'email', tone: 'ok', text: 'Check your new inbox. Your email changes once you confirm it.' }
    case 'email-changed':
      return {
        section: 'email',
        tone: 'ok',
        text: 'Email changed. Sign-in links go there now, and your other devices are signed out.',
      }
    // Step-up (decision 030): the one confirm box sits at the top of Email.
    case 'reauth':
      return {
        section: 'email',
        tone: 'warning',
        text: 'For your safety, confirm it’s you first, below. Then try again.',
      }
    case 'reauth-failed':
      return {
        section: 'email',
        tone: 'warning',
        text: 'We couldn’t send the code just now (or sent too many). Try again in a few minutes.',
      }
    case 'email-taken':
      return {
        section: 'email',
        tone: 'warning',
        text: 'That address already has a Bits account, so your email hasn’t changed.',
      }
    case 'email-cancelled':
      return { section: 'email', tone: 'ok', text: 'Cancelled. Your email hasn’t changed.' }
    case 'removed':
      return {
        section: 'sign-in',
        tone: 'ok',
        text: 'Passkey removed. Your device may still offer it; you can delete it there too.',
      }
    case 'renamed':
      return { section: 'sign-in', tone: 'ok', text: 'Passkey renamed.' }
    case 'passkey-added':
      return { section: 'sign-in', tone: 'ok', text: 'Passkey added. Use it next time you sign in.' }
    case 'passkey-failed':
      return { section: 'sign-in', tone: 'warning', text: 'Passkey wasn’t added. Try again.' }
    case 'passkey-duplicate':
      return { section: 'sign-in', tone: 'warning', text: 'That passkey is already on your account.' }
    case 'passkey-limit':
      return { section: 'sign-in', tone: 'warning', text: 'You have the most passkeys an account can hold. Remove one first.' }
    case 'disconnected':
      return { section: 'sign-in', tone: 'ok', text: `${provider} disconnected.` }
    case 'connected':
      return { section: 'sign-in', tone: 'ok', text: `${provider} connected. You can sign in with it now.` }
    case 'already-linked':
      return {
        section: 'sign-in',
        tone: 'warning',
        text: `That ${provider} account is already connected to a different Bits account.`,
      }
    case 'passkey-needs-js':
      return { section: 'sign-in', tone: 'warning', text: 'Adding a passkey needs JavaScript. Turn it on and try again.' }
    case 'methods-error':
      return { section: 'sign-in', tone: 'warning', text: 'That didn’t work. Try again.' }
    default:
      return undefined
  }
}
