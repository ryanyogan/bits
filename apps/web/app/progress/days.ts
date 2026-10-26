// Local calendar days (YYYY-MM-DD) for streaks and the activity heatmap,
// computed in the user's IANA timezone (users.timezone, set at sign-up).

export function localDay(at: number, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  } catch {
    return new Date(at).toISOString().slice(0, 10)
  }
  let get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The day `n` days after `day` (negative for before). */
export function addDays(day: string, n: number): string {
  let date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

/**
 * The streak to show today: the stored run counts only while its last day is
 * today or yesterday.
 */
export function currentStreak(user: { streak_days: number; streak_last_day: string | null; timezone: string }, now = Date.now()): number {
  if (!user.streak_last_day) return 0
  let today = localDay(now, user.timezone)
  return user.streak_last_day >= addDays(today, -1) ? user.streak_days : 0
}
