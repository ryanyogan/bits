// Structured logs: one JSON object per line, which Workers Observability
// indexes by field (workers-best-practices). Use these instead of bare
// console.* strings in server code. `error` lines also open Workers Issues
// (decision 039), so keep them for things the owner should look at.

type Level = 'info' | 'warn' | 'error'

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({ level, message, ...fields }))
}

/** An error as loggable fields (no circular structures, no email addresses). */
export function errorFields(error: unknown): { error: { name: string; message: string; stack?: string } | string } {
  return {
    error:
      error instanceof Error
        ? { name: error.name, message: redact(error.message), stack: error.stack && redact(error.stack) }
        : redact(String(error)),
  }
}

/**
 * Where a request went, safe to log: method, path and the Cloudflare ray id
 * (`cf-ray`, the id the dashboard's request logs carry). Never the query
 * string: magic links, email-change links and `/login/check` carry tokens
 * and addresses there. Paths hold only public ids (course slugs, handles).
 */
export function requestFields(request: Request): { method: string; path: string; rayId: string | null } {
  return {
    method: request.method,
    path: new URL(request.url).pathname,
    rayId: request.headers.get('cf-ray'),
  }
}

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[a-z]{2,}/gi

/** Drops anything shaped like an email address from logged text. */
export function redact(text: string): string {
  return text.replace(EMAIL, '[email]')
}
