# 029. Lesson video in R2, drafts and the watch position

Status: Accepted (2026-10-27). Supersedes the video parts of 014 (the
simulated player) and 018 ("videos found in the folder show as ready").
Amended 2026-10-29 by 055: there is no Watch mode; the player sits at the
top of the lesson.

## Context

Milestone 5 is done when two things hold. Switching modes keeps the draft
and the video position. A lesson whose video isn't ready publishes as
text-only. The handoff recommends Cloudflare Stream and keeps R2-only as a
fallback. The budget is about $200 in total.

Research on 2026-10-27 compared the two. A sub-agent read the Cloudflare
docs through Context7's index of developers.cloudflare.com; live fetching
was blocked in that session, so re-check prices before relying on them.

| | Stream | R2 only |
|---|---|---|
| Storage | $5/month per 1,000 minutes, prepaid | $0.015/GB-month; 10 GB free |
| Delivery | $1 per 1,000 minutes watched | Egress free; Class B reads $0.36/M (10M free) |
| 20 lessons × 7 min, 1,000 min watched | about $6/month | about $0 |
| … at 10,000 min watched | about $15/month | about $0, plus Worker requests |
| Adaptive bitrate, transcoding | yes (HLS/DASH) | no: one MP4, encoded by the author |
| Generated captions | yes | no: we ship our own `.vtt` |

Sources: <https://developers.cloudflare.com/stream/pricing/> and
<https://developers.cloudflare.com/r2/pricing/>.

Stream's direct creator uploads, signed webhooks (`Webhook-Signature`,
HMAC-SHA256 of `time.body`) and `allowedOrigins` would all have worked.
Media Transformations can read from R2, but it outputs MP4 clips of 60
seconds or less from inputs of 100 MB or less, with no HLS, so it can't
serve whole lessons.

**The owner chose R2-only on 2026-10-27 to keep costs down.** Stream is
not used and no Stream resources exist. If adaptive streaming is ever
needed, the `videos` table and the player's `source` prop are the seams to
change.

## Decision

### Video

- **Storage.** MP4s live in the existing `CONTENT` bucket (`bits-content`)
  under `videos/<uuid>.mp4`. There is no new bucket.
  - The bucket stays private. It also holds unpublished course builds, so
    it must never get a public custom domain or r2.dev access.
  - Reusing it means no new resource, no new binding, and a deploy that
    can't fail on a missing bucket.
  - Keys are random per upload and never rewritten. That makes every
    object immutable without hashing a large file in the browser.
- **Upload.** The R2 binding's multipart API, through the Worker:
  - `POST /api/author/videos` (course, path, size) creates the multipart
    upload and a `videos` row with `status = uploading`. It answers with
    the id, the part size (10 MiB) and the parts already stored.
  - `PUT /api/author/videos/:id/parts/:n` sends the raw bytes of one part.
    The server checks the part's exact length, calls `uploadPart`, and
    records `{partNumber, etag}` on the row.
  - `POST /api/author/videos/:id/complete` (duration) calls `complete()`,
    checks the object's size, and marks the row `ready`.

  Why this design:
  - Parts stay far under the Workers request-body limit (100 MB on
    Free/Pro), and R2's 5 MiB minimum part size is met.
  - No S3 access keys and no bucket CORS are needed.
  - The Worker knows when the upload is complete, so there's no webhook.
    `POST /webhooks/video` is removed.

  Uploads resume. Starting again with the same course, path and size
  within 6 days returns the same upload and the parts it already has. R2
  aborts unfinished multipart uploads after 7 days by default; this
  bucket's lifecycle rules are unverified. A failed part is retried four
  times with backoff.

  Only an admin, or an author listed on the course, can upload, and the
  course must already exist. The author's browser reads the duration from
  the file. Uploads are capped at 2 GB and three hours.
