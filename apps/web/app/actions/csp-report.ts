import { log } from '../log.ts'

// Content-Security-Policy violation reports (decision 027). Browsers send the
// old `report-uri` shape (application/csp-report, one report) or the Reporting
// API shape (application/reports+json, an array). Either way each report
// becomes one `warn` log line; nothing is stored.

/** Reports are small; anything bigger is not a browser's report. */
const MAX_BODY_BYTES = 16 * 1024
/** Reporting API batches can hold several; log a few at most. */
const MAX_REPORTS = 5

export interface CspViolation {
  documentURL?: string
  blockedURL?: string
  effectiveDirective?: string
  disposition?: string
  sourceFile?: string
  lineNumber?: number
  columnNumber?: number
  sample?: string
}

/** Logs the request's violation reports and answers 204, whatever it holds. */
export async function receiveCspReport(request: Request): Promise<Response> {
  let text = await readCapped(request, MAX_BODY_BYTES)
  for (let violation of text ? parseCspReports(text).slice(0, MAX_REPORTS) : []) {
    log('warn', 'CSP violation', { csp: violation })
  }
  return new Response(null, { status: 204 })
}

/** Both report shapes, normalised; URLs lose their query and fragment (magic-link tokens live there). */
export function parseCspReports(text: string): CspViolation[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return []
  }
  let bodies: Record<string, unknown>[] = []
  if (Array.isArray(json)) {
    for (let report of json) {
      if (isRecord(report) && report.type === 'csp-violation' && isRecord(report.body)) bodies.push(report.body)
    }
  } else if (isRecord(json) && isRecord(json['csp-report'])) {
    let r = json['csp-report']
    bodies.push({
      documentURL: r['document-uri'],
      blockedURL: r['blocked-uri'],
      effectiveDirective: r['effective-directive'] ?? r['violated-directive'],
      disposition: r.disposition,
      sourceFile: r['source-file'],
      lineNumber: r['line-number'],
      columnNumber: r['column-number'],
      sample: r['script-sample'],
    })
  }
  return bodies.map((body) => ({
    documentURL: cleanUrl(body.documentURL),
    blockedURL: cleanUrl(body.blockedURL),
    effectiveDirective: short(body.effectiveDirective),
    disposition: short(body.disposition),
    sourceFile: cleanUrl(body.sourceFile),
    lineNumber: typeof body.lineNumber === 'number' ? body.lineNumber : undefined,
    columnNumber: typeof body.columnNumber === 'number' ? body.columnNumber : undefined,
    sample: short(body.sample),
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function short(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value.slice(0, 120) : undefined
}

/** `inline`, `eval` and the like pass through; URLs keep only origin and path. */
function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    let url = new URL(value)
    return short(url.protocol === 'http:' || url.protocol === 'https:' ? url.origin + url.pathname : url.protocol)
  } catch {
    return short(value)
  }
}

async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return null
  let reader = request.body.getReader()
  let chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    let { done, value } = await reader.read()
    if (done || !value) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  let bytes = new Uint8Array(size)
  let offset = 0
  for (let chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
