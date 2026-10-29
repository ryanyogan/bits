import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from 'remix/form-data-parser'
import { formData, type FormDataOptions } from 'remix/middleware/form-data'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../routes.ts'

const KiB = 1024
const MiB = 1024 * KiB

/**
 * Form body limits per endpoint (remix/form-data-parser: `maxFiles`,
 * `maxFileSize`, `maxParts`, `maxTotalSize`; for urlencoded bodies
 * `maxParts` counts fields and `maxTotalSize` the raw body). Only the
 * course-folder upload takes files. Video parts are raw bytes, read and
 * capped at 10 MiB by `uploadVideoPart`, never form data.
 */
export const formLimits = {
  /** Sign-in, code, token links, sign-out: an email address or a code. */
  auth: { maxFiles: 0, maxParts: 16, maxTotalSize: 16 * KiB },
  /** Every other form or API body: settings, admin, author version forms, /api/run (a 4000-character prompt), /api/ask, passkey JSON. */
  default: { maxFiles: 0, maxParts: 100, maxTotalSize: 64 * KiB },
  /** Up to 8 drafts of 4000 characters each (`MAX_DRAFTS_PER_SAVE`, `MAX_DRAFT_LENGTH`). */
  drafts: { maxFiles: 0, maxParts: 40, maxTotalSize: 160 * KiB },
  /** "Complete lesson": every exercise's prompt and code joins it via `form=`. */
  lessonSave: { maxFiles: 0, maxParts: 400, maxTotalSize: 256 * KiB },
  /** A course folder: many small text files (the DropZone sends media as names only). */
  courseUpload: { maxFiles: 300, maxFileSize: 1 * MiB, maxParts: 1000, maxTotalSize: 8 * MiB },
} satisfies Record<string, FormDataOptions>

type Scope = keyof typeof formLimits

const scopes: [ReturnType<typeof createMatcher>, Scope][] = [
  [createMatcher(routes.api.authorUpload.pattern), 'courseUpload'],
  [createMatcher(routes.courses.lesson.complete.pattern), 'lessonSave'],
  [createMatcher(routes.api.drafts.pattern), 'drafts'],
  [createMatcher(routes.login.action.pattern), 'auth'],
  [createMatcher(routes.auth.verify.action.pattern), 'auth'],
  [createMatcher(routes.auth.email.action.pattern), 'auth'],
  [createMatcher(routes.auth.emailRevert.action.pattern), 'auth'],
  [createMatcher(routes.logout.action.pattern), 'auth'],
]

/** The scope a request's body is parsed under. */
export function formScope(url: URL): Scope {
  return scopes.find(([matcher]) => matcher.match(url))?.[1] ?? 'default'
}

function isLimitError(error: unknown): boolean {
  return (
    error instanceof MaxFilesExceededError ||
    error instanceof MaxFileSizeExceededError ||
    error instanceof MaxHeaderSizeExceededError ||
    error instanceof MaxPartsExceededError ||
    error instanceof MaxTotalSizeExceededError
  )
}

/**
 * `formData()` with the limits of the endpoint being called. A body over
 * its limit is answered 413 here instead of becoming a logged 500.
 */
export function scopedFormData(): ReturnType<typeof formData> {
  let parsers = Object.fromEntries(
    Object.entries(formLimits).map(([scope, limits]) => [scope, formData(limits)]),
  ) as Record<Scope, ReturnType<typeof formData>>
  return async (context, next) => {
    try {
      return await parsers[formScope(context.url)](context, next)
    } catch (error) {
      // Only a parse limit, and only before the action ran (no FormData yet).
      if (!isLimitError(error) || context.has(FormData)) throw error
      return new Response('Payload Too Large', {
        status: 413,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  }
}
