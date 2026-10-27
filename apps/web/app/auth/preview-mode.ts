// Is this Worker a Workers Preview (decisions 032, 038)? Pure, so the
// wrangler.jsonc check (scripts/lib/preview-resources.ts) can run the same
// rule over the config without loading the platform.

/** The env fields that say whether this Worker is a Workers Preview. */
export interface PreviewSignals {
  APP_ENV?: string
  CANONICAL_ORIGIN?: string
  EMAIL?: unknown
}

/**
 * `APP_ENV=preview`, which only the `previews` block of wrangler.jsonc sets,
 * and none of production's canonical origin or mail binding. All three must
 * hold, so production can't become a preview through one wrong var.
 */
export function previewMode(signals: PreviewSignals): boolean {
  return signals.APP_ENV === 'preview' && !signals.CANONICAL_ORIGIN && !signals.EMAIL
}
