import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { LiveDot } from '@bits/ui/live-dot'
import { Tag } from '@bits/ui/tag'

import type { TreeNode } from '../../data.ts'

export interface SourcePreviewProps {
  tree: TreeNode[]
  file: string
  markdown: string
}

/**
 * Source + preview (Authoring spec §2d): FileTree, SourceViewer and the
 * rendered preview of the latest build. Static: "● live" means latest build,
 * not live editing. Below 480px the tree collapses into "Files (n)".
 */
export function SourcePreview(handle: Handle<SourcePreviewProps>) {
  return () => {
    let { tree, file, markdown } = handle.props
    let fileCount = tree.filter((n) => n.kind !== 'folder' && n.kind !== 'more' && !n.name.endsWith('/')).length
    return (
      <section aria-label="Source and preview" mix={sectionStyle}>
        <nav aria-label="Course files" mix={[treeCard, wideOnly]}>
          <FileTree tree={tree} />
        </nav>
        <details mix={[treeCard, treeDetails, narrowOnly]}>
          <summary mix={summaryStyle}>Files ({fileCount})</summary>
          <FileTree tree={tree} />
        </details>

        <div mix={paneStyle}>
          <div mix={paneHead}>
            <span mix={paneName}>{file}</span>
            <span>markdown</span>
          </div>
          <pre tabIndex={0} aria-label={`${file} source`} mix={preStyle}>
            {highlight(markdown)}
          </pre>
        </div>

        <div mix={[paneStyle, previewPane]}>
          <div mix={paneHead}>
            <span mix={paneName}>Preview</span>
            <LiveDot>live</LiveDot>
          </div>
          <Preview />
        </div>
      </section>
    )
  }
}

function FileTree(handle: Handle<{ tree: TreeNode[] }>) {
  return () => (
    <ul mix={treeList}>
      {handle.props.tree.map((node, index) => (
        <li
          key={index}
          aria-current={node.selected ? 'true' : undefined}
          data-kind={node.kind}
          mix={[treeItem, node.selected ? treeSelected : undefined]}
          style={{ paddingLeft: `${node.depth * 14 - (node.selected ? 6 : 0)}px` }}
        >
          {node.kind === 'more' ? <span aria-label="more files">…</span> : node.name}
        </li>
      ))}
    </ul>
  )
}

/** Mini lesson render of 06-temperature.md (artboard lines 152–178), scaled-down lesson parts. */
function Preview() {
  return () => (
    <div mix={previewBody}>
      <div mix={tutorRow}>
        <span aria-hidden="true" mix={tutorAvatar} />
        <p mix={tutorText}>
          Last lesson you saw that a model never picks <strong>the</strong> next word. It gives every token a
          probability, then rolls a weighted die.
        </p>
      </div>
      <div mix={oddsStyle} role="img" aria-label="Next-token odds for “Moon café tagline:”: Brew 62%, One 26%, Lunar 12%, at temperature 0.70">
        {[
          ['Brew', 62, 'var(--ion)'],
          ['One', 26, 'var(--ion-a45)'],
          ['Lunar', 12, 'var(--ion-a45)'],
        ].map(([token, pct, colour]) => (
          <div key={token as string} mix={oddsRow}>
            <span>{token}</span>
            <span mix={oddsBar} style={{ width: `${pct}%`, background: colour as string }} />
          </div>
        ))}
        <span mix={oddsTemp}>temperature ━━━━━━○━━━ 0.70</span>
      </div>
      <div mix={composerStyle}>
        <Tag variant="your-turn-sm" mix={selfStart}>
          Your turn · +40
        </Tag>
        <span mix={taskStyle}>
          Ask for a <strong>tagline for a coffee shop on the moon</strong> with a length limit.
        </span>
        <ul mix={chipsStyle} aria-label="Checks">
          <li mix={chipStyle}>○ Asks for a tagline</li>
          <li mix={chipStyle}>○ Sets a length limit</li>
          <li mix={chipStyle}>○ Run at 0 and 1.0</li>
        </ul>
      </div>
      <div mix={quizStyle}>
        <span mix={quizQuestion}>What does temperature change?</span>
        <span mix={quizOption}>◯ How long the answer is</span>
        <span mix={quizOption}>◯ How spread out the odds are</span>
      </div>
    </div>
  )
}

/**
 * A small highlighter for course markdown (tokens §1.4 syntax colours):
 * `---` dim, frontmatter keys ion, `**bold**` text 600 (across lines),
 * `:::name` and `:::` volt, `{attrs}` synapse-soft, `- check` / `- run` synapse.
 */
