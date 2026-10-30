import { css } from 'remix/component'

import type { SyntaxKind } from '../code-editor.tsx'

/**
 * The syntax colours of build-time highlighted code, shared by the
 * `:::code` editor and the static code sample in lesson prose (decision 061).
 */
export const syntaxStyle: Record<SyntaxKind, ReturnType<typeof css>> = {
  keyword: css({ color: 'var(--syntax-keyword)' }),
  string: css({ color: 'var(--syntax-string)' }),
  type: css({ color: 'var(--syntax-type)' }),
  function: css({ color: 'var(--syntax-function)' }),
  plain: css({ color: 'var(--syntax-plain)' }),
  comment: css({ color: 'var(--syntax-comment)' }),
  number: css({ color: 'var(--syntax-number)' }),
  punct: css({ color: 'var(--text-quiet)' }),
}
