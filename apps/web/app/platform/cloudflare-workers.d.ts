// Ambient declaration for the Workers runtime module. Kept in a script (non-
// module) .d.ts so `declare module` declares rather than augments.
declare module 'cloudflare:workers' {
  /** Worker bindings, importable at module scope. */
  export const env: Env
}