- **Linking.** The build stays pure. Callers (the CLI, the test platform
  and the folder upload) first load the newest ready upload for each
  course + path (`loadVideoLinks`) and pass it as
  `buildCourse(files, { videos })`.
  - A lesson whose `video:` has a ready upload gets
    `content.video = { src, duration, chapters, cues }`. The duration comes
    from the upload, else from the frontmatter `duration`.
  - A lesson without one gets a warning ("video not uploaded yet: …
    publishes as text-only"). It has no `content.video`, so there's no
    Watch mode and no `video` format on the card.
  - Chapters past the end are still an error.
  - Captions and the transcript come from `assets/<name>.vtt`, as before.
  - Builds from before this decision carry a `video` without `src`.
    `hasVideo()` treats those as text-only.

  Linking happens at build time, so after an upload the author uploads
  the folder again. The author page says "uploaded · rebuild to link".
- **Playback.** `GET /media/videos/:id.mp4` streams from R2 through the
  Worker.
  - Ranges are parsed into an `R2Range` and answered with 206 and
    `Content-Range`, or 416. `If-None-Match` gets a 304.
  - Responses carry `Cache-Control: public, max-age=31536000, immutable`
    and `Accept-Ranges: bytes`.
  - No D1 lookup is needed: an object exists only once its upload is
    complete.
  - Going through the Worker rather than a public custom domain keeps the
    bucket private and needs no new DNS or CORS. It costs one Worker
    request and one Class B read per range request. The router's session
    middleware also reads D1 once per range request. That's acceptable at
    this scale, and a pre-router fast path in `worker.ts` could drop it
    later.
- **Upload limits** (added at merge, after a security review). A part's
  body is read with a hard cap at the part's length, so a missing or wrong
  `Content-Length` can't make the Worker buffer more than 10 MiB. Parts are
  rate-limited by `RL_UPLOADS` (120 a minute: a 1 GB video is about 100
  parts) and completion by `RL_WRITES`.
- **Hotlinking.** Three cheap guards:
  - a request with `Sec-Fetch-Site: cross-site`, or with a Referer from
    another host, gets 403;
  - every response carries `Cross-Origin-Resource-Policy: same-origin`, so
    browsers refuse to load the file on other origins;
  - a direct request (curl, an address-bar visit) is allowed. The content
    is free anyway.
- **Player.** `VideoPlayer` takes `source: { src, poster? }` and plays a
  plain `<video>` with the existing custom controls: chapter scrubber,
  speed, captions drawn from the cues, keyboard shortcuts, synced
  transcript.
  - There's no hls.js and no adaptive bitrate.
  - It renders the `<video>` only after hydration (`preload="metadata"`).
    With JS off, the poster and the full transcript render.
  - A media error shows a note pointing to the transcript and the text
    lesson.
  - Without `source` (the style guide), the simulated clock remains.
- **Terms.** Cloudflare's CDN terms for Free/Pro/Business zones restrict
  serving video "unless purchased separately as part of a Paid Service".
  Our understanding, not verified against the current text, is that R2 and
  Workers (the Developer Platform) count as such a service. The owner
  should read
  <https://www.cloudflare.com/service-specific-terms-application-services/>
  before launching video widely.

### Drafts and the watch position

- **Browser.** `@bits/ui/lib/drafts` (`readDraft`, `writeDraft`,
  `flushDrafts`). Islands take `persist: { id, key, saved?, sync? }`.
  - **Local writes.** Every write goes to localStorage at once, as
    `bits:draft:<id>` (the existing key, so old drafts survive) plus
    `bits:draft-at:<id>`. Islands re-created by client navigation or a
    mode switch read it back.
  - **Who uses it.** The PromptComposer and the Terminal prompt share
    `prompt:<exercise>`. The CodeEditor keeps what was retyped in type
    mode as `code:<file>`. The VideoPlayer keeps `video`: whole seconds,
    saved every 5 seconds while playing, and on pause, seek and leaving
    the page. The end of a video saves 0.
  - **Server sync.** Signed in, the page also passes `sync`. Writes are
    queued per lesson, debounced (1.5 seconds, or 5 seconds for the
    position), batched (8 drafts per request) and sent with `keepalive`.
    They also flush on `pagehide` and when the tab hides. Nothing blocks.
  - **Merge.** `readDraft` takes the newer of the local copy and the
    server's `saved` copy. A newer local copy is uploaded. That is the
    sign-in merge: drafts typed while signed out reach the account the
    first time the lesson opens signed in, at no extra cost.
- **Server.** `lesson_drafts (user_id, course_id, lesson_slug, key, value,
  updated_at)` in migration 0006. It's a table rather than the handoff's
  `lesson_progress.drafts` column, so a draft doesn't create a progress
  row or mark a lesson started. It's keyed by slugs like `lesson_progress`.
  - `POST /api/drafts` takes course, lesson, and `key` and `value`
    repeated. It answers 204, or 401 when signed out.
  - Only keys the lesson has are accepted (`lessonDraftKeys`), with values
    up to 4,000 characters and at most 8 per request. It's rate-limited by
    `RL_DRAFTS` (60 a minute).
  - The lesson page reads the viewer's drafts in the same D1 batch as the
    session (`loadSession({ withDrafts })`, decision 026), so a signed-in
    lesson stays at one round trip. It renders the
    saved prompt into the composer and Terminal input, and the saved
    position as the player's `initialTime`.
  - The author draft preview neither reads nor writes drafts on the server.
- Watch resumes the position. Read mode does not resume a scroll position.

## Consequences

- With no uploads (a fresh environment), every lesson is text-only. That's
  the milestone's rule. Tests seed one ready video
  (`app/test/videos.ts`) so the Temperature lesson has Watch mode. Locally,
  upload an MP4 on `/author/tokens-and-temperature`, then run
  `pnpm db:seed:local` (or drop the folder) to link it.
- Authors must encode web-friendly MP4s themselves: H.264/AAC with
  `+faststart`, for example
  `ffmpeg -i in.mov -c:v libx264 -crf 23 -preset slow -c:a aac -movflags +faststart out.mp4`.
  Everyone gets the same bitrate.
- CSP lane: no CSP change is needed today, because the policy has no
  `default-src`. If one is added, allow `media-src 'self'` and
  `connect-src 'self'` (uploads, `/api/drafts`). `blob:` is not needed,
  because there's no MSE.
- To turn video on in production:
  1. run `pnpm db:migrate:remote` (migration 0006);
  2. deploy;
  3. upload on `/author/<course>`;
  4. upload the course folder again.

  No new bucket, secret, CORS rule or paid product is needed. The new
  `RL_DRAFTS` rate-limit binding is created by the deploy.
