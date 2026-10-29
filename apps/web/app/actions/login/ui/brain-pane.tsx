import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { BrainCanvas } from '../public/brain-canvas.tsx'

/**
 * The Auth "living brain" pane (Auth spec, left pane): WebGL point cloud,
 * dot grid, "Your neurons, saved." and the decorative SessionPanel. The
 * logo is AuthShell's, laid over this pane's top row (decision 044).
 *
 * A cell of the auth band (decision 047): the canvas stays inside it, over
 * faint graph paper, and the session panel is a flat ink cell with a
 * hairline (no glass, no blur), nearly opaque so its text reads over the
 * points.
 *
 * Responsive (resolutions §8): stacked above the form below 1040px; below
 * 760px it moves under the form as a 200px band with no canvas and no
 * session panel; at 520px and narrower it is hidden.
 */
export function BrainPane(_handle: Handle) {
  return () => {
    return (
      <aside aria-label="About accounts" mix={paneStyle}>
        <BrainCanvas />
        <div aria-hidden="true" mix={gridPaperStyle} />
        <div mix={bottomStyle}>
          {/* Not a heading: the form's <h1> must come first (Auth spec, accessibility). */}
          <p mix={displayStyle}>
            Your neurons,
            <br />
            <span mix={voltStyle}>saved.</span>
          </p>
          <div aria-hidden="true" mix={sessionStyle}>
            <div>
              <span mix={voltStyle}>›</span> session.restore()
            </div>
            <div>
              <span mix={ionStyle}>✓</span> 5 lessons · 12-day streak · 1,240 neurons
            </div>
            <div>
              <span mix={ionStyle}>✓</span> resuming “Temperature &amp; randomness”
              <span mix={caretStyle}>▍</span>
            </div>
          </div>
        </div>
      </aside>
    )
  }
}

const paneStyle = css({
  position: 'relative',
  minWidth: 0,
  minHeight: '560px',
  overflow: 'hidden',
  borderRight: 'var(--border-w) solid var(--line-cell)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: 'var(--space-10) var(--section-pad-x)',
  '@media (max-width: 1039px)': { minHeight: '480px', borderRight: 0, borderBottom: 'var(--border-w) solid var(--line-cell)' },
  '@media (max-width: 759px)': {
    minHeight: '200px',
    padding: 'var(--space-6) var(--section-pad-x)',
    borderBottom: 0,
    borderTop: 'var(--border-w) solid var(--line-cell)',
  },
  '@media (max-width: 520px)': { display: 'none' },
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})

// Graph paper, as under the landing field (047), from the cell's top-left.
const gridPaperStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--field-grid) var(--border-w), transparent var(--border-w)), linear-gradient(90deg, var(--field-grid) var(--border-w), transparent var(--border-w))',
  backgroundSize: 'var(--field-grid-step) var(--field-grid-step)',
  backgroundPosition: '-1px -1px',
  pointerEvents: 'none',
})

const bottomStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
  maxWidth: '520px',
})

const displayStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 4.4vw, 60px)',
  lineHeight: 0.98,
  letterSpacing: 'var(--tracking-tight)',
  '@media (max-width: 759px)': { fontSize: '36px' },
})

// Flat ink over the canvas (047): no glass, no blur, square.
const sessionStyle = css({
  padding: 'var(--space-4) var(--space-5)',
  background: 'var(--cell-fill)',
  border: 'var(--border-w) solid var(--line-cell)',
  boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt-edge)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.9,
  color: 'var(--muted)',
  '@media (max-width: 759px)': { display: 'none' },
})

const voltStyle = css({ color: 'var(--volt)' })
const ionStyle = css({ color: 'var(--ion)' })

const caretStyle = css({
  color: 'var(--volt)',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
