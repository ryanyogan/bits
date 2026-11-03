// Coach eval (decision 064): how often the live judge agrees with a human
// label, and whether any of 20 injection attempts gets a pass.
//
//   node --import remix/node-tsx scripts/coach-eval.ts [--vars <.dev.vars>] [--repeats N]
//
// Each attempt goes through the coach's own grading path: the deterministic
// layers (grade.ts), the injection screen, then the judge through
// `judgeModel()` (model.ts, the only provider call) and the server's
// arithmetic (`applyJudge`). Nothing is written to D1.
//
// It calls the real model, so it needs the gateway vars from wrangler.jsonc
// and `CF_AIG_TOKEN` (or `ANTHROPIC_API_KEY`) from a .dev.vars file.
// Haiku 5.5 is $0.10 / $0.50 per million input / output tokens (checked
// 2026-11-02); a full run is about 100 calls of ~1k tokens: well under a cent.
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

import type { VerdictCriterion } from '@bits/db'

import type { PromptBlock } from '../app/actions/courses/lesson/content.ts'
import { exercisesOf } from '../app/actions/courses/lesson/content.ts'
import { buildCourse } from '../app/content/compile/index.ts'
import { gradeRun } from '../app/runs/grade.ts'
import { applyJudge, judgeSystem, judgeUser, parseJudgeVerdict, screensAsInjection, verdictSchema } from '../app/runs/judge.ts'
import { judgeModel, modelConfigured, type ModelEnv } from '../app/runs/model.ts'
import { exercises } from './coach-eval/cases.ts'

const here = path.dirname(new URL(import.meta.url).pathname)
const PRICE = { input: 0.1 / 1e6, output: 0.5 / 1e6 }

let { values } = parseArgs({
  options: {
    vars: { type: 'string', default: path.join(here, '..', '.dev.vars') },
    repeats: { type: 'string', default: '3' },
  },
})
let repeats = Math.max(1, Number(values.repeats) || 3)

async function loadEnv(varsPath: string): Promise<ModelEnv> {
  let env: ModelEnv = {}
  let wrangler = await fs.readFile(path.join(here, '..', 'wrangler.jsonc'), 'utf8')
  env.AI_GATEWAY_ACCOUNT_ID = /"AI_GATEWAY_ACCOUNT_ID"\s*:\s*"([^"]+)"/.exec(wrangler)?.[1]
  env.AI_GATEWAY_ID = /"AI_GATEWAY_ID"\s*:\s*"([^"]+)"/.exec(wrangler)?.[1]
  let text = await fs.readFile(varsPath, 'utf8').catch(() => '')
  for (let line of text.split('\n')) {
    let match = /^(CF_AIG_TOKEN|ANTHROPIC_API_KEY)\s*=\s*"?([^"\s]*)"?\s*$/.exec(line)
    if (match?.[2]) env[match[1] as 'CF_AIG_TOKEN' | 'ANTHROPIC_API_KEY'] = match[2]
  }
  return env
}

const COURSE_MD = `---
title: Coach eval
track: foundations
level: beginner
summary: Exercises for the coach eval.
outcomes: [Grade]
cover: { pattern: dots, sigil: E }
badge: { name: Eval, glyph: E }
---
`

/** Compiles one `:::prompt` source through the real content build. */
function compile(source: string): PromptBlock {
  let lesson = `---\ntitle: Eval\norder: 1\nminutes: 5\nxp: 40\n---\n\nAn exercise.\n\n${source}\n`
  let files = [
    { path: 'course.md', text: COURSE_MD, size: COURSE_MD.length },
    { path: '01-eval.md', text: lesson, size: lesson.length },
  ]
  let result = buildCourse(files, { folder: 'coach-eval' })
  let content = result.lessons?.get('eval')
  let block = content && exercisesOf(content)[0]
  if (!block || result.errors) {
    throw new Error(`Eval exercise didn't build: ${JSON.stringify(result.report.filter((item) => item.level === 'error'))}`)
  }
  return block
}

interface Graded {
  passed: boolean
  via: 'deterministic' | 'screen' | 'judge' | 'unusable'
  criteria: VerdictCriterion[]
}

let usage = { input: 0, output: 0, calls: 0 }

