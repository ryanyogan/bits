// WebCrypto helpers for secrets that are stored hashed (decision 015). Works
// the same on Workers and Node; no `node:crypto`.

const encoder = new TextEncoder()

/** Lowercase hex SHA-256 of a string. */
export async function sha256Hex(value: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 32 random bytes as base64url: the magic-link token. */
export function randomToken(): string {
  let bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A uniformly random 6-digit code, leading zeros kept. */
export function randomCode(): string {
  // Rejection sampling: 4294000000 is the largest multiple of 10^6 below 2^32.
  let value: number
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0]!
  } while (value >= 4_294_000_000)
  return String(value % 1_000_000).padStart(6, '0')
}

/** Constant-time comparison for equal-length hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
