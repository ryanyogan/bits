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

const onCall = `:::prompt{id="on-call" xp=20 coach}
Put the rota in the prompt, then ask who's on call on Tuesday
- goal "Get Claude to tell you who's on call on Tuesday, using only the rota you give it"
- check "The rota is in the prompt" /tuesday|\\btue\\b/i
- expect "Names one person" match /\\b(priya|sam|jo)\\b/i
- expect "Short" sentences<=2
- rubric "Answers for Tuesday, from the rota" must evidence
- rubric "Says the answer comes from the rota" should
- hint "Claude can't see your rota unless it's in the message. Where is it now?"
- reference "Here is our on-call rota:\\nMon: Jo\\nTue: Priya\\nWed: Sam\\n\\nUsing only this rota, who is on call on Tuesday? Answer in one sentence."
- run temperature=[1.0]
:::`

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
- rubric "Spells the word out letter by letter before counting" must evidence
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
- check "Asks it to reason first" /step by step|reason|think|work (it )?(through|out)|show (your )?work|before (you )?answer|explain why/i
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
