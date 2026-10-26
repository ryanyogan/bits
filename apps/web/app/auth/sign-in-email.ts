// The one email sign-in sends: the 6-digit code and the magic link together
// (handoff, Auth). Plain text plus a small inline-styled HTML part.
import { APP_TITLE } from '../config.ts'
import type { MailMessage } from './mailer.ts'

export function signInEmail(input: { to: string; code: string; link: string; minutes: number }): MailMessage {
  let { to, code, link, minutes } = input
  let spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  let subject = `${spaced} is your ${APP_TITLE} sign-in code`
  let text = [
    `Your ${APP_TITLE} sign-in code is ${code}.`,
    '',
    'Or open this link to sign in:',
    link,
    '',
    `The code and link expire in ${minutes} minutes and work once.`,
    `If you didn't ask to sign in to ${APP_TITLE}, you can ignore this email.`,
  ].join('\n')
  let html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#16161a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px">
      <tr><td style="padding:32px">
        <p style="margin:0 0 8px;font-size:15px">Your ${APP_TITLE} sign-in code is</p>
        <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</p>
        <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#16161a;color:#ffffff;font-weight:600;text-decoration:none">Sign in to ${APP_TITLE}</a></p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#5c5c66">The code and link expire in ${minutes} minutes and work once. If you didn't ask to sign in to ${APP_TITLE}, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`
  return { to, subject, text, html }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
