import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { ActivityGrid, sampleActivity } from '@bits/ui/activity-grid'
import { AttentionMap } from '@bits/ui/attention-map'
import { AppBar } from '@bits/ui/app-bar'
import { AvatarButton } from '@bits/ui/avatar-button'
import { BackButton } from '@bits/ui/back-button'
import { BrandMark } from '@bits/ui/brand-mark'
import { Callout } from '@bits/ui/callout'
import { Card } from '@bits/ui/card'
import { CheckChip, checkListStyle } from '@bits/ui/check-chip'
import { Chip, ChoiceChip, SuggestionChip } from '@bits/ui/chip'
import { CodeEditor } from '@bits/ui/code-editor'
import { CodeInput } from '@bits/ui/code-input'
import { ComparePanel } from '@bits/ui/compare-panel'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { CourseCard, WriteCourseCard, courseGridStyle } from '@bits/ui/course-card'
import { CourseCover, coverPatterns } from '@bits/ui/course-cover'
import { EmptyState } from '@bits/ui/empty-state'
import { Eyebrow, MonoHeading } from '@bits/ui/eyebrow'
import { FilterPill } from '@bits/ui/filter-pill'
import { Footer } from '@bits/ui/footer'
import { BadgeChip, BadgeTile, HexBadge, badgeGridStyle } from '@bits/ui/hex-badge'
import { Icon, iconNames } from '@bits/ui/icon'
import { Kbd } from '@bits/ui/kbd'
import { KeyValueList } from '@bits/ui/key-value-list'
import { Keycap, type KeycapVariant } from '@bits/ui/keycap'
import { LessonBar } from '@bits/ui/lesson-bar'
import { LessonNode, LessonNodeRow, lessonListStyle } from '@bits/ui/lesson-node'
import { LiveDot } from '@bits/ui/live-dot'
import { Logo } from '@bits/ui/logo'
import { NavLink } from '@bits/ui/nav-link'
import { NextTokenPlayer } from '@bits/ui/next-token'
import { OddsBars } from '@bits/ui/odds-bars'
import { ProgressBar, SegmentedProgress } from '@bits/ui/progress-bar'
import { ProgressRing } from '@bits/ui/progress-ring'
import { PromptComposer } from '@bits/ui/prompt-composer'
import { ProviderButton } from '@bits/ui/provider-button'
import { QuizChoice } from '@bits/ui/quiz-choice'
import { RabbitHole } from '@bits/ui/rabbit-hole'
import { RewardRegion, RewardToast } from '@bits/ui/reward-toast'
import { SearchField } from '@bits/ui/search-field'
import { SegmentedTabs, StaticTabs } from '@bits/ui/segmented-tabs'
import { StatTile } from '@bits/ui/stat-tile'
import { StreakPill } from '@bits/ui/streak-pill'
import { Switch } from '@bits/ui/switch'
import { TabPanels } from '@bits/ui/tab-panels'
import { Tag } from '@bits/ui/tag'
import { OutputPanel, TerminalLog } from '@bits/ui/terminal'
import { TextField } from '@bits/ui/text-field'
import { TokenizerPanel } from '@bits/ui/token-pill'
import { ToolButton } from '@bits/ui/tool-button'
import { TrainingScrubber } from '@bits/ui/training-scrubber'
import { LearnerBubble, ModelOutput, TutorAvatar, TutorMessage, attachedBlock } from '@bits/ui/tutor'
import { VideoPlayer } from '@bits/ui/video-player'
import { XpPill } from '@bits/ui/xp-pill'

import { APP_NAME } from '../../config.ts'
import { Section, Specimen, State, column, row, specimenGrid } from './layout.tsx'
import {
  agentFile,
  attentionLinks,
  attentionTokens,
  chapters,
  cues,
  nextTokenSteps,
  oddsCandidates,
  rabbitHoleLinks,
  outputLines,
  readmeFile,
  terminalEntries,
  tokens,
  toolsFile,
  trainingSnapshots,
} from './samples.tsx'

const navLinks = [
  { href: '#sg-nav', label: 'Courses' },
  { href: '#sg-nav-me', label: 'My learning' },
  { href: '#sg-nav-author', label: 'Write a course' },
]

const keycapStates = [
  ['rest', undefined],
  ['hover', 'hover'],
  ['pressed', 'active'],
  ['focus-visible', 'focus'],
] as const

