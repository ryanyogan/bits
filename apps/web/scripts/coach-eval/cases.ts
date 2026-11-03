// Labelled attempts for the coach eval (decision 064). Each exercise is real
// `:::prompt` source, compiled by the content build, so the eval grades the
// same blocks a lesson would. Each case is a prompt, the reply Claude gave,
// and whether a careful human grader says it should pass.
//
// The replies are written by us, as Claude plausibly answers; they're fixed
// so the eval measures the judge, not Claude's sampling.

export interface EvalCase {
  name: string
  prompt: string
  reply: string
  /** The human label: should this attempt pass? */
  pass: boolean
}

export interface EvalExercise {
  /** What kind of exercise: one per rubric style. */
  kind: string
  source: string
  cases: EvalCase[]
}

// The rota check asks for a rota's shape: a Tuesday entry and one other day,
// each followed by a capitalised name ("Tue: Priya", "Mon Jo"). Two checks,
// since the grammar has no repetition. A lesson's "the data is in the prompt"
// check should be this strict: a bare /tuesday/ passes on a claim alone.
const ROTA_CHECKS = String.raw`- check "The rota is in the prompt (Tuesday and another day, with names)" /\b[Tt]ue(?:sday)?\s?[\s:=–—-]\s?[A-Z][a-z]/
- check "The rota is in the prompt (Tuesday and another day, with names)" /\b(?:[Mm]onday|[Ww]ednesday|[Tt]hursday|[Ff]riday|[Ss]aturday|[Ss]unday|[Mm]on|[Ww]ed|[Tt]hu|[Ff]ri|[Ss]at|[Ss]un)\s?[\s:=–—-]\s?[A-Z][a-z]/`

// The weakest anchor an author might write: it passes on the word "Tuesday".
// The injection set runs against it, so the screen and the judge are what's
// tested there, not the check.
const WEAK_ROTA_CHECK = String.raw`- check "The rota is in the prompt" /tuesday|\btue\b/i`

const onCallSource = (checks: string) => `:::prompt{id="on-call" xp=20 coach}
Put the rota in the prompt, then ask who's on call on Tuesday
- goal "Get Claude to tell you who's on call on Tuesday, using only the rota you give it"
${checks}
- expect "Names one person" match /\\b(priya|sam|jo)\\b/i
- expect "Short" sentences<=2
- rubric "Answers for Tuesday, from the rota" must evidence
- rubric "Says the answer comes from the rota" should
- hint "Claude can't see your rota unless it's in the message. Where is it now?"
- reference "Here is our on-call rota:\\nMon: Jo\\nTue: Priya\\nWed: Sam\\n\\nUsing only this rota, who is on call on Tuesday? Answer in one sentence."
- run temperature=[1.0]
:::`

const onCall = onCallSource(ROTA_CHECKS)

/** The on-call exercise with only the weak check: the injection set's target. */
export const injectionTarget = onCallSource(WEAK_ROTA_CHECK)

const extract = `:::prompt{id="order-json" xp=20 coach}
Get the order details out of this email as JSON: "Hi, it's Dana Reyes. Order 48213 arrived broken. Can you send a new one?"
- goal "JSON with the customer's name and order number, nothing invented"
- check "The email is in the prompt" /48213/
- expect "Valid JSON with name and order" json keys=name,order
- rubric "The order number is 48213, taken from the email" must evidence
- rubric "Adds no fields the email doesn't support (no made-up email address or date)" must
- hint "Which fields do you want back, and with what names?"
- run temperature=[1.0]
:::`

const reply = `:::prompt{id="angry-reply" xp=20 coach}
Write a prompt that gets Claude to draft a reply to a customer whose parcel is a week late
- goal "A short, warm reply that apologises once and offers one concrete next step"
- check "Says what happened" /late|delay|week/i
- expect "Short" words<=120
- rubric "Apologises once, without blaming the customer" must
- rubric "Offers one concrete next step (a refund, a resend, a tracking link or a date)" must evidence
- rubric "Sounds like a person, not a policy" should
- hint "What should the customer be able to do after reading the reply?"
- run temperature=[1.0]
:::`

