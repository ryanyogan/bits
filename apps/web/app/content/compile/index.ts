// The content build: course folder in, validated JSON out. No I/O here, so
// the CLI (scripts/content.ts), the folder upload (POST /api/author/upload)
// and tests all run the same code. See decision 018.
export { buildCourse, type BuildOptions, type CourseBuild } from './course.ts'
export type { LinkedVideo } from './lesson.ts'
export { formatItem, type ReportItem, type SourceFile } from './report.ts'
