import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { MonoHeading } from '@bits/ui/eyebrow'

/** A style-guide section: mono heading + content. */
export function Section(handle: Handle<{ id: string; title: string; intro?: RemixNode; children?: RemixNode }>) {
  return () => {
    let { id, title, intro, children } = handle.props
    return (
      <section aria-labelledby={id} mix={sectionStyle}>
        <MonoHeading level={2} id={id}>
          {title}
        </MonoHeading>
        {intro ? <p mix={introStyle}>{intro}</p> : null}
        {children}
      </section>
    )
  }
}

/** A specimen card with a mono caption (System "Components" card recipe). */
export function Specimen(handle: Handle<{ caption: string; wide?: boolean; children?: RemixNode }>) {
  return () => {
    let { caption, wide, children } = handle.props
    return (
      <div mix={[specimenStyle, wide ? wideStyle : undefined]}>
        <span mix={captionStyle}>{caption}</span>
        {children}
      </div>
    )
  }
}

/** Labelled state cell inside a specimen: the component, then its state name. */
export function State(handle: Handle<{ label: string; children?: RemixNode }>) {
  return () => (
    <div mix={stateStyle}>
      <div mix={stateBody}>{handle.props.children}</div>
      <span mix={stateLabel}>{handle.props.label}</span>
    </div>
  )
}

export const sectionStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 })
const introStyle = css({ margin: 0, maxWidth: '68ch', fontSize: 'var(--fs-15)', lineHeight: 1.6, color: 'var(--muted)' })

export const specimenGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
  gap: 'var(--space-4)',
})

const specimenStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  minWidth: 0,
  padding: 'var(--space-6)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  '@media (max-width: 480px)': { padding: 'var(--space-4_5)' },
})
const wideStyle = css({ gridColumn: '1 / -1' })
const captionStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })

export const row = css({ display: 'flex', gap: 'var(--space-3_5)', flexWrap: 'wrap', alignItems: 'center' })
export const column = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)', minWidth: 0 })

const stateStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-start', minWidth: 0 })
const stateBody = css({ display: 'flex', alignItems: 'center', minHeight: '56px', maxWidth: '100%' })
const stateLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--dim)' })