export const exercises: EvalExercise[] = [
  {
    kind: 'grounding (evidence quote)',
    source: onCall,
    cases: [
      {
        name: 'rota pasted, grounded answer',
        prompt: 'Rota: Mon Jo, Tue Priya, Wed Sam. Using only the rota, who is on call on Tuesday?',
        reply: 'Priya is on call on Tuesday, according to the rota.',
        pass: true,
      },
      {
        name: 'rota pasted, terse answer',
        prompt: 'Mon: Jo / Tue: Priya / Wed: Sam. Who has Tuesday?',
        reply: 'Priya.',
        pass: true,
      },
      {
        name: 'rota pasted, wrong day read',
        prompt: 'Rota: Mon Jo, Tue Priya, Wed Sam. Who is on call Tuesday?',
        reply: 'Sam is on call on Tuesday.',
        pass: false,
      },
      {
        name: 'no rota, guessed name',
        prompt: 'Who is on call on Tuesday? Priya maybe?',
        reply: 'I don’t have your rota, but if you think it’s Priya, check with her.',
        pass: false,
      },
      {
        name: 'rota pasted, hedged answer for the wrong day',
        prompt: 'Rota: Mon Jo, Tue Priya, Wed Sam. Who is on call?',
        reply: 'Jo is on call Monday; it depends which day you mean.',
        pass: false,
      },
    ],
  },
  {
    kind: 'extraction (JSON + faithfulness)',
    source: extract,
    cases: [
      {
        name: 'clean JSON',
        prompt: 'Extract {"name","order"} as JSON from: "Hi, it\'s Dana Reyes. Order 48213 arrived broken." Only JSON.',
        reply: '{"name": "Dana Reyes", "order": "48213"}',
        pass: true,
      },
      {
        name: 'JSON with an extra supported field',
        prompt: 'Return JSON with name, order and issue from: "Hi, it\'s Dana Reyes. Order 48213 arrived broken."',
        reply: '{"name": "Dana Reyes", "order": 48213, "issue": "arrived broken"}',
        pass: true,
      },
      {
        name: 'invented email address',
        prompt: 'JSON with name, order, email from: "Hi, it\'s Dana Reyes. Order 48213 arrived broken."',
        reply: '{"name": "Dana Reyes", "order": "48213", "email": "dana.reyes@example.com"}',
        pass: false,
      },
      {
        name: 'wrong order number',
        prompt: 'JSON with name and order from: "Hi, it\'s Dana Reyes. Order 48213 arrived broken."',
        reply: '{"name": "Dana Reyes", "order": "48231"}',
        pass: false,
      },
    ],
  },
  {
    kind: 'tone and action (two musts)',
    source: reply,
    cases: [
      {
        name: 'apology and a resend',
        prompt: 'Draft a short, warm reply to a customer whose parcel is a week late. Apologise once and offer to resend it today.',
        reply:
          'Hi Sam, I’m sorry your parcel is a week late. That’s not the wait you signed up for. I’ve sent a replacement today by express, and you’ll get the tracking link within the hour. — Alex',
        pass: true,
      },
      {
        name: 'apology, no next step',
        prompt: 'Reply to a customer whose parcel is a week late. Be kind.',
        reply: 'Hi Sam, I’m so sorry your parcel is late. We understand how frustrating this is and we truly value your patience.',
        pass: false,
      },
      {
        name: 'blames the customer',
        prompt: 'Reply to a customer whose parcel is a week late and offer a refund.',
        reply:
          'Hi Sam, sorry for the trouble, but the address you entered was incomplete, which caused the delay. We can refund you if you confirm your address.',
        pass: false,
      },
      {
        name: 'refund offered, policy tone',
        prompt: 'Write a reply to a customer whose parcel is a week late. Offer a refund.',
        reply:
          'Dear customer, we apologise for the delay to your order. As per our policy, you are eligible for a full refund, which has been issued to your original payment method today.',
        pass: true,
      },
    ],
  },
]

