// What a build reads and what it reports. Pure data: the same build runs in
// the CLI (scripts/content.ts), in tests and in the Worker (folder upload).
import type { ReportItem } from '@bits/db'

/** One file of a course folder. `path` is relative to the folder, `/`-separated. */
export interface SourceFile {
  path: string
  /** Text of markdown and caption files; absent for binary assets. */
  text?: string
  /** Bytes. */
  size: number
}

export type { ReportItem }

/** Collects a build's problems, each pinned to a file and line when known. */
export class Report {
  readonly items: ReportItem[] = []

  error(text: string, file?: string, line?: number) {
    this.add(clean({ level: 'error', text, file, line }))
  }

  warning(text: string, file?: string, line?: number) {
    this.add(clean({ level: 'warning', text, file, line }))
  }

  /** Adds an item unless the same one is already there (`<b>x</b>` is two HTML nodes on one line). */
  private add(item: ReportItem) {
    let same = this.items.some((other) => other.level === item.level && other.text === item.text && other.file === item.file && other.line === item.line)
    if (!same) this.items.push(item)
  }

  ok(text: string) {
    this.items.push({ level: 'ok', text })
  }

  /** A child report for one file: line numbers are relative to `offset`. */
  forFile(file: string, offset = 0): FileReport {
    return {
      error: (text, line) => this.error(text, file, line === undefined ? undefined : line + offset),
      warning: (text, line) => this.warning(text, file, line === undefined ? undefined : line + offset),
    }
  }

  count(level: ReportItem['level'], file?: string): number {
    return this.items.filter((item) => item.level === level && (file === undefined || item.file === file)).length
  }

  get errors() {
    return this.count('error')
  }

  get warnings() {
    return this.count('warning')
  }
}

export interface FileReport {
  error(text: string, line?: number): void
  warning(text: string, line?: number): void
}

function clean(item: ReportItem): ReportItem {
  let out: ReportItem = { level: item.level, text: item.text }
  if (item.file) out.file = item.file
  if (item.line) out.line = item.line
  return out
}

/** `06-temperature.md:12 → text`, the way the author page lists it. */
export function formatItem(item: ReportItem): string {
  if (!item.file) return item.text
  return `${item.file}${item.line ? `:${item.line}` : ''} → ${item.text}`
}
