// Bridges wrangler's generated `Env` (worker-configuration.d.ts, which names
// runtime types as globals) to module-scoped @cloudflare/workers-types. The app
// also runs on Node in development, so it cannot load the Workers runtime
// globals wholesale without clobbering Node/DOM `Request`, `Response`, etc.
declare global {
  type D1Database = import('@cloudflare/workers-types/index.ts').D1Database
  type Fetcher = import('@cloudflare/workers-types/index.ts').Fetcher
  type ExecutionContext = import('@cloudflare/workers-types/index.ts').ExecutionContext
}

export {}
