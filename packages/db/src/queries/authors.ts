// Who may write courses (decision 037): the author role, per-course
// authorship and the invites an admin sends to make someone an author.
//
// Every write that an admin makes re-checks, inside its own statement, that
// the acting user is still an admin, so a demoted admin's in-flight form
// changes nothing.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { UserRole } from '../tables.ts'

/** How long an invite link works. */
export const AUTHOR_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** A user who can author: role author or admin. */
export interface AuthorPerson {
  id: string
  email: string
  handle: string
  display_name: string
  role: UserRole
}

/** An invite that can still be accepted. */
export interface OpenAuthorInvite {
  id: string
  token_hash: string
  email: string
  courses: string[]
  /** Titles of the courses that still exist. */
  course_titles: string[]
  invited_by: string | null
  /** The inviter's handle, when they still exist. */
  invited_by_handle: string | null
  expires_at: number
  created_at: number
}

export interface CourseAuthorList {
  slug: string
  title: string
  authors: AuthorPerson[]
}

/** Everything /admin/authors shows. */
export interface AuthorsOverview {
  people: AuthorPerson[]
  invites: OpenAuthorInvite[]
  courses: CourseAuthorList[]
}

const open = (alias: string, now: string) =>
  `${alias}.accepted_at is null and ${alias}.revoked_at is null and ${alias}.expires_at > ${now}`

// The invite `i`, its inviter's handle (`u`), and its courses' titles in the invite's order.
const inviteColumns = `i.id, i.token_hash, i.email, i.courses, i.invited_by, u.handle as invited_by_handle,
  i.expires_at, i.created_at,
  (select json_group_array(c.title) from json_each(i.courses) j join courses c on c.slug = j.value) as course_titles`

type InviteRow = Omit<OpenAuthorInvite, 'courses' | 'course_titles'> & { courses: string; course_titles: string }

