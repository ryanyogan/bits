

# Latent — Build Handoff for Claude Code

2026-10-26 · 

## Read this first

This doc sets out what to build and the rules it has to follow. It deliberately does not pin framework or platform APIs. Remix 3 is in beta and changes quickly, and what your training data knows about Remix is mostly the React-based v1/v2 era, which does not apply.

Before writing any code, do these in order:
- 

Load the Remix 3 skills in this repo. Look in `.claude/skills/` and any other skills folder in the repo, and read every skill whose description mentions Remix, routing, components, UI, forms, sessions, middleware, data loading or testing. Use them for route definitions, data loading and mutations, forms, sessions and cookies, components and the built-in UI tooling, and tests.
- 

Load your Cloudflare skills. Use them to choose and configure every platform piece: Workers, D1, R2, KV, Durable Objects, Queues, Stream, AI Gateway, Turnstile, email sending, `wrangler` config, bindings, migrations, local dev and deploys.
- 

Avoid React-era habits. No `@remix-run/react`, React Router conventions or Next.js patterns, unless a repo skill tells you to use them.
- 

Know which wins in a conflict. On how to call an API, the skill wins. On how the product should behave, this doc wins. Either way, note the conflict in the decision log (step 5).
- 

Log every choice. Add one short file per decision under `docs/decisions/NNN-title.md`: the context, the choice, and which skill you consulted.

"Recommended" in this doc means a default to confirm against the skills. "Required" means don't change it without asking Ryan.

