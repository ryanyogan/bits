// Reads course folders from disk for the content build. Node-only: used by
// scripts/content.ts and by the test platform (platform.node.ts), which
// publishes content/courses/ into the in-memory bindings.
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { SourceFile } from '../../app/content/compile/index.ts'

/** The repo's course folders: content/courses/<slug>/. */
export const coursesDir = path.resolve(import.meta.dirname, '../../../../content/courses')

/** Files whose text the build reads; everything else is listed by size only. */
const TEXT_FILES = /\.(md|vtt|txt)$/i

/** Every file in a course folder, paths relative to it. Dotfiles are skipped. */
export async function readCourseFolder(dir: string): Promise<SourceFile[]> {
  let entries = await fs.readdir(dir, { recursive: true, withFileTypes: true })
  let files: SourceFile[] = []
  for (let entry of entries) {
    if (!entry.isFile()) continue
    let full = path.join(entry.parentPath, entry.name)
    let rel = path.relative(dir, full).split(path.sep).join('/')
    if (rel.split('/').some((part) => part.startsWith('.'))) continue
    let stat = await fs.stat(full)
    let file: SourceFile = { path: rel, size: stat.size }
    if (TEXT_FILES.test(rel)) file.text = await fs.readFile(full, 'utf8')
    files.push(file)
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** Course folders under `root` (each has a course.md), sorted by name. */
export async function listCourseFolders(root = coursesDir): Promise<string[]> {
  let entries = await fs.readdir(root, { withFileTypes: true })
  let folders: string[] = []
  for (let entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    folders.push(path.join(root, entry.name))
  }
  return folders.sort()
}
