# 009. Route maps and controllers

Status: Accepted (2026-10-26)

## Decision

- `apps/web/app/routes.ts` is the URL contract. Each page area is a nested
  `route()` map with its own controller at
  `app/actions/<key>/controller.tsx` (e.g. `routes.courses.lesson` →
  `actions/courses/lesson/controller.tsx`). `app/router.ts` maps each one.
  Links and form actions always use `routes.x.href(params, { searchParams })`.
- Pages render through `app/ui/layout.tsx` (`Layout` → `@bits/ui` `Document`
  + `AppBar`). Placeholders use `app/ui/placeholder-page.tsx`.
- Forms are native `<form method="post">`, parsed with
  `remix/data-schema/form-data` schemas that live next to the controller
  (`schema.ts`). Invalid input re-renders with status 422 and the issues.
  Success redirects with 303.
- `/api/*` and `/webhooks/*` are JSON endpoints. They are 501 stubs for now.
- Spec deviation: the handoff's `/auth/verify` is one URL with GET (magic
  link) and POST (code). That is modeled as `form('/auth/verify')`
  (`index` + `action`), which is the Remix idiom for one URL with two
  methods.
