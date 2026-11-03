// Reading a rubric label (decision 064 §3.7): pure, so the content build
// can warn about what the judge will do with a line, and the judge can tag it.

/**
 * A rubric line about grounding: the answer comes "from the rota", is "taken
 * from the email", "based on the document". The judge must quote that
 * material from the prompt, and the server checks the quote is there.
 *
 * Authors say so with `grounded` (or `grounded=false`), and the flag decides.
 * Without it, this heuristic is the default: a grounding phrase, then (at
 * most one word on) a noun for material someone pastes into a prompt, not
 * inside a "not …" clause. "Keeps the id from the line", "a reminder from the
 * clinic" and "not reworded lines from the passage" aren't grounding (content
 * lane eval, 2026-11-02: the judge failed correct replies hunting for a
 * source). The build warns whenever the heuristic fires, so the author
 * confirms it with the flag.
 */
const SOURCES = [
  'rota', 'schedule', 'timetable', 'calendar', 'e-?mails?', 'messages?', 'thread', 'chat', 'conversation', 'turns',
  'history', 'documents?', 'docs?', 'passages?', 'excerpts?', 'snippets?', 'text', 'notes', 'policy', 'policies',
  'handbook', 'manual', 'faq', 'articles?', 'pages?', 'files?', 'records?', 'reports?', 'reviews?', 'tickets?',
  'transcript', 'context', 'material', 'data', 'tables?', 'list', 'menu', 'catalogu?e?', 'spec', 'sources?',
  'sheets?', 'logs?', 'bookings?', 'orders?', 'invoices?', 'forecast', 'tool results?', 'results?',
  'knowledge base', 'prompt',
].join('|')
const GROUNDING = new RegExp(
  String.raw`\b(?:from|according to|based on|grounded in|drawn from|using only|only from|taken from|quoted from|copied from) (?:the|this|that|your|its|their|our|a|an|those|these) (?:[\w-]+ )?(?:${SOURCES})\b`,
  'gi',
)
/** A negation earlier in the same clause: "not reworded lines from the passage". */
const NEGATED = /\b(?:not|no|never|rather than|instead of)\b|n['’]t\b/i

/** The label heuristic alone (the build warns when it fires without an explicit flag). */
export function looksGrounded(label: string): boolean {
  for (let match of label.matchAll(GROUNDING)) {
    let clause = label.slice(0, match.index).split(/[,;:()—–]/).pop() ?? ''
    if (!NEGATED.test(clause)) return true
  }
  return false
}


/**
 * An `evidence` line about something absent ("adds no hours", "invents
 * none", "leaves out the email", "without promising one"): the judge must
 * quote the reply, and it can't quote what isn't there, so such a line is
 * never met. The build warns. A clause the reply says out loud ("Says it
 * doesn't know", "Says the passages don't cover Canada") is quotable, so a
 * speech verb earlier in the clause skips it.
 */
const ABSENT_VERBS = String.raw`(?:add|includ|invent|us|mention|mak\w* up|promis|giv|ask|repeat|contain|guess|stat|list|nam|quot)\w*`
const ABSENCE = new RegExp(
  [
    String.raw`\b(?:doesn['’]t|does not|don['’]t|do not|never|without|no longer) ${ABSENT_VERBS}`,
    String.raw`\b(?:leaves?|left) out\b`,
    String.raw`\b(?:omits?|omitted|omitting|avoids?|avoiding)\b`,
    String.raw`\bfree of\b`,
    String.raw`\b(?:adds?|invents?|includes?|contains?|uses?|has|have|makes?|gives?|mentions?|asks?) (?:no|none|nothing)\b`,
    String.raw`\bnothing (?:is |was |gets )?(?:added|invented|made up|guessed)\b`,
    String.raw`^(?:no|not|nothing|none)\b`,
  ].join('|'),
  'gi',
)
const SPOKEN = /\b(?:says?|saying|states?|tells?|admits?|explains?|replies|flags?|warns?)\b/i

export function aboutAbsence(label: string): boolean {
  for (let match of label.matchAll(ABSENCE)) {
    let clause = label.slice(0, match.index).split(/[,;:()—–]/).pop() ?? ''
    if (!SPOKEN.test(clause)) return true
  }
  return false
}
