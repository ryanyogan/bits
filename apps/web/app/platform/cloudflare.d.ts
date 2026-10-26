// Bridges wrangler's generated `Env` (worker-configuration.d.ts, which names
// runtime types as globals) to module-scoped @cloudflare/workers-types. The app
// also runs on Node in development, so it cannot load the Workers runtime
// globals wholesale without clobbering Node/DOM `Request`, `Response`, etc.
declare global {
  type D1Database = import('@cloudflare/workers-types/index.ts').D1Database
  type Fetcher = import('@cloudflare/workers-types/index.ts').Fetcher
  type ExecutionContext = import('@cloudflare/workers-types/index.ts').ExecutionContext
  type SendEmail = import('@cloudflare/workers-types/index.ts').SendEmail

  // Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them.
  // Optional because development and tests run without them (app/auth/config.ts).
  interface Env {
    SESSION_SECRET?: string
    TURNSTILE_SECRET_KEY?: string
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
  }
}

export {}