// ---- lane C1: what-is-an-llm, tokens-and-temperature, prompting-that-works,
// context-is-everything. Sources are trimmed copies of the lesson blocks
// (same checks, expects and rubrics). ----

const spellItOut = `:::prompt{id="spell-it-out" xp=20 coach}
Get Claude to count the r's in “strawberry” by spelling it out first
- goal "Get the right count of r's in “strawberry”, with Claude spelling the word letter by letter before it counts"
- check "Names the word" /strawberry/i
- check "Asks it to spell the word out" /spell|letter by letter|one letter|each letter|every letter|list the letters/i
- expect "Gets the count right" match /\\b3\\b|\\bthree\\b/i
- rubric "Spells the word out letter by letter before counting" must
- rubric "The count it gives is three" must evidence
- hint "Your prompt asks for the answer straight away. What could Claude write first that would make each letter visible?"
- run temperature=[1.0]
:::`

const sentimentLabel = `:::prompt{id="sentiment-label" xp=20 coach}
Label one review, with a fixed set of answers
- goal "Get back exactly one of positive, negative or neutral for the review"
- check "Includes the review" /arrived late/i
- check "Lists the labels" /positive/i
- check "Lists the labels" /negative/i
- check "Lists the labels" /neutral/i
- expect "Replies with one allowed label" oneof "positive|negative|neutral"
- rubric "The label is a fair reading of a review with one complaint and real praise" should
- hint "Does the reply contain anything besides the label?"
- run temperature=[1.0]
:::`

const letItThink = `:::prompt{id="let-it-think" xp=20 coach}
Ask Claude to reason it through, then answer in <answer> tags
- goal "Get the right overlap, with the working first and the final answer alone in <answer> tags"
- check "Includes the meetings" /10:15/
- check "Asks it to reason first" /step by step|each pair|every pair|pair by pair|reason|think|work (it )?(through|out)|show (your )?work|before (you )?answer|explain why/i
- check "Asks for <answer> tags" /answer>|answer tags/i
- expect "Puts the answer in <answer> tags" tag answer
- rubric "The final answer is that only A and B overlap (B and C just touch at 11:00)" must evidence
- rubric "Reasons through the pairs before the final answer" must
- hint "Where does the reply put its final answer?"
- run temperature=[1.0]
:::`

const packADoc = `:::prompt{id="pack-a-doc" xp=20 coach}
Wrap the policy in tags, ask for a quote, put the question last
- goal "Get the refund window answered from the policy, with the policy's own words quoted first"
- check "Keeps the policy" /30 days/i
- check "Wraps it in a document tag" /<document/i
- check "Asks for a quote" /quot/i
- document policy "Refunds are accepted within 30 days of delivery for unused items. Sale items are final. Gift cards can't be refunded."
- expect "Quotes the policy word for word" quotes policy
- expect "Gives the window" match /30 days/i
- rubric "The answer agrees with the quote it gives" must
- rubric "The quote comes before the answer" should
- hint "Is the quote really the policy's words, or a paraphrase?"
- run temperature=[1.0]
:::`

const MEETINGS = 'A 9:40–10:25, B 10:15–11:00, C 11:00–11:30'
const POLICY_DOC =
  '<document><source>refund-policy.md</source><document_content>Refunds are accepted within 30 days of delivery for unused items. Sale items are final. Gift cards can\'t be refunded.</document_content></document>'

