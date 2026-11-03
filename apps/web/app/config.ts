// App-wide constants. The product name lives here and nowhere else: change it
// once and the wordmark, titles and copy follow.

/** Product name and wordmark (always lowercase in the wordmark). */
export const APP_NAME = 'bits'

/**
 * Product name as written in prose and document titles: the same lowercase
 * "bits" (decision 005), even at the start of a sentence. Kept as its own
 * name so prose reads as prose at the call site.
 */
export const APP_TITLE = APP_NAME

/** One-line pitch used in the default description. */
export const APP_TAGLINE = 'Learn AI by typing to it.'

/** Builds a document title: "Page · bits", or just "bits" for the landing page. */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${APP_TITLE}` : APP_TITLE
}
