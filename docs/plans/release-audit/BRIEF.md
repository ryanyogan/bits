# Pre-release UX/UI audit — shared brief (read fully)

Owner's goal (verbatim intent): prep bits for release. Go page by page, flow by flow, and find UI/UX that
doesn't make sense, could be streamlined, or isn't in line with how good LMSs present courses (Coursera,
Khan Academy, Frontend Masters, Scrimba, Brilliant, egghead, Execute Program). Check:
- text is easy to read in BOTH light and dark mode (contrast, size, line length, weight);
- content is clear and easy to see; we make good use of space (no cramped or vast empty areas);
- redundant UI elements (two things doing one job, repeated labels/headers/CTAs);
- the right buttons/actions show for the current state (signed out/in, not started/in progress/done,
  passed/failed, empty/full, author/admin);
- input boxes placed sensibly (owner: "some of the input boxes are a bit weirdly placed");
- responsive and highly usable at 360px (phone), 768px and 1024px (tablet), 1440px (desktop),
  1920px+ (large desktop);
- Remix 3 best practices (see AGENTS.md and apps/web/node_modules/remix/INDEX.md).
Owner also said: quizzes that are just filled in don't make sense — the learner should prompt their way
to success with help back from the agent (Claude). And: remove the little "bits / tokens / agents"
legend on the home screen (neural field labels, apps/web/app/actions/home/public/neural-field.tsx) —
barely seen, no value.

Repo: /home/ryan/code/bits. Read AGENTS.md first (it is long and binding), then the decisions relevant
to your lane in docs/decisions/. Designs: docs/design/.

## Rules for this AUDIT wave
- READ-ONLY on the repo. Do not edit, commit or branch. Your output is a report file.
- Run your own server: `cd /home/ryan/code/bits && PORT=<your port> pnpm dev:restart` in the background
  (local D1 is shared; if empty run `pnpm db:migrate:local && pnpm db:seed:local`; demo user
  demo@bits.local — in dev, sign-in codes are logged as `[mail]` in the server output).
  Kill your server when done.
- Chrome: load claude-in-chrome tools with ONE ToolSearch; call tabs_context_mcp, create YOUR OWN tab,
  never touch other tabs, close yours at the end. The window can't be resized: check breakpoints by
  injecting iframes on a same-origin page:
  `document.body.innerHTML='<iframe src="/path" style="width:360px;height:900px;border:0">'`
  and read `iframe.contentDocument.documentElement.scrollWidth` for overflow. Screenshot to look.
  Long sweeps: run async, store on window, read later (45s exec limit). Return indexes, not URLs with
  query strings (they get [BLOCKED]). Theme: POST /theme or set `<html data-theme="light|dark">` in the
  iframe doc to compare.
- Do not trigger alert/confirm dialogs (e.g. delete-account buttons).
- Hand off near 250k tokens: write what you have to the report and return.

## Report format (write to the path in your lane brief, Markdown)
For each finding: `### [P0|P1|P2] short title` then: Page/flow + breakpoint/theme, What's wrong (observed,
not guessed), Why it matters (cite LMS convention or WCAG where relevant), Proposed fix (concrete: what
to change), Files (paths, line numbers), Shared? (does the fix touch packages/ui or a file another page
uses — name it). P0 = blocks release / broken / unreadable; P1 = clearly confusing or wasteful; P2 = polish.
End with: a short "Top 5" and a list of anything you couldn't check and why. Be honest; don't pad.
Return to the lead: the report path and a 10-line summary.
