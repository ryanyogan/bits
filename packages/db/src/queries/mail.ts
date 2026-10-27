// The global daily mail cap (migration 0009, decision 039). The per-address
// and per-IP limits live on email_tokens (queries/auth.ts); this bounds the
// total across everyone, so a distributed sender can't spend the Email
// Sending quota or the domain's reputation.
import type { D1DataTableDatabase } from '../d1/database.ts'

/** The UTC day a timestamp falls on, YYYY-MM-DD: the counter's key. */
export function mailDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export type MailReservation = { ok: true } | { ok: false; firstRefusal: boolean }

/**
 * Reserves one send for today, only while today's count is below `cap`, as
 * one upsert: D1 runs statements one at a time, so parallel requests can't
 * both take the last slot (the `insertRunWithin` pattern, decision 019).
 * Never count first and send later.
 *
 * When the cap is reached, `firstRefusal` is true for exactly one caller per
 * day (the one that stamps `capped_at`), so the crossing is logged once.
 */
export async function reserveMailSend(
  db: D1DataTableDatabase,
  input: { now: number; cap: number },
): Promise<MailReservation> {
  let day = mailDay(input.now)
  let reserved = await db.d1
    .prepare(
      `insert into mail_quota (day, sent) select ?1, 1 where ?2 > 0
       on conflict (day) do update set sent = sent + 1 where sent < ?2`,
    )
    .bind(day, input.cap)
    .run()
  if (reserved.meta.changes === 1) return { ok: true }

  let stamped = await db.d1
    .prepare(
      `insert into mail_quota (day, sent, capped_at) values (?1, 0, ?2)
       on conflict (day) do update set capped_at = ?2 where capped_at is null`,
    )
    .bind(day, input.now)
    .run()
  return { ok: false, firstRefusal: stamped.meta.changes === 1 }
}

/** The counter for the day `now` falls on (tests, logs). */
export async function readMailQuota(
  db: D1DataTableDatabase,
  now: number,
): Promise<{ sent: number; capped_at: number | null } | null> {
  return db.d1.prepare('select sent, capped_at from mail_quota where day = ?').bind(mailDay(now)).first()
}
