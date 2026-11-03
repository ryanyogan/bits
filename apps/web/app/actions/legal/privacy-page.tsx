import type { Handle } from 'remix/component'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import { APP_TITLE } from '../../config.ts'
import { routes } from '../../routes.ts'
import { LegalPage } from './legal-page.tsx'

/** When this text last changed. Update it with every edit (decision 028). */
export const PRIVACY_UPDATED = '3 November 2026'

/**
 * /privacy: what the app stores, who else sees it, and how long it stays.
 * Written from the code (migrations, app/runs, app/auth, worker.ts's daily
 * clean-up). When those change, change this page in the same commit.
 */
export function PrivacyPage(handle: Handle<{ viewer: Viewer | null; analytics: boolean }>) {
  return () => {
    let settings = routes.settings.index.href()
    let { analytics } = handle.props
    return (
      <LegalPage
        title="Privacy"
        description={`What ${APP_TITLE} keeps about you, who else sees it, and how to take it with you or delete it.`}
        updated={PRIVACY_UPDATED}
        path={routes.legal.privacy.href()}
        viewer={handle.props.viewer}
      >
        <h2>The short version</h2>
        <ul>
          <li>
            We keep what the app needs to work: your email, your progress and the prompts you write in lessons.
          </li>
          <li>
            Prompts you run go to Anthropic's Claude so it can answer, and then, with Claude's reply, to Claude again so
            the coach can grade them. Nothing else about you goes with them.
          </li>
          {analytics ? (
            <li>
              No ads and no tracking cookies. We count page views with Cloudflare Web Analytics, which sets no cookies
              and doesn't follow you around. We don't sell or share your data.
            </li>
          ) : (
            <li>No ads, no analytics, no tracking cookies, no third-party scripts. We don't sell or share your data.</li>
          )}
          <li>
            You can download everything or delete your account at any time in <a href={settings} data-rmx-prefetch={prefetchFor(settings)}>Settings</a>.
          </li>
        </ul>

        <h2>If you have an account</h2>
        <ul>
          <li>
            <strong>Account:</strong> your email, display name, handle, the goals you picked at sign-up, your time zone
            (to count streak days), the lesson depth you picked (new to this or engineer), the theme you picked (dark or light, if you pinned one) and when you joined.
          </li>
          <li>
            <strong>Progress:</strong> lessons you finished and when, neurons earned per exercise, quiz and lesson, your
            streak, daily activity counts and badges.
          </li>
          <li>
            <strong>Prompt journal:</strong> every prompt you run or submit in a lesson, with the lesson, the temperature,
            the model, token counts, whether the checks passed, and the time.
          </li>
          <li>
            <strong>Quick-check answers:</strong> each answer you check in a lesson's quick check, with the lesson,
            whether it was right, and the time. The server grades it; it is never sent to a model.
          </li>
          <li>
            <strong>Coach verdicts:</strong> for each prompt run the coach grades, which checks it met, the hint you were
            shown, whether it passed, the time and, when the coach model ran, its token counts. A note is also kept when
            you ask to see an exercise's strong prompt.
          </li>
          <li>
            <strong>Deploy checks:</strong> when a lesson asks you to check your deployed Worker, the{' '}
            <code>https://….workers.dev</code> address you give (its host only, never a path or query), the path the
            lesson calls, how it went (passed, or why not), the status code, how long it took, and the time. {APP_TITLE}'s
            server makes one GET request to that address, with no cookies; the reply is checked and then dropped, never
            stored. Failed checks are deleted after 30 days; passing ones stay with your account.
          </li>
          <li>
            <strong>Sign-in methods:</strong> if you sign in with GitHub or Google, your account id there and the email
            they report. If you add a passkey, its public key and a name for it. We never see a password: there are
            none.
          </li>
          <li>
            <strong>Sessions:</strong> each signed-in browser has a session record with a hash of its id, the browser's
            user agent, and when it started and was last seen. Sessions end after 30 days.
          </li>
        </ul>
        <p>
          All of this stays until you delete your account. Expired sessions are removed by a daily clean-up.
        </p>

        <h2>If you don't have an account</h2>
        <p>
          You can take lessons signed out. Your browser then gets the same session cookie, and the session holds your
          finished lessons, the lesson depth and theme you picked and a random visitor id. Prompts you run are journalled under that visitor id with a hash of
          your IP address, which is how the hourly limits work. Quick-check answers and coach verdicts are kept the
          same way. A daily clean-up deletes signed-out runs, answers and verdicts after 7 days.
          If you sign in, your progress, recent runs, answers and verdicts move into your account. Checking a deployed
          Worker needs an account, so nothing about it is kept for signed-out visitors.
        </p>

        <h2>Signing in by email</h2>
        <p>
          When you ask for a sign-in link we store your email, hashes of the link and code, and a hash of your IP
          address (to limit how many codes one address can request). They expire after a few minutes and the daily
          clean-up deletes them an hour later. The email itself is sent through Cloudflare's email service.
        </p>

        <h2>Author invites</h2>
        <p>
          If an admin invites you to write courses, we store your email, a hash of the invite link, the courses it
          offers, which admin sent it, and when it was accepted or withdrawn. The invite is sent through Cloudflare's
          email service and counts towards the same daily email limit as sign-in codes. The record is deleted 30 days
          after the invite expires (invites last 7 days), accepted or not, or straight away when you delete your
          account. {APP_TITLE} admins can see the email addresses of authors, admins and anyone with an open invite.
        </p>

        <h2>Cookies and your browser</h2>
        <p>
          We set one cookie, <code>__Host-session</code>, which keeps you signed in and holds your signed-out progress.
          It is strictly necessary, so there is no cookie banner. Drafts of prompts you're writing are kept in your
          browser's local storage and never leave your device until you run them. Fonts and scripts are served from
          our own site{analytics ? ', apart from the Web Analytics script below' : ''}.
        </p>

        {analytics ? (
          <>
            <h2>Page views</h2>
            <p>
              To see which pages people read and how fast they load, every page loads Cloudflare Web Analytics' script
              from <code>static.cloudflareinsights.com</code>. It reports the page's address, the page you came from, load
              timings, and your browser, operating system, device type and country to Cloudflare. It sets no cookies and
              uses no local storage, and Cloudflare says it doesn't fingerprint visitors by IP address or user agent. We
              only see totals, never a list of visitors. If your browser sends Global Privacy Control, the script isn't
              loaded at all.
            </p>
          </>
        ) : null}

        <h2>Your public profile</h2>
        <p>
          New accounts are private. Each starts with a made-up handle (like <code>learner_7f3k9q</code>), not one taken
          from your email or name, and nothing about you is shown to anyone else until you choose to make your profile
          public in <a href={settings} data-rmx-prefetch={prefetchFor(settings)}>Settings</a>, where you can also change
          the handle. A public profile at <code>/u/your-handle</code> shows your name, handle, stats, courses, badges and
          activity heatmap, and certificates for finished courses are public with it. When a course ends with a deploy
          check you passed, its certificate also links the <code>workers.dev</code> address it passed on (only while your
          profile is public). Your email and your prompt journal are never shown. Accounts made before 2 November 2026 started public and keep the setting they have; you can
          make yours private at any time.
        </p>

        <h2>Who else handles your data</h2>
        <ul>
          <li>
            <strong>Cloudflare</strong> hosts {APP_TITLE}: the app (Workers), the database (D1, in the United States),
            course files (R2), sign-in email{analytics ? ', page-view counts (Web Analytics)' : ''} and the AI Gateway. Cloudflare keeps short-lived request logs (paths,
            status codes and errors) that we use to fix bugs.
          </li>
          <li>
            <strong>Anthropic</strong> runs the model. When you press Run, the text of your prompt and a fixed
            instruction from us go to Claude through Cloudflare's AI Gateway. For a coached exercise, your prompt and
            Claude's reply then go to Claude once more, with the exercise's grading rules, so the coach can grade them.
            Your name, email and account are not sent.
            Anthropic handles that data under its own{' '}
            <a href="https://www.anthropic.com/legal/privacy">privacy policy</a>.
          </li>
          <li>
            <strong>GitHub and Google</strong>, only if you choose to sign in with them.
          </li>
        </ul>
        <p>Course authors don't see who took their course or what you wrote.</p>

        <h2>Taking your data with you, or deleting it</h2>
        <ul>
          <li>
            <strong>Export:</strong> Settings → Download my data gives you a JSON file with your account, sign-in
            methods, progress, badges, every prompt in your journal, your quick-check answers, the coach's
            verdicts and your deploy checks.
          </li>
          <li>
            <strong>Sign out everywhere</strong> ends every session at once.
          </li>
          <li>
            <strong>Delete account</strong> removes your account and everything tied to it straight away: sessions,
            sign-in methods, passkeys, progress, badges, your prompt journal, your quick-check answers, the coach's
            verdicts and your deploy checks. Courses you
            published stay up but are
            no longer linked to you. Cloudflare's database keeps point-in-time recovery history for a limited time,
            after which deleted data is gone from backups too.
          </li>
        </ul>

        <h2>Changes</h2>
        <p>
          If we change what we collect, we'll update this page and the date at the top before the change ships.
        </p>
      </LegalPage>
    )
  }
}