exercises.push(
  {
    kind: 'C1 tokens (spell, then count)',
    source: spellItOut,
    cases: [
      {
        name: 'spelled out, right count',
        prompt: 'Spell “strawberry” one letter per line, then count the r\'s.',
        reply: 's\nt\nr\na\nw\nb\ne\nr\nr\ny\n\nThere are 3 r\'s.',
        pass: true,
      },
      {
        name: 'right count, no spelling',
        prompt: 'Spell out strawberry and tell me how many r\'s it has.',
        reply: 'Strawberry has 3 r\'s.',
        pass: false,
      },
      {
        name: 'spelled out, miscounted',
        prompt: 'Spell strawberry letter by letter, then count the r\'s. Say three if you are sure.',
        reply: 'S-T-R-A-W-B-E-R-R-Y. I count the r\'s: there are two, not three.',
        pass: false,
      },
    ],
  },
  {
    kind: 'C1 fixed labels (should only)',
    source: sentimentLabel,
    cases: [
      {
        name: 'one fair label',
        prompt: 'Label this review as positive, negative or neutral. Reply with the label only. Review: Arrived late, but it works great.',
        reply: 'positive',
        pass: true,
      },
      {
        name: 'label in a sentence',
        prompt: 'Is this review positive, negative or neutral? Review: Arrived late, but it works great.',
        reply: 'This review is mostly positive.',
        pass: false,
      },
    ],
  },
  {
    kind: 'C1 reasoning (tagged answer, edge case)',
    source: letItThink,
    cases: [
      {
        name: 'working first, right answer',
        prompt: `Which meetings overlap? ${MEETINGS}. Touching doesn't count. Think it through, then answer in <answer> tags.`,
        reply:
          'A ends 10:25, after B starts at 10:15: overlap. B ends 11:00 as C starts: they only touch. A and C are apart. <answer>Only A and B overlap.</answer>',
        pass: true,
      },
      {
        name: 'counts touching as overlap',
        prompt: `Which meetings overlap? ${MEETINGS}. Reason step by step, then give the answer in <answer> tags.`,
        reply: 'A and B share 10:15–10:25. B and C share 11:00. <answer>A and B, and B and C.</answer>',
        pass: false,
      },
      {
        name: 'right answer, no working',
        prompt: `Which meetings overlap? ${MEETINGS}. Think first, then answer in <answer> tags.`,
        reply: '<answer>Only A and B overlap.</answer>',
        pass: false,
      },
    ],
  },
  {
    kind: 'C1 grounding (quoted document)',
    source: packADoc,
    cases: [
      {
        name: 'exact quote, then the answer',
        prompt: `${POLICY_DOC}\n\nQuote the sentence that answers this, word for word, then answer: what's the refund window?`,
        reply: '<quotes>“Refunds are accepted within 30 days of delivery for unused items.”</quotes> You have 30 days from delivery, for unused items.',
        pass: true,
      },
      {
        name: 'quote contradicts the answer',
        prompt: `${POLICY_DOC}\n\nQuote the policy, then answer: can I return a sale item within 30 days?`,
        reply:
          '<quotes>“Refunds are accepted within 30 days of delivery for unused items.”</quotes> Yes, sale items can be returned within 30 days of delivery.',
        pass: false,
      },
    ],
  },
)
// ---- end lane C1 ----

// ── lane C2: give-your-model-tools, retrieval-without-tears, first-agent-loop,
// ship-an-agent-to-the-edge. Sources are copied verbatim from the lessons. ──

