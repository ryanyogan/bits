// The course-metadata fixtures (decision 073) in content/fixtures/. Only the
// test platform (platform.node.ts) publishes them, next to content/courses/.
export const soonCourse = {
  slug: 'soon-course',
  title: 'Soon course',
  lessons: ['what-it-is', 'build-it'],
} as const

export const buildAlongCourse = {
  slug: 'build-along',
  title: 'Build-along course',
  repo: 'https://github.com/ryanyogan/klippy',
  /** No code, works on a phone. */
  idea: 'the-idea',
  /** `device: desk`, `tag: a-01`, `verified: 2026-11-01`, two versions, a ``` sample. */
  build: 'first-step',
} as const