function strings(text: string): string[] {
  try {
    let parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function toInvite(row: InviteRow): OpenAuthorInvite {
  return { ...row, courses: strings(row.courses), course_titles: strings(row.course_titles) }
}

/** Authors and admins, open invites, and every course with its authors: one batch. */
export async function readAuthorsOverview(db: D1DataTableDatabase, now: number): Promise<AuthorsOverview> {
  let d1 = db.d1
  let [people, invites, courses, authors] = await db.batch<Record<string, unknown>>([
    d1.prepare(
      `select id, email, handle, display_name, role from users
       where role in ('author', 'admin') order by role = 'admin' desc, handle`,
    ),
    d1
      .prepare(
        `select ${inviteColumns}
         from author_invites i left join users u on u.id = i.invited_by
         where ${open('i', '?1')} order by i.created_at desc`,
      )
      .bind(now),
    d1.prepare('select slug, title from courses order by sort, slug'),
    d1.prepare(
      `select a.course_slug, u.id, u.email, u.handle, u.display_name, u.role
       from course_authors a join users u on u.id = a.user_id order by a.created_at, u.handle`,
    ),
  ])
  let bySlug = new Map<string, CourseAuthorList>()
  for (let row of (courses?.results ?? []) as unknown as { slug: string; title: string }[]) {
    bySlug.set(row.slug, { slug: row.slug, title: row.title, authors: [] })
  }
  for (let row of (authors?.results ?? []) as unknown as (AuthorPerson & { course_slug: string })[]) {
    let { course_slug, ...person } = row
    bySlug.get(course_slug)?.authors.push(person)
  }
  return {
    people: (people?.results ?? []) as unknown as AuthorPerson[],
    invites: ((invites?.results ?? []) as unknown as InviteRow[]).map(toInvite),
    courses: [...bySlug.values()],
  }
}

export interface AuthorInviteInput {
  id: string
  tokenHash: string
  email: string
  /** Course slugs; unknown ones are dropped. */
  courses: string[]
  adminId: string
  expiresAt: number
  now: number
}

/**
 * Stores an invite, withdrawing any open invite to the same address (one
 * open invite per address, so only the newest link works). Returns false,
 * writing nothing, when `adminId` is no longer an admin.
 */
export async function insertAuthorInvite(db: D1DataTableDatabase, input: AuthorInviteInput): Promise<boolean> {
  let d1 = db.d1
  let admin = `exists (select 1 from users where id = ?1 and role = 'admin')`
  let [, inserted] = await db.batch([
    d1
      .prepare(`update author_invites set revoked_at = ?2 where email = ?3 and ${open('author_invites', '?2')} and ${admin}`)
      .bind(input.adminId, input.now, input.email),
    d1
      .prepare(
        `insert into author_invites (id, token_hash, email, courses, invited_by, expires_at, created_at)
         select ?2, ?3, ?4,
           (select json_group_array(slug) from courses where slug in (select value from json_each(?5))),
           ?1, ?6, ?7
         where ${admin}`,
      )
      .bind(input.adminId, input.id, input.tokenHash, input.email, JSON.stringify(input.courses), input.expiresAt, input.now),
  ])
  return (inserted?.meta.changes ?? 0) > 0
}

/** The open invite behind a link's token hash, without spending it. */
export async function findOpenAuthorInvite(db: D1DataTableDatabase, tokenHash: string, now: number): Promise<OpenAuthorInvite | null> {
  let row = await db.d1
    .prepare(
      `select ${inviteColumns}
       from author_invites i left join users u on u.id = i.invited_by
       where i.token_hash = ?1 and ${open('i', '?2')}`,
    )
    .bind(tokenHash, now)
    .first<InviteRow>()
  return row ? toInvite(row) : null
}

/**
 * Spends an invite for `userId`, in one batch: only while it is open and
 * addressed to the user's current email. Grants `author` to a learner
 * (never touches an author or admin) and adds the user to the invite's
 * courses that still exist. False when nothing was spent.
 */
export async function acceptAuthorInvite(
  db: D1DataTableDatabase,
  input: { tokenHash: string; userId: string; now: number },
): Promise<boolean> {
  let d1 = db.d1
  // ?1 token hash, ?2 now, ?3 user id. The follow-up statements run only
  // for the row this batch just spent.
  let spent = `exists (select 1 from author_invites where token_hash = ?1 and accepted_by = ?3 and accepted_at = ?2)`
  let [accepted] = await db.batch([
    d1
      .prepare(
        `update author_invites set accepted_at = ?2, accepted_by = ?3
         where token_hash = ?1 and ${open('author_invites', '?2')}
           and email = (select email from users where id = ?3)`,
      )
      .bind(input.tokenHash, input.now, input.userId),
    d1
      .prepare(`update users set role = 'author', updated_at = ?2 where id = ?3 and role = 'learner' and ${spent}`)
      .bind(input.tokenHash, input.now, input.userId),
    d1
      .prepare(
        `insert or ignore into course_authors (course_slug, user_id, created_at)
         select c.slug, ?3, ?2 from author_invites i, json_each(i.courses) j join courses c on c.slug = j.value
         where i.token_hash = ?1 and i.accepted_by = ?3 and i.accepted_at = ?2`,
      )
      .bind(input.tokenHash, input.now, input.userId),
  ])
  return (accepted?.meta.changes ?? 0) > 0
}

/** Withdraws an open invite. False when it wasn't open or `adminId` isn't an admin. */
export async function revokeAuthorInvite(
  db: D1DataTableDatabase,
  input: { id: string; adminId: string; now: number },
): Promise<boolean> {
  let result = await db.d1
    .prepare(
      `update author_invites set revoked_at = ?2
       where id = ?3 and ${open('author_invites', '?2')}
         and exists (select 1 from users where id = ?1 and role = 'admin')`,
    )
    .bind(input.adminId, input.now, input.id)
    .run()
  return result.meta.changes > 0
}

/**
 * Steps a user down one role: an admin to author, an author to learner
 * (which also takes them off every course). Never the acting admin
 * themselves. False when nothing changed.
 */
export async function demoteAuthor(
  db: D1DataTableDatabase,
  input: { userId: string; from: 'admin' | 'author'; adminId: string; now: number },
): Promise<boolean> {
  let d1 = db.d1
  let to = input.from === 'admin' ? 'author' : 'learner'
  let guard = `?2 != ?1 and exists (select 1 from users where id = ?1 and role = 'admin')`
  let statements = [
    d1
      .prepare(`update users set role = ?4, updated_at = ?5 where id = ?2 and role = ?3 and ${guard}`)
      .bind(input.adminId, input.userId, input.from, to, input.now),
  ]
  if (to === 'learner') {
    // Runs after the update in the same transaction: only once the user is a learner.
    statements.push(
      d1
        .prepare(
          `delete from course_authors where user_id = ?2
           and exists (select 1 from users where id = ?2 and role = 'learner') and ${guard}`,
        )
        .bind(input.adminId, input.userId),
    )
  }
  let [updated] = await db.batch(statements)
  return (updated?.meta.changes ?? 0) > 0
}

/** Adds an author or admin to a course. False when it changed nothing. */
export async function addCourseAuthor(
  db: D1DataTableDatabase,
  input: { slug: string; userId: string; adminId: string; now: number },
): Promise<boolean> {
  let result = await db.d1
    .prepare(
      `insert or ignore into course_authors (course_slug, user_id, created_at)
       select c.slug, u.id, ?4 from courses c, users u
       where c.slug = ?2 and u.id = ?3 and u.role in ('author', 'admin')
         and exists (select 1 from users where id = ?1 and role = 'admin')`,
    )
    .bind(input.adminId, input.slug, input.userId, input.now)
    .run()
  return result.meta.changes > 0
}

/** Takes a user off a course. False when they weren't on it. */
export async function removeCourseAuthor(
  db: D1DataTableDatabase,
  input: { slug: string; userId: string; adminId: string },
): Promise<boolean> {
  let result = await db.d1
    .prepare(
      `delete from course_authors where course_slug = ?2 and user_id = ?3
       and exists (select 1 from users where id = ?1 and role = 'admin')`,
    )
    .bind(input.adminId, input.slug, input.userId)
    .run()
  return result.meta.changes > 0
}
