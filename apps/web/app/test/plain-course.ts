// The test-only course in content/fixtures/plain-course/. The test platform
// (platform.node.ts) publishes it next to content/courses/; nothing else does.
// Its lessons have no gated blocks, so `completeLesson(cookie, course, lesson)`
// finishes each one without fields. Use it for tests about progress, badges
// and certificates rather than a real course, whose lessons will change.
export const plainCourse = {
  slug: 'plain-course',
  title: 'Plain course',
  badge: 'Plain course',
  lessons: ['lesson-1', 'lesson-2', 'lesson-3'],
} as const
