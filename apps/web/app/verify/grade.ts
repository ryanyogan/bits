// Grading a learner's Worker reply against a `:::verify` block (decision
// 072). Pure: the status check first, then the block's `- expect` checks,
// the same deterministic reply checks prompts use (decision 064), and one
// hint. Patterns never reach the verdict, only labels and notes.
import type { VerifyCheckResult, VerifyOutcome, VerifyVerdict } from '@bits/ui/lib/verify-client'

import type { VerifyBlock } from '../actions/courses/lesson/content.ts'
import { runReplyCheck } from '../runs/reply-checks.ts'
import { statusLabel } from './path.ts'
import { VERIFY_MAX_BYTES, VERIFY_TIMEOUT_MS, type Fetched } from './fetch.ts'

/** The verdict for one fetch of `origin` + `block.path`. */
export function gradeVerify(block: VerifyBlock, origin: string, fetched: Fetched): VerifyVerdict {
  let base = { origin, path: block.path, ms: fetched.ms }
  let failed = (outcome: Exclude<VerifyOutcome, 'pass'>, hint: string, checks: VerifyCheckResult[] = [], status?: number): VerifyVerdict => {
    let verdict: VerifyVerdict = { ...base, passed: false, outcome, checks, hint }
    if (status !== undefined) verdict.status = status
    return verdict
  }
  switch (fetched.kind) {
    case 'network':
      return failed(
        'network',
        'bits couldn’t reach that Worker. Check the URL is the one wrangler deploy printed, and that the deploy finished.',
      )
    case 'timeout':
      return failed('timeout', `Your Worker didn’t answer within ${VERIFY_TIMEOUT_MS / 1000} seconds. Open ${block.path} in your browser: does it hang?`)
    case 'redirect':
      return failed(
        'redirect',
        `Your Worker answered ${block.path} with a redirect (${fetched.status}). bits doesn’t follow redirects: make ${block.path} answer directly.`,
        [{ label: statusLabel(block.path), met: false, note: `It answered ${fetched.status}.` }],
        fetched.status,
      )
    case 'too-large':
      return failed(
        'too-large',
        `The reply is over ${VERIFY_MAX_BYTES / 1024} KiB. Return a small body from ${block.path}.`,
        [{ label: statusLabel(block.path), met: fetched.status >= 200 && fetched.status < 300 }],
        fetched.status,
      )
  }

  let ok = fetched.status >= 200 && fetched.status < 300
  let statusCheck: VerifyCheckResult = ok
    ? { label: statusLabel(block.path), met: true }
    : { label: statusLabel(block.path), met: false, note: `It answered ${fetched.status}.` }
  if (!ok) {
    let hint =
      fetched.status === 404
        ? `Your Worker has no ${block.path} route yet (404). Add it, run wrangler deploy again, then check.`
        : `Your Worker answered ${fetched.status}. Make ${block.path} return 200: check wrangler tail for an error.`
    return failed('status', hint, [statusCheck, ...block.expects.map((check) => ({ label: check.label, met: false }))], fetched.status)
  }

  let checks: VerifyCheckResult[] = [statusCheck]
  for (let check of block.expects) {
    let result = runReplyCheck(check, { reply: fetched.body, prompt: '' })
    let entry: VerifyCheckResult = { label: check.label, met: result.met }
    if (!result.met && result.note) entry.note = result.note
    checks.push(entry)
  }
  let missed = checks.find((check) => !check.met)
  if (!missed) {
    return { ...base, passed: true, outcome: 'pass', status: fetched.status, checks, hint: 'Your Worker is live and answers the way it should.' }
  }
  let hint =
    block.hintsFor?.find((tied) => tied.for === missed.label)?.text ??
    block.hints?.[0] ??
    missed.note ??
    `Open ${block.path} on your Worker in a browser and compare it with the goal.`
  return failed('checks', hint, checks, fetched.status)
}