async function grade(env: ModelEnv, block: PromptBlock, prompt: string, reply: string): Promise<Graded> {
  let ranAt = new Set((block.run?.temperatures ?? []).map((t) => Math.round(t * 100)))
  let deterministic = gradeRun(block, { prompt, output: reply, live: true }, ranAt)
  if (deterministic.layer !== 'judge') return { passed: deterministic.holds, via: 'deterministic', criteria: deterministic.criteria }
  if (screensAsInjection(prompt) || screensAsInjection(reply)) return { passed: false, via: 'screen', criteria: deterministic.criteria }
  let result = await judgeModel({ system: judgeSystem(block), user: judgeUser(prompt, reply), schema: verdictSchema, env })
  usage.calls++
  usage.input += result.usage.input
  usage.output += result.usage.output
  let parsed = result.stopReason === 'refusal' ? undefined : parseJudgeVerdict(result.text, block.rubric?.length ?? 0)
  // As in production: a refusal or an unreadable verdict is a miss ("try
  // again"), never a pass. Counted separately so it shows in the report.
  if (!parsed) return { passed: false, via: 'unusable', criteria: deterministic.criteria }
  let applied = applyJudge(block, deterministic.criteria, parsed, reply)
  return { passed: applied.passed, via: 'judge', criteria: applied.criteria }
}

async function main() {
  let env = await loadEnv(values.vars!)
  if (!modelConfigured(env)) {
    console.error(`No judge configured: set CF_AIG_TOKEN or ANTHROPIC_API_KEY in ${values.vars} (and the gateway vars in wrangler.jsonc).`)
    process.exit(2)
  }
  console.log(`Coach eval: ${repeats} repeat(s) per case, judge through the gateway\n`)

  let agree = 0
  let total = 0
  let unusable = 0
  let disagreements: string[] = []
  for (let exercise of exercises) {
    let block = compile(exercise.source)
    let ok = 0
    let n = 0
    for (let item of exercise.cases) {
      let outcomes: Graded[] = []
      for (let i = 0; i < repeats; i++) outcomes.push(await grade(env, block, item.prompt, item.reply))
      for (let outcome of outcomes) {
        n++
        if (outcome.via === 'unusable') unusable++
        if (outcome.passed === item.pass) ok++
        else {
          let missed = outcome.criteria.filter((c) => c.kind === 'rubric' && c.met !== item.pass).map((c) => c.label)
          disagreements.push(`  ${exercise.kind} / ${item.name}: label ${item.pass ? 'pass' : 'fail'}, got ${outcome.passed ? 'pass' : 'fail'} via ${outcome.via}${missed.length ? ` (${missed.join('; ')})` : ''}`)
        }
      }
    }
    agree += ok
    total += n
    console.log(`${exercise.kind.padEnd(36)} ${ok}/${n} agree (${Math.round((ok / n) * 100)}%)`)
  }
  console.log(`${'all'.padEnd(36)} ${agree}/${total} agree (${Math.round((agree / total) * 100)}%), ${unusable} unusable verdict(s)`)
  if (disagreements.length) console.log(`\nDisagreements:\n${disagreements.join('\n')}`)

  let injections = JSON.parse(await fs.readFile(path.join(here, 'coach-eval', 'injections.json'), 'utf8')) as {
    cases: { name: string; prompt: string; reply: string }[]
  }
  let onCall = compile(exercises[0]!.source)
  let screened = 0
  let judgedFail = 0
  let passes: string[] = []
  let ungraded = 0
  let other = 0
  for (let item of injections.cases) {
    let outcome = await grade(env, onCall, item.prompt, item.reply)
    if (outcome.via === 'screen') screened++
    else if (outcome.passed) passes.push(`  ${item.name} (via ${outcome.via})`)
    else if (outcome.via === 'judge') judgedFail++
    else if (outcome.via === 'unusable') ungraded++
    else other++
  }
  console.log(
    `\nInjections: ${injections.cases.length} attempts, ${passes.length} passed. ` +
      `${screened} stopped by the screen, ${judgedFail} failed by the judge, ` +
      `${ungraded} refused or unreadable (a miss), ${other} failed the deterministic checks.`,
  )
  if (passes.length) console.log(`Passed (defence failures):\n${passes.join('\n')}`)

  let cost = usage.input * PRICE.input + usage.output * PRICE.output
  console.log(`\nJudge calls: ${usage.calls}, ${usage.input} input + ${usage.output} output tokens, about $${cost.toFixed(4)}`)
  if (passes.length) process.exitCode = 1
}

await main()
