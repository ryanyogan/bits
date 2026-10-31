import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { Callout, type CalloutTone } from '@bits/ui/callout'
import { CodeInput } from '@bits/ui/code-input'
import { MonoHeading } from '@bits/ui/eyebrow'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { KeyValueList } from '@bits/ui/key-value-list'
import { Switch } from '@bits/ui/switch'
import { Tag } from '@bits/ui/tag'
import { themePreference } from '@bits/ui/theme'
import { TextField } from '@bits/ui/text-field'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

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
import { PageHead } from '../../ui/page-head.tsx'

export type SettingsSection = 'profile' | 'appearance' | 'email' | 'sign-in' | 'data' | 'sessions' | 'danger'

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
  /** Signed in within the last 10 minutes: email change, new passkeys and connecting a provider need it (decision 030). */
  recentAuth: boolean
  notice?: SettingsNotice
  errors?: SettingsErrors
}

const outline: Array<{ id: SettingsSection; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
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
    // The resolved theme, from the page's <ThemeScope> (decision 062).
    let theme = themePreference(handle)

    return (
      <Layout title="Settings" description="Your sign-in, your profile, your data." viewer={viewer}>
        <PageFrame>
          <PageHead
            label="Account"
            title="Settings"
            titleId="settings-title"
            lead="Your sign-in, your profile, your data. Everything here is yours to change or take with you."
          >
            {/* Always rendered, so a notice that arrives with the page is in a live region (decision 031). */}
            <div role="status" mix={noticeSlotStyle}>
              {notice ? (
                <Callout tone={notice.tone} title={noticeTitles[notice.section]}>
                  {notice.text}
                </Callout>
              ) : null}
            </div>
          </PageHead>

          <RuledSection as="div" pad="none">
          <div mix={panesStyle}>
            <aside mix={asideStyle} aria-labelledby="settings-outline">
              <MonoHeading id="settings-outline" uppercase={false} mix={[sentenceHeading, outlineHeadingStyle]}>
                On this page
              </MonoHeading>
              <nav aria-labelledby="settings-outline">
                <ul mix={outlineListStyle}>
                  {outline.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} mix={[outlineLinkStyle, item.id === 'danger' ? outlineDangerStyle : undefined]}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
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
                      <a href={routes.profile.index.href({ handle: profileHandle })} data-rmx-prefetch={prefetchFor(routes.profile.index.href({ handle: profileHandle }))} mix={monoLinkStyle}>
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

              {/* 2. Appearance (decision 062) */}
              <Section
                id="appearance"
                title="Appearance"
                description="Dark or light. System follows your device and switches with it."
              >
                <form method="post" action={routes.settings.appearance.href()} mix={formStyle}>
                  <Switch
                    name="theme"
                    legend="Theme"
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'light', label: 'Light' },
                    ]}
                    value={theme}
                  />
                  <div mix={footerStyle}>
                    <Keycap type="submit" variant="dark" mix={footerKeyStyle}>
                      Save theme
                    </Keycap>
                  </div>
                </form>
              </Section>

              {/* 3. Email */}
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
                        Cancel the change
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

              {/* 4. Sign-in methods */}
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
                  <ReauthBlock what="add a passkey or connect GitHub or Google" email={viewer.email} />
                )}
                <p mix={noteStyle}>
                  {passkeyCount === 1 ? 'You have 1 passkey.' : `You have ${passkeyCount} passkeys.`} Email sign-in
                  always works, so you can't lock yourself out.
                </p>
              </Section>

              {/* 5. Your data */}
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

              {/* 6. Sessions */}
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

              {/* 7. Delete account */}
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

          </div>
          </RuledSection>
        </PageFrame>
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

/**
 * One settings group: a row of the ruled column (decision 047). The heading
 * and description sit in a narrow left cell, the controls in the wide right
 * one; stacked under 1100px. Rows share one hairline.
 */
