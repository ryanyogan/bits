// The paths a `:::verify` block may call (decision 072). Pure and tiny: the
// content build checks authored paths with it, and the endpoint checks them
// again before every fetch, without loading the content compiler.

/** Longest path a `:::verify` may call. */
export const MAX_VERIFY_PATH = 200

/**
 * One leading slash (never `//`, which would name another host), then
 * unreserved characters and slashes, and an optional query of the same plus
 * `=` and `&`. No `%`, `@`, `\` or `#`.
 */
const VERIFY_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/]*(?:\?[A-Za-z0-9\-._~=&]*)?$/

/** Whether `path` is one a `:::verify` may call: the shape above, at most 200 characters, no `..` segment. */
export function isVerifyPath(path: string): boolean {
  return path.length <= MAX_VERIFY_PATH && VERIFY_PATH.test(path) && !path.split(/[/?]/).includes('..')
}

/** The label of the status check every deploy check starts with. */
export function statusLabel(path: string): string {
  return `${path} answers 200 OK`
}
