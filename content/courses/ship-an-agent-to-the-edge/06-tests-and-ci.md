---
# sources (checked 2026-11-03):
# - Cloudflare Workers, CI/CD with external providers (wrangler-action, an API token and the account id
#   as repository secrets)
#   https://developers.cloudflare.com/workers/ci-cd/external-cicd/
# - cloudflare/wrangler-action v4.1.3 (latest release on 2026-11-03), README and src/wranglerAction.ts:
#   when `<pm> exec wrangler --version` equals wranglerVersion it uses that install instead of
#   installing another
#   https://github.com/cloudflare/wrangler-action
# - Cloudflare Workers, Wrangler configuration, `secrets.required` ("wrangler deploy ... validate that all
#   secrets in secrets.required are configured on the Worker before the operation succeeds")
#   https://developers.cloudflare.com/workers/wrangler/configuration/
# - Klippy f-05 → f-06, recorded output docs/outputs/f-06.txt, and the CI runs in f-07.txt (2026-11-03):
#   run 41768008367 on main, deploy job green with every step skipped (no secrets); run 41768008197 on
#   the tag, deploy not run. Not recorded: a real deploy (no CLOUDFLARE_* secrets on the repo).
title: "Tests and CI"
order: 6
minutes: 20
xp: 60
module: Ship it
device: desk
tag: f-05
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
---

Klippy's repo has run a `check` job on every push since course A: a frozen
install, typecheck, the tests (agent tests run in the Workers runtime, with
the model stubbed and no network), and a dry-run build of each Worker. In
this lesson CI also **deploys**: on `main`, once `check` passes,
migrations first, then the agent, then the web app.

### 1. When it deploys

The new job sits under `check` in the same workflow:

:::code{file=".github/workflows/ci.yml" lang="yaml" tag="f-06" highlight="2-3" label=".github/workflows/ci.yml"}
  deploy:
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    # One deploy at a time, and never cancel one halfway (a half-applied migration is worse than a late deploy).
    concurrency:
      group: deploy
      cancel-in-progress: false
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - name: No Cloudflare secrets yet, so no deploy
        if: env.CLOUDFLARE_API_TOKEN == ''
        run: echo "::notice::Deploy skipped. Add the CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets to deploy main."
:::

Each line is a rule:

- `needs: check`: never deploy code that failed typecheck, tests or a
  build.
- `if:` pushes to `main` only. Tags and pull requests never deploy.
- `concurrency` with `cancel-in-progress: false`: one deploy at a time, and
  never cut one off halfway. A half-applied migration is worse than a late
  deploy.
- **The secret gate.** GitHub doesn't let an `if:` read `secrets` directly,
  but it can read the job's `env`. Every step checks
  `env.CLOUDFLARE_API_TOKEN != ''`, and the first prints a notice when it's
  empty. So until you add the secrets, the job is green and does nothing,
  and so is every fork and fresh clone.

### 2. In what order

Three steps deploy, in a fixed order:

:::code{file=".github/workflows/ci.yml" lang="yaml" tag="f-06" highlight="1-11" label=".github/workflows/ci.yml"}
      # Order matters. 1) The database first: migrations only add, so the code that's live now keeps working.
      - name: Apply D1 migrations
        if: env.CLOUDFLARE_API_TOKEN != ''
        uses: cloudflare/wrangler-action@v4.1.3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4.157.0" # the version in the lockfile, so the action uses it instead of installing another
          packageManager: pnpm
          workingDirectory: apps/agent
          command: d1 migrations apply DB --remote
...
      # 2) The agent, before the web app that calls it through the service binding.
      - name: Deploy the agent
...
          workingDirectory: apps/agent
          command: deploy
      # 3) The web app.
      - name: Deploy the web app
...
          workingDirectory: apps/web
          command: deploy
:::

1. **Migrations first.** The one D1 database both Workers share gets new
   tables before new code needs them. That only works if migrations only
   **add**, so the code that's live right now keeps working while the new
   code rolls out. Keep them additive: never drop or rename a column that
   live code reads in the same deploy.
2. **Then the agent**, because the web app calls it.
3. **Then the web app.** Its build step bundles the islands first.

`wranglerVersion: "4.157.0"` is the version in the lockfile. When the
installed Wrangler matches it, the action uses that one instead of
installing another, so CI deploys with exactly the Wrangler your tests
used. Copy [`ci.yml`](https://github.com/ryanyogan/klippy/blob/f-06/.github/workflows/ci.yml).

### 3. Secrets: the Workers' first

There are two kinds of secret, and the order you add them matters.

**The Workers' secrets go in first, by hand, once.** Both `wrangler.jsonc`
files list theirs under `secrets.required`, and `wrangler deploy` refuses
to deploy a Worker that's missing one. So put them before CI ever deploys:

```sh
cd apps/agent
pnpm exec wrangler secret put KLIPPY_TOKEN      # openssl rand -hex 32
cd ../web
pnpm exec wrangler secret put KLIPPY_TOKEN      # the same value as the agent's
pnpm exec wrangler secret put SESSION_SECRET    # openssl rand -base64 32
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

CI doesn't push these. The action can, from GitHub secrets, but then each
lives in two places.

**Then the repository secrets, which switch the deploy on.** In GitHub:
Settings → Secrets and variables → Actions. Add `CLOUDFLARE_ACCOUNT_ID`,
and `CLOUDFLARE_API_TOKEN`: an account-owned API token with Workers Scripts
Edit and D1 Edit (plus Workers Routes once you add a custom domain in the
next lesson), not your user's global key. The next push to `main` deploys.
Add these first and that push fails on the missing Worker secrets.

### 4. What we saw

We haven't added the Cloudflare secrets to Klippy's repo, so there's no
real deploy to show. What CI recorded is the gate working: on `main`, the
`deploy` job ran green, printed "No Cloudflare secrets yet, so no deploy"
and skipped every other step. On the `f-06` tag, `deploy` didn't run at
all.

:::quiz{id="deploy-order" xp=20}
Why does the deploy job apply D1 migrations before it deploys either Worker?

- [x] So the tables exist before new code reads them, while the live code keeps working
  Right. That holds only if migrations add and never take away.
- [ ] Because wrangler deploy fails when migrations are pending
  Not quite. It deploys anyway, and the new code meets old tables.
- [ ] To make deploys faster
  Not quite. It's about order, not speed.
:::

Your code matches tag `f-06`
([changes from f-05](https://github.com/ryanyogan/klippy/compare/f-05...f-06)).

:::rabbithole
- read "External CI/CD" by="Cloudflare" url="https://developers.cloudflare.com/workers/ci-cd/external-cicd/"
- read "wrangler-action" by="Cloudflare" url="https://github.com/cloudflare/wrangler-action"
:::