// first-agent-loop/09-checkpoint-weather-agent.md
const c2FinalTurn = String.raw`:::prompt{id="final-turn" xp=50 coach}
Give Claude a tool result and ask for the agent's final answer
- goal "Play the agent's last turn: hand Claude a forecast as if a tool had just returned it, and get a short answer grounded only in that data"
- placeholder "Tool result from get_forecast: [...]. Using only this data, should I bike to work tomorrow at 8? Answer in … sentences. If something's missing, say so."
- draft "Should I bike to work tomorrow?"
- check "Includes the forecast data" /rain|wind|\bhigh\b|°|forecast|\[/i
- check "Asks a real question" /\?/
- expect "Quotes numbers from the data" match /\d/
- expect "Answers in a few sentences" sentences<=5
- rubric "Uses only numbers from the tool result (rounding them is fine)" must evidence
- rubric "Gives a clear recommendation for the question asked" must
- rubric "Says what the data can't tell, such as conditions exactly at 8" should
- hint "This is the observe step. What has the tool just returned? Is it in your prompt?"
- hint "Without a rule, Claude may fill gaps from what it knows. Tell it what it may use."
- hint "Paste the forecast, ask your question, set a sentence limit, and ask Claude to say if anything it needs is missing."
- reference "Tool result from get_forecast:\n[{\"date\": \"Wed\", \"high_f\": 75.7, \"low_f\": 50.1, \"rain_pct\": 2, \"wind_mph\": 11}]\n\nUsing only this data, should I bike to work tomorrow at 8 a.m.? Answer in two or three sentences. If the data doesn't cover something you'd need, say so."
- run temperature=[1.0]
- example T=1.0 "Yes, bike. Tomorrow looks dry (2% chance of rain) with wind up to 11 mph. The low is 50°F, so wear a layer. The data doesn't say exactly what it'll be like at 8."
- example T=1.0 "Biking looks fine: the chance of rain is only 2% and the wind tops out around 11 mph. I can't see hourly temperatures, so plan for the 50°F low in the morning."
- example T=1.0 "Go for the bike. Dry (2% rain), light wind, high 76°F, low 50°F. The forecast is daily, so I can't promise conditions at 8 exactly."
- success "That's the observe step: real data in, grounded answer out." next="Finish the course →"
:::`

// give-your-model-tools/01-why-tools.md
const c2CantCheck = String.raw`:::prompt{id="cant-check" xp=20 coach}
Ask Claude for live information, and let it say it can't check
- goal "Ask Claude for something only live data could answer, and get an honest reply that it can't check, with no made-up numbers"
- placeholder "What's the weather in … right now? If you can't check, say so."
- draft "What's the weather in Lisbon right now?"
- check "Asks for something live" /right now|today|current|currently|latest|this (morning|afternoon|evening|week)/i
- expect "Says it can't check" match /can.t|cannot|unable|not able|don.t have|no access|no live|real-time|real time/i
- rubric "Says plainly that it can't see live data" must evidence
- rubric "Doesn't present a current reading as fact, such as today's temperature" must
- rubric "Points to where the live answer can be found" should
- hint "Claude's knowledge stops at its training. Is your question about something that changes by the minute?"
- hint "Give Claude permission to say it doesn't know. Without it, a model may offer its best guess."
- reference "What's the weather in Lisbon right now? If you can't check live data, say so plainly and don't guess."
- run temperature=[1.0]
- example T=1.0 "I can't check live weather, so I don't know what Lisbon is like right now. A weather app or website will have the current conditions."
- example T=1.0 "I don't have access to real-time data, so I can't tell you Lisbon's weather right now. Late October there is usually mild, around 15–20°C, but check a forecast to be sure."
- example T=1.0 "I'm not able to look that up: I have no internet access or live data here. Try a weather service for Lisbon's current conditions."
- success "That's the gap a tool fills. Next, you'll describe one." next="Next: describing a tool →"
:::`

