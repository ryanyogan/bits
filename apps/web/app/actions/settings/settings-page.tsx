import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Callout, type CalloutTone } from '@bits/ui/callout'
import { Card } from '@bits/ui/card'
import { CodeInput } from '@bits/ui/code-input'
import { Eyebrow, MonoHeading } from '@bits/ui/eyebrow'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { KeyValueList } from '@bits/ui/key-value-list'
import { Switch } from '@bits/ui/switch'
import { Tag } from '@bits/ui/tag'
import { TextField } from '@bits/ui/text-field'

import type { Viewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { GeneratedAvatar } from '../profile/ui/generated-avatar.tsx'
import type { AccountSettings } from './data.ts'
import { AddPasskey } from './public/add-passkey.tsx'
import { DeleteConfirm } from './public/delete-confirm.tsx'
import { summaryStyle } from './ui/confirm-disclosure.tsx'
import { HandleField } from './ui/handle-field.tsx'
import { MethodRow } from './ui/method-row.tsx'
import { ReauthBlock } from './ui/reauth-block.tsx'
import { Layout } from '../../ui/layout.tsx'

export type SettingsSection = 'profile' | 'email' | 'sign-in' | 'data' | 'sessions' | 'danger'

export interface SettingsNotice {
  section: SettingsSection
  tone: CalloutTone
  text: string
}

/** Field errors and submitted values for the one form that failed (422). */
export interface SettingsErrors {
  section: SettingsSection
  fields: Record<string, string | undefined>
  values: Record<string, string>
}

export interface SettingsPageProps {
  viewer: Viewer
  account: AccountSettings
  /** Signed in within the last 10 minutes: email change and new passkeys need it (decision 030). */
  recentAuth: boolean
  notice?: SettingsNotice
  errors?: SettingsErrors
}

const outline: Array<{ id: SettingsSection; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'email', label: 'Email' },
  { id: 'sign-in', label: 'Sign-in methods' },
  { id: 'data', label: 'Your data' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'danger', label: 'Delete account' },
]

