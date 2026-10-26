# Resolutions to spec gaps (provisional, 2026-10-26)

These answer the "inconsistencies and gaps" in README.md. Builders follow these over any single artboard.

1. **Danger colour**: `--danger: #FF7A6B` (7.86:1 on ink), tint `rgba(255,122,107,0.12)`, line `rgba(255,122,107,0.4)`. Used for validation errors, wrong code, wrong quiz answer and delete account. Provisional until design sign-off.
2. **Match the artboards where they disagree with the handoff tokens**:
   - Text on volt is `#0A0C05` (`--on-volt`).
   - Selected tabs use `#1C2030` (`--selected`).
   - Synapse is allowed wherever the artboards use it.
3. **Keycap normalised**: radius 12px, edge `0 4px 0 <edge>`, plus `inset 0 1px 0 rgba(255,255,255,.55)` on primary. Hover lifts -1px. Active presses 3px with a 1px edge, 120ms (handoff motion rule). Sizes are `sm` (min-height 44px hit area), `md` (46px) and `lg` (56px).
4. **LessonNode** takes a `size` prop: 32 in System, 30 in Course, 20 in the Lesson outline. Current/next numerals must be readable: current = `#0A0C05` on volt, next = `--muted` on `--raised`.
5. **AppBar**: sticky with blur on every page (the Catalog treatment). The lesson pages use their own compact lesson header, as drawn.
6. **Contrast**: any text under 4.5:1 is raised to the nearest passing token.
   - Line numbers in the highlighted range stay as designed; all other line numbers move to `--dim`.
   - Comments move to `--dim`.
   - The selected filter count uses `#4A5068` on `#ECEEF5`.
   - Locked badges are dimmed with a desaturated fill, not text opacity.
   - The focus ring is a 4px volt glow plus a 2px solid volt outline, so it is visible on its own.
   - `--dim` is never used as text on `#1C2030`; use `--muted` there.
7. **Touch targets**: every interactive element gets ≥44px of hit area. Where the design draws something smaller (38/34/36/40px), keep the visual size and extend the hit area with padding or a `::before` inset, so the look stays pixel-matched.
8. **Mobile (<760px)**:
   - The app nav collapses to a menu button that opens a sheet with the nav links. XP, streak and avatar stay visible.
   - The Lesson outline becomes a collapsible "Lesson outline" disclosure above the content.
   - The Auth brain panel moves below the form, and from 360px to 520px it is hidden.
   - Wide code blocks scroll horizontally inside their card, never the page.
9. **Course modules (M1–M3)**: render them from an optional `module` field in the lesson frontmatter. Provisional, logged.
10. **Prompt journal "All →"** links to `/me?tab=journal` (no new route).
11. **Mode tabs and filters** are links with `aria-current`, because state lives in the URL. Tabs are true ARIA tabs only for client-only panels (editor file tabs, Sign in / Create account if done client-side; otherwise links too).
