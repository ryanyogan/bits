import type { AuthorPerson, AuthorsOverview, CourseAuthorList, OpenAuthorInvite } from '@bits/db'
import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Callout, type CalloutTone } from '@bits/ui/callout'
import { CellGrid } from '@bits/ui/cell-grid'
import { ChoiceChip } from '@bits/ui/chip'
import { EmptyState } from '@bits/ui/empty-state'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { Panel } from '@bits/ui/panel'
import { RuledSection } from '@bits/ui/ruled-section'
import { inputStyle, TextField } from '@bits/ui/text-field'

import type { Viewer } from '../../../auth/identity.ts'
import { APP_NAME } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { PageHead } from '../../../ui/page-head.tsx'

export type AdminSection = 'invite' | 'invites' | 'people' | 'courses'

export interface AdminNotice {
  tone: CalloutTone
  text: string
}

/** The one form that failed (422), with what was typed. */
export interface AdminErrors {
  section: AdminSection
  message: string
  /** The invalid field, for the danger border and focus. */
  field?: 'email'
  values?: { email?: string; courses?: string[] }
  /** The course whose form failed. */
  course?: string
}

export interface AdminAuthorsPageProps {
  viewer: Viewer
  /** The admin's IANA zone, for invite expiry dates. */
  timeZone: string
  overview: AuthorsOverview
  currentPath: string
  notice?: AdminNotice
  errors?: AdminErrors
}

