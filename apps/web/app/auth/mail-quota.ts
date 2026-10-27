// The global daily cap on the mail people can ask for (decision 039): sign-in
// and step-up codes, and confirm-new-address codes. Each request reserves a
// slot before its token is stored and its email sent, after the
// per-address and per-IP limits pass, so a refused request costs nothing.
// The security notice to the old address after an email change is not
// capped: it only follows a confirmed code, which was.
import { reserveMailSend, type D1DataTableDatabase } from '@bits/db'

import { platform } from '#platform'

import { log } from '../log.ts'

/**
 * Sends per UTC day, unless SIGNIN_MAIL_DAILY_CAP says otherwise. Email
 * Sending includes 3,000 a month on Workers Paid, then $0.35 per 1,000
 * (checked 2026-10-27); 300 a day is far above real use and bounds a
 * distributed burst to a few dollars and one bad day for the domain.
 */
export const DEFAULT_MAIL_DAILY_CAP = 300

export function mailDailyCap(): number {
  let raw = platform.env.SIGNIN_MAIL_DAILY_CAP as string | undefined
  let value = raw ? Number(raw) : Number.NaN
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAIL_DAILY_CAP
}

/**
 * Takes one of today's sends. False when the cap is reached; the first
 * refusal of the day logs an error (once per crossing), so an alert on error
 * logs or Workers Issues picks it up.
 */
export async function reserveMail(db: D1DataTableDatabase, purpose: 'sign-in' | 'email-change'): Promise<boolean> {
  let cap = mailDailyCap()
  let result = await reserveMailSend(db, { now: Date.now(), cap })
  if (result.ok) return true
  if (result.firstRefusal) {
    log('error', 'Daily mail cap reached', { cap, purpose, setting: 'SIGNIN_MAIL_DAILY_CAP' })
  }
  return false
}
