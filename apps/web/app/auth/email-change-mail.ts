// The three emails of an email change (decision 030): the code + link to the
// new address, the "already has an account" notice that replaces it when the
// address is taken, and the notice to the old address once the change is
// done. Plain text plus the same small inline-styled HTML as sign-in mail.
import { APP_TITLE } from '../config.ts'
import type { MailMessage } from './mailer.ts'

/** To the new address: confirm with the code or the link. */
export function confirmEmailChangeMail(input: { to: string; code: string; link: string; minutes: number }): MailMessage {
  let { to, code, link, minutes } = input
  let spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  let text = [
    `Your ${APP_TITLE} confirmation code is ${code}.`,
    '',
    `Someone signed in to ${APP_TITLE} asked to use ${to} as their sign-in email.`,
    'Or open this link to confirm the change:',
    link,
    '',
    `The code and link expire in ${minutes} minutes and work once.`,
    `If this wasn't you, ignore this email. Nothing changes until it is confirmed.`,
  ].join('\n')
  return {
    to,
    subject: `${spaced} is your ${APP_TITLE} confirmation code`,
    text,
    html: layout(`
      <p style="margin:0 0 8px;font-size:15px">Confirm your new ${APP_TITLE} email with this code</p>
      <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#16161a;color:#ffffff;font-weight:600;text-decoration:none">Confirm ${escapeHtml(to)}</a></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c5c66">The code and link expire in ${minutes} minutes and work once. If this wasn't you, ignore this email. Nothing changes until it is confirmed.</p>`),
  }
}

/**
 * To the new address when it already has an account. The requester sees the
 * same "check your inbox" either way, so the form never reveals who has an
 * account; only the owner of the address learns it.
 */
export function emailTakenMail(input: { to: string }): MailMessage {
  let text = [
    `Someone signed in to ${APP_TITLE} asked to use ${input.to} as their sign-in email.`,
    '',
    `This address already belongs to a ${APP_TITLE} account, so nothing changed.`,
    `If it was you, sign in with this address instead. If it wasn't, you can ignore this email.`,
  ].join('\n')
  return {
    to: input.to,
    subject: `This email already has a ${APP_TITLE} account`,
    text,
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Someone signed in to ${APP_TITLE} asked to use <strong>${escapeHtml(input.to)}</strong> as their sign-in email.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">This address already belongs to a ${APP_TITLE} account, so nothing changed.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c5c66">If it was you, sign in with this address instead. If it wasn't, you can ignore this email.</p>`),
  }
}

/** To the old address once the change is done, with the revert link. */
export function emailChangedMail(input: { to: string; newEmail: string; revertLink: string; days: number }): MailMessage {
  let { to, newEmail, revertLink, days } = input
  let text = [
    `Your ${APP_TITLE} sign-in email is now ${newEmail}.`,
    '',
    `Sign-in links and codes go there from now on.`,
    '',
    `If you didn't make this change, open this link within ${days} days to undo it.`,
    `It puts this address back, signs out every device and removes passkeys and GitHub or Google sign-ins added since the day before the change:`,
    revertLink,
  ].join('\n')
  return {
    to,
    subject: `Your ${APP_TITLE} email was changed`,
    text,
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Your ${APP_TITLE} sign-in email is now <strong>${escapeHtml(newEmail)}</strong>. Sign-in links and codes go there from now on.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">If you didn't make this change, undo it within ${days} days. That puts this address back, signs out every device and removes passkeys and GitHub or Google sign-ins added since the day before the change.</p>
      <p style="margin:0"><a href="${escapeHtml(revertLink)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#16161a;color:#ffffff;font-weight:600;text-decoration:none">This wasn't me: undo it</a></p>`),
  }
}

function layout(body: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#16161a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px">
      <tr><td style="padding:32px">${body}
      </td></tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
