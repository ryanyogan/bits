# CodeLesson → `/courses/:course/:lesson?mode=terminal`

Artboard: `docs/design/artboards/CodeLesson.dc.html` (1440 × 1200, interactive). Title "Latent — The loop (terminal mode)" → **"The loop · Your first agent loop · Bits"**.

Access: public. Terminal mode is available for every lesson (handoff: three reading modes for the same content). This artboard shows a coding lesson: the terminal-style tutor on the left and a CodeEditor + OutputPanel on the right. For a lesson with no `:::code`/`:::terminal` blocks, Terminal mode is the left pane alone at `max-width:900px; margin:0 auto`.

Prototype state (line 168): `{ copied: false, type: false, q: "", log: [] }`.

## "latent" → "bits"

- `<title>` (line 5).
- Terminal title row prompt `latent` (line 54) → `bits`.

## Layout

Root `min-height:100vh; display:flex; flex-direction:column; background:#07080D; font-family:Geist`.

1. **Bar** (AppBar `terminal`, lines 32–47). Canonical: use the full lesson bar (sticky glass, SegmentedProgress, XpPill) for consistency with Read mode. Artboard content:
   - BackButton → course.
   - **"Your first agent loop · Lesson 4 of 10"** / **"The loop"**.
   - Mode tabs (`margin-left:auto`): **Read** (link), **Watch** (link), **Terminal** (`aria-current="page"`, `#1C2030`). Wrap in `<nav aria-label="Lesson format">`.
2. **Workspace** (line 49): `flex:1; display:flex; flex-wrap:wrap; gap:16px; padding:16px; box-sizing:border-box; align-items:stretch`.
   - Left: TerminalLog section (`flex:1 1 460px; min-width:0`).
   - Right: editor column `<section aria-label="Code editor" style="flex:1.35 1 580px; min-width:0; display:flex; flex-direction:column; gap:16px">` → CodeEditor (`flex:1`) + OutputPanel.

No outline sidebar in Terminal mode.

## Left — TerminalLog (lines 52–105)

Container: `border-radius:18px; background:#090A10; border:1px solid rgba(255,255,255,0.09); overflow:hidden; font:14px/1.7 Geist Mono`; focus-within border `rgba(198,255,61,0.55)`.

- Title row: **`bits`** (volt) · **`~/first-agent-loop`** · right **"lesson 4/10 · 18% →"**.
- Log (`padding:20px 20px 8px; gap:18px; color:#C6CAD6`), verbatim:

```
› why does the loop check stop_reason?
◆ tutor
  Every reply comes with a reason the model stopped talking.
  If it's "tool_use", it wants you to run a tool and hand back
  the result. Anything else means it's finished.
  ↳ highlighted agent.ts lines 12–32
› run it
$ npx tsx agent.ts "Weather in Chicago?"
  → tool_use    get_weather({ city: "Chicago" })
  ← tool_result { temp_f: 41, sky: "overcast" }
  → end_turn    "41°F and overcast in Chicago."
  ✓ 2 turns · 1 tool call · 1.8s
◆ tutor
  Two turns: one to ask for the weather, one to answer.
  Now break it on purpose. Delete [line 31] and run it again.
  Predict first — does it loop forever, or crash?
  [a] loops forever   [b] crashes   [c] works fine
```
  Colours: `›` volt + learner text `#ECEEF5`; `◆ tutor` volt; tutor body `#D5D8E3` (`white-space:pre-wrap; padding-left:18px`), `"tool_use"` ion; pointer line `#9AA0B4` with `agent.ts` `#ECEEF5`; `$` synapse; output box `margin-left:18px; padding:12px 14px; radius 10; bg #0E1018; border rgba(255,255,255,0.06); gap 2px; font-size 13px` with labels `→ tool_use   ` / `→ end_turn   ` ion and `← tool_result` volt (the labels are padded with spaces to align — keep `white-space:pre`), summary `#9AA0B4 margin-top:6px`; "line 31" chip `color:#ECEEF5; background:rgba(198,255,61,0.14); padding:0 4px; border-radius:4px`; option buttons are ToolButtons (40px, radius 9, 13px).
- Appended entries (`.rise .35s ease 6px`): `› {q}` / `◆ tutor` / `{a}`; keep last 3. Replies: if input contains "hint" → **"Look at what the API requires after a tool_use block. What's missing if line 31 is gone?"**; else **"Good guess. Now delete line 31, hit Run, and read the first line of the error out loud."** (Prototype only; real replies come from lesson content / model.)
- TerminalInput (lines 99–104): `margin:12px; padding:0 8px 0 14px; border-radius:12px; background:#0E1018; border:1px solid rgba(198,255,61,0.35)`; `›` volt; sr label **"Answer or ask the tutor"**; input placeholder **"answer, ask, or type “hint”"** (50px, 14px mono); `↵` hint 12px `#7A8098`.

Mapping from lesson blocks: plain markdown → `◆ tutor` blocks; `:::quiz` → lettered ToolButtons (`[a] …`); `:::prompt` → TerminalInput becomes the prompt input with CheckChips rendered above it as `○ label` / `✓ label` lines; model output → `→` lines in ion; `:::terminal` → `$ cmd` + output box.

## Right — CodeEditor (lines 109–148)

See components §10.14. Instance data:

