# 005. The name is "bits"

Status: Accepted (2026-10-26)

## Context

The handoff and the design canvas use the working name "Latent", and call it
a placeholder "kept in one config constant".

## Decision

The product is called **bits** (lowercase in UI copy). The name lives in
`apps/web/app/config.ts` (`APP_NAME`, `APP_TAGLINE`, `pageTitle()`), and UI
components take it as a prop (e.g. `AppBar brand`). Package scope is
`@bits/*`, the Worker is `bits` and the database is `bits-db`.

## Consequences

Where the design says "Latent", render `APP_NAME`. Renaming again changes
`config.ts`, plus the infrastructure names, which are not user-visible.
