// POST /api/drafts (decision 029): a signed-in learner's lesson drafts, sent
// by @bits/ui's lib/drafts.ts in the background. FormData: course, lesson,
// then `key` and `value` repeated (up to 8 pairs). Only keys the lesson
// actually has are kept. Answers 204; signed out it answers 401 and the
// browser keeps its localStorage copy.
import type { RequestContext } from 'remix/router'

import { currentUser } from '../../auth/identity.ts'
import { getCatalog } from '../../content/request.ts'
import { lessonDraftKeys } from '../../progress/draft-keys.ts'
import { MAX_DRAFT_LENGTH, MAX_DRAFTS_PER_SAVE, saveDrafts } from '../../progress/drafts.ts'
import { jsonError } from '../../runs/run.ts'

export async function saveDraftsAction(context: RequestContext<any, any>): Promise<Response> {
  let user = currentUser(context)
  if (!user) return jsonError('sign_in_required', 401)
  let form = context.get(FormData) as FormData
  let course = form.get('course')
  let lesson = form.get('lesson')
  let keys = form.getAll('key')
  let values = form.getAll('value')
  if (typeof course !== 'string' || typeof lesson !== 'string' || !keys.length || keys.length !== values.length) {
    return jsonError('invalid', 422)
  }
  if (keys.length > MAX_DRAFTS_PER_SAVE) return jsonError('too_many', 422, { max: MAX_DRAFTS_PER_SAVE })

  let catalog = await getCatalog(context)
  let content = catalog.getLesson(course, lesson) && (await catalog.lessonContent(course, lesson))
  if (!content) return jsonError('not_found', 404)
  let allowed = lessonDraftKeys(content)

  let drafts = new Map<string, string>()
  for (let [i, key] of keys.entries()) {
    let value = values[i]
    if (typeof key !== 'string' || typeof value !== 'string' || !allowed.has(key)) return jsonError('unknown_draft', 422)
    if (value.length > MAX_DRAFT_LENGTH) return jsonError('too_long', 422, { max: MAX_DRAFT_LENGTH })
    drafts.set(key, value)
  }
  await saveDrafts(context, user.id, course, lesson, [...drafts].map(([key, value]) => ({ key, value })))
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