/** Every shared component in its variants and states (static examples + live islands). */
export function Catalogue(handle: Handle) {
  return () => (
    <>
      <Section id="sg-brand" title="Brand & icons">
        <div mix={specimenGrid}>
          <Specimen caption="Logo — nav 30/20 · auth 28/19 · app 26/17 · footer">
            <div mix={column}>
              <Logo brand={APP_NAME} href="#sg-brand" variant="nav" />
              <Logo brand={APP_NAME} href="#sg-brand" variant="auth" />
              <Logo brand={APP_NAME} href="#sg-brand" variant="app" />
              <Logo brand={APP_NAME} href="#sg-brand" variant="footer" />
            </div>
          </Specimen>
          <Specimen caption="BrandMark — 26 · 30 · 48">
            <div mix={row}>
              <BrandMark size={26} />
              <BrandMark size={30} />
              <BrandMark size={48} />
            </div>
          </Specimen>
          <Specimen caption={`Icons — ${iconNames.length}, decorative unless labelled`} wide>
            <ul mix={iconGrid}>
              {iconNames.map((name) => (
                <li key={name} mix={iconCell}>
                  <span
                    data-on={name === 'play' ? 'text' : name === 'check' || name === 'tutor' ? 'volt' : undefined}
                    mix={iconBox}
                  >
                    <Icon name={name} size={name === 'play' ? 20 : undefined} />
                  </span>
                  <span mix={iconName}>{name}</span>
                </li>
              ))}
            </ul>
          </Specimen>
        </div>
      </Section>

      <Section id="sg-nav" title="Navigation">
        <Specimen caption="AppBar — app (signed in), static position here; sticky glass on pages. Under 760px the nav becomes the menu sheet.">
          <div mix={barFrame}>
            <AppBar
              brand={APP_NAME}
              homeHref="#sg-nav"
              links={navLinks}
              currentPath="#sg-nav"
              position="static"
              navLabel="App (sample)"
              actions={
                <>
                  <XpPill neurons={1240} />
                  <StreakPill days={12} />
                  <AvatarButton initials="JR" href="#sg-nav" />
                </>
              }
            />
          </div>
        </Specimen>
        <Specimen caption="AppBar — marketing (signed out)">
          <div mix={barFrame}>
            <AppBar
              brand={APP_NAME}
              homeHref="#sg-nav"
              variant="marketing"
              position="static"
              navLabel="Primary (sample)"
              links={[
                { href: '#sg-nav-c', label: 'Courses' },
                { href: '#sg-nav-h', label: 'How it works' },
                { href: '#sg-nav-p', label: 'The path' },
              ]}
              actions={
                <>
                  <NavLink href="#sg-nav" variant="marketing">
                    Sign in
                  </NavLink>
                  <Keycap href="#sg-nav">Start free</Keycap>
                </>
              }
            />
          </div>
        </Specimen>
        <Specimen caption="LessonBar — back · context · segmented progress · mode tabs · neurons">
          <div mix={barFrame}>
            <LessonBar
              position="static"
              backHref="#sg-nav"
              context="Tokens & temperature · Lesson 6 of 8"
              title="Temperature & randomness"
              segments={['done', 'done', 'done', 'done', 'done', 'current', 'upcoming', 'upcoming']}
              progressLabel="Lesson 6 of 8, 5 complete"
              modes={[
                { label: 'Read', href: '#sg-nav', current: true },
                { label: 'Watch', href: '#sg-nav-w' },
                { label: 'Terminal', href: '#sg-nav-t' },
              ]}
              neurons={1240}
            />
          </div>
        </Specimen>
        <div mix={specimenGrid}>
          <Specimen caption="NavLink — app · marketing · footer">
            <div mix={stateGrid}>
              <State label="app rest">
                <NavLink href="#sg-nav">Courses</NavLink>
              </State>
              <State label="app hover">
                <NavLink href="#sg-nav" forceState="hover">
                  Courses
                </NavLink>
              </State>
              <State label="current">
                <NavLink href="#sg-nav" current>
                  Courses
                </NavLink>
              </State>
              <State label="focus-visible">
                <NavLink href="#sg-nav" forceState="focus">
                  Courses
                </NavLink>
              </State>
              <State label="marketing">
                <NavLink href="#sg-nav" variant="marketing">
                  How it works
                </NavLink>
              </State>
              <State label="footer">
                <NavLink href="#sg-nav" variant="footer">
                  Privacy
                </NavLink>
              </State>
            </div>
          </Specimen>
          <Specimen caption="BackButton · bar pills">
            <div mix={stateGrid}>
              <State label="back rest">
                <BackButton href="#sg-nav" label="Back to course" />
              </State>
              <State label="back hover">
                <BackButton href="#sg-nav" label="Back to course" forceState="hover" />
              </State>
              <State label="back focus">
                <BackButton href="#sg-nav" label="Back to course" forceState="focus" />
              </State>
              <State label="XpPill">
                <XpPill neurons={1240} />
              </State>
              <State label="StreakPill">
                <StreakPill days={12} />
              </State>
              <State label="avatar rest">
                <AvatarButton initials="JR" href="#sg-nav" />
              </State>
              <State label="avatar hover">
                <AvatarButton initials="JR" href="#sg-nav" forceState="hover" />
              </State>
              <State label="avatar current">
                <AvatarButton initials="JR" href="#sg-nav" current />
              </State>
              <State label="avatar focus">
                <AvatarButton initials="JR" href="#sg-nav" forceState="focus" />
              </State>
            </div>
          </Specimen>
        </div>
        <Specimen caption="Footer">
          <div mix={barFrame}>
            <Footer
              brand={APP_NAME}
              homeHref="#sg-nav"
              copyright="© 2026 Bits"
              links={[
                { href: '#sg-f1', label: 'Courses' },
                { href: '#sg-f2', label: 'Write a course' },
                { href: '#sg-f3', label: 'Privacy' },
              ]}
            />
          </div>
        </Specimen>
      </Section>

      <Section id="sg-buttons" title="Buttons">
        <Specimen caption="Keycap — variants × states (sm 36 + 44 hit · md 46 · lg 56)">
          <div mix={matrix}>
            {(['primary', 'dark', 'ghost', 'ghost-mono', 'ion'] as KeycapVariant[]).map((variant) => (
              <div key={variant} mix={matrixRow}>
                <span mix={matrixLabel}>{variant}</span>
                {keycapStates.map(([label, force]) => (
                  <State key={label} label={label}>
                    <Keycap variant={variant} forceState={force}>
                      {variant === 'ion' ? 'Copied ✓' : 'Start lesson →'}
                    </Keycap>
                  </State>
                ))}
                <State label="disabled">
                  <Keycap variant={variant} disabled>
                    {variant === 'primary' ? 'Copy off' : 'Disabled'}
                  </Keycap>
                </State>
              </div>
            ))}
            <div mix={[matrixRow, inverseRow]}>
              <span mix={[matrixLabel, onVolt]}>inverse</span>
              {keycapStates.slice(0, 3).map(([label, force]) => (
                <State key={label} label={label}>
                  <Keycap variant="inverse" forceState={force}>
                    Next: Top-p →
                  </Keycap>
                </State>
              ))}
            </div>
          </div>
        </Specimen>
        <div mix={specimenGrid}>
          <Specimen caption="Keycap — sizes, glow, loading, link">
            <div mix={row}>
              <Keycap size="sm">sm Copy</Keycap>
              <Keycap size="md">md Resume →</Keycap>
              <Keycap size="lg">lg Start free</Keycap>
            </div>
            <div mix={row}>
              <Keycap size="lg" glow>
                Start learning →
              </Keycap>
              <Keycap loading>Sending</Keycap>
              <Keycap href="#sg-buttons" variant="dark">
                Link keycap
              </Keycap>
            </div>
          </Specimen>
          <Specimen caption="ToolButton — outline (34) · quiz (40) · video (40); aria-pressed">
            <div mix={stateGrid}>
              <State label="outline">
                <ToolButton>⌨ Type it</ToolButton>
              </State>
              <State label="outline hover">
                <ToolButton forceState="hover">⌨ Type it</ToolButton>
              </State>
              <State label="outline pressed">
                <ToolButton pressed>⌨ Type it</ToolButton>
              </State>
              <State label="quiz">
                <ToolButton variant="quiz">[a] loops forever</ToolButton>
              </State>
              <State label="quiz pressed">
                <ToolButton variant="quiz" pressed>
                  [b] crashes
                </ToolButton>
              </State>
              <State label="video">
                <ToolButton variant="video" square label="Pause">
                  <Icon name="pause" />
                </ToolButton>
              </State>
              <State label="video speed">
                <ToolButton variant="video">1.25×</ToolButton>
              </State>
              <State label="video CC on">
                <ToolButton variant="video" pressed label="Captions">
                  CC
                </ToolButton>
              </State>
              <State label="focus">
                <ToolButton forceState="focus">⌨ Type it</ToolButton>
              </State>
              <State label="disabled">
                <ToolButton disabled>⌨ Type it</ToolButton>
              </State>
            </div>
          </Specimen>
          <Specimen caption="ProviderButton — rest · hover · focus · busy · Kbd">
            <div mix={column}>
              <ProviderButton icon="github" href="#sg-buttons">
                Continue with GitHub
              </ProviderButton>
              <ProviderButton icon="globe" href="#sg-buttons" forceState="hover">
                Continue with Google
              </ProviderButton>
              <ProviderButton icon="key" forceState="focus">
                Use a passkey
              </ProviderButton>
              <ProviderButton icon="key" busy>
                Waiting for passkey…
              </ProviderButton>
              <div mix={row}>
                <Kbd>⌘ K</Kbd>
                <Kbd>Shift</Kbd>
                <Kbd>↵</Kbd>
              </div>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="sg-selection" title="Selection">
        <div mix={specimenGrid}>
          <Specimen caption="SegmentedTabs — URL tabs (links + aria-current)">
            <div mix={column}>
              <SegmentedTabs
                label="Lesson format (sample)"
                items={[
                  { label: 'Read', href: '#sg-selection', current: true },
                  { label: 'Watch', href: '#sg-sel-w', forceState: 'hover' },
                  { label: 'Terminal', href: '#sg-sel-t', forceState: 'focus' },
                ]}
              />
              <span mix={note}>current · hover · focus-visible</span>
              <SegmentedTabs
                label="Account (sample)"
                flavour="account"
                items={[
                  { label: 'Sign in', href: '#sg-selection', current: true },
                  { label: 'Create account', href: '#sg-sel-c' },
                ]}
              />
              <StaticTabs items={['Read', 'Watch', 'Terminal']} selected={1} size="sm" />
              <span mix={note}>StaticTabs (decorative, Main preview)</span>
            </div>
          </Specimen>
          <Specimen caption="TabPanels — client-side ARIA tabs (island, @remix-run/ui/tabs)">
            <TabPanels
              label="Account (client tabs sample)"
              items={[
                { name: 'signin', label: 'Sign in', panel: <p>Sign-in panel. Use ← → to move between tabs.</p> },
                { name: 'create', label: 'Create account', panel: <p>Create-account panel.</p> },
              ]}
            />
          </Specimen>
          <Specimen caption="ChoiceChip (checkbox) — off · on · hover · focus · disabled; Chip; SuggestionChip">
            <div mix={stateGrid}>
              <State label="off">
                <ChoiceChip name="goals" value="work">
                  Use AI at work
                </ChoiceChip>
              </State>
              <State label="on">
                <ChoiceChip name="goals" value="curious" defaultChecked>
                  Curious about AI
                </ChoiceChip>
              </State>
              <State label="hover">
                <ChoiceChip name="goals" value="code" forceState="hover">
                  Build with code
                </ChoiceChip>
              </State>
              <State label="focus">
                <ChoiceChip name="goals" value="teach" forceState="focus">
                  Teach others
                </ChoiceChip>
              </State>
              <State label="disabled">
                <ChoiceChip name="goals" value="x" disabled>
                  Disabled
                </ChoiceChip>
              </State>
              <State label="Chip selected">
                <Chip selected>Agents</Chip>
              </State>
              <State label="SuggestionChip">
                <SuggestionChip href="#sg-selection">Explain tokens like I’m 12</SuggestionChip>
              </State>
              <State label="Suggestion hover">
                <SuggestionChip href="#sg-selection" forceState="hover">
                  What is RAG?
                </SuggestionChip>
              </State>
            </div>
          </Specimen>
          <Specimen caption="FilterPill — links with aria-current">
            <nav aria-label="Filter by track (sample)" mix={row}>
              <FilterPill href="#sg-selection" count={8} dot="var(--text)" selected>
                All
              </FilterPill>
              <FilterPill href="#sg-sel-f" count={2} dot="var(--track-foundations)">
                Foundations
              </FilterPill>
              <FilterPill href="#sg-sel-p" count={2} dot="var(--track-prompting)" forceState="hover">
                Prompting
              </FilterPill>
              <FilterPill href="#sg-sel-t" count={2} dot="var(--track-tools)" forceState="focus">
                Tools
              </FilterPill>
            </nav>
            <span mix={note}>selected · rest · hover · focus-visible</span>
          </Specimen>
          <Specimen caption="Tags — meta · meta-ion · format · cover · done · your turn · run hint">
            <div mix={row}>
              <Tag variant="meta">8 lessons</Tag>
              <Tag variant="meta-ion">text + video</Tag>
              <Tag variant="format">code</Tag>
              <span mix={coverTagBg}>
                <Tag variant="cover" color="var(--ion)">
                  PROMPTING
                </Tag>
              </span>
              <Tag variant="done">✓ DONE</Tag>
              <Tag variant="your-turn">Your turn</Tag>
              <Tag variant="your-turn-sm">Your turn · +40</Tag>
              <Tag variant="run-hint">Run ↵</Tag>
            </div>
          </Specimen>
          <Specimen caption="Switch (Settings) · QuizChoice (progressive form)">
            <Switch
              name="motion"
              legend="Motion"
              options={[
                { value: 'full', label: 'Full motion' },
                { value: 'reduced', label: 'Reduced' },
              ]}
              value="full"
            />
            <QuizChoice
              name="quiz-a"
              question="Same prompt at T=0 twice. Same token?"
              options={[
                { value: 'same', label: 'Same token' },
                { value: 'diff', label: 'Different token' },
              ]}
              action={
                <Keycap type="submit" size="sm">
                  Check
                </Keycap>
              }
            />
            <QuizChoice
              name="quiz-b"
              question="After submit: correct · incorrect"
              options={[
                { value: 'same', label: 'Same token', result: 'correct' },
                { value: 'diff', label: 'Different token', result: 'incorrect', checked: true },
              ]}
              explanation="At 0 the favourite wins every time, so the same token comes back."
            />
          </Specimen>
        </div>
      </Section>

      <Section id="sg-inputs" title="Inputs">
        <div mix={specimenGrid}>
          <Specimen caption="TextField — rest · focus · error (danger) · hint · disabled · compact">
            <div mix={column}>
              <TextField name="sg-email" label="Email" type="email" placeholder="you@example.com" mono />
              <TextField name="sg-name" label="Display name" value="Jamie" forceFocus />
              <TextField name="sg-email-bad" label="Email" type="email" value="jamie@" error="Enter a full email address." mono />
              <TextField name="sg-handle" label="Handle" hint="Lowercase letters and dashes." value="jamie" />
              <TextField name="sg-disabled" label="Disabled" value="read only" disabled />
              <TextField name="sg-slug" label="Course slug" compact mono value="tokens-temperature" />
            </div>
          </Specimen>
          <Specimen caption="SearchField (⌘K island) · CodeInput (6-digit, island) — rest · error">
            <SearchField action="#sg-inputs" label="Search courses" placeholder="Search courses" shortcut />
            <SearchField action="#sg-inputs" id="sg-search-focus" label="Search courses (focused)" value="agents" forceFocus />
            <CodeInput name="sg-code" label="6-digit code" />
            <CodeInput name="sg-code-bad" label="6-digit code (error)" value="123456" error="That code didn’t match. Check the latest email." />
          </Specimen>
        </div>
      </Section>

      <Section id="sg-layout" title="Labels & layout">
        <div mix={specimenGrid}>
          <Specimen caption="Card — default · page · compact · dashed · glass">
            <div mix={column}>
              <Card variant="page">
                <Eyebrow tone="muted" size="sm" uppercase>
                  page
                </Eyebrow>
              </Card>
              <Card variant="compact">
                <Eyebrow tone="muted" size="sm" uppercase>
                  compact
                </Eyebrow>
              </Card>
              <Card variant="dashed">
                <Eyebrow tone="muted" size="sm" uppercase>
                  dashed
                </Eyebrow>
              </Card>
              <div mix={glassBg}>
                <Card variant="glass">
                  <Eyebrow tone="muted" size="sm" uppercase>
                    glass
                  </Eyebrow>
                </Card>
              </div>
            </div>
          </Specimen>
          <Specimen caption="Callout — danger · warning · ok · info · compact">
            <Callout tone="danger" title="That code didn’t match.">
              Request a new one or check the latest email.
            </Callout>
            <Callout tone="warning">Lesson 3 has no checks yet.</Callout>
            <Callout tone="ok">9 files compiled.</Callout>
            <Callout tone="info">Progress is saved on this device until you sign in.</Callout>
            <Callout tone="danger" compact>
              lesson-04.md: unknown block :::quizz
            </Callout>
          </Specimen>
          <Specimen caption="Eyebrow tones · MonoHeading · LiveDot">
            <div mix={column}>
              <Eyebrow tone="volt" uppercase>
                01 — Volt eyebrow
              </Eyebrow>
              <Eyebrow tone="ion" uppercase>
                02 — Ion eyebrow
              </Eyebrow>
              <Eyebrow tone="synapse" size="sm" uppercase>
                Synapse small
              </Eyebrow>
              <Eyebrow tone="muted" size="xs" uppercase>
                Muted extra small
              </Eyebrow>
              <MonoHeading level={3}>Mono heading</MonoHeading>
              <div mix={row}>
                <LiveDot>connected</LiveDot>
                <LiveDot tone="ion" pulse>
                  building
                </LiveDot>
                <LiveDot tone="dim">not connected</LiveDot>
              </div>
            </div>
          </Specimen>
          <Specimen caption="StatTile (main · profile) · KeyValueList (default · course)">
            <div mix={statRow}>
              <StatTile variant="main" value="62%" label="context used" color="var(--volt)" />
              <StatTile value="1,240" label="neurons" color="var(--volt)" />
              <StatTile value="12" label="day streak" color="var(--ion)" />
            </div>
            <KeyValueList
              items={[
                { term: 'Email', value: 'jamie@example.com', mono: true },
                { term: 'Joined', value: 'October 2026' },
              ]}
            />
            <KeyValueList
              variant="course"
              items={[
                { term: '8', value: 'chat lessons — every one' },
                { term: '6', value: 'typed prompt exercises' },
                { term: '5', value: 'optional videos', color: 'var(--ion)' },
                { term: '1', value: 'checkpoint project', color: 'var(--synapse)' },
              ]}
            />
          </Specimen>
          <Specimen caption="EmptyState" wide>
            <EmptyState
              title="0 results for “quantum”"
              hint="Try a track filter or a shorter word."
              action={
                <Keycap variant="ghost" size="sm" href="#sg-layout">
                  Clear filters
                </Keycap>
              }
            />
          </Specimen>
        </div>
      </Section>

      <Section id="sg-courses" title="Courses">
        <ul mix={courseGridStyle}>
          <li>
            <CourseCard
              href="#sg-courses"
              title="Tokens & temperature"
              desc="Why the same prompt gives different answers, and how to control it."
              track="Prompting"
              level="Beginner"
              lessons={8}
              mins={42}
              sigil="T°"
              tone="ion"
              pattern="stripes-115"
              formats={['text', 'video']}
              pct={62}
            />
          </li>
          <li>
            <CourseCard
              href="#sg-courses"
              title="What is an LLM, really?"
              desc="Next-token prediction, from the ground up."
              track="Foundations"
              level="Beginner"
              lessons={6}
              mins={30}
              sigil="LLM"
              tone="volt"
              pattern="dots"
              formats={['text']}
              pct={100}
            />
          </li>
          <li>
            <CourseCard
              href="#sg-courses"
              title="Give your model tools"
              desc="Function calling without the magic. Hover state shown."
              track="Tools"
              level="Intermediate"
              lessons={9}
              mins={55}
              sigil="fn()"
              tone="synapse"
              pattern="rings"
              formats={['text', 'code']}
              forceState="hover"
            />
          </li>
          <li>
            <WriteCourseCard href="#sg-courses" />
          </li>
        </ul>
        <span mix={note}>CourseCard: started (bar) · done (DoneTag) · hover (lift, tilt, sigil scale) · WriteCourseCard</span>
        <Specimen caption="CourseCover — the 8 named patterns">
          <ul mix={coverGrid}>
            {coverPatterns.map((pattern, index) => (
              <li key={pattern} mix={coverCell}>
                <CourseCover
                  pattern={pattern}
                  tone={(['volt', 'ion', 'volt', 'ion', 'synapse', 'synapse', 'volt', 'ion'] as const)[index]!}
                  sigil={['LLM', 'T°', '›_', '[ctx]', 'fn()', 'RAG', 'loop', 'edge'][index]!}
                  mix={coverRadius}
                />
                <span mix={iconName}>{pattern}</span>
              </li>
            ))}
          </ul>
          <div mix={row}>
            <CourseCover pattern="stripes-115" tone="ion" sigil="T°" variant="thumb" />
            <CourseCover pattern="rays" tone="volt" sigil="loop" variant="thumb" />
            <CourseCover pattern="stripes-115" tone="ion" sigil="T°" variant="art" />
          </div>
        </Specimen>
        <ContinueBanner
          href="#sg-courses"
          eyebrow="CONTINUE · LESSON 6 OF 8"
          courseTitle="Tokens & temperature"
          nextLesson="Temperature & randomness"
          mins={7}
          pct={62}
          sigil="T°"
          tone="ion"
          pattern="stripes-115"
        />
        <div mix={specimenGrid}>
          <Specimen caption="ProgressBar — card · banner · art · row · level · SegmentedProgress">
            <div mix={column}>
              <div mix={row}>
                <ProgressBar pct={62} variant="card" color="var(--ion)" label="Course progress (card)" />
              </div>
              <div mix={row}>
                <ProgressBar pct={62} variant="banner" color="var(--ion)" label="Course progress (banner)" />
              </div>
              <div mix={row}>
                <ProgressBar pct={62} variant="art" color="var(--ion)" label="Course progress (art)" />
              </div>
              <div mix={row}>
                <ProgressBar pct={40} variant="row" color="var(--volt)" label="Course progress (row)" />
              </div>
              <ProgressBar pct={70} variant="level" label="Level progress" />
              <SegmentedProgress
                segments={['done', 'done', 'done', 'done', 'done', 'current', 'upcoming', 'upcoming']}
                label="Lesson 6 of 8, 5 complete"
              />
            </div>
          </Specimen>
          <Specimen caption="ProgressRing — 96 · 132 with caption · 0% (no fill) · 100% (volt)">
            <div mix={row}>
              <ProgressRing pct={62} />
              <ProgressRing pct={62} size={132} color="var(--volt)" caption="CONTEXT" label="Context window 62 percent full" />
              <ProgressRing pct={0} />
              <ProgressRing pct={100} />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="sg-lessons" title="Lessons">
        <div mix={specimenGrid}>
          <Specimen caption="LessonNode — 32 · 30 · 20 × done · current · next">
            <div mix={nodeGrid}>
              {([32, 30, 20] as const).map((size) =>
                (['done', 'current', 'next'] as const).map((state, i) => (
                  <State key={`${size}${state}`} label={`${size} ${state}`}>
                    <LessonNode size={size} state={state} n={i + 5} />
                  </State>
                )),
              )}
              <State label="20 current passed">
                <LessonNode size={20} state="current" passed n={6} />
              </State>
            </div>
            <ol mix={lessonListStyle}>
              <LessonNodeRow state="done">What is a token?</LessonNodeRow>
              <LessonNodeRow state="current">Temperature &amp; randomness</LessonNodeRow>
              <LessonNodeRow state="next">The context window</LessonNodeRow>
            </ol>
          </Specimen>
          <Specimen caption="TutorAvatar · CheckChip · TokenizerPanel">
            <div mix={row}>
              <TutorAvatar />
              <TutorAvatar size={30} />
              <TutorAvatar size={26} />
            </div>
            <ul aria-label="Checks (sample)" mix={checkListStyle}>
              <CheckChip passed>Asks for a tagline</CheckChip>
              <CheckChip passed>Coffee + moon</CheckChip>
              <CheckChip>Sets a length limit</CheckChip>
              <CheckChip compact>Ran at 0 and 1.0</CheckChip>
            </ul>
            <TokenizerPanel tokens={tokens} />
          </Specimen>
        </div>
        <Specimen caption="Conversation — TutorMessage · LearnerBubble · ModelOutput (done · streaming · example · error)">
          <div mix={chatColumn}>
            <TutorMessage>
              <p>
                Temperature divides every score before they become probabilities. Try <code>T=0</code> and{' '}
                <strong>T=1.0</strong> on the same prompt.
              </p>
            </TutorMessage>
            <LearnerBubble>Write a 6-word tagline for a café on the moon.</LearnerBubble>
            <ModelOutput temperature="0" tokens={9}>
              Brew among the stars, every morning.
            </ModelOutput>
            <ModelOutput temperature="1.0" state="streaming">
              Lunar lattes, zero gravity
            </ModelOutput>
            <ModelOutput temperature="1.0" state="example">
              One small sip for mankind.
            </ModelOutput>
            <ModelOutput temperature="0.7" state="error">
              Fly me to the foam.
            </ModelOutput>
            <LearnerBubble variant="plain">Same token every time?</LearnerBubble>
          </div>
        </Specimen>
        <Specimen caption="PromptComposer (island) — type, Enter runs, Shift+Enter newline; passes when all checks pass">
          <div mix={chatColumn}>
            <TutorMessage>
              <p>Your turn: get the model to write a short tagline for a café on the moon, at temperature 0 and at 1.0.</p>
            </TutorMessage>
            <div mix={attachedBlock}>
              <PromptComposer
                id="sg-composer"
                task="Write the prompt yourself — no pasting the answer"
                checks={[
                  { label: 'Asks for a tagline', patterns: [{ source: 'tagline|slogan', flags: 'i' }] },
                  {
                    label: 'Coffee + moon',
                    patterns: [
                      { source: 'coffee|caf[eé]', flags: 'i' },
                      { source: 'moon|lunar', flags: 'i' },
                    ],
                  },
                  { label: 'Sets a length limit', patterns: [{ source: '\\bwords?\\b|\\bshort\\b|\\bunder\\b|\\bmax', flags: 'i' }] },
                  { label: 'Ran at 0 and 1.0', ranAt: [0, 100] },
                ]}
                examples={{
                  '0': ['Brew among the stars, every morning.'],
                  '70': ['Lunar lattes, zero gravity.', 'Coffee with a crater view.'],
                  '100': ['One small sip for mankind.', 'Fly me to the foam.'],
                }}
                reward={{
                  xp: 40,
                  message: 'Same prompt, different answers — and now you know why.',
                  next: { href: '#sg-lessons', label: 'Next: Top-p →' },
                }}
              />
            </div>
          </div>
        </Specimen>
        <div mix={specimenGrid}>
          <Specimen caption="OddsBars (island) — drag the slider; follows the composer's temperature">
            <OddsBars id="sg-odds" context="Moon café tagline:" candidates={oddsCandidates} />
          </Specimen>
          <Specimen caption="RewardToast — lesson · system · RewardRegion (island, listens for bits:reward)">
            <RewardToast
              xp={40}
              message="Same prompt, different answers — and now you know why."
              next={{ href: '#sg-lessons', label: 'Next: Top-p →' }}
            />
            <RewardToast variant="system" xp={40} message="Prompt passed all 3 checks" />
            <RewardRegion dismissAfter={6000} />
          </Specimen>
        </div>
        <Specimen caption="CodeEditor (island) — file tabs (arrow keys), highlight 6–13 + focus line 10, Copy, Type it">
          <CodeEditor
            files={[agentFile, toolsFile, readmeFile]}
            highlight={{ from: 6, to: 13, label: 'the loop' }}
            focusLine={10}
          />
        </Specimen>
        <div mix={specimenGrid}>
          <Specimen caption="CodeEditor — type mode on (Copy off)">
            <CodeEditor files={[toolsFile]} initialTyped="export async functoin getW" />
          </Specimen>
          <Specimen caption="CodeEditor — copied state (ion keycap)">
            <CodeEditor files={[toolsFile]} initialCopied typeMode={false} />
          </Specimen>
        </div>
        <div mix={specimenGrid}>
          <Specimen caption="TerminalLog (island) — type “hint” and press Enter">
            <TerminalLog
              path="~/first-agent-loop"
              progress="lesson 4/10 · 18% →"
              entries={terminalEntries}
              replies={{
                hint: 'Look at what the API requires after a tool_use block. What’s missing if line 10 is gone?',
                fallback: 'Good guess. Now delete line 10, hit Run, and read the first line of the error out loud.',
              }}
            />
          </Specimen>
          <Specimen caption="OutputPanel (island) — Run replays at 120ms/line">
            <OutputPanel command='npx tsx agent.ts "Weather in Chicago?"' lines={outputLines} />
          </Specimen>
        </div>
        <Specimen caption="VideoPlayer (island) — chapter scrubber, play/pause, speed, CC, transcript; Space/K, ←/→, J/L, C, [ ]">
          <VideoPlayer
            title="Temperature & randomness"
            duration={270}
            chapters={chapters}
            cues={cues}
            initialTime={112}
          />
        </Specimen>
      </Section>

      <Section
        id="sg-toys"
        title="Lesson toys"
        intro="The :::nexttoken, :::training, :::attention, :::compare and :::rabbithole blocks (decision 021). With JS off the islands render their fallback: a table or list of the same data."
      >
        <div mix={specimenGrid}>
          <Specimen caption="NextTokenPlayer (island) — plays when scrolled into view; play/pause, ‹ ›, restart; no play button under reduced motion">
            <NextTokenPlayer prompt="The capital of France is" steps={nextTokenSteps} illustrative />
          </Specimen>
          <Specimen caption="TrainingScrubber (island) — drag through training; loss sparkline marks the step">
            <TrainingScrubber id="sg-training" prompt="Once upon a" snapshots={trainingSnapshots} illustrative />
          </Specimen>
        </div>
        <div mix={specimenGrid}>
          <Specimen caption="AttentionMap (island) — click or arrow through the tokens; tint = weight">
            <AttentionMap tokens={attentionTokens} links={attentionLinks} caption="What does “it” refer to?" illustrative />
          </Specimen>
          <Specimen caption="ComparePanel (static) — two columns, stacked under 640px">
            <ComparePanel
              left="Base model"
              right="Assistant"
              illustrative
              rows={[
                {
                  prompt: 'What is the capital of France?',
                  left: 'What is the capital of Germany?\nWhat is the capital of Spain?\nWhat is the capital of Italy?',
                  right: 'The capital of France is Paris.',
                },
              ]}
            />
          </Specimen>
        </div>
        <Specimen caption="RabbitHole (static) — up to 3 external links; new tab, data-rmx-document, noopener" wide>
          <RabbitHole id="sg-rabbit-hole" links={rabbitHoleLinks} />
        </Specimen>
      </Section>

      <Section id="sg-progress" title="Progress & identity">
        <div mix={specimenGrid}>
          <Specimen caption="HexBadge — earned · locked · preview · BadgeChip">
            <ul mix={badgeGridStyle}>
              <BadgeTile name="First token" glyph="1st" color="var(--volt)" />
              <BadgeTile name="Few-shot" glyph="×3" color="var(--synapse)" />
              <BadgeTile name="Streak ×7" glyph="7d" color="var(--volt-soft)" />
              <BadgeTile name="Temperature tamer" glyph="T°" color="var(--ion)" />
              <BadgeTile name="Tool wielder" glyph="fn" locked />
              <BadgeTile name="Shipped" glyph="↗" locked />
            </ul>
            <div mix={row}>
              <HexBadge name="Temperature tamer" glyph="T°" color="var(--ion)" variant="preview" />
              <BadgeChip name="First token" color="var(--volt)" />
              <BadgeChip name="Few-shot" color="var(--synapse)" />
              <BadgeChip name="Tool wielder" color="var(--code-gutter-faint)" />
            </div>
          </Specimen>
          <ActivityGrid levels={sampleActivity()} label="Activity heatmap (sample): seeded data for the last 182 days" />
        </div>
      </Section>
    </>
  )
}