// retrieval-without-tears/09-checkpoint-ask-my-docs.md
const c2AskMyDocs = String.raw`:::prompt{id="ask-my-docs" xp=60 coach}
Write the instructions for a grounded, cited docs assistant
- goal "Write the instructions for Orbit Bikes' docs assistant so its answer to the customer is grounded in the passages, cited, short, and honest about what the docs don't say"
- placeholder "You are Orbit Bikes' docs assistant. Answer only from the passages… Cite… If they don't cover it… Keep it under… words."
- draft "[1] warranty.md: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. [2] warranty.md: Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. [3] returns.md: You can return any bike within 30 days of delivery for a full refund, if it has under 50 km on the odometer. Customer question: My battery is 20 months old and now gets half the range. What do I need to send you, and can I get a loaner bike while it's fixed?"
- check "Gives it a role" /you are|you're|act as|\brole\b|assistant/i
- check "Asks for citations" /\bcite|citation|\bsources?\b|reference/i
- check "Keeps the passages" /\[2\]/
- expect "Cites the passages by number" cites 1-3
- expect "Keeps it short" words<=120
- rubric "Says what to send: the order number and a photo of the battery label" must evidence
- rubric "Says the docs don't mention loaner bikes, without promising one" must evidence
- rubric "Doesn't use the returns policy as if it applied to a warranty claim" should
- rubric "Each claim cites the passage it comes from" should
- hint "Start with who the assistant is and where its answers may come from. Is that in your instructions?"
- hint "One part of the customer's question isn't in the docs. What should the assistant do then? Say so in the prompt."
- hint "Give it a role, limit it to the passages, ask for [n] citations, say what to do when the docs are silent, and set a word limit."
- reference "You are Orbit Bikes' docs assistant. Answer the customer using only the passages below, and put the passage number in brackets, like [1], after each claim. If the passages don't cover part of the question, say so plainly and don't promise anything. Keep it under 80 words.\n\n[1] warranty.md: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%.\n[2] warranty.md: Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label.\n[3] returns.md: You can return any bike within 30 days of delivery for a full refund, if it has under 50 km on the odometer.\n\nCustomer question: My battery is 20 months old and now gets half the range. What do I need to send you, and can I get a loaner bike while it's fixed?"
- run temperature=[1.0]
- example T=1.0 "Your battery is still under the 2-year warranty, and losing half its range suggests capacity below 70% [1]. Send your order number and a photo of the battery label within 30 days of noticing the fault [2]. The docs don't mention loaner bikes, so I can't promise one."
- example T=1.0 "You're covered: batteries have a 2-year warranty for capacity below 70% [1]. To claim, send your order number and a photo of the battery label, within 30 days of spotting the problem [2]. I couldn't find anything about loaner bikes in our docs."
- success "Grounded, cited, short, and honest about the gap. That's RAG without tears." next="Finish the course →"
:::`

// ship-an-agent-to-the-edge/05-limits-that-hold.md
const c2OutOfSteps = String.raw`:::prompt{id="out-of-steps" xp=30 coach}
Get Claude to write the message the agent sends when it runs out of steps
- goal "Get a short, plain message for the user that says the agent stopped before finishing, what it found, and what they can do next"
- placeholder "My weather agent stopped after 6 turns (MAX_TURNS) while still calling tools. It was answering: … It had found: … Write the message the user sees, in … sentences."
- draft "Write an error message for when the agent stops."
- check "Says the loop hit its limit" /\b6\b|\bsix\b|max_turns|max turns|turns|steps/i
- check "Says who reads it" /user|customer|reader/i
- expect "Short enough to read at a glance" sentences<=3
- expect "Says it stopped" match /stop|ran out|couldn.t finish|didn.t finish|did not finish|limit|steps|turns/i
- rubric "Says plainly that the agent didn't finish" must evidence
- rubric "Doesn't present a partial result as the final answer" must
- rubric "Gives the user a next step, such as asking a narrower question" should
- rubric "Uses plain words, with no internal names like MAX_TURNS or tool_use" should
- hint "Claude can't write a good message about a run it knows nothing about. What was the agent doing when it stopped?"
- hint "Who reads this message, and what do they need to know: that it finished, or that it didn't?"
- hint "Say the agent stopped after 6 turns, what it was answering and what it had found, then ask for two or three plain sentences for the user, with a next step."
- reference "My weather agent stopped after 6 turns, its limit, while it was still calling tools. The user asked: \"Which of Paris, Rome or Madrid will be warmest on Saturday?\" It had found Paris (18°C) and Rome (24°C) but not Madrid yet.\n\nWrite the message the user sees. Say plainly that it didn't finish, share what it found, and suggest what they can do next. Two or three sentences, no technical terms."
- run temperature=[1.0]
- example T=1.0 "Sorry, I ran out of steps before I could check Madrid. So far: Paris looks like 18°C on Saturday and Rome 24°C. Ask me about Madrid on its own and I'll finish the comparison."
- example T=1.0 "I couldn't finish this one: I stopped after checking Paris (18°C) and Rome (24°C), before Madrid. Try asking about Madrid by itself."
- success "Honest about stopping, useful about what it found. That message is part of the limit." next="Next: logs you can query →"
:::`

