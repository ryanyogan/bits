import type { Handle, MixInput } from 'remix/component'

import { Tag } from './tag.tsx'

export interface DeskTagProps {
  mix?: MixInput<HTMLElement>
}

/**
 * "Desk": the lesson's build steps need a computer and a terminal
 * (decision 073), so a phone learner can save it for later. The visible
 * word is short; screen readers hear the whole reason after it. Static.
 */
export function DeskTag(handle: Handle<DeskTagProps>) {
  return () => (
    <Tag variant="desk" mix={handle.props.mix}>
      Desk
      <span class="sr-only">: best at a computer, with a terminal</span>
    </Tag>
  )
}
