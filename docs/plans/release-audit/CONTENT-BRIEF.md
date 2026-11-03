# Wave 2 content conversion — shared brief

Goal (owner): learners "prompt their way to success with help back from the agent", instead of filling in quizzes.
The coach engine (decision 064) is merged on master. Read: docs/decisions/064-coached-prompts.md, the conversion plan
and per-block inventory in docs/plans/release-audit/D-coached-prompts.md, AGENTS.md "Why bits exists" (quality
bar: best sources only, distilled, honest, start with Claude, original words) and the Content sections, and
docs/plans/release-audit/IMPL-BRIEF.md (binding rules: own worktree, commits, tests, report, hand-off ~250k).
The engine author's syntax summary (authoritative copy is decision 064 + /author block reference):

```
:::prompt{id="on-call" xp=20 coach [gate=false]}
<task line>
- goal "…"  - draft "…"/- placeholder "…"  - check "label" /re/i
- expect "label" json [keys=a,b] [types=a:number] | words<=N | sentences<=N | one-word | oneof "a|b|c" | tag name
         | cites 1-3 | quotes doc-id | match /re/i | prompt-shorter-than N      (≤8)
- rubric "label" must|should [on=prompt] [evidence]   (≤6; needs coach)
- hint "…" (1–5 with coach, general first)   - reference "…" (≤2000)   - document id "…" (≤4000)
- run temperature=[1.0]   - example T=1.0 "…"   - success "…"
:::
```
Rules: every prompt needs a check or expect; coach needs ≥1 rubric + ≥1 hint; regex allowlist grammar (no * + {n});
rubrics judged only when the reply is live and all checks/expects hold. `:::ask{coach}` does NOT exist — where D's
plan says "convert quiz to coached explain-it-back", write a coached `:::prompt` instead (the learner prompts Claude
to produce/do the thing that shows the idea), or keep a real choice question if a prompt would be contrived.
A lesson that teaches prompt injection by example: use expect lines without `coach` (the injection screen trips).

Per exercise: a clear goal; at least one deterministic check/expect so a fooled judge alone can't pass; rubric
criteria that test the lesson's one idea; hints that are Socratic and never give the answer; a strong reference
prompt; honest example replies for the offline path (label as examples; never fake live output).
Re-check every version-dependent fact you touch (model names, prices, API params) against current official docs
(Context7, the claude-api skill, or Firecrawl per memory) and date it in the lesson. Keep each lesson 5–8 minutes.

Verify: `pnpm content validate content/courses/<slug>` clean for your courses; add 1–2 cases per converted course to
apps/web/scripts/coach-eval/cases.ts and run `pnpm --filter @bits/web coach:eval` against your cases using
`--vars /home/ryan/code/bits/apps/web/.dev.vars` (live calls; keep it to ≤3 repeats; report agreement and cost);
walk at least two converted lessons in a browser (Chrome own tab, or Playwright) at 360 and 1440 in both themes,
with a local key so runs are live; full `pnpm test`, typecheck, doctor green.
Report: per course, blocks converted/kept/removed, facts re-checked (with source + date), eval numbers, anything
that felt contrived and was kept as a choice question, and engine gaps you hit (don't change engine code — note it).
