# 013. Profile and Authoring pages (UI build)

Status: Accepted (2026-10-26)

## Decision

- **App bar for signed-in pages.** `Layout` takes an optional `viewer`
  (`Viewer | null`). When it is passed, the bar uses the app links (Courses /
  My learning → `/me` / Write a course) and, when signed in, XpPill +
  StreakPill + AvatarButton (components §3.1b). Omitting it keeps the
  marketing links. `bleed` drops `<main>`'s padding and max-width for pages
  with full-width bands (Profile's identity band).
- **One `<main>`.** The artboards put a `<main>` inside the Profile body;
  `Layout` already owns `<main id="main">`, so the Profile column is a `<div>`
  and the side column an `<aside>`.
- **Profile.** `/me` and `/u/:handle` share `actions/profile/profile-page.tsx`.
  The full journal is `/me?tab=journal` (resolutions §10). A private or
  unknown handle is the same 404 ("This profile is private."), so handles
  can't be probed. The heatmap uses the artboard's Park–Miller generator
  (`profileActivity()`), not `@bits/ui`'s `sampleActivity()`. Badge heading
  counts the defined badges ("5 OF 9"), not the artboard's "12".
  "View certificate" links to `/courses/:course#certificate` until a
  certificate route exists (handoff open decision).
- **Authoring routes.** Added `POST /author/repo`, `POST
  /author/:course/publish` and `POST /author/:course/rollback`. They are
  stubs: publish refuses with 422 when the latest build has errors, otherwise
  both redirect 303 with `?live=N&done=…`, which the page uses to show the
  flipped pointer until `course_versions` exists. Upload posts to
  `/api/author/upload` (501 stub).
- **Publish confirm without JS.** Publish opens a native `popover` confirm
  (`popovertarget`), so it works with JS off. With errors it is a focusable
  `aria-disabled` button with "Fix n errors to publish".
- **DropZone island** (`actions/author/public/drop-zone.tsx`): a plain
  multipart form without JS; hydrated, it adds drag-and-drop with folder
  walking, upload progress (XHR) and a polite live region. On coarse pointers
  it drops `webkitdirectory` and accepts `.zip` only.
