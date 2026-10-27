# 032. CI deploys: production on master, a Workers Preview per pull request

Status: Accepted (2026-10-27). Milestone 1 ("deploy a preview per branch in
CI"). Builds on 006, 008, 020, 026. Changes 020's `preview_urls: false`.

## Context

Deploys were manual: `pnpm db:migrate:remote`, then `pnpm deploy`, from the
owner's machine. CI (`.github/workflows/ci.yml`) only checked: typecheck,
test, build. The handoff's milestone 1 asks for a preview per branch in CI.

Previews are the hard part. Decision 020 turned `preview_urls` off because
a preview URL was a second full host on the production D1, R2, email and
secrets. Cloudflare has since shipped **Workers Previews** (`wrangler
preview`, open beta, wrangler ≥ 4.135; we have 4.152.0). The Cloudflare
skill says to use Previews for branch and PR environments, not the older
`wrangler versions upload --preview-alias` flow, which runs a version with
the production bindings. The facts that shape this decision, from the
Previews docs (checked 2026-10-27 through Context7 and `wrangler --help`):

- A Preview inherits **none** of the production bindings or vars. They are
  declared in a `previews` block in `wrangler.jsonc`, and anything not
  listed doesn't exist in a Preview.
- D1, R2, KV and the rest are isolated only by binding a Preview to a
  different resource. Previews that share a `database_id` share rows.
- Routes, custom domains and Cron Triggers stay on production. A Preview
  answers only on its Preview URL. On workers.dev that's
  `<name>-<worker>.<subdomain>.workers.dev`, and it carries
  `X-Robots-Tag: noindex`.
- workers.dev Preview URLs need `preview_urls: true`, and the same switch
  turns on **Version URLs**, which run a production version with
  production bindings.
- A custom-domain Preview host (`<name>.previews.bits.yogan.dev`) would be
  two levels deep. Universal SSL doesn't cover that; it needs Advanced
  Certificate Manager, which costs money.
- Preview URLs are public unless Cloudflare Access protects them.
- `wrangler d1 migrations apply` reads the top-level `d1_databases`, so
  migrating a preview database needs its own config. The docs use a
  separate `wrangler.preview-migrations.jsonc`.

## Decision

### Production: master deploys itself

`ci.yml` job `deploy` runs on a push to master after `check` passes:

1. Downloads `check`'s `apps/web/build` artifact, so it ships exactly what
   was tested, then runs `pnpm install` for the lockfile's wrangler.
2. `wrangler d1 migrations apply DB --remote`, against production.
3. `wrangler deploy --message "ci <sha>" --tag <sha12>`.
4. A smoke test: `/health` (which runs a D1 query), `/`, `/courses` and
   `/login` on https://bits.yogan.dev must answer 200. It retries 5 times,
   6 s apart. On failure the job fails and prints the rollback command.
   There's no automatic rollback: a rollback doesn't undo migrations
   (Cloudflare's rollback limits), so a person decides.

- It uses GitHub Environment **`production`** (url https://bits.yogan.dev),
  so the owner can add required reviewers or a branch rule.
- Concurrency: the workflow group cancels superseded runs only on pull
  requests (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`).
  The deploy job has its own group `deploy-production` with
  `cancel-in-progress: false`. So two deploys never run at once, and an
  in-flight one is never cancelled. A newer master push waits, and only
  the newest waiting run deploys.
- Migrations run before the code, so they must be **additive**: expand,
  deploy, then contract in a later change. The old code serves traffic
  while the deploy uploads. This was already true for manual deploys.
- Wrangler runs through `pnpm exec wrangler`, the lockfile's version. The
  wrangler skill says to use the project's local Wrangler, and the deploy
  job needs `pnpm install` anyway, so `cloudflare/wrangler-action` would
  add nothing.

### Previews: a Workers Preview per same-repo pull request

`ci.yml` job `preview` runs on a pull request after `check` passes:

- **Name `pr-<n>`**, so the URL is
  `https://pr-<n>-bits.ryanyogan.workers.dev`. It runs
  `wrangler preview --name pr-<n> --ignore-base-config --json`, so
  wrangler.jsonc is the only source of preview settings and the dashboard's
  base config is ignored. The URL goes into a single PR comment, found by
  the `<!-- bits-preview -->` marker and edited on each push, and into the
  `preview` Environment's URL. A smoke test (`/health`, `/`, `/courses`)
  must pass first.
- **Separate resources, shared by every Preview**:
  - D1 `bits-preview-db` and R2 `bits-preview-content`, in the `previews`
    block. Both are free-tier resources (D1 allows 10 databases on Free,
    R2 has 10 GB free).
  - Previews never read or write production data.
  - Previews share data with each other. Cloudflare's own "shared staging
    database" pattern does the same. A database per PR would mean creating
    and dropping D1s from CI, which needs broader token permissions.
- **Migrations go only to the preview database.** `scripts/preview.ts
  migrate` reads `previews.d1_databases` and writes a throwaway config
  whose only database is the preview one. Then it runs
  `wrangler d1 migrations apply PREVIEW_DB --remote` with that config.
  - We use this rather than the committed second config file the docs
    show, so the id lives in one place and the script can refuse a config
    that names production.
  - `scripts/lib/preview-resources.ts` refuses a previews block that names
    the production database (by id or name) or the production bucket. It
    has unit tests.
  - A PR's migration lands in the shared preview database before review,
    which is the point of a preview. A bad one can be undone with D1 Time
    Travel, or by recreating `bits-preview-db`. Production is untouched.
- **Content**: `pnpm content upload --all --publish --preview` publishes the
  branch's `content/courses/` into the preview database and bucket on each
  deploy (`scripts/content.ts --preview`, the same guard). Without this, a
  Preview would show an empty catalog. Last writer wins across PRs. Each
  push adds a version. That's preview data, so it doesn't matter.
- **What a Preview gets** (`previews` block):
  - `APP_ENV=preview`, `EMAIL_FROM`, its own rate-limit namespaces
    (3001–3006, so preview traffic never spends production's), placement
    and observability.
  - No `send_email`: outside production the mailer keeps mail in memory,
    so **email sign-in doesn't work on a Preview**. Previews are for
    reviewing pages signed out.
  - No AI Gateway vars or `CF_AIG_TOKEN`: runs fall back to the lesson's
    examples, so no model spend.
  - No `CANONICAL_ORIGIN` or `LEGACY_HOSTS`: a Preview answers on its own
    host. Pages drop the canonical link (it's production-only), and
    og:image paths are relative.
  - No OAuth client secrets, so OAuth sign-in doesn't work on a Preview
    either.
  - A fresh random `SESSION_SECRET` on each deploy (`--secrets-file`, a
    mode-600 temp file that's deleted at once). Preview sessions don't
    outlive a push, and no production secret reaches a Preview.
  - Crons don't run on Previews.
- **Version URLs closed off.** `preview_urls: true` also exposes Version
  URLs like `<hash>-bits.ryanyogan.workers.dev`, which run production
  bindings. `app/canonical-host.ts`, called from `worker.ts`, now 301s any
  `*.workers.dev` host to `CANONICAL_ORIGIN` when `APP_ENV` is
  `production`, the same way `LEGACY_HOSTS` already were. So 020's concern
  (a second production host) still holds.
  - It covers workers.dev only. `pnpm preview` on localhost without a
    `.dev.vars` runs with the production vars and must keep working.
  - Previews run with `APP_ENV=preview`, so they're unaffected.
- **Who gets a preview.** Only PRs whose head repo is this repo, and not
  Dependabot. Fork PRs and Dependabot get `check` only and never see a
  secret. GitHub already withholds secrets from them, and the job
  condition makes it explicit.
- **Off until set up.** The preview `database_id` is a placeholder
  (all zeros) until the owner creates the database. Until then
  `scripts/preview.ts check` exits 3, and the job prints a notice and skips
  every step after it. PRs stay green.
- **Cleanup.** `.github/workflows/preview-cleanup.yml` runs
  `wrangler preview delete --name pr-<n> --skip-confirmation` when a PR
  closes. It shares the PR's concurrency group, so it waits for a running
  deploy. It checks out the default branch, because a closed, unmerged PR
  has no merge ref. Rows a PR wrote stay in the preview database.
- Concurrency: one group per PR (`preview-pr-<n>`, no cancelling) and none
  across PRs. A single global group would drop queued previews, because
  GitHub keeps only one pending run per group. Two PRs that migrate the
  preview database at the same instant could race. The second run fails
  and a re-run fixes it, which is acceptable at this scale.

### Secrets, environments, token

- GitHub Environments: **`production`** (deploy job) and **`preview`**
  (preview and cleanup jobs). Secrets in each: `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`. Repository-level secrets work too.
  - Environment secrets let the owner limit `production` to the master
    branch.
  - Honest limit: previews need Workers Scripts Edit on the same Worker,
    which can also deploy production. Separate tokens don't narrow that.
    The guard is that only collaborators can open same-repo PRs.
- **API token**: an account-owned token (`wrangler login` can't be scoped).
  Start from the dashboard's "Edit Cloudflare Workers" template, then
  remove KV and Pages. Scope it to this account and the `yogan.dev` zone:
  - Account · **Workers Scripts: Edit**: deploy, previews, preview
    secrets, rollback.
  - Account · **D1: Edit**: migrations on both databases, preview content.
  - Account · **Workers R2 Storage: Edit**: preview content upload through
    remote bindings.
  - Account · **Account Settings: Read**: wrangler's account lookups.
  - Zone yogan.dev · **Workers Routes: Edit**: the `bits.yogan.dev` custom
    domain is in wrangler.jsonc, and Cloudflare's table says changing
    routes or custom domains during a deploy needs it.
  - The template's User · User Details: Read and Memberships: Read can
    stay. They're harmless.
  - Not verified against the live account from here. If the first deploy
    fails on authorization (for example the `send_email` binding), add the
    permission the error names, and record it here.

### Manual fallback

Still works from a machine with `wrangler login`:
`pnpm db:migrate:remote && pnpm deploy`. Rollback:
`pnpm --filter @bits/web exec wrangler rollback`. That rolls back code only;
connected data and migrations stay.

## Consequences

- The first CI deploy after merging sets `preview_urls: true` on the
  Worker. workers.dev Preview URLs work only after that.
- `docs/decisions/020`'s `preview_urls: false` bullet is replaced by this.
- The cron, email sending and live runs can't be checked on a Preview.
  Use `pnpm preview` locally for those, as before.
- Preview URLs are public, with `noindex` on workers.dev. To restrict them,
  the owner can put Cloudflare Access on this Worker's Preview URLs
  (Workers & Pages → bits → Settings → Domains). We haven't done that: the
  app is public anyway, and previews hold no production data.
- `wrangler preview` is open beta. If its JSON shape changes, the
  `jq '.preview.urls[0]'` step fails loudly, and production is unaffected.

## Follow-up (2026-10-27): pinned actions, step-scoped secrets

After a security review: every action is pinned to a full commit SHA, with
the version in a comment (Renovate keeps digests current). The Cloudflare
token and account id are no longer job-level env; only the steps that call
Cloudflare get them (migrations, deploy, preview content upload, preview
create, preview delete). Steps before them, including third-party actions,
never see the token. The preview job still runs this branch's own code
(`pnpm install`, `scripts/preview.ts`, the content CLI) with the token, which
is why previews are limited to same-repo PRs: only collaborators can open
them.
