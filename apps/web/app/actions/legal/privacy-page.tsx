import type { Handle } from 'remix/component'

import type { Viewer } from '../../auth/identity.ts'
import { APP_TITLE } from '../../config.ts'
import { routes } from '../../routes.ts'
import { LegalPage } from './legal-page.tsx'

/** When this text last changed. Update it with every edit (decision 028). */
export const PRIVACY_UPDATED = '27 October 2026'

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
            Prompts you run go to Anthropic's Claude so it can answer. Nothing else about you goes with them.
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
            You can download everything or delete your account at any time in <a href={settings}>Settings</a>.
          </li>
        </ul>

        <h2>If you have an account</h2>
        <ul>
          <li>
            <strong>Account:</strong> your email, display name, handle, the goals you picked at sign-up, your time zone
            (to count streak days) and when you joined.
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
          finished lessons and a random visitor id. Prompts you run are journalled under that visitor id with a hash of
          your IP address, which is how the hourly limits work. A daily clean-up deletes signed-out runs after 7 days.
          If you sign in, your progress and recent runs move into your account.
        </p>

        <h2>Signing in by email</h2>
        <p>
          When you ask for a sign-in link we store your email, hashes of the link and code, and a hash of your IP
          address (to limit how many codes one address can request). They expire after a few minutes and the daily
          clean-up deletes them an hour later. The email itself is sent through Cloudflare's email service.
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
          Profiles are public by default at <code>/u/your-handle</code>: your name, handle, stats, courses, badges and
          activity heatmap. Certificates for finished courses are public with it. Your email and your prompt journal are
          never shown. You can make your profile (and certificates) private in <a href={settings}>Settings</a>.
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
            instruction from us go to Claude through Cloudflare's AI Gateway. Your name, email and account are not sent.
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
            methods, progress, badges and every prompt in your journal.
          </li>
          <li>
            <strong>Sign out everywhere</strong> ends every session at once.
          </li>
          <li>
            <strong>Delete account</strong> removes your account and everything tied to it straight away: sessions,
            sign-in methods, passkeys, progress, badges and your prompt journal. Courses you published stay up but are
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