/** `/settings` (docs/design/spec/pages/Settings.md). Every action is a plain POST form. */
export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { viewer, account, recentAuth, notice, errors } = handle.props
    let err = (section: SettingsSection, field: string) =>
      errors?.section === section ? errors.fields[field] : undefined
    let val = (section: SettingsSection, field: string, fallback: string) =>
      errors?.section === section ? (errors.values[field] ?? fallback) : fallback
    let failed = (section: SettingsSection) =>
      errors?.section === section ? (
        <Callout tone="danger" role="alert" compact>
          Check the highlighted field.
        </Callout>
      ) : null

    let visibility = val('profile', 'visibility', viewer.isPublic ? 'public' : 'private')
    let profileHandle = viewer.handle
    let passkeyCount = account.methods.filter((m) => m.kind === 'passkey').length

    return (
      <Layout title="Settings" description="Your sign-in, your profile, your data." viewer={viewer} bleed>
        <div mix={pageStyle}>
          <header mix={headerStyle}>
            <Eyebrow as="p">Account</Eyebrow>
            <h1 mix={titleStyle}>Settings</h1>
            <p mix={leadStyle}>
              Your sign-in, your profile, your data. Everything here is yours to change or take with you.
            </p>
          </header>

          <div role="status" mix={noticeSlotStyle}>
            {notice ? (
              <Callout tone={notice.tone} title={noticeTitles[notice.section]}>
                {notice.text}
              </Callout>
            ) : null}
          </div>

          <div mix={panesStyle}>
            <div mix={columnStyle}>
              {/* 1. Profile */}
              <Section id="profile" title="Profile" description="How you appear on bits. Your email is never shown.">
                <div mix={identityStyle}>
                  <span mix={avatarStyle}>
                    <GeneratedAvatar seed={viewer.handle} name={viewer.name.split(' ')[0]!} />
                  </span>
                  <span mix={identityTextStyle}>
                    <span mix={identityNameStyle}>{viewer.name}</span>
                    <span mix={identityHandleStyle}>@{viewer.handle}</span>
                  </span>
                </div>
                <form method="post" action={routes.settings.profile.href()} mix={formStyle} noValidate>
                  {failed('profile')}
                  <TextField
                    name="name"
                    label="Display name"
                    value={val('profile', 'name', viewer.name)}
                    error={err('profile', 'name')}
                    autoComplete="name"
                    maxLength={60}
                    required
                    autoFocus={Boolean(err('profile', 'name'))}
                  />
                  <HandleField
                    name="handle"
                    label="Handle"
                    prefix="bits.dev/u/"
                    value={val('profile', 'handle', viewer.handle)}
                    error={err('profile', 'handle')}
                    hint="Letters, numbers, dashes and underscores. Changing it breaks old links."
                    autoFocus={Boolean(err('profile', 'handle')) && !err('profile', 'name')}
                  />
                  <div mix={visibilityStyle}>
                    <Switch
                      name="visibility"
                      legend="Profile visibility"
                      options={[
                        { value: 'public', label: 'Public' },
                        { value: 'private', label: 'Private' },
                      ]}
                      value={visibility}
                    />
                    <p mix={noteStyle}>
                      Public profiles show your name, level, stats, activity, courses and badges. Your email and
                      prompt journal are never shown.
                    </p>
                    {viewer.isPublic ? (
                      <a href={routes.profile.index.href({ handle: profileHandle })} mix={monoLinkStyle}>
                        View public profile →
                      </a>
                    ) : null}
                  </div>
                  <div mix={footerStyle}>
                    <Keycap type="submit" mix={footerKeyStyle}>
                      Save profile
                    </Keycap>
                  </div>
                </form>
              </Section>

              {/* 2. Email */}
              <Section id="email" title="Email" description="Where your sign-in links and codes go.">
                <KeyValueList
                  mix={centeredTermsStyle}
                  items={[
                    {
                      term: 'Email',
                      value: (
                        <span mix={emailValueStyle}>
                          <span>{viewer.email}</span>
                          {account.verified ? (
                            <Tag variant="meta" mix={verifiedStyle}>
                              verified
                            </Tag>
                          ) : (
                            <Tag variant="meta" mix={unverifiedStyle}>
                              unverified
                            </Tag>
                          )}
                        </span>
                      ),
                      mono: true,
                    },
                  ]}
                />
                {account.pendingEmail ? (
                  <div mix={pendingStyle}>
                    <div mix={pendingHeadStyle}>
                      <span aria-hidden="true" mix={pendingTileStyle}>
                        <Icon name="mail" />
                      </span>
                      <p mix={pendingTextStyle}>
                        Check <span mix={pendingEmailStyle}>{account.pendingEmail}</span> for a link to confirm the
                        change, or type the 6-digit code from that email.
                      </p>
                    </div>
                    <form method="post" action={routes.settings.emailConfirm.href()} mix={formStyle} noValidate>
                      <CodeInput
                        name="code"
                        label="6-digit code"
                        value={val('email', 'code', '')}
                        error={err('email', 'code')}
                        autoFocus={Boolean(err('email', 'code'))}
                      />
                      <div mix={footerStyle}>
                        <Keycap type="submit" mix={footerKeyStyle}>
                          Confirm new email
                        </Keycap>
                      </div>
                    </form>
                    <form method="post" action={routes.settings.email.href()}>
                      <Keycap type="submit" variant="ghost-mono" name="intent" value="cancel" mix={footerKeyStyle}>
                        Keep {viewer.email}
                      </Keycap>
                    </form>
                  </div>
                ) : null}
                {recentAuth ? (
                  <details mix={disclosureStyle} open={err('email', 'email') ? true : undefined}>
                    <summary mix={summaryStyle}>{account.pendingEmail ? 'Use a different address' : 'Change email'}</summary>
                    <form method="post" action={routes.settings.email.href()} mix={formStyle} noValidate>
                      <TextField
                        name="email"
                        label="New email"
                        type="email"
                        placeholder="you@somewhere.dev"
                        value={val('email', 'email', '')}
                        error={err('email', 'email')}
                        autoComplete="email"
                        inputMode="email"
                        enterKeyHint="send"
                        required
                        mono
                        autoFocus={Boolean(err('email', 'email'))}
                      />
                      <div mix={footerStyle}>
                        <Keycap type="submit" mix={footerKeyStyle}>
                          Send confirmation link →
                        </Keycap>
                      </div>
                    </form>
                  </details>
                ) : (
                  <ReauthBlock what="change your email" email={viewer.email} />
                )}
              </Section>

              {/* 3. Sign-in methods */}
              <Section id="sign-in" title="Sign-in methods" description="Use any of these to get in. Keep at least one.">
                <ul mix={methodListStyle}>
                  {account.methods.map((method) => (
                    <MethodRow key={method.id} method={method} />
                  ))}
                </ul>
                {recentAuth ? (
                  <form method="post" action={routes.settings.methods.href()}>
                    <AddPasskey optionsUrl={routes.api.passkey.href({ step: 'register-options' })} />
                  </form>
                ) : (
                  <ReauthBlock what="add a passkey" email={viewer.email} />
                )}
                <p mix={noteStyle}>
                  {passkeyCount === 1 ? 'You have 1 passkey.' : `You have ${passkeyCount} passkeys.`} Email sign-in
                  always works, so you can't lock yourself out.
                </p>
              </Section>

              {/* 4. Your data */}
              <Section
                id="data"
                title="Your data"
                description="Download everything you've done here: progress, neurons, badges and every prompt in your journal, as one JSON file."
              >
                <div mix={footerStyle}>
                  <Keycap variant="dark" href={routes.settings.export.href()} download mix={footerKeyStyle}>
                    Download my data (.json)
                  </Keycap>
                </div>
                <p mix={metaStyle}>
                  {account.export.size} · includes {account.export.prompts} prompts
                </p>
              </Section>

              {/* 5. Sessions */}
              <Section
                id="sessions"
                title="Sessions"
                description={account.sessions.length === 1 ? "You're signed in on 1 device." : `You're signed in on ${account.sessions.length} devices.`}
              >
                <KeyValueList
                  items={account.sessions.map((session) => ({
                    term: session.current ? 'This device' : 'Device',
                    value: `${session.label} · ${session.when}`,
                    mono: true,
                  }))}
                />
                <form method="post" action={routes.settings.sessions.href()} mix={sessionsFormStyle}>
                  <div mix={footerStyle}>
                    <Keycap type="submit" variant="dark" aria-describedby="sessions-hint" mix={footerKeyStyle}>
                      Sign out everywhere
                    </Keycap>
                  </div>
                  <p id="sessions-hint" mix={noteStyle}>
                    Including this device.
                  </p>
                </form>
              </Section>

              {/* 6. Delete account */}
              <Section
                id="danger"
                title="Delete account"
                danger
                description={
                  <span mix={dangerCopyStyle}>
                    This permanently deletes your account, sign-in methods, sessions, progress, neurons, badges and
                    prompt journal. It can't be undone. Download your data first if you want a copy.
                  </span>
                }
              >
                <details mix={disclosureStyle} open={errors?.section === 'danger' ? true : undefined}>
                  <summary mix={summaryStyle}>Delete my account…</summary>
                  <form method="post" action={routes.settings.deleteAccount.href()} mix={formStyle} noValidate>
                    <DeleteConfirm
                      handle={viewer.handle}
                      value={val('danger', 'confirm', '')}
                      error={err('danger', 'confirm')}
                    />
                  </form>
                </details>
              </Section>
            </div>

            <aside mix={asideStyle} aria-labelledby="settings-outline">
              <Card variant="compact" mix={outlineCardStyle}>
                <MonoHeading id="settings-outline" mix={outlineHeadingStyle}>
                  On this page
                </MonoHeading>
                <nav aria-labelledby="settings-outline">
                  <ul mix={outlineListStyle}>
                    {outline.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`} mix={outlineLinkStyle}>
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>
            </aside>
          </div>
        </div>
      </Layout>
    )
  }
}

interface SectionProps {
  id: SettingsSection
  title: string
  description: RemixNode
  danger?: boolean
  children?: RemixNode
}

/** SectionCard (24px, radius 20, gap 18) with a MonoHeading `<h2>` and description. */
function Section(handle: Handle<SectionProps>) {
  return () => {
    let { id, title, description, danger, children } = handle.props
    let headingId = `${id}-heading`
    return (
      <Card
        as="section"
        variant={danger ? 'dashed' : 'page'}
        labelledBy={headingId}
        mix={[sectionStyle, danger ? dangerSectionStyle : undefined]}
      >
        <div mix={sectionHeadStyle} id={id}>
          <MonoHeading id={headingId} mix={danger ? dangerHeadingStyle : undefined}>
            {title}
          </MonoHeading>
          <p mix={descriptionStyle}>{description}</p>
        </div>
        {children}
      </Card>
    )
  }
}

// Settings §2: the check-inbox pattern from /login/check, inline.
const pendingStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: '1px solid var(--line-strong)',
  background: 'var(--well)',
})

const pendingHeadStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3_5)' })

const pendingTileStyle = css({
  flex: 'none',
  width: '64px',
  height: '64px',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--volt-tint)',
  border: '1px solid var(--volt-a40)',
  display: 'grid',
  placeItems: 'center',
  '@media (max-width: 480px)': { width: '48px', height: '48px' },
})

const pendingTextStyle = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })

const pendingEmailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })

const pageStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-10)',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--space-4) var(--space-16)', gap: 'var(--space-7)' },
})

const headerStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })

const titleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 5vw, 64px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
})

const leadStyle = css({
  margin: 0,
  maxWidth: '60ch',
  fontSize: 'var(--fs-18)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
})

const panesStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', alignItems: 'flex-start' })

const columnStyle = css({
  flex: '999 1 600px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
})

const asideStyle = css({
  flex: '1 1 320px',
  minWidth: 0,
  position: 'sticky',
  top: 'calc(var(--shell-h) + var(--space-4))',
  '@media (max-width: 951px)': { position: 'static' },
  '@media (max-width: 820px)': { display: 'none' },
})

const outlineCardStyle = css({ gap: 'var(--space-1)' })

const outlineHeadingStyle = css({ padding: '0 var(--space-3) var(--space-2_5)' })

const outlineListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
})

const outlineLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-1_5) var(--space-3)',
  borderRadius: 'var(--radius-10)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text-body)',
  textDecoration: 'none',
  '&:hover': { background: 'var(--fill-hover)', color: 'var(--text)' },
})

const sectionStyle = css({
  padding: 'var(--space-6)',
  '@media (max-width: 480px)': { padding: 'var(--space-4_5)' },
})

const dangerSectionStyle = css({
  gap: 'var(--space-4_5)',
  border: '1px dashed var(--danger-a35)',
  background: 'var(--danger-a04)',
})

const sectionHeadStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })

const dangerHeadingStyle = css({ color: 'var(--danger)' })

const descriptionStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })

const dangerCopyStyle = css({ display: 'block', fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })

const identityStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' })

// The Profile avatar (148px SVG) scaled to 64px.
const avatarStyle = css({
  flex: 'none',
  width: '64px',
  height: '64px',
  '& svg': { display: 'block', width: '64px', height: '64px' },
})

const identityTextStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 })
const identityNameStyle = css({ fontSize: 'var(--fs-16)', fontWeight: 600, color: 'var(--text)' })
const identityHandleStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })

const formStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4_5)' })

const visibilityStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })

const noteStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--muted)' })

const metaStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })

const monoLinkStyle = css({
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  textDecoration: 'none',
  '&:hover': { color: 'var(--volt-link-hover)' },
})

// Section footers: right-aligned on desktop, full width on phones.
const footerStyle = css({ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)' })
const footerKeyStyle = css({ '@media (max-width: 480px)': { flex: '1 1 100%' } })

const sessionsFormStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'stretch', '& p': { textAlign: 'right' }, '@media (max-width: 480px)': { '& p': { textAlign: 'left' } } })

const emailValueStyle = css({ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2_5)' })
const verifiedStyle = css({ borderColor: 'var(--volt-a40)', color: 'var(--volt)' })
const unverifiedStyle = css({ borderColor: 'var(--warn-line)', color: 'var(--warn)' })

// The open content sits in the ::details-content slot, so stretch the items
// and keep only the summary at its own width.
const disclosureStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 'var(--space-4)',
  '& > summary': { alignSelf: 'flex-start' },
})

const methodListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
})

const centeredTermsStyle = css({ '& dt': { alignSelf: 'center' } })

const noticeTitles: Record<SettingsSection, string> = {
  profile: 'Profile',
  email: 'Email',
  'sign-in': 'Sign-in methods',
  data: 'Your data',
  sessions: 'Sessions',
  danger: 'Delete account',
}

const noticeSlotStyle = css({ '&:empty': { display: 'none' }, marginBottom: 'calc(var(--space-6) * -1)', '@media (max-width: 480px)': { marginBottom: 'calc(var(--space-3) * -1)' } })
