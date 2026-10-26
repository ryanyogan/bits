// Structured logs: one JSON object per line, which Workers Observability
// indexes by field (workers-best-practices). Use these instead of bare
// console.* strings in server code.

type Level = 'info' | 'warn' | 'error'

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({ level, message, ...fields }))
}

/** An error as loggable fields (no circular structures). */
export function errorFields(error: unknown): { error: { name: string; message: string; stack?: string } | string } {
  return {
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  }
}
