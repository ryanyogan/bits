import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { IllustrativeTag, toyBodyStyle, toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'

export interface TokenPillProps {
  text: string
  /** Token id shown under the pill. */
  id?: string
  /** Position in the sequence; tints cycle volt → ion → synapse. */
  index: number
  mix?: MixInput<HTMLElement>
}

/** One token (components §10.11), as an `<li>`. Leading spaces are kept (`white-space: pre`). Static. */
export function TokenPill(handle: Handle<TokenPillProps>) {
  return () => {
    let { text, id, index, mix } = handle.props
    let pill = (
      <span data-tint={String(index % 3)} mix={pillStyle}>
        {text}
      </span>
    )
    return (
      <li aria-label={id ? `${text.trim() || 'space'}, token ${id}` : text} mix={[itemStyle, mix]}>
        {id ? (
          <span aria-hidden="true" mix={stackStyle}>
            {pill}
            <span mix={idStyle}>{id}</span>
          </span>
        ) : (
          pill
        )}
      </li>
    )
  }
}

const itemStyle = css({ display: 'flex' })
const stackStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' })
const pillStyle = css({
  padding: 'var(--space-1_5) var(--space-2)',
  borderRadius: 'var(--radius-7)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-15)',
  lineHeight: 'normal',
  whiteSpace: 'pre',
  color: 'var(--text)',
  border: 'var(--border-w) solid transparent',
  '&[data-tint="0"]': { background: 'var(--volt-tint-on)', borderColor: 'var(--volt-a35)' },
  '&[data-tint="1"]': { background: 'var(--ion-a12)', borderColor: 'var(--ion-a35)' },
  '&[data-tint="2"]': { background: 'var(--syn-a14)', borderColor: 'var(--syn-a40)' },
})
const idStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-10)', color: 'var(--dim)' })

export const tokenListStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1_5)' })

export interface TokenizerPanelProps {
  tokens: [text: string, id: string][]
  /** Shows the "illustrative" tag: made-up ids. */
  illustrative?: boolean
  mix?: MixInput<HTMLElement>
}

/** `:::tokenizer` block (components §10.11): ion panel + token pills with ids. Static for fixed samples. */
export function TokenizerPanel(handle: Handle<TokenizerPanelProps>) {
  return () => {
    let { tokens, illustrative, mix } = handle.props
    let chars = tokens.reduce((sum, [text]) => sum + text.length, 0)
    return (
      <div mix={[toyPanelStyle, mix]}>
        <p mix={[toyHeaderStyle, headerStyle]}>
          <span mix={tagRow}>
            <span mix={toyLabelStyle}>tokenizer</span>
            {illustrative ? <IllustrativeTag /> : null}
          </span>
          <span>{`${tokens.length} tokens · ${chars} characters`}</span>
        </p>
        <div mix={toyBodyStyle}>
          <ol aria-label="Tokens" mix={tokenListStyle}>
            {tokens.map(([text, id], index) => (
              <TokenPill key={index} text={text} id={id} index={index} />
            ))}
          </ol>
        </div>
      </div>
    )
  }
}

const tagRow = css({ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' })
const headerStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
