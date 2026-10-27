import type { Handle } from 'remix/component'

import type { Viewer } from '../../auth/identity.ts'
import { APP_TITLE } from '../../config.ts'
import { routes } from '../../routes.ts'
import { LegalPage } from './legal-page.tsx'

/** When this text last changed. Update it with every edit (decision 028). */
export const TERMS_UPDATED = '27 October 2026'

/** /terms: the deal, in plain words. */
export function TermsPage(handle: Handle<{ viewer: Viewer | null }>) {
  return () => {
    return (
      <LegalPage
        title="Terms"
        description={`The deal for using ${APP_TITLE}, in plain words.`}
        updated={TERMS_UPDATED}
        path={routes.legal.terms.href()}
        viewer={handle.props.viewer}
      >
        <h2>What {APP_TITLE} is</h2>
        <p>
          {APP_TITLE} is a free place to learn AI engineering: short lessons, small exercises and a sandbox where your
          prompts run against a real model. There's nothing to pay and no paid tier. By using it you agree to these
          terms and to how we handle data as set out in the <a data-rmx-prefetch="intent" href={routes.legal.privacy.href()}>Privacy</a> page.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Use an email address you control. Anyone who can read it can sign in as you.</li>
          <li>One person per account. Pick a handle and name that aren't someone else's or offensive.</li>
          <li>You can delete your account whenever you like, in Settings.</li>
        </ul>

        <h2>Using the sandbox fairly</h2>
        <p>
          Live model runs cost real money, so they have limits: per hour, per day, and a shared daily cap. Past a
          limit, runs show the lesson's example output instead. Please don't:
        </p>
        <ul>
          <li>try to get around the limits, or use the sandbox as a free general-purpose API;</li>
          <li>
            use it for anything illegal or harmful, or for anything Anthropic's{' '}
            <a href="https://www.anthropic.com/legal/aup">usage policy</a> forbids (your prompts run on Claude);
          </li>
          <li>attack, overload or scrape the site, or access other people's accounts.</li>
        </ul>
        <p>We may limit or close accounts that do these things.</p>

        <h2>Model output can be wrong</h2>
        <p>
          Language models make mistakes, sometimes confidently. Treat what the model says as a draft to check, not as
          professional, legal, medical or financial advice. Some lesson toys use made-up numbers to show an idea; they
          are labelled “illustrative”.
        </p>

        <h2>What's yours and what's ours</h2>
        <ul>
          <li>Your prompts are yours. You let us store them, show them back to you and send them to the model to run.</li>
          <li>
            If you publish a course, you keep the rights to it. You let us host it and show it to everyone for free, and
            you confirm you have the right to publish what's in it.
          </li>
          <li>
            The lessons, design and code of {APP_TITLE} are ours. Linked sources belong to their authors; we link to
            them, we don't copy them.
          </li>
        </ul>

        <h2>No guarantees</h2>
        <p>
          {APP_TITLE} is provided as it is, for free. We work to keep it running and correct, but we can't promise it
          will always be available, error-free or unchanged. Lessons, features and limits may change, and the service
          may stop. As far as the law allows, we aren't liable for losses from using it or from relying on model output.
          Nothing here takes away rights you have by law.
        </p>

        <h2>Changes</h2>
        <p>
          If these terms change in a way that matters, we'll update this page and the date at the top before the change
          takes effect.
        </p>
      </LegalPage>
    )
  }
}
