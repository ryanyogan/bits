-- Migration number: 0009 	 Daily mail quota: one counter row per UTC day (decision 039)
--
-- Every email the app sends on request (sign-in codes, step-up codes,
-- confirm-new-address codes) first reserves a slot here, with one upsert
-- that only adds 1 while `sent` is below the day's cap. The per-address and
-- per-IP limits stay on email_tokens; this bounds the total, so a
-- distributed sender can't burn the Email Sending quota or the domain's
-- reputation. `capped_at` is set by the first refusal of the day, so the
-- crossing is logged once. The daily cron deletes rows older than 30 days.

create table mail_quota (
  -- UTC day, YYYY-MM-DD.
  day text primary key not null check (length(day) = 10),
  sent integer not null default 0 check (sent >= 0),
  -- Epoch ms of the day's first refused send; null while under the cap.
  capped_at integer
);
