import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS, forcedSvgPaint } from './lib/states.ts'

export interface BitCellsProps {
  /**
   * The bits, most significant first: a string of `0`/`1` (`"110010100"`),
   * or a number, drawn in binary (`404` → `110010100`). A `0` is an unlit
   * cell (a hairline frame), a `1` a lit one.
   */
  bits: string | number
  /** Fewest cells to draw; a number shorter than this is padded with unlit cells on the left. */
  width?: number
  /** Cell size in px (default `--bit-cell`, 8). */
  size?: number
  /** Colour of a lit cell: `text` (default), `volt`, `ion`, `synapse` or `dim`. */
  tone?: 'text' | 'volt' | 'ion' | 'synapse' | 'dim'
  /**
   * Accessible name. Without one the row is decorative (`aria-hidden`):
   * the text beside it carries the meaning (decision 058).
   */
  label?: string
  mix?: MixInput<SVGSVGElement>
}

/** `404` → `"110010100"`. */
export function toBits(value: number, width = 0): string {
  return Math.max(0, Math.floor(value)).toString(2).padStart(width, '0')
}

/**
 * A row of bit cells (decision 058): the smallest unit of the bits motif.
 * An unlit cell is a hairline square, a lit one a filled square, with
 * `--bit-gap` between them. Used by `EmptyState` (an all-zero row) and the
 * status pages (the HTTP status in binary), and free for a caller that has
 * a small number to show as bits. Static, an inline SVG.
 */
export function BitCells(handle: Handle<BitCellsProps>) {
  return () => {
    let { bits, width = 0, size, tone = 'text', label, mix } = handle.props
    let row = typeof bits === 'number' ? toBits(bits, width) : bits.padStart(width, '0')
    let cells = [...row]
    let cell = size ?? 8
    let gap = 2
    let step = cell + gap
    let total = cells.length * step - gap
    return (
      <svg
        width={total}
        height={cell}
        viewBox={`0 0 ${total} ${cell}`}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
        mix={[rowStyle, tones[tone], mix]}
      >
        {cells.map((bit, index) =>
          bit === '1' ? (
            <rect key={index} x={index * step} y={0} width={cell} height={cell} fill="currentColor" />
          ) : (
            <rect
              key={index}
              x={index * step + 0.5}
              y={0.5}
              width={cell - 1}
              height={cell - 1}
              fill="none"
              stroke="var(--bit-off)"
              data-off=""
            />
          ),
        )}
      </svg>
    )
  }
}

// Forced colours: a lit cell in the text colour, an unlit frame in GrayText.
const rowStyle = css({
  display: 'inline-block',
  flex: 'none',
  verticalAlign: 'middle',
  overflow: 'visible',
  // `[stroke][data-off]` outranks forcedSvgPaint's `[stroke]:not(...)`, so the frame stays grey.
  [FORCED_COLORS]: { ...forcedSvgPaint, '& [stroke][data-off]': { stroke: 'GrayText' } },
})

// Each tone carries its own forced-colours rule: a mixin is its own layer,
// so a rule in another mixin can't be relied on to beat the tone's colour.
const tone = (color: string) => css({ color, [FORCED_COLORS]: { color: 'CanvasText' } })
const tones = {
  text: tone('var(--bit-on)'),
  volt: tone('var(--volt)'),
  ion: tone('var(--ion)'),
  synapse: tone('var(--synapse)'),
  dim: tone('var(--dim)'),
}
