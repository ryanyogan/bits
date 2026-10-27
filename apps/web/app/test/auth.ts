// Test support: sign in through the real email + code flow and get back the
// session cookie. Tests run with APP_ENV=test, so mail
// lands in `outbox` instead of being sent.
import { createD1Database, users, type User, type UserRole } from '@bits/db'

import { platform } from '#platform'

import { outbox } from '../auth/mailer.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

export const testDb = createD1Database(platform.env.DB)

let ipCounter = 0

/** A fresh client IP per request, so the per-IP email limit never trips across tests. */
export function testIp(): string {
  ipCounter++
  return `203.0.113.${ipCounter % 250}`
}

export function form(fields: Record<string, string | string[]>): FormData {
  let body = new FormData()
  for (let [name, value] of Object.entries(fields)) {
    for (let item of Array.isArray(value) ? value : [value]) body.append(name, item)
  }
  return body
}

/** Requests the sign-in email and returns its 6-digit code and magic-link token. */
export async function requestCode(email: string, fields: Record<string, string | string[]> = {}) {
  let response = await router.fetch(
    new Request(new URL(routes.login.action.href(), 'http://localhost'), {
      method: 'POST',
      headers: { 'CF-Connecting-IP': testIp() },
      body: form({ email, ...fields }),
    }),
  )
  if (response.status !== 303) throw new Error(`POST /login answered ${response.status}`)
  let message = outbox.findLast((m) => m.to === email)
  if (!message) throw new Error(`No email for ${email}`)
  let code = /code is (\d{6})/.exec(message.text)?.[1]
  let token = /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1]
  if (!code || !token) throw new Error('Email is missing the code or link')
  return { code, token, message }
}

/** `__Host-session=...` from a response's Set-Cookie, ready for a Cookie header. */
export function sessionCookieFrom(response: Response): string | null {
  let header = response.headers.getSetCookie().find((value) => value.startsWith('__Host-session='))
  return header ? header.split(';')[0]! : null
}

/** Signs in (creating the user if needed) and returns its Cookie header value. */
export async function signIn(
  email: string,
  options: { role?: UserRole; displayName?: string } = {},
): Promise<{ cookie: string; user: User }> {
  let { code } = await requestCode(email, options.displayName ? { mode: 'signup', displayName: options.displayName } : {})
  let response = await router.fetch(
    new Request(new URL(routes.auth.verify.action.href(), 'http://localhost'), {
      method: 'POST',
      body: form({ email, code }),
    }),
  )
  let cookie = sessionCookieFrom(response)
  if (response.status !== 303 || !cookie) throw new Error(`Code sign-in failed: ${response.status}`)
  let user = (await testDb.findOne(users, { where: { email } }))!
  if (options.role && user.role !== options.role) {
    await testDb.update(users, user.id, { role: options.role })
  }
  return { cookie, user: { ...user, goals: user.goals as string[], role: options.role ?? user.role } }
}

/**
 * Backdates the sign-in time of every session of a user by an hour, so it
 * no longer counts as a recent sign-in (decision 030).
 */
export async function ageSessions(userId: string): Promise<void> {
  await testDb.d1
    .prepare(`update sessions set data = json_set(data, '$[0].user.at', json_extract(data, '$[0].user.at') - 3600000) where user_id = ?`)
    .bind(userId)
    .run()
}

/** router.fetch with an optional session cookie. */
export function fetchAs(cookie: string | null, path: string, init: RequestInit = {}): Promise<Response> {
  let headers = new Headers(init.headers)
  if (cookie) headers.set('Cookie', cookie)
  return router.fetch(new Request(new URL(path, 'http://localhost'), { ...init, headers }))
}

export interface RunInput {
  course: string
  lesson: string
  exercise: string
  prompt: string
  /** T × 100. */
  temperature: number
  /** CF-Connecting-IP; defaults to a fresh test IP. */
  ip?: string
}

/** POST /api/run as the composer does. Returns the response (read its body to finish the run). */
export function runPrompt(cookie: string | null, input: RunInput): Promise<Response> {
  let { ip = testIp(), temperature, ...fields } = input
  return fetchAs(cookie, routes.api.run.href(), {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
    body: form({ ...fields, temperature: String(temperature) }),
  })
}

/**
 * Runs an exercise at each temperature (× 100) and returns the session
 * cookie to keep using (a signed-out visitor gets one on the first run).
 */
export async function runAt(
  cookie: string | null,
  exercise: Omit<RunInput, 'temperature'>,
  temperatures: number[],
): Promise<string | null> {
  for (let temperature of temperatures) {
    let response = await runPrompt(cookie, { ...exercise, temperature })
    if (response.status !== 200) throw new Error(`POST /api/run answered ${response.status}`)
    await response.text()
    cookie = sessionCookieFrom(response) ?? cookie
  }
  return cookie
}

/** Completes a lesson through the real "complete lesson" form. Returns the response. */
export async function completeLesson(
  cookie: string | null,
  course: string,
  lesson: string,
  fields: Record<string, string | string[]> = {},
): Promise<Response> {
  return fetchAs(cookie, routes.courses.lesson.complete.href({ course, lesson }), { method: 'POST', body: form(fields) })
}
