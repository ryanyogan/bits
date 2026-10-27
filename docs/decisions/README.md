# Decision log

One file per decision: `NNN-short-title.md`, numbered in order. Each has Status,
Context, Decision and Consequences. To change a decision, add a new record
that supersedes the old one, and mark the old one `Superseded by NNN`.

| # | Decision |
|---|----------|
| 001 | [Monorepo layout](001-monorepo-layout.md) |
| 002 | [Workers asset strategy](002-workers-asset-strategy.md) |
| 003 | [remix/data-table on D1](003-data-table-on-d1.md) |
| 004 | [Dev runtime: Node + getPlatformProxy](004-dev-runtime.md) |
| 005 | [The name is "bits"](005-name-bits.md) |
| 006 | [Wrangler config: compat date, no nodejs_compat, deferred bindings](006-wrangler-config.md) |
| 007 | [Styling: tokens, cascade layers, self-hosted fonts](007-styling-conventions.md) |
| 008 | [Schema conventions and migrations](008-schema-conventions.md) |
| 009 | [Route maps and controllers](009-routes-and-controllers.md) |
| 010 | [Component library: static by default, small islands](010-component-library.md) |
| 011 | [Auth and Settings UI choices](011-auth-and-settings-ui.md) |
| 012 | [Landing field (three.js)](012-landing-field-three.md) |
| 013 | [Profile and authoring UI](013-profile-and-authoring-ui.md) |
| 014 | [Lesson pages: Read, Watch, Terminal](014-lesson-pages-ui.md) |
| 015 | [Auth: D1 sessions, email link + code, OAuth, cop](015-auth.md) |
| 016 | [Progress: D1 ledger, "complete lesson" form, session-held anonymous progress](016-progress.md) |
| 017 | [No Turnstile on email sign-in (for now)](017-no-turnstile.md) |
| 018 | [Content pipeline: markdown folders, versions in R2, a live pointer in D1](018-content-pipeline.md) |
| 019 | [Live prompts: /api/run through AI Gateway, journalled runs](019-live-prompts.md) |
| 020 | [Production hardening: client navigation, headers, caching, limits, placement](020-production-hardening.md) |
| 021 | [Lesson toys: nexttoken, training, attention, compare, rabbithole](021-lesson-toys.md) |
| 022 | [App shell: one sticky header, lesson sub-bar, sticky outline](022-app-shell.md) |
| 023 | [Reading comfort and layout stability](023-reading-and-stability.md) |
| 024 | [Pending forms and navigation feedback, app-wide](024-pending-and-navigation-feedback.md) |
| 025 | [Compact run window, phone terminal height, forced colours checked](025-compact-windows-and-forced-colors.md) |
| 026 | [Server performance: one D1 round trip per page, split Worker bundle](026-server-performance.md) |
| 027 | [A strict, nonce-based Content-Security-Policy](027-strict-csp.md) |
| 028 | [Terms and Privacy, link-preview cards, badge toast, certificates](028-small-platform-features.md) |
| 029 | [Lesson video in R2, drafts and the watch position](029-video-and-drafts.md) |
| 030 | [Passkeys and email change: step-up, owner-only links, revert window](030-passkeys-and-email-change.md) |
| 031 | [Accessibility pass: axe suite at 360 and 1440, fixes at the source](031-accessibility-pass.md) |
| 032 | [CI deploys: production on master, a Workers Preview per pull request](032-ci-deploys-and-previews.md) |
| 033 | [Cloudflare Web Analytics: a nonced beacon we load ourselves](033-web-analytics.md) |
| 034 | [A pause control for the landing field (WCAG 2.2.2)](034-landing-field-pause.md) |
| 035 | [Media skips the session; profile and author pages read in one batch](035-media-fast-path-and-batched-reads.md) |
| 036 | [CI publishes content/courses/ to production, unchanged courses skipped](036-ci-content-publish.md) |
| 039 | [A daily mail cap, one housekeeping batch, and error logs worth alerting on](039-mail-cap-housekeeping-monitoring.md) |
| 041 | [Catalog background: a rabbit hole that drops in once](041-catalog-background.md) |
| 042 | [Design-system consistency and link prefetch](042-design-system-consistency-and-prefetch.md) |
