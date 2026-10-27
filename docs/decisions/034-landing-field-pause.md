# 034. A pause control for the landing field (WCAG 2.2.2)

Status: Accepted (2026-10-27). Resolves the deferral in 031. Builds on 012,
023, 025 and 031.

## Context

The landing page's 3D field (012) moves on its own for as long as the page
is open. WCAG 2.2.2 (Pause, Stop, Hide) asks for a way to pause motion that
starts by itself, lasts more than 5 seconds and runs alongside other content.
Being decorative and `aria-hidden` doesn't exempt it. 031 deferred the
control as a design change. Under reduced motion the field kept the spec's
¼ speed (Main §NeuralField) with cursor parallax off.

## Decision

### The control

- `FieldMotionToggle` (`app/actions/home/public/field-motion-toggle.tsx`) is
  a `ToolButton` (outline) with a pause glyph and the visible text "Pause
  animation". The text is the accessible name, so the label is in the name
  (2.5.3). It is a toggle: the name stays the same and `aria-pressed="true"`
  means paused. The glyph turns into play while paused, so sighted users can
  see what a press will do. The pill has a glass background (`--ink-a60` and
  a blur) because the field moves behind it. The pressed tint is laid over
  that as an image, and forced colours fall back to ToolButton's
  Highlight pair (025).
- **Where it goes:** in the hero, under the "Scroll — the network rewires
  itself" cue. That is where the field is most visible and least covered,
  and the button is early in the tab order (after the hero's prompt and
  chips). A button on the sticky layer itself would have to sit above the
  content and cover text as the page scrolls, and the field layer is
  `aria-hidden`, so a focusable child there would fail axe. The control
  doesn't follow the reader down the page. The criterion asks for a
  mechanism, and one at the top of the page that is remembered across
  visits meets it.
- **Without JS or WebGL 2:** nothing moves (012 leaves the static dot grid).
  The button is server-rendered inside a `visibility: hidden` slot. It holds
  its space from the first paint, so showing it is no layout shift (023),
  but it can't be seen or focused. The slot becomes visible once the field
  reports itself live.

### What "paused" means

- The render loop is cancelled (`cancelAnimationFrame`): no time step,
  drift, twinkle, signals or galaxy spin, and no GPU work. That also saves
  battery and CPU. The last frame stays on the canvas.
- **Scrolling still moves the formations.** That motion is started by the
  reader and stops when they stop scrolling. While paused, each scroll
  event asks the scene for one still frame (`Field.draw()`, at most one per
  animation frame). The frame has time frozen, the morph set straight to the
  scroll target (no easing left to play out) and no parallax. So the stage
  HUD and the formation still tell the page's story, and nothing moves on
  its own. A resize clears the WebGL buffer, so it redraws one still frame
  too.
- Paused before the first frame (reduced motion or a stored choice), the
  scene draws one still frame. The loop never starts, so there is no flash
  of motion.

### Defaults and memory

- **`prefers-reduced-motion: reduce` now starts paused.** 031 kept the
  spec's ¼ speed. A slower field is still a large, full-viewport field
  moving on its own, which is the vestibular trigger the setting is about.
  Since there is now a control, the safer default is still, and the reader
  who wants motion can turn it on. Played under reduced motion, it still
  runs at ¼ speed with no cursor parallax (031).
- The choice is stored per viewer in `localStorage` (`bits:field-motion`:
  `paused` or `playing`), with every access in try/catch. A stored choice
  wins over the media query. It is read in the browser before the scene
  starts, so the first frame already respects it. With storage blocked, the
  choice lasts for the page.
- The state lives in `public/field-motion.ts`. The browser loads that module
  once for both islands: the canvas island in the sticky layer and the
  toggle in the hero. They hydrate separately and talk through the module's
  `EventTarget`.

### Hidden and off-screen

- These were already handled (012/Main §NeuralField): `visibilitychange`
  and an `IntersectionObserver` on the layer stop the loop. Pausing joins
  them as a third condition in the same `sync()`.

### Tests

- `apps/web/app/field-motion.test.e2e.ts`. The scene writes a coarse loop
  counter to the canvas (`data-frames`, every 30 loop frames; still frames
  don't count). The test checks that:
  - the counter climbs while the field plays;
  - it holds for 1.5 s after Space on the focused toggle (`aria-pressed`
    flips to `true`);
  - after a reload the field is still paused and the loop never starts
    (counter stays 0);
  - pressing again plays it;
  - under emulated reduced motion with no stored choice, it starts paused,
    and a stored "playing" wins after a reload.
- The axe suite (031) now waits for the toggle on the landing page, so the
  visible control is audited at 360 and 1440. Headless Chromium has WebGL 2
  (SwiftShader), so the field goes live in tests.

## Consequences

- `Field` gained `draw()`. Any later change to the scene's per-frame logic
  belongs in `step(dt, still)`, so loop frames and still frames stay alike.
- The `data-frames` attribute is a test hook. It costs one attribute write
  every 30 frames, and no selector reads it.
- Forced colours were reasoned from ToolButton's existing pressed handling
  (025) and the Icon's `forcedSvgPaint`. The toggle wasn't checked by hand
  in an emulated forced-colours run.
