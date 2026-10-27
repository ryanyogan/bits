import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Viewer } from '../../auth/identity.ts'
import { Layout } from '../../ui/layout.tsx'
import { Catalogue } from './catalogue.tsx'
import { SystemBoard } from './system.tsx'

/**
 * `/styleguide`: the System artboard rebuilt with the real components, then
 * every shared component in all variants and states. Kept in production,
 * `noindex` (meta + X-Robots-Tag).
 */
export function StyleguidePage(handle: Handle<{ currentPath: string; viewer: Viewer | null }>) {
  return () => (
    <Layout
      title="Design system"
      description="The Bits design system: tokens and every shared component in all states."
      currentPath={handle.props.currentPath}
      viewer={handle.props.viewer}
      head={<meta name="robots" content="noindex" />}
    >
      <div mix={pageStyle}>
        <SystemBoard />
        <Catalogue />
      </div>
    </Layout>
  )
}

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-16)',
  marginTop: 'calc(var(--space-12) * -1 + var(--space-16))',
  '@media (max-width: 480px)': { gap: 'var(--space-14)' },
})