export function highlight(markdown: string): RemixNode[] {
  let out: RemixNode[] = []
  let inFrontmatter = false
  let bold = false

  // `**…**` can span lines (the artboard's prompt task does), so `bold` carries over.
  let inline = (line: string) => {
    let buffer = ''
    let flush = () => {
      if (buffer) out.push(bold ? <span mix={boldStyle}>{buffer}</span> : buffer)
      buffer = ''
    }
    for (let i = 0; i < line.length; ) {
      if (line.startsWith('**', i)) {
        if (bold) {
          buffer += '**'
          flush()
          bold = false
        } else {
          flush()
          bold = true
          buffer = '**'
        }
        i += 2
      } else {
        buffer += line[i++]
      }
    }
    flush()
  }

  markdown.split('\n').forEach((line, index) => {
    if (index > 0) out.push('\n')
    if (line === '---' && (index === 0 || inFrontmatter)) {
      inFrontmatter = index === 0
      out.push(<span mix={dimStyle}>{line}</span>)
      return
    }
    let key = inFrontmatter ? /^([\w-]+:)(.*)$/.exec(line) : null
    if (key) {
      out.push(<span mix={keyStyle}>{key[1]}</span>, key[2])
      return
    }
    let block = /^(:::[\w-]*)(\{.*\})?(.*)$/.exec(line)
    if (block) {
      out.push(<span mix={blockStyle}>{block[1]}</span>)
      if (block[2]) out.push(<span mix={attrStyle}>{block[2]}</span>)
      if (block[3]) out.push(block[3])
      return
    }
    let directive = /^(- (?:check|run|example))(.*)$/.exec(line)
    if (directive) {
      out.push(<span mix={directiveStyle}>{directive[1]}</span>, directive[2])
      return
    }
    inline(line)
  })
  return out
}

const sectionStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'stretch' })
const NARROW = '@media (max-width: 480px)'
const wideOnly = css({ [NARROW]: { display: 'none' } })
const narrowOnly = css({ display: 'none', [NARROW]: { display: 'block' } })

const treeCard = css({
  flex: '1 1 240px',
  maxWidth: '300px',
  padding: 'var(--space-5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--well)',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 2,
  color: 'var(--text-quiet)',
  [NARROW]: { maxWidth: 'none' },
})
const treeDetails = css({ padding: '0 var(--space-5)', '&[open]': { paddingBottom: 'var(--space-4)' } })
const summaryStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  cursor: 'pointer',
  color: 'var(--text)',
})
const treeList = css({ listStyle: 'none', margin: 0, padding: 0 })
const treeItem = css({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '&[data-kind="folder"], &[data-kind="asset"]': { color: 'var(--muted)' },
  '&[data-kind="course"]': { color: 'var(--ion)' },
})
const treeSelected = css({
  marginLeft: 'var(--space-1_5)',
  borderRadius: 'var(--radius-xs)',
  background: 'var(--volt-tint)',
  color: 'var(--text)',
})

const paneStyle = css({
  flex: '999 1 420px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--well)',
  border: '1px solid var(--line)',
})
const previewPane = css({ background: 'var(--ink)' })
const paneHead = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--line-bar)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const paneName = css({ color: 'var(--text)' })
const preStyle = css({
  margin: 0,
  padding: 'var(--space-4_5)',
  overflowX: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.75,
  color: 'var(--text-quiet)',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '-2px' },
})
const dimStyle = css({ color: 'var(--dim)' })
const keyStyle = css({ color: 'var(--ion)' })
const boldStyle = css({ color: 'var(--text)', fontWeight: 600 })
const blockStyle = css({ color: 'var(--volt)' })
const attrStyle = css({ color: 'var(--synapse-soft)' })
const directiveStyle = css({ color: 'var(--synapse)' })

const previewBody = css({ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const tutorRow = css({ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' })
const tutorAvatar = css({ flex: 'none', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', background: 'var(--volt)' })
const tutorText = css({
  margin: 'var(--space-0_5) 0 0',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.65,
  color: 'var(--text-body)',
  '& strong': { color: 'var(--text)' },
})
const oddsStyle = css({
  marginLeft: '38px',
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--ion-a28)',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  [NARROW]: { marginLeft: 0 },
})
const oddsRow = css({ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 'var(--space-2_5)', alignItems: 'center' })
const oddsBar = css({ display: 'block', height: '14px', borderRadius: 'var(--radius-4)' })
const oddsTemp = css({ color: 'var(--muted)', overflowWrap: 'anywhere' })
const composerStyle = css({
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--volt-a40)',
  background: 'var(--well)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
})
const selfStart = css({ alignSelf: 'flex-start' })
const taskStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--text-body)', '& strong': { color: 'var(--text)' } })
const chipsStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: 'var(--space-1_5)',
  flexWrap: 'wrap',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const chipStyle = css({ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--line-strong)' })
const quizStyle = css({
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-14)',
})
const quizQuestion = css({ color: 'var(--text)' })
const quizOption = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minHeight: '40px',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--line-panel)',
  color: 'var(--text-quiet)',
})