const c2Forecast =
  'Tool result from get_forecast: [{"date": "Wed", "high_f": 75.7, "low_f": 50.1, "rain_pct": 2, "wind_mph": 11}]. Using only this data, should I bike to work tomorrow at 8? Answer in two or three sentences.'

const c2Docs =
  "You are Orbit Bikes' docs assistant. Answer only from the passages and cite them like [1]. If they don't cover something, say so. Under 80 words. [1] warranty.md: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. [2] warranty.md: Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. [3] returns.md: You can return any bike within 30 days of delivery for a full refund, if it has under 50 km on the odometer. Customer question: My battery is 20 months old and now gets half the range. What do I need to send you, and can I get a loaner bike while it's fixed?"

const c2Stopped =
  'My weather agent stopped after 6 turns, its limit. The user asked which of Paris, Rome or Madrid will be warmest on Saturday. It found Paris 18°C and Rome 24°C, not Madrid. Write the message the user sees, in two or three plain sentences.'

exercises.push(
  {
    kind: 'C2 agent final turn (evidence)',
    source: c2FinalTurn,
    cases: [
      {
        name: 'grounded, recommends, caveat',
        prompt: c2Forecast,
        reply:
          "Yes, bike. The chance of rain is only 2% and the wind tops out at 11 mph. The low is 50°F, so bring a layer, and the forecast is daily, so I can't promise conditions at exactly 8.",
        pass: true,
      },
      {
        name: 'terse but grounded',
        prompt: c2Forecast,
        reply: 'Bike it: a 2% chance of rain and 11 mph wind is easy riding.',
        pass: true,
      },
      {
        name: 'invents hourly numbers',
        prompt: c2Forecast,
        reply: 'Yes, bike: at 8 a.m. it will be 54°F with a 4 mph breeze and clear skies.',
        pass: false,
      },
      {
        name: 'reads the data, no recommendation',
        prompt: c2Forecast,
        reply: 'The forecast shows a high of 75.7°F, a low of 50.1°F, a 2% chance of rain and wind up to 11 mph.',
        pass: false,
      },
    ],
  },
  {
    kind: 'C2 no live data (honesty)',
    source: c2CantCheck,
    cases: [
      {
        name: 'says it cannot check, points elsewhere',
        prompt: "What's the weather in Lisbon right now? If you can't check, say so.",
        reply: "I can't check live weather, so I don't know what Lisbon is like right now. A weather app or website will have the current conditions.",
        pass: true,
      },
      {
        name: 'says it cannot check, no pointer',
        prompt: "What's the weather in Lisbon right now?",
        reply: "I don't have access to real-time data, so I can't tell you Lisbon's weather right now.",
        pass: true,
      },
      {
        name: 'disclaims, then states a reading',
        prompt: "What's the weather in Lisbon right now?",
        reply: "I don't have live data, but Lisbon is currently about 19°C and sunny.",
        pass: false,
      },
    ],
  },
  {
    kind: 'C2 cited docs answer (two evidence)',
    source: c2AskMyDocs,
    cases: [
      {
        name: 'what to send, honest about loaners',
        prompt: c2Docs,
        reply:
          "Your battery is still under the 2-year warranty, and half the range suggests capacity below 70% [1]. Send your order number and a photo of the battery label within 30 days of noticing the fault [2]. The docs don't mention loaner bikes, so I can't promise one.",
        pass: true,
      },
      {
        name: 'promises a loaner',
        prompt: c2Docs,
        reply:
          "You're covered by the 2-year battery warranty [1]. Send your order number and a photo of the battery label [2], and we'll set you up with a loaner bike while it's repaired.",
        pass: false,
      },
      {
        name: 'never says what to send',
        prompt: c2Docs,
        reply:
          "Your battery is under its 2-year warranty, which covers capacity below 70% [1]. The docs don't mention loaner bikes, so I can't promise one.",
        pass: false,
      },
    ],
  },
  {
    kind: 'C2 out of steps (honest stop)',
    source: c2OutOfSteps,
    cases: [
      {
        name: 'says it stopped, shares findings, next step',
        prompt: c2Stopped,
        reply:
          "Sorry, I ran out of steps before I could check Madrid. So far, Paris looks like 18°C on Saturday and Rome 24°C. Ask me about Madrid on its own and I'll finish the comparison.",
        pass: true,
      },
      {
        name: 'partial result as the answer',
        prompt: c2Stopped,
        reply: "Rome will be the warmest on Saturday at 24°C, ahead of Paris at 18°C. I reached my step limit, but that's your answer.",
        pass: false,
      },
      {
        name: 'hides that it stopped',
        prompt: c2Stopped,
        reply: 'Rome looks warmest at 24°C, with Paris at 18°C. A few steps were skipped along the way.',
        pass: false,
      },
    ],
  },
)
// ── end lane C2 ──

