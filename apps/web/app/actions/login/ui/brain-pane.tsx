import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { BrainCanvas } from '../public/brain-canvas.tsx'

/**
 * The Auth "living brain" pane (Auth spec, left pane): WebGL point cloud,
 * dot grid, "Your neurons, saved." and the decorative SessionPanel. The
 * logo is AuthShell's, laid over this pane's top row (decision 044).
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
        <div aria-hidden="true" mix={dotGridStyle} />
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
  flex: '1 1 560px',
  minWidth: 0,
  minHeight: '560px',
  overflow: 'hidden',
  borderRight: '1px solid var(--line-hair)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  // The top row is AuthShell's logo (an --appbar-h row at the page gutter).
  padding: 'var(--appbar-h) var(--page-gutter) var(--space-8)',
  '@media (max-width: 1039px)': { borderRight: 0, borderBottom: '1px solid var(--line-hair)' },
  '@media (max-width: 759px)': {
    flexBasis: '100%',
    minHeight: '200px',
    padding: 'var(--space-6) var(--page-gutter)',
    borderBottom: 0,
    borderTop: '1px solid var(--line-hair)',
  },
  '@media (max-width: 520px)': { display: 'none' },
})

const dotGridStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(var(--dot-grid) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
  pointerEvents: 'none',
})

const bottomStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5_5)',
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

const sessionStyle = css({
  padding: 'var(--space-4) var(--space-4_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--glass-well)',
  WebkitBackdropFilter: 'blur(12px)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--line)',
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
