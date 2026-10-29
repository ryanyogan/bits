import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { fieldBoxStyle } from '@bits/ui/lib/field'
import { TokenizerPanel } from '@bits/ui/token-pill'

export interface TokenizerToyProps {
  /** Field id. */
  id: string
  sample: string
  /** The sample, tokenized at build time (shown with JS off). */
  tokens: [text: string, id: string][]
  /** Label the ids as illustrative. */
  illustrative?: boolean
}

/**
 * The `:::tokenizer` toy (components §10.11): type anything and the panel
 * re-tokenizes it live. The server renders the sample's real tokens; typing
 * uses a small in-browser approximation (whole common words, long words cut
 * into chunks, punctuation and digits on their own) with stable fake ids, so
 * it teaches the shape of tokenization without shipping a vocabulary.
 * Client entry.
 */
export const TokenizerToy = clientEntry(
  import.meta.url,
  function TokenizerToy(handle: Handle<TokenizerToyProps>) {
    let text = handle.props.sample

    return () => {
      let { id, sample, tokens, illustrative } = handle.props
      let shown = text === sample ? tokens : approximateTokens(text, tokens)
      return (
        <div mix={toyStyle}>
          <label for={id} mix={labelStyle}>
            Text to tokenize
          </label>
          <input
            id={id}
            value={text}
            autocomplete="off"
            spellcheck={false}
            maxLength={200}
            mix={[
              fieldBoxStyle,
              inputStyle,
              on('input', (event) => {
                text = event.currentTarget.value
                handle.update()
              }),
            ]}
          />
          <div aria-live="polite" mix={panelJoin}>
            <TokenizerPanel tokens={shown} illustrative={illustrative} />
          </div>
        </div>
      )
    }
  },
)

/** Rough BPE-like pieces: leading space sticks to the word; long words split into chunks. */
export function approximateTokens(text: string, known: [string, string][] = []): [string, string][] {
  let ids = new Map(known)
  let pieces = text.match(/ ?[A-Za-zÀ-ÿ’']+| ?\d{1,3}| ?[^\sA-Za-zÀ-ÿ\d]|\s+/g) ?? []
  let out: string[] = []
  for (let piece of pieces) {
    let lead = piece.startsWith(' ') ? ' ' : ''
    let word = piece.slice(lead.length)
    if (!/^[A-Za-zÀ-ÿ’']+$/.test(word) || word.length <= 7) {
      out.push(piece)
      continue
    }
    // Cut long words after a vowel run, roughly every 3–6 letters.
    let rest = word
    let first = true
    while (rest.length > 7) {
      let cut = rest.slice(2, 6).search(/[aeiouy][^aeiouy]/i)
      let at = cut < 0 ? 4 : cut + 3
      out.push((first ? lead : '') + rest.slice(0, at))
      rest = rest.slice(at)
      first = false
    }
    out.push((first ? lead : '') + rest)
  }
  return out.map((piece) => [piece, ids.get(piece) ?? String(fakeId(piece))])
}

function fakeId(piece: string): number {
  let hash = 2166136261
  for (let i = 0; i < piece.length; i++) {
    hash ^= piece.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 50000
}

// The input and the panel are one ruled block (decision 047): the panel
// tucks its top hairline under the input's bottom one.
const toyStyle = css({ display: 'flex', flexDirection: 'column' })
const labelStyle = css({ marginBottom: 'var(--space-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
// The shared field as a lone input (decision 051); it lifts over the
// panel's hairline while focused so the focus edge isn't half covered.
const inputStyle = css({ position: 'relative', '&:focus': { zIndex: 1 } })
const panelJoin = css({ marginTop: 'calc(-1 * var(--border-w))' })