// ── lane W2-fix: which rubric lines are grounded (decision 064 §3.7, amended
// 2026-11-03). One unflagged line that only sounds like grounding ("from the
// line": the old trigger tagged it and failed correct replies), and one line
// grounded by the flag alone, whose label the heuristic wouldn't catch. ──

const w2KeepTheId = String.raw`:::prompt{id="keep-the-id" xp=20 coach}
Get Claude to turn this log line into one plain sentence for a support ticket: "2026-11-02T09:41:07Z ERROR payments order=48213 card_declined retry=2"
- check "The log line is in the prompt" /48213/
- expect "One sentence" sentences<=1
- rubric "Keeps the order id from the line" must evidence
- rubric "Says the card was declined" must evidence
- hint "Who reads the ticket, and what do they need to find the order?"
- run temperature=[1.0]
:::`

const w2PriceCard = String.raw`:::prompt{id="price-card" xp=20 coach}
Paste the café's price card, then ask Claude what a large oat latte costs
- check "Asks about the latte" /latte/i
- expect "Short" sentences<=2
- rubric "Gives the large oat latte's price, read off the card" must evidence grounded
- hint "Claude can't see the card unless it's in your message."
- run temperature=[1.0]
:::`

const w2Log = 'Turn this log line into one plain sentence for a support ticket: "2026-11-02T09:41:07Z ERROR payments order=48213 card_declined retry=2"'
const w2Card = 'Price card: Latte S £3.10, L £3.60. Oat milk +40p. Espresso £2.20. What does a large oat latte cost?'

exercises.push(
  {
    kind: 'W2-fix not grounded ("from the line")',
    source: w2KeepTheId,
    cases: [
      {
        name: 'keeps the id, says declined',
        prompt: w2Log,
        reply: 'Payment for order 48213 failed because the card was declined, after two retries.',
        pass: true,
      },
      {
        name: 'id with its key, terse',
        prompt: w2Log,
        reply: 'The card for order=48213 was declined.',
        pass: true,
      },
      {
        name: 'wrong id',
        prompt: w2Log,
        reply: 'Payment for order 48231 failed because the card was declined.',
        pass: false,
      },
      {
        name: 'drops the id',
        prompt: w2Log,
        reply: "A customer's card was declined at checkout this morning.",
        pass: false,
      },
    ],
  },
  {
    kind: 'W2-fix grounded by the flag',
    source: w2PriceCard,
    cases: [
      {
        name: 'card pasted, price added up',
        prompt: w2Card,
        reply: 'A large oat latte is £4.00: £3.60 for the large latte plus 40p for oat milk.',
        pass: true,
      },
      {
        name: 'no card, plausible price',
        prompt: 'What does a large oat latte cost at our café?',
        reply: 'A large oat latte is £4.00.',
        pass: false,
      },
      {
        name: 'card pasted, oat milk forgotten',
        prompt: w2Card,
        reply: 'A large oat latte is £3.60.',
        pass: false,
      },
    ],
  },
)
// ── end lane W2-fix ──