/** `/admin/authors` (decision 037). Every action is a plain POST form. */
export function AdminAuthorsPage(handle: Handle<AdminAuthorsPageProps>) {
  return () => {
    let { viewer, timeZone, overview, currentPath, notice, errors } = handle.props
    let failed = (section: AdminSection) =>
      errors?.section === section ? (
        <Callout tone="danger" role="alert" compact>
          {errors.message}
        </Callout>
      ) : null
    let chosen = new Set(errors?.section === 'invite' ? (errors.values?.courses ?? []) : [])

    return (
      <Layout title="Authors" description={`Who writes ${APP_NAME} courses.`} viewer={viewer} currentPath={currentPath}>
        <PageFrame>
          <PageHead
            label="Admin"
            title="Authors"
            lead="Invite someone to write courses, and choose who works on which course. Invites go by email and only work for that address."
          >
            {/* Always rendered, so a notice that arrives with the page is in a live region (decision 031). */}
            <div role="status" mix={noticeSlotStyle}>
              {notice ? <Callout tone={notice.tone}>{notice.text}</Callout> : null}
            </div>
          </PageHead>

          <RuledSection as="div" pad="none">
          <CellGrid cols={2} colsMid={1} pad={false}>
              <Section id="invite" title="Invite an author" description="They get a link for 7 days. Accepting makes them an author; an admin stays an admin.">
                {/* Keyed by the newest invite: after a send the client navigation gives a blank form, not the old values. */}
                <form
                  method="post"
                  action={routes.admin.authors.invite.href()}
                  data-rmx-key={`invite-${overview.invites[0]?.id ?? 'none'}`}
                  mix={formStyle}
                  noValidate
                >
                  {failed('invite')}
                  <TextField
                    name="email"
                    label="Email address"
                    type="email"
                    mono
                    autoComplete="off"
                    inputMode="email"
                    maxLength={254}
                    required
                    value={errors?.section === 'invite' ? errors.values?.email : undefined}
                    error={errors?.section === 'invite' && errors.field === 'email' ? errors.message : undefined}
                    autoFocus={errors?.section === 'invite' && errors.field === 'email'}
                  />
                  {overview.courses.length ? (
                    <fieldset mix={fieldsetStyle}>
                      <legend mix={legendStyle}>Courses to join (optional)</legend>
                      <div mix={chipsStyle}>
                        {overview.courses.map((course) => (
                          <ChoiceChip key={course.slug} name="courses" value={course.slug} defaultChecked={chosen.has(course.slug)}>
                            {course.title}
                          </ChoiceChip>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <div mix={footerStyle}>
                    <Keycap type="submit" mix={footerKeyStyle}>
                      Send invite →
                    </Keycap>
                  </div>
                </form>
              </Section>

              <Section id="invites" title="Open invites" description="Waiting to be accepted. Withdrawing one stops its link working.">
                {failed('invites')}
                {overview.invites.length ? (
                  <ul mix={listStyle}>
                    {overview.invites.map((invite) => (
                      <li key={invite.id}>
                        <InviteRow invite={invite} timeZone={timeZone} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No open invites." hint="Invites you send show here until they’re accepted." />
                )}
              </Section>

              <Section id="people" title="Authors and admins" description="Removing the author role also takes them off every course.">
                {failed('people')}
                {overview.people.length ? (
                  <ul mix={listStyle}>
                    {overview.people.map((person) => (
                      <li key={person.id}>
                        <PersonRow person={person} self={person.id === viewer.id} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No authors yet." />
                )}
              </Section>

              <Section id="courses" title="Courses" description="Who can build and publish each course. Admins can manage every course anyway.">
                {failed('courses')}
                {overview.courses.length ? (
                  <ul mix={listStyle}>
                    {overview.courses.map((course) => (
                      <li key={course.slug}>
                        <CourseAuthors course={course} people={overview.people} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No courses yet." hint="Courses appear here after their first upload." />
                )}
              </Section>
          </CellGrid>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

interface SectionProps {
  id: AdminSection
  title: string
  description: string
  children?: RemixNode
}

/**
 * One cell of the 2-up grid (decision 047): a `Panel`, whose strip heading
 * carries the section's id (the redirects land on `#invites` and so on),
 * then the description and the section's controls.
 */
function Section(handle: Handle<SectionProps>) {
  return () => {
    let { id, title, description, children } = handle.props
    return (
      <Panel id={id} title={title}>
        <div mix={sectionStyle}>
          <p mix={descriptionStyle}>{description}</p>
          {children}
        </div>
      </Panel>
    )
  }
}

function InviteRow(handle: Handle<{ invite: OpenAuthorInvite; timeZone: string }>) {
  return () => {
    let { invite, timeZone } = handle.props
    let expires = new Date(invite.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone })
    let courses = invite.course_titles
    let meta = [
      `expires ${expires}`,
      invite.invited_by_handle ? `from @${invite.invited_by_handle}` : null,
      courses.length ? courses.join(', ') : 'no courses',
    ]
      .filter(Boolean)
      .join(' · ')
    return (
      <div mix={rowStyle}>
        <span mix={bodyStyle}>
          <span mix={emailStyle}>{invite.email}</span>
          <span mix={metaStyle}>{meta}</span>
        </span>
        <form method="post" action={routes.admin.authors.revoke.href()} mix={rowFormStyle}>
          <input type="hidden" name="invite" value={invite.id} />
          <Keycap type="submit" variant="ghost" size="sm">
            Withdraw<span class="sr-only"> the invite to {invite.email}</span>
          </Keycap>
        </form>
      </div>
    )
  }
}

function PersonRow(handle: Handle<{ person: AuthorPerson; self: boolean }>) {
  return () => {
    let { person, self } = handle.props
    let name = person.display_name || person.handle
    return (
      <div mix={rowStyle}>
        <span mix={bodyStyle}>
          <span mix={nameStyle}>
            {name} <span mix={handleStyle}>@{person.handle}</span>
          </span>
          <span mix={metaStyle}>
            {person.role}
            {self ? ' · you' : ''} · {person.email}
          </span>
        </span>
        {self ? null : (
          <form method="post" action={routes.admin.authors.role.href()} mix={rowFormStyle}>
            <input type="hidden" name="user" value={person.id} />
            <input type="hidden" name="from" value={person.role} />
            <Keycap type="submit" variant="ghost" size="sm">
              {person.role === 'admin' ? 'Remove admin role' : 'Remove author role'}
              <span class="sr-only"> from @{person.handle}</span>
            </Keycap>
          </form>
        )}
      </div>
    )
  }
}

function CourseAuthors(handle: Handle<{ course: CourseAuthorList; people: AuthorPerson[] }>) {
  return () => {
    let { course, people } = handle.props
    let on = new Set(course.authors.map((author) => author.id))
    let candidates = people.filter((person) => !on.has(person.id))
    let selectId = `add-${course.slug}`
    return (
      <div mix={courseStyle}>
        <span mix={courseHeadStyle}>
          <span mix={nameStyle}>{course.title}</span>
          <span mix={metaStyle}>{course.slug}</span>
        </span>
        {course.authors.length ? (
          <ul mix={authorListStyle}>
            {course.authors.map((author) => (
              <li key={author.id} mix={authorItemStyle}>
                <span mix={handleStyle}>@{author.handle}</span>
                <form method="post" action={routes.admin.authors.course.href()} mix={rowFormStyle}>
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="course" value={course.slug} />
                  <input type="hidden" name="user" value={author.id} />
                  <Keycap type="submit" variant="ghost" size="sm">
                    Remove<span class="sr-only"> @{author.handle} from {course.title}</span>
                  </Keycap>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p mix={descriptionStyle}>No authors listed. Admins can still manage it.</p>
        )}
        {candidates.length ? (
          <form method="post" action={routes.admin.authors.course.href()} mix={addFormStyle}>
            <input type="hidden" name="intent" value="add" />
            <input type="hidden" name="course" value={course.slug} />
            <label for={selectId} mix={labelStyle}>
              Add an author to {course.title}
            </label>
            <div mix={addRowStyle}>
              <select id={selectId} name="user" mix={[inputStyle, selectStyle]}>
                {candidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    @{person.handle} ({person.role})
                  </option>
                ))}
              </select>
              <Keycap type="submit" variant="dark" size="sm">
                Add
              </Keycap>
            </div>
          </form>
        ) : null}
      </div>
    )
  }
}

const noticeSlotStyle = css({ width: '100%', '&:not(:empty)': { paddingTop: 'var(--space-2)' } })
// Each section is a cell of a 2-up grid sharing hairlines (decision 047).
const sectionStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4_5)' })
const descriptionStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
const formStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4_5)' })
const fieldsetStyle = css({ margin: 0, padding: 0, border: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2_5)', minWidth: 0 })
const legendStyle = css({ padding: 0, marginBottom: 'var(--space-2_5)', fontSize: 'var(--fs-14)', color: 'var(--text-body)' })
const labelStyle = css({ fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const chipsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })
const footerStyle = css({ display: 'flex' })
const footerKeyStyle = css({ '@media (max-width: 480px)': { flex: '1 1 100%' } })
// One box of rows sharing hairlines, not a stack of cards (decision 047).
const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  border: 'var(--border-w) solid var(--line-cell)',
  background: 'var(--well)',
  '& > li + li': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText', '& > li + li': { borderColor: 'GrayText' } },
})
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
})
const courseStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
})
const bodyStyle = css({ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
// In the column-flex course card a flex-basis would become a height.
const courseHeadStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const nameStyle = css({ fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' })
const emailStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: 'var(--text)', overflowWrap: 'anywhere' })
const handleStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', fontWeight: 400, color: 'var(--muted)' })
const metaStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)', overflowWrap: 'anywhere' })
const rowFormStyle = css({ margin: 0, marginLeft: 'auto' })
const authorListStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const authorItemStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 })
const addFormStyle = css({ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)' })
const addRowStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', '& > select': { flex: '1 1 auto' } })
const selectStyle = css({
  minHeight: 'var(--touch-target)',
  minWidth: 0,
  padding: '0 var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  // A select is :read-only to CSS; keep the solid border.
  '&:read-only:not(:disabled)': { borderStyle: 'solid' },
})