const note = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--dim)' })
const iconGrid = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 'var(--space-3)',
})
const iconCell = css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' })
const iconBox = css({
  display: 'grid',
  placeItems: 'center',
  width: '56px',
  height: '56px',
  borderRadius: 'var(--radius-12)',
  background: 'var(--well)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  // Icons drawn for a filled surface sit on that surface here.
  '&[data-on="text"]': { background: 'var(--text)' },
  '&[data-on="volt"]': { background: 'var(--volt)' },
})
const iconName = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--muted)' })
const barFrame = css({ borderRadius: 'var(--radius-12)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--ink)' })
const stateGrid = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4) var(--space-5)', alignItems: 'flex-start' })
const matrix = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-2)' })
const matrixRow = css({ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' })
const matrixLabel = css({ width: '96px', paddingTop: 'var(--space-5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const inverseRow = css({ padding: 'var(--space-3)', borderRadius: 'var(--radius-16)', background: 'var(--volt)', '& span': { color: 'var(--on-volt)' } })
const onVolt = css({ color: 'var(--on-volt)' })
const coverTagBg = css({ display: 'inline-flex', padding: 'var(--space-1_5)', borderRadius: 'var(--radius-sm)', background: 'var(--well)', '& > span': { position: 'static' } })
const glassBg = css({ padding: 'var(--space-4)', borderRadius: 'var(--radius-20)', background: 'radial-gradient(var(--syn-a40) 1px, transparent 1px) 0 0 / 14px 14px, var(--ink)' })
const statRow = css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--space-3)' })
const coverGrid = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
  gap: 'var(--space-3_5)',
})
const coverCell = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })
const coverRadius = css({ borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' })
const nodeGrid = css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 'var(--space-3)' })
const chatColumn = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4_5)', maxWidth: '760px', minWidth: 0 })