function Section(handle: Handle<SectionProps>) {
  return () => {
    let { id, title, description, danger, children } = handle.props
    let headingId = `${id}-heading`
    return (
      <section aria-labelledby={headingId} mix={[sectionStyle, danger ? dangerSectionStyle : undefined]}>
        <div mix={sectionHeadStyle} id={id}>
          <MonoHeading id={headingId} uppercase={false} mix={[sentenceHeading, danger ? dangerHeadingStyle : undefined]}>
            {title}
          </MonoHeading>
          <p mix={descriptionStyle}>{description}</p>
        </div>
        <div mix={sectionBodyStyle}>{children}</div>
      </section>
    )
  }
}

// Settings §2: the check-inbox pattern from /login/check, inline.
const pendingStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-5)',
  border: 'var(--border-w) solid var(--line-cell)',
  boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt-edge)',
  background: 'var(--well)',
})

const pendingHeadStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3_5)' })

const pendingTileStyle = css({
  flex: 'none',
  width: '48px',
  height: '48px',
  color: 'var(--volt)',
  background: 'var(--volt-tint)',
  border: 'var(--border-w) solid var(--volt-edge)',
  display: 'grid',
  placeItems: 'center',
})

const pendingTextStyle = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })

const pendingEmailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })



// The outline in a side cell, the groups in the wide one, one hairline
// between them; the outline goes under 900px (the groups are the page).
const panesStyle = css({
  display: 'grid',
  gridTemplateColumns: '240px minmax(0, 1fr)',
  '@media (max-width: 899.98px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const columnStyle = css({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 899.98px)': { borderLeft: 0 },
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})

const asideStyle = css({
  minWidth: 0,
  alignSelf: 'start',
  position: 'sticky',
  top: 'var(--shell-h)',
  '@media (max-width: 899.98px)': { display: 'none' },
})



const outlineHeadingStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-6)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
})

const outlineListStyle = css({ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' })

const outlineLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--control-field)',
  padding: 'var(--space-2) var(--space-6)',
  boxSizing: 'border-box',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  fontSize: 'var(--fs-14)',
  color: 'var(--muted)',
  textDecoration: 'none',
  '&:hover': { background: 'var(--fill-hover)', color: 'var(--text)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText', '&:hover': { textDecoration: 'underline' } },
})

const outlineDangerStyle = css({ '&:hover': { color: 'var(--danger)' } })

const sectionStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.6fr)',
  gap: 'var(--space-6) var(--space-10)',
  padding: 'var(--space-12) var(--section-pad-x)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '&:last-child': { borderBottom: 0 },
  '@media (max-width: 1099.98px)': { gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' },
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--section-pad-x)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})

const sectionBodyStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4_5)', maxWidth: '640px' })

// The danger row: a faint danger ground and a danger rule down its left
// edge, inside the cell (decision 047: accents as signals).
const dangerSectionStyle = css({
  background: 'var(--danger-a04)',
  boxShadow: 'inset var(--border-w-strong) 0 0 var(--danger-line)',
})

const sectionHeadStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignSelf: 'start' })

// Mono headings in sentence case, like every strip on the grid (decision 047).
const sentenceHeading = css({ letterSpacing: 'normal' })
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

// Section footers: at the start of the controls column, full width on phones.
const footerStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' })
const footerKeyStyle = css({ '@media (max-width: 480px)': { flex: '1 1 100%' } })

const sessionsFormStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'stretch' })

const emailValueStyle = css({ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2_5)' })
const verifiedStyle = css({ borderColor: 'var(--volt-edge)', color: 'var(--volt)' })
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

// One box of rows sharing hairlines (decision 047), not a stack of cards.
const methodListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  border: 'var(--border-w) solid var(--line-cell)',
  '& > li + li': { borderTop: 'var(--border-w) solid var(--line-cell)' },
  '@media (forced-colors: active)': { borderColor: 'GrayText', '& > li + li': { borderColor: 'GrayText' } },
})

const centeredTermsStyle = css({ '& dt': { alignSelf: 'center' } })

const noticeTitles: Record<SettingsSection, string> = {
  profile: 'Profile',
  appearance: 'Appearance',
  email: 'Email',
  'sign-in': 'Sign-in methods',
  data: 'Your data',
  sessions: 'Sessions',
  danger: 'Delete account',
}

const noticeSlotStyle = css({ width: '100%', '&:not(:empty)': { paddingTop: 'var(--space-2)' } })
