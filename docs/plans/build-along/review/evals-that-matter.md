# Steel-man review: Evals that matter (2026-11-03)

Reviewer: lane V (fork). Scope: `content/courses/evals-that-matter/`, all 8 lessons and `course.md`.

Read as a senior AI engineer, and as a newcomer on a phone. Re-checked today with Firecrawl (`maxAge: 0`):
- Anthropic, "Define success criteria and build evaluations";
- Hamel Husain and Shreya Shankar, "AI Evals FAQ" (2026-09-18): 100–200 labels per failure mode, the 10–20 / 40–45 / 40–45 split, TPR/TNR with "positive = error present". All three match lesson 5.

The lane C author checked the remaining sources the same day; see the source headers in each lesson.

**Overall:** strong. The arc is right: error analysis → code first → judge → calibrate → CI → agents → checkpoint. There's one idea per lesson and a single running example (the bike shop). Exercises that are arithmetic are graded by code, not a coach, which is good practice. It's honest about limits: lesson 8 says three labels are a smoke test. Toys are labelled illustrative, and there's no copied prose.

## Findings

| # | Sev | Lesson | Finding | Fix |
|---|---|---|---|---|
| 1 | must | 07 | "Next Friday", said on Monday 2 Nov, is ambiguous: it could mean the 6th or the 13th. A careful judge could name the 13th, and the example reply asserted the 6th. A learner arguing with the premise is a bad exercise. | **Fixed.** The task now says "this Friday", and the header notes why. |
| 2 | must | 07 | `first_bad_step` must be 1. A sound reading says step 2 (the booking) went wrong, and step 1 was only a read. A good prompt could fail the code check. | **Fixed.** The lesson text, goal and reference define "first step that went wrong" as the first step that used a wrong value. The existing hint stays. |
| 3 | should | 04 | The lesson teaches "reason before you decide", but the reference prompt said "think it through, then reply with only JSON", with the verdict first. Without extended thinking, that leaves no room to reason. Anthropic's current wording is "use a grader with thinking on". | **Fixed.** The rule is now "a reason, before the verdict". The engineer text cites thinking, and for this sandbox (no thinking) puts the critique field first. The reference, placeholder, examples and hint are reordered. The JSON checks are order-agnostic, so nothing else changes. |
| 4 | should | 04 | "Pass or fail, never 1 to 10" was presented as settled, but Anthropic's page allows a 1–5 scale. | **Fixed.** The engineer text says Anthropic allows 1–5 and Husain argues binary, and that the course follows Husain, with the reason. |
| 5 | should | 05, 08 | Same ordering issue as #3: the verdicts came before `notes`. | **Fixed.** Notes come first in the placeholder, reference and examples. The lesson 8 recap says "with a reason first". |
| 6 | should | 02 | `expect match /closed/i` failed a valid expectation such as "Says the shop isn't open on Sundays". | **Fixed.** It now accepts `closed`, `not open`, `isn't open` and `doesn't open`; the regex stays inside the allowlist grammar. |
| 7 | nit | 03 | The sample `hasIntent` threw on prose: `JSON.parse` would crash the run instead of failing the case. `underWords` counted a leading space as a word. | **Fixed.** `hasIntent` checks `isJson` first, `underWords` trims, and one sentence says why. |
| 8 | nit | 03, 06 | Freshness warnings: code samples with no `verified:`. | **Left.** Lesson 6 imports placeholder modules (`./cases`, `./bot`), so it can't be run verbatim. Decision 073 owns the follow-up. |
| 9 | nit | 01 | The Spanish example replies "15 libras" for a UK shop. That's plausible, since a UK shop quotes pounds in Spanish. | **Left.** |
| 10 | note | all | The coach eval wasn't run live for this course, so judge agreement on these rubrics isn't measured. Every `evidence` rubric quotes the reply, not pasted material, so none needs `grounded`, and the build agrees. | **Left for the lead:** run `pnpm --filter @bits/web coach:eval` before publishing. |

## Checked and fine

- **Running time:** minutes and word counts fit 6–8 minutes per lesson.
- **Toys:** lesson 1 compare and the lesson 5 and 7 steps all carry `illustrative`.
- **Rabbit holes:** at most 3, all https, all free (lesson 8 swapped the paid cohort for Husain's free guide).
- **pass^k arithmetic:** 0.9³ ≈ 73%; pass@3 = 1 − 0.1³ = 99.9%.
- **Lesson 7 dates:** 2026-11-02 is a Monday, and 11-05 is a Thursday.
- **Injection screening (decision 064):** the lessons tell learners to say "the judge" or "a reviewer", never "the grader", and the references follow that.
- **Coach rubrics:** a lazy prompt (the draft) fails on JSON or format checks before the coach runs. The reference passes every rubric.
