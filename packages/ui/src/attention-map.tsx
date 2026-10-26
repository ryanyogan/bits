import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { formatOdds, showToken } from './odds-list.tsx'
import { toyNoteStyle, ToyPanel, toyTableStyle } from './toy-panel.tsx'

export interface AttentionLink {
  /** Index of the token doing the looking. */
  from: number
  /** Index of the earlier token it looks at. */
  to: number
  /** Attention weight, 0–1. */
  weight: number
}

export interface AttentionMapProps {
  tokens: string[]
  links: AttentionLink[]
  caption?: string
  illustrative?: boolean
}

/** The token to show first: the one with the strongest link. */
export function initialFrom(links: AttentionLink[]): number {
  let best = links[0]
  for (let link of links) if (best && link.weight > best.weight) best = link
  return best?.from ?? 0
}

/** What token `from` attends to, strongest first. */
export function attendsTo(links: AttentionLink[], from: number): AttentionLink[] {
  return links.filter((link) => link.from === from).sort((a, b) => b.weight - a.weight)
}

/**
 * `:::attention` (lesson toy): the sentence as token chips. Clicking or
 * focusing a token highlights the earlier tokens it attends to, tinted by
 * weight, with the weight under each chip. The chips are one tab stop with
 * roving focus (←/→, Home/End). No arcs: the chips wrap at 360px, where
 * arcs between rows stop being legible. Server render (no JS): a table of
 * from → to (weight). Client entry.
 */
export const AttentionMap = clientEntry(
  import.meta.url,
  function AttentionMap(handle: Handle<AttentionMapProps>) {
    let live = false
    let selected = initialFrom(handle.props.links)
    let buttons: HTMLButtonElement[] = []

    handle.queueTask(() => {
      live = true
      handle.update()
    })

    function select(index: number, focus = false) {
      let count = handle.props.tokens.length
      selected = Math.max(0, Math.min(count - 1, index))
      handle.update()
      if (focus) handle.queueTask(() => buttons[selected]?.focus())
    }

    function onKey(event: KeyboardEvent) {
      let last = handle.props.tokens.length - 1
      let next =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? selected + 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? selected - 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : undefined
      if (next === undefined) return
      event.preventDefault()
      select(next, true)
    }

    return () => {
      let { tokens, links, caption, illustrative } = handle.props
      let header = { context: caption ?? 'who looks at whom', label: 'attention', illustrative }

      if (!live) {
        return (
          <ToyPanel {...header}>
            <p mix={sentenceStyle}>{tokens.join('')}</p>
            <table mix={toyTableStyle}>
              <caption>Attention: how much each token looks at an earlier one.</caption>
              <thead>
                <tr>
                  <th scope="col">from</th>
                  <th scope="col">to</th>
                  <th scope="col">weight</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={`${link.from}-${link.to}`}>
                    <td data-mono>{showToken(tokens[link.from] ?? '')}</td>
                    <td data-mono>{showToken(tokens[link.to] ?? '')}</td>
                    <td data-mono>{link.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ToyPanel>
        )
      }

      let targets = attendsTo(links, selected)
      let weightOf = new Map(targets.map((link) => [link.to, link.weight]))
      let name = (index: number) => `“${(tokens[index] ?? '').trim() || 'space'}”`
      let summary = targets.length
        ? `${name(selected)} looks most at ${targets
            .slice(0, 3)
            .map((link) => `${name(link.to)} (${formatOdds(link.weight)})`)
            .join(', ')}.`
        : `${name(selected)}: no links in this example. Pick another token.`
      return (
        <ToyPanel {...header}>
          <div role="toolbar" aria-label="Tokens: pick one to see what it attends to" mix={[chipRow, ref((node, signal) => node.addEventListener('keydown', onKey as EventListener, { signal }))]}>
            {tokens.map((token, index) => {
              let weight = weightOf.get(index)
              let isSelected = index === selected
              return (
                <button
                  key={index}
                  type="button"
                  tabIndex={isSelected ? 0 : -1}
                  aria-pressed={isSelected ? 'true' : 'false'}
                  aria-label={`${token.trim() || 'space'}${weight === undefined ? '' : `, attention ${formatOdds(weight)}`}`}
                  data-state={isSelected ? 'from' : weight === undefined ? undefined : 'to'}
                  mix={[
                    chipStyle,
                    ref((node) => {
                      buttons[index] = node as HTMLButtonElement
                    }),
                    on('click', () => select(index)),
                    on('focus', () => {
                      if (selected !== index) select(index)
                    }),
                  ]}
                >
                  {weight === undefined ? null : (
                    <span aria-hidden="true" mix={heatStyle} style={{ opacity: String(0.15 + 0.85 * weight) }} />
                  )}
                  <span mix={chipText}>{token}</span>
                  <span aria-hidden="true" mix={weightStyle}>
                    {weight === undefined ? (isSelected ? 'from' : '') : formatOdds(weight)}
                  </span>
                </button>
              )
            })}
          </div>
          <p aria-live="polite" mix={toyNoteStyle}>
            {summary}
          </p>
        </ToyPanel>
      )
    }
  },
)

const sentenceStyle = css({ margin: 0, fontSize: 'var(--fs-18)', lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' })
const chipRow = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1_5)' })
const chipStyle = css({
  position: 'relative',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-0_5)',
  minWidth: 'var(--touch-target)',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-7)',
  border: '1px solid var(--line-control)',
  background: 'var(--well)',
  color: 'var(--text)',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'border-color var(--duration-fast), background-color var(--duration-fast)',
  '&:hover': { borderColor: 'var(--line-strong)' },
  '&[data-state="from"]': { background: 'var(--volt-tint-on)', borderColor: 'var(--volt-a60)' },
  '&[data-state="to"]': { borderColor: 'var(--ion-a55)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const heatStyle = css({
  position: 'absolute',
  inset: 0,
  background: 'var(--ion-a45)',
  transition: 'opacity var(--duration-sigil) var(--ease-out)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const chipText = css({ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', whiteSpace: 'pre' })
const weightStyle = css({
  position: 'relative',
  minHeight: '1em',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-10)',
  lineHeight: 1,
  color: 'var(--text-quiet)',
})
