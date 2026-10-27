// Outgoing mail. Production sends through the Cloudflare Email Sending
// binding (`EMAIL`, wrangler.jsonc). Development and tests never send: the
// message lands in `outbox` and, in development, in the server log, so you can
// sign in locally by copying the code or link from the terminal. Workers
// Previews send nothing and keep nothing (decision 038): sign-in shows its
// code on the page instead (email-sign-in.ts), and other mail is dropped.
import { platform } from '#platform'

import { log } from '../log.ts'
import { appEnv, emailFrom, isPreview, isProduction } from './config.ts'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
}

/** Messages "sent" outside production, newest last. Tests read the code from here. */
export const outbox: MailMessage[] = []

export class MailError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message)
    this.name = 'MailError'
  }
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (isPreview()) {
    // Never the subject or body: they carry codes and links, and preview
    // logs are kept by Workers Observability.
    log('info', 'Mail is off on previews; not sent')
    return
  }
  if (!isProduction) {
    outbox.push(message)
    if (outbox.length > 50) outbox.shift()
    if (appEnv !== 'test') console.log(`\n[mail] to ${message.to}: ${message.subject}\n${message.text}\n`)
    return
  }

  try {
    await platform.env.EMAIL.send({ ...message, from: emailFrom() })
  } catch (error) {
    let code = (error as { code?: string }).code
    console.error(JSON.stringify({ level: 'error', message: 'Email send failed', code, error: String(error) }))
    throw new MailError('Email send failed', code)
  }
}
