import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css } from 'remix/component'
import * as tabs from '@remix-run/ui/tabs'

import { accountItem, accountTrack, itemBase, modeItem, modeTrack } from './segmented-tabs.tsx'

export interface TabPanel {
  name: string
  label: string
  /**
   * Server-rendered panel content. JSX crosses the island boundary as data,
   * so it must not carry `mix` (mixins are functions); style it with plain
   * elements the panel styles, or pass a static component.
   */
  panel: RemixNode
}

export interface TabPanelsProps {
  /** Accessible name of the tablist. */
  label: string
  items: TabPanel[]
  defaultTab?: string
  /** Visual flavour of the tab strip, same as SegmentedTabs. */
  flavour?: 'mode' | 'account'
}

/**
 * Segmented tabs that switch client-side panels: true ARIA tabs (tablist,
 * roving tabindex, arrow keys, Home/End) from `@remix-run/ui/tabs`.
 * Resolutions §11: use this only when the panels live on one URL; URL-backed
 * tabs are `SegmentedTabs` links. The first panel renders with JS off.
 */
export const TabPanels = clientEntry(
  import.meta.url,
  function TabPanels(handle: Handle<TabPanelsProps>) {
    return () => {
      let { label, items, defaultTab, flavour = 'account' } = handle.props
      let account = flavour === 'account'

      return (
        <tabs.Context defaultActiveTab={defaultTab ?? items[0]?.name}>
          <div mix={[rootStyle, tabs.root()]}>
            <div aria-label={label} mix={[account ? accountTrack : modeTrack, account ? stretchStyle : startStyle, tabs.list()]}>
              {items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  mix={[itemBase, account ? accountItem : modeItem, tabs.tab({ name: item.name })]}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {items.map((item) => (
              <div key={item.name} mix={[panelStyle, tabs.panel({ name: item.name })]}>
                {item.panel}
              </div>
            ))}
          </div>
        </tabs.Context>
      )
    }
  },
)

const rootStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5_5)' })
const stretchStyle = css({ alignSelf: 'stretch' })
const startStyle = css({ alignSelf: 'flex-start' })
const panelStyle = css({
  fontSize: 'var(--fs-15)',
  color: 'var(--text-body)',
  '& > p': { margin: 0 },
  '&[hidden]': { display: 'none' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '4px' },
})
