// The flash an accepted author invite leaves for /author (decision 068): the
// titles of the courses the new author joined (maybe none).
export const AUTHOR_WELCOME_KEY = 'author:welcome'

/** The welcome line for /author, once, after accepting an invite. */
export function authorWelcome(flashed: unknown): string | undefined {
  if (!Array.isArray(flashed)) return undefined
  let titles = flashed.filter((title): title is string => typeof title === 'string')
  return titles.length
    ? `You’re an author now, on ${titles.join(', ')}. Your courses are below.`
    : 'You’re an author now. Upload a course folder below to make your first build.'
}
