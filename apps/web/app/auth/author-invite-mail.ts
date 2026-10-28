// The author invite email (decision 037): a link only, no code. Same small
// inline-styled HTML as the other account mail.
import { APP_TITLE } from '../config.ts'
import type { MailMessage } from './mailer.ts'

export function authorInviteMail(input: { to: string; link: string; days: number; from: string }): MailMessage {
  let { to, link, days, from } = input
  let text = [
    `${from} invited you to write courses on ${APP_TITLE}.`,
    '',
    `Sign in to ${APP_TITLE} as ${to}, then open this link to accept:`,
    link,
    '',
    `The link works once and expires in ${days} days. It only works for ${to}.`,
    `If you weren't expecting this, ignore this email. Nothing changes unless you accept.`,
  ].join('\n')
  return {
    to,
    subject: `You're invited to write courses on ${APP_TITLE}`,
    text,
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5"><strong>${escapeHtml(from)}</strong> invited you to write courses on ${APP_TITLE}.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">Sign in as <strong>${escapeHtml(to)}</strong>, then accept:</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#16161a;color:#ffffff;font-weight:600;text-decoration:none">Accept the invite</a></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c5c66">The link works once, expires in ${days} days and only works for ${escapeHtml(to)}. If you weren't expecting this, ignore this email. Nothing changes unless you accept.</p>`),
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