- Tabs: **`TS` agent.ts** (selected), **`TS` tools.ts**, **`#` .env.example**.
- Actions: ToolButton **"⌨ Type it"** (`aria-pressed`), Copy keycap **"Copy"** / **"Copied ✓"** (1600ms) / **"Copy off"** (type mode).
- Type banner (type mode only): **"Type mode — retype the loop from memory. Copy is off."** · **"142 / 486 chars · 97% accurate"**.
- Highlight range lines 12–32 (`highlight="12-32"`), focus line 31; in type mode lines > 22 at opacity .28 and the caret after line 22.
- Status bar: **TypeScript** · **UTF-8** · **Ln 31, Col 5** · **"● lines 12–32: the loop"** (volt).

Code (verbatim, 33 lines; syntax keys `k` keyword `#B9A6FF`, `s` string `#C6FF3D`, `t` type `#3DE3FF`, `f` function `#ECEEF5`, `p` plain `#C6CAD6`, `c` comment `#7A8098`, `n` number `#3DE3FF`):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const client = new Anthropic();

type Msg = Anthropic.MessageParam;

export async function agent(task: string) {
  const messages: Msg[] = [{ role: "user", content: task }];

  // the loop: think → act → observe → repeat
  while (true) {
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1024,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return res; // the model is done talking
    }

    const results = await Promise.all(
      res.content
        .filter((b) => b.type === "tool_use")
        .map(runTool),
    );
    messages.push({ role: "user", content: results });
  }
}
```

Segment tokens per line are in the script (lines 194–228); e.g. line 1 `[["k","import"],["p"," Anthropic "],["k","from"],["s"," \"@anthropic-ai/sdk\""],["p",";"]]`. In production, highlighting happens at build time (handoff); map the highlighter's scopes to the 7 colours above.

## Right — OutputPanel (lines 150–161)

Header **"OUTPUT"** + Keycap `s` **"▶ Run"**. Body (13px/1.8 mono `#C6CAD6`):

```
$ npx tsx agent.ts "Weather in Chicago?"
turn 1 stop_reason="tool_use" → get_weather
turn 2 stop_reason="end_turn"
41°F and overcast in Chicago.
```
`$` synapse; `turn N` ion; quoted stop reasons volt; last line `#ECEEF5`.

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| Terminal panel | focus-within | border `rgba(198,255,61,0.55)` (.2s) |
| TerminalInput | Enter | appends `› q` + tutor reply (`.rise`), clears input |
| Quiz ToolButtons | hover / click | bg `rgba(255,255,255,0.08)`; click appends the learner's choice as `› [b] crashes` and the tutor's response (proposed) |
| "↳ highlighted agent.ts lines 12–32" | click (proposed) | scrolls the editor to line 12 and flashes the range |
| Type it | click | toggles type mode: banner appears (`.rise`), lines > cursor ghosted, Copy → "Copy off" disabled |
| Copy | click | clipboard write; "Copied ✓" ion for 1600ms |
| Code line | hover | bg `rgba(255,255,255,0.025)` |
| Run | click | replays OutputPanel lines (proposed 120ms/line) |
| Keycaps | active | Code CSS uses `translateY(2px)` with no edge change → use canonical 3px + `0 1px 0 {edge}` |

## Responsive

- Workspace wraps: editor column drops under the terminal below ~1072px (460 + 16 + 580 + 32 padding).
- **360px**:
  - Workspace keeps `padding:16px`, `gap:12px`.
  - Order: terminal first (the lesson), editor second. Terminal min-height: let content flow (no fixed height); TerminalInput stays at the bottom of the panel — make it `position:sticky; bottom:8px` within the page so it is always reachable.
  - Terminal font 14 → 13px; `padding-left:18px` indents stay; output box `margin-left:0`.
  - Option buttons wrap; each 44px.
  - Editor: tabs row scrolls horizontally (`overflow-x:auto`), actions wrap to their own row (right-aligned); code area scrolls horizontally (inner `min-width:560px` → keep; that's expected for code), font 13px, gutter 36px; status bar wraps (hide "UTF-8" at ≤480px).
  - Mode tabs: as Lesson (bar rows).
- Alternative for phones (recommended, not drawn): a 2-option SegmentedTabs `account` flavour at the top of the workspace — **Lesson** / **Code** — showing one pane at a time; switches are instant (island), and the "↳ highlighted lines" pointer switches to Code.

## Accessibility

- Terminal log `role="log" aria-live="polite"`; learner/tutor lines have SR prefixes ("You:", "Tutor:"). Decorative glyphs (`›`, `◆`, `$`, `→`, `←`) `aria-hidden` with text equivalents where meaningful ("tool use", "tool result").
- File tabs: proper ARIA tabs with keyboard support; tab panel labelled by the file name.
- Type mode: `aria-pressed` toggle; banner `aria-live="polite"`; Copy disabled state uses `aria-disabled` + `disabled`.
- Line numbers `aria-hidden` and `user-select:none`.
- Contrast flags: gutter `#4A5068` on `#0A0C14` 2.45:1 (decorative but readable numbers are referenced in the lesson text, e.g. "line 31") → raise to `#7A8098` (4.99:1); ghosted type-mode lines at opacity .28 ≈ 1.9–2.2:1 (intentional "ghost"; acceptable only because the same text is available with type mode off — note it); "Copy off" `#7A8098` on `#1C2030` 4.13:1 (disabled controls are exempt, but prefer `#9AA0B4`, 6.21:1).
- Touch: ToolButtons 34/40px, Run 36px, Copy 34px, mode tabs 38px → 44px on coarse pointers.
