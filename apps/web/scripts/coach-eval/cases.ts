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