The design is the canvas [Latent — AI Learning Platform](https://claude.ai/code/artifact/19768b96-158f-4754-82b1-aee2d9334af1), which has 9 artboards. `System.dc.html` holds the design tokens and component states; build the design system from it, not by eyeballing screenshots. If you can't open the canvas, ask Ryan to share it or export it.

## The product

Latent (working name) is a free platform that teaches AI from "what's a token?" up to shipping a first agent. Learners move through a lesson by typing prompts and code, not by scrolling. It runs on Remix 3 beta and Cloudflare.

Required behaviour:
- 

Free with no paywall. Signing in only saves progress. Nothing is gated behind an account except syncing.
- 

Anonymous first. Lesson 1 works with no account. Progress is kept locally and merged into the account at sign-in.
- 

Text is always there, video is optional. Every lesson works as text. A lesson gets a Watch tab only when its frontmatter declares a video.
- 

Three reading modes. Read (a chat-style tutor), Watch, and Terminal (CLI-style), all for the same content. Switching modes keeps your place and your draft prompt.
- 

Type to move forward. `:::prompt` exercises carry live checks and block "lesson complete" until they pass. Code blocks have Copy and an optional retype mode that turns Copy off.
- 

Courses are markdown. A course is a folder of `.md` files with a few custom blocks, published by upload or by GitHub sync. There is no WYSIWYG course editor in v1.
- 

Visible progress. Neurons (XP), daily streaks, badges, a per-course progress ring, an activity grid and a prompt journal of everything the learner has typed.

## Architecture

Recommended: a single Worker runs the Remix 3 app and handles every page, API call and webhook. Course builds run on a Queue, and model calls go through AI Gateway, so neither blocks a page request. Treat every product named here as a default to confirm with the Cloudflare skills.

The browser uploads and plays video directly with Stream. Only the "video ready" webhook goes through the Worker.
|

Piece |

Job |

Confirm with the Cloudflare skills |
|

Worker (Remix 3 app) |

Every page, API route and webhook |

Runtime and CPU limits, bindings, static asset serving |
|

D1 |

Users, sessions, progress, XP, content index |

Migrations, batch and transaction semantics, read replication |
|

R2 |

Compiled course JSON, upload staging, fonts |

Worker-served vs public bucket, cache headers |
|

Queue (or Workflows) |

Course builds |

Retries, CPU limits for parsing and highlighting |
|

AI Gateway |

Model calls with limits, caching and a spend cap |

Rate-limit and provider configuration |
|

Stream |

Video upload, encoding, HLS, captions |

Direct uploads, webhooks, captions, pricing |
|

Turnstile |

Bot check on email sends and anonymous runs |

Invisible mode |
|

KV (optional) |

Session and catalog caching |

Only if D1 reads become the bottleneck |

## Routes

There are 16 page routes and 7 endpoints. Define them however the repo's Remix 3 routing skill prescribes. The paths, the access rules and what each screen shows are required; the file layout is not.

All pages render on the server. Interactive pieces (the 3D field, the prompt composer, the editor, the video player) load as client islands, so lesson text can be read with JavaScript off.

Pages
|

Path |

Artboard |

Access |

Notes |
|

`/` |

Main |

public |

Landing page. The 3D field is a client-only island. The hero prompt bar goes to lesson 1 with the typed text prefilled. |
|

`/courses` |

Catalog |

public |

Filters live in the URL (`?track=agents&q=rag`) so they can be shared. The Continue banner appears when there is any progress, local or synced. |
|

`/courses/:course` |

Course |

public |

Syllabus with each lesson's state, outcomes, progress ring and badge preview. |
|

`/courses/:course/:lesson` |

Lesson, CodeLesson |

public |

`?mode=read|watch|terminal`. The default is the user's last-used mode. `watch` appears only when the lesson has a video. |
|

`/login` |

Auth |

public |

Sign in and Create account tabs (`?mode=signup`), plus `?next=` to return the user afterwards. |
|

`/login/check` |

Auth (sent) |

public |

The "check your inbox" screen with 6-digit code entry. |
|

`/auth/verify` |

— |

public |

GET `?token=` handles the magic link; POST handles the code. Both start a session, merge anonymous progress, then redirect to `next`. |
|

`/auth/oauth/:provider` |

— |

public |

`github` or `google`. Redirects to the provider. |
|

`/auth/oauth/:provider/callback` |

— |

public |

Links the provider identity to an account or creates one. |
|

`/logout` |

— |

user |

POST only. |
|

`/me` |

Profile |

user |

Private dashboard with stats, activity, courses, badges and journal. |
|

`/u/:handle` |

Profile (public) |

public |

Shown only when the profile is public. No email, no journal. |
|

`/settings` |

— |

user |

Email, sign-in methods (add or remove passkeys and providers), public toggle, data export, account deletion. |
|

`/author` |

Authoring |

author |

The author's courses, folder upload and repo connection. |
|

`/author/:course` |

Authoring |

author |

Validation report for the latest build, preview link, and Publish. |
|

`/author/:course/preview/:lesson` |

Lesson |

author |

Renders a draft version with a "Draft" banner. |

Endpoints
|

Method + path |

Who calls it |

Purpose |
|

`POST /api/progress` |

lesson client |

A batched list of progress events (see Database). Idempotent on `event_id`. |
|

`POST /api/run` |

prompt composer |

Runs a learner's prompt against a model (see Running prompts). |
|

`POST /api/passkey/:step` |

auth client |

WebAuthn register and login options and verification. |
|

`POST /api/author/upload` |

Authoring |

A folder or zip upload, which starts a build. |
|

`POST /api/author/video-upload-url` |

Authoring |

Returns a one-time direct-upload URL for a lesson video. |
|

`POST /webhooks/github` |

GitHub |

A push to the tracked branch queues a build. Signature checked. |
|

`POST /webhooks/video` |

video provider |

Marks a video ready and stores its duration and playback id. |

Roles: `learner` is the default. `author` can manage the courses they own. `admin` can do everything and grant the author role.

## Database

Recommended: use D1 as the single system of record. Store compiled course content in R2; D1 indexes it rather than storing it. Before you write migrations, confirm D1, its migration workflow and its batch/transaction behaviour with the Cloudflare skills. Use whatever query layer the Remix skills or the repo already use.

Progress is keyed by `(course_id, lesson_slug)` rather than a versioned lesson id, so republishing a course never wipes anyone's progress.

Rules
- 

Progress events. The client sends `{event_id, type, course, lesson, exercise?, at}`. The types are `lesson_started`, `exercise_passed`, `lesson_completed`, `mode_changed` and `draft_saved`. The server dedupes on `event_id`.
- 

Never trust the client's XP. On `exercise_passed`, the server re-runs that exercise's checks from the compiled lesson against the submitted prompt and runs, and only then awards XP. `UNIQUE(user_id, kind, ref)` makes each award once-only. Update `users.xp_total` in the same batch.
- 

Streaks. A streak is the run of consecutive `activity_days` ending today or yesterday, using the user's `timezone`. Store the timezone at sign-up from the browser.
- 

Anonymous merge. Before sign-in, events queue in `localStorage` under an anonymous id. On sign-in the client replays the queue to `/api/progress`, and the dedupe makes the replay safe.
- 

Badges and levels. Both are defined in code or content config, not in the database: an id, a rule and a glyph. Award badges server-side when their rule first becomes true.
- 

Indexes. Add indexes on `exercise_attempts(user_id, created_at DESC)`, `xp_events(user_id)` and `courses(status, track, sort)`.

## Auth

Required: there are four ways in and no passwords. They are an email magic link (with a 6-digit code in the same email), GitHub, Google and passkeys. Recommended: build a thin auth layer of your own on top of the Remix 3 session and cookie primitives from the repo skills. Switch to a full auth library only if a repo skill points you to one that runs on Workers.

Sessions
- 

The cookie is `__Host-session`, an opaque random id with `HttpOnly`, `Secure` and `SameSite=Lax`. It lasts 30 days and renews when used.
- 

The session row lives in D1. KV is an option if the Cloudflare skills recommend it for read-heavy session lookup.
- 

Every POST checks `Origin`, in addition to any CSRF middleware the Remix skills provide.
- 

`/settings` has "sign out everywhere", which deletes all of the user's sessions.

Email link + code
- 

The user submits an email. The request is checked by Turnstile and rate-limited to 3 per email per 10 minutes and 20 per IP per hour.
- 

Create a token of 32 random bytes and a 6-digit code, and store only their SHA-256 hashes. Both expire after 15 minutes and are single-use. The code allows 5 attempts.
- 

Send one email containing both. For the sender, use Cloudflare's email sending if the skills say it is production-ready for transactional mail; otherwise pick a provider (see Open decisions).
- 

Verifying either one marks the email as verified, creates the user if needed, starts a session and merges anonymous progress.

GitHub and Google
- 

Use OAuth 2 with PKCE and `state`, through a small library that runs on Workers (for example Arctic), or whatever the skills prefer.
- 

Account linking: when the provider returns a verified email that matches an existing user, link the identity to that user. Otherwise create a new user.

Passkeys
- 

Use a WebAuthn library that runs on Workers' WebCrypto (for example SimpleWebAuthn). The relying-party id is the apex domain.
- 

Passkey sign-in is offered on the sign-in screen. Adding a passkey is offered once after first sign-in and always in `/settings`.

Sign-up extras
- 

The design asks for a display name and "what brings you here?" goals. Store the goals in `users.goals` and use them to pick the first course suggested on `/courses`.
- 

Generate the handle from the name or email and make it unique. It can be edited in settings.

Deleting an account removes the user's row, identities, passkeys, sessions, attempts and progress. Export (on the same page) returns a JSON of the progress and the prompt journal.

## Course content pipeline

Required: a course is a folder of markdown files. Building it turns the folder into versioned JSON in R2 plus index rows in D1, and publishing is a single pointer flip, so rolling back is free.

Folder layout

Frontmatter
- 

`course.md`: `title`, `slug`, `track` (`foundations|prompting|tools|agents`), `level`, `summary`, `outcomes[]`, `cover` (a pattern name and a sigil, or an svg), `badge {id, name, glyph}`, `authors[]`.
- 

Each lesson: `title`, `order`, `minutes`, `xp`, plus the optional `video` (an asset path) and `chapters[] {at, title}`.

Blocks. Plain markdown renders as a tutor message in Read mode and as tutor output in Terminal mode. Custom blocks use `remark-directive` syntax:
|

Block |

Attributes |

Body |

Renders as |
|

`:::prompt` |

`id`, `xp`, `model?`, `temperature?` |

The task text, then `- check "label" /regex/flags` lines, `- run temperature=[0, 1.0]`, and optional `- example T=0 "…"` canned outputs |

The "Your turn" composer with live checks |
|

`:::code` |

`file`, `lang`, `copy`, `type-mode`, `highlight="12-32"` |

Code |

The editor, with tabs when several `:::code` blocks sit next to each other |
|

`:::quiz` |

`id`, `xp`, `multiple?` |

A question, then `- [ ]` and `- [x]` options, each with an optional indented explanation |

A choice card |
|

`:::odds` |

`prompt`, `slider` |

`token logit` lines |

The probability bars with a temperature slider |
|

`:::tokenizer` |

`sample?` |

— |

The live tokenizer toy |
|

`:::terminal` |

`cmd` |

A scripted log |

Terminal output |

Build steps
- 

A source arrives: a folder or zip upload goes to R2 staging, or a GitHub push webhook fetches the tarball of the configured path.
- 

A job is enqueued. Recommended: a Queue consumer, or Workflows if the skills favour it for multi-step jobs with retries. Check Worker CPU limits for the build step.
- 

Parse with unified: `remark-parse`, `remark-frontmatter`, `remark-gfm` and `remark-directive`. Validate frontmatter and blocks against a schema.
- 

Compile each lesson into a JSON block list. Highlight code at build time (for example with Shiki) so the client ships no highlighter. Raw HTML in markdown is rejected.
- 

Write `courses/{slug}/v{n}/manifest.json` and `…/{lesson}.json` to R2. They are immutable and cached forever.
- 

Insert `course_versions` and `lessons` rows, and save the validation report.
- 

Publish sets `courses.current_version_id`. Rollback points it back at an older version.

Validation. These are the checks the Authoring screen shows.
- 

Errors (block publishing): bad or missing frontmatter, duplicate `order`, a `:::prompt` with no checks, a regex that doesn't compile or is flagged as catastrophic, an unknown block.
- 

Warnings: a missing video file, a lesson over 15 minutes, a `:::code` block without `lang`.

Safety. Check regexes run on the server with a length cap (prompts of 4,000 characters at most) and a safe-regex check at build time. Authors are trusted but not admins: their markdown can't inject script.

## Video storage and playback

Recommended: use Cloudflare Stream for lesson videos. It handles encoding, adaptive streaming, thumbnails and captions. Keep R2 for everything else. Use the Cloudflare skills to confirm Stream's current upload, webhook and caption features, and its pricing, against the R2-only fallback below before you commit.

Upload
- 

An author's build finds `video: assets/06-temperature.mp4`. It doesn't proxy the bytes; instead the Authoring UI asks `POST /api/author/video-upload-url` for a one-time direct-upload URL. Use resumable (tus) uploads for anything over 200 MB.
- 

The browser uploads straight to Stream. A `videos` row is created with `status = uploading`.
- 

`POST /webhooks/video` (signature verified) sets `status = ready` and stores `provider_uid` and `duration_s`.
- 

The next build links the lesson to the ready video. Until it's ready the validator shows a warning, and the lesson publishes as text-only.

Playback
- 

The design draws its own controls: a chaptered scrubber, play and pause, speed, CC, and a synced transcript. Play the HLS manifest with `hls.js`, which falls back to native HLS on Safari, rather than an embedded iframe player.
- 

Chapters come from the lesson frontmatter. The transcript comes from the caption track: a `.vtt` in `assets/` with the same base name, or the provider's generated captions if the skills confirm that feature.
- 

Videos are public because the platform is free. Restrict allowed origins to the production and preview domains so they can't be hotlinked.
- 

Save the watch position in `lesson_progress.drafts` (local storage for anonymous users) so both Watch and Read resume where the learner left off.

R2-only fallback. Store the MP4 in R2 behind a custom domain and play it with a plain `<video>` element. It costs less, but there's no adaptive bitrate and no generated captions. Use it only if Stream is ruled out.

## Running prompts

Recommended: learners' prompts run against a real model through `POST /api/run`, which streams tokens back. That route goes through Cloudflare AI Gateway for rate limits, caching, logs and a spend cap. Every exercise also ships canned outputs, so the lesson still works when the model can't be reached.

Request flow
- 

The client sends `{course, lesson, exercise_id, prompt, temperature}`.
- 

The server loads the exercise from the compiled lesson. The lesson, not the client, sets the model, `max_tokens` (300 at most), the allowed temperatures and an optional system prompt.
- 

Call the model through AI Gateway, with the provider key held as a Worker secret. The default model is a small, fast one (for example `claude-haiku-5-5`), and an exercise can override it.
- 

Stream the response to the composer so tokens appear live. Return the token counts when it finishes.
- 

Write an `exercise_attempts` row for signed-in users. For anonymous users, keep the attempt locally and replay it at merge.

Limits. These are starting values; tune them from Gateway analytics.
|

Who |

Runs |

Other limits |
|

Anonymous |

10 per hour per IP + anonymous id |

Turnstile once per session |
|

Signed in |

60 per hour, 300 per day |

— |
|

Every request |

— |

Prompt 4,000 characters at most, temperature clamped to 0–1 |

Implement the limits with whatever the Cloudflare skills recommend, such as the rate-limiting binding or a Durable Object per key. When a limit is hit, show the exercise's canned `- example` output labelled "example output" so the learner can keep going.

Checks
- 

The `- check` regexes run in the browser as the learner types, which drives the live ticks.
- 

`- run` requirements count runs, at the required temperatures, logged for that exercise.
- 

On `exercise_passed` the server re-runs every check before awarding XP (see Database).

Temperature range. The lesson design's slider goes to 1.5, but it only drives the `:::odds` toy, which works on fixed logits in the browser. Real runs are clamped to the provider's accepted range.

## Frontend

Required: match the canvas closely. Build the components with Remix 3's built-in component and UI tooling, following the repo skills, not a third-party component kit. The design system is dark-only in v1.

Tokens. These come from `System.dc.html`. Put them in one CSS custom-properties file.
|

Token |

Value |

Use |
|

`--ink` |

`#07080D` |

Page background |
|

`--surface` / `--raised` |

`#0E1018` / `#151826` |

Cards and inputs / dark keycaps and selected tabs |
|

`--text` / `--muted` / `--dim` |

`#ECEEF5` / `#9AA0B4` / `#7A8098` |

`--dim` is the lightest grey allowed for text |
|

`--volt` / `--volt-edge` |

`#C6FF3D` / `#6E9116` |

The primary action, "your turn" and success. Text on volt is `--ink`. |
|

`--ion` |

`#3DE3FF` |

Model output, in-progress states and video |
|

`--synapse` |

`#9D85FF` |

Only the 3D field and the Tools track |
|

Fonts |

Unbounded 500/700/800, Geist 400–600, Geist Mono 400/500 |

Self-host subsets rather than loading Google Fonts at runtime |
|

Radii |

8, 11, 14, 18, 22 px and pill |

— |
|

Motion |

Keycap press 120 ms with 3 px travel; reveals 400 ms with an 8 px rise |

— |

Components to build: `AppBar`, `Keycap` (primary, dark, ghost), `SegmentedTabs`, `Chip`, `CourseCard` (CSS pattern cover + outlined sigil), `ProgressRing`, `LessonNode` (done, current, next), `TutorMessage`, `LearnerBubble`, `PromptComposer`, `CheckChip`, `TokenPill`, `OddsBars`, `CodeEditor` (tabs, line highlight, copy, type mode), `TerminalLog`, `VideoPlayer`, `RewardToast`, `HexBadge`, `ActivityGrid`.

The landing page's 3D field. The working prototype is in `Main.dc.html` on the canvas; port its logic rather than reinventing it.
- 

Use `three` as a dependency, dynamically imported inside a client-only island after the hero has painted.
- 

About 3,400 points sit in a single `ShaderMaterial`. Four position attributes (network, token ribbon, torus-knot agent loop, galaxy) are blended in the vertex shader by a `uMorph` uniform, staggered per point, with additive blending. The network's edges and the signals travelling along them fade out as the first morph starts.
- 

The canvas is a `position: sticky` layer (`top: 0; height: 100vh`, with a negative bottom margin) behind every section. Map page scroll progress to `uMorph` 0–3 with holds at each formation, and ease it by 0.055 per frame. The palette shifts per stage, and the cursor adds a small parallax.
- 

A right-side label shows the current stage (01 Neurons, 02 Tokens, 03 Agents, 04 You). Re-render it only when the stage changes, never every frame.
- 

Performance: cap the pixel ratio at 2 and drop to about 1,500 points under 760 px wide. Pause when the tab is hidden or the canvas is off-screen. With `prefers-reduced-motion`, run the field at 1/4 speed and hide the blinking caret.
- 

If WebGL fails, show the static dot grid alone, with no error.

Accessibility
- 

Use real `<button>`, `<a>`, `<input>` and `<label>` elements.
- 

Touch targets are at least 44 px, and text contrast is at least 4.5:1.
- 

The focus ring is a 4 px volt glow.
- 

In the composer, Enter runs and Shift+Enter adds a new line.
- 

The 3D canvas is `aria-hidden`.
- 

Every page works at 360 px wide.

Budgets
- 

Landing page LCP under 2.0 s on a mid-range phone over 4G.
- 

No hydration of lesson text: lesson pages ship only the islands they use.

## Build order

Ship the work in six milestones, each deployable on its own. Finish one with its acceptance checks passing and a preview URL before starting the next. Write tests in the style the repo skills prescribe, and cover each milestone's main flow with an end-to-end test.
- 

Foundations and landing
- 

Load the skills and write the first decision records. Set up `wrangler` config with the D1, R2, Queue and KV bindings, run migrations locally and remotely, and deploy a preview per branch in CI.
- 

Build the tokens, fonts, `AppBar`, `Keycap` and the full landing page, 3D field included.
- 

Done when `/` loads on a preview URL within the budgets, and the field morphs through all four stages on scroll.
- 

Content pipeline and read-only learning
- 

Build the markdown parser and validator, the build job, the R2 layout, `/courses`, `/courses/:course`, and lesson Read mode rendering every block. Prompts use canned outputs only, with checks in the browser.
- 

Use the Temperature lesson from the canvas as the first fixture course.
- 

Done when a CLI script uploads the fixture folder, publishing makes it visible, and a broken fixture shows its errors.
- 

Auth and progress
- 

Build email link and code sign-in, GitHub, Google, sessions, the anonymous merge, `/api/progress`, XP, streaks, badges and `/me`.
- 

Done when a lesson finished while signed out is still there after sign-in, and a forged `exercise_passed` earns no XP.
- 

Live prompts
- 

Build `/api/run` through AI Gateway with streaming, the limits, the canned fallback and the prompt journal.
- 

Done when the 11th anonymous run within an hour falls back to the example output, and the Gateway shows the spend cap set.
- 

Code, Terminal and Video
- 

Build `CodeEditor` (copy and type mode), Terminal mode, the video upload flow, the webhook, and the player with chapters and transcript.
- 

Done when switching modes keeps the draft and the video position, and a lesson whose video isn't ready publishes as text-only.
- 

Authoring and polish
- 

Build the `/author` screens, the GitHub App sync and preview builds, passkeys, public profiles, and settings with export and delete.
- 

Finish with an accessibility pass and a performance pass.
- 

Done when a push to the repo rebuilds the course and shows its validation report, and every page passes an automated accessibility check at 360 px and at 1440 px.

## Open decisions for Ryan

Ryan needs to make eight calls. Until he does, the agent should build with the default and log it as provisional.
|

Decision |

Default until decided |

Needed by |
|

Product name and domain |

"latent" as a placeholder, kept in one config constant |

Milestone 1 |
|

Model provider and monthly spend cap for `/api/run` |

Anthropic through AI Gateway, a small fast model, cap [AMOUNT] |

Milestone 4 |
|

Transactional email sender |

Cloudflare email sending if the skills say it's ready; otherwise a hosted provider |

Milestone 3 |
|

Video: Stream or R2-only |

Stream |

Milestone 5 |
|

Who can author in v1 |

Ryan plus people an admin invites |

Milestone 6 |
|

Profiles public by default? |

Public, but the prompt journal and email are never shown |

Milestone 3 |
|

Analytics |

Cloudflare Web Analytics (no cookies) |

Milestone 1 |
|

Certificates (shown on the Profile design) |

A simple shareable page per finished course, no PDF |

Milestone 6 |