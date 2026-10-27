// Test support: a software WebAuthn authenticator (ES256, "none"
// attestation) that answers the server's real options the way a browser
// and platform authenticator would, so tests exercise the full verifier
// instead of mocking it. Web Crypto only.
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'

const encoder = new TextEncoder()

export interface SoftAuthenticatorOptions {
  /** clientDataJSON.origin; defaults to the test router's origin. */
  origin?: string
  /** Sets the user-verified flag (default true). */
  userVerified?: boolean
  /** Sets backup-eligible + backed-up, like a synced passkey (default true). */
  synced?: boolean
}

export interface SoftAuthenticator {
  credentialId: string
  register(options: PublicKeyCredentialCreationOptionsJSON, overrides?: SoftAuthenticatorOptions): Promise<RegistrationResponseJSON>
  authenticate(options: PublicKeyCredentialRequestOptionsJSON, overrides?: SoftAuthenticatorOptions): Promise<AuthenticationResponseJSON>
}

export async function createSoftAuthenticator(defaults: SoftAuthenticatorOptions = {}): Promise<SoftAuthenticator> {
  let keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  let rawId = crypto.getRandomValues(new Uint8Array(16))
  let credentialId = b64url(rawId)
  let counter = 0
  let userHandle: string | undefined

  let settings = (overrides?: SoftAuthenticatorOptions) => ({
    origin: 'http://localhost',
    userVerified: true,
    synced: true,
    ...defaults,
    ...overrides,
  })

  async function authData(rpId: string, flags: number, attested?: Uint8Array): Promise<Uint8Array> {
    let rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)))
    let count = new Uint8Array(4)
    new DataView(count.buffer).setUint32(0, counter)
    return concat(rpIdHash, Uint8Array.of(flags), count, attested ?? new Uint8Array())
  }

  function flags(options: ReturnType<typeof settings>, attested: boolean): number {
    let value = 0x01 // UP
    if (options.userVerified) value |= 0x04 // UV
    if (options.synced) value |= 0x08 | 0x10 // BE + BS
    if (attested) value |= 0x40 // AT
    return value
  }

  return {
    credentialId,

    async register(options, overrides) {
      let config = settings(overrides)
      userHandle = options.user.id
      let jwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
      let coseKey = cbor(
        new Map<number, unknown>([
          [1, 2], // kty: EC2
          [3, -7], // alg: ES256
          [-1, 1], // crv: P-256
          [-2, fromB64url(jwk.x!)],
          [-3, fromB64url(jwk.y!)],
        ]),
      )
      let idLength = new Uint8Array(2)
      new DataView(idLength.buffer).setUint16(0, rawId.length)
      let attested = concat(new Uint8Array(16), idLength, rawId, coseKey)
      let data = await authData(options.rp.id ?? 'localhost', flags(config, true), attested)
      let attestationObject = cbor(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', data],
        ]),
      )
      let clientDataJSON = encoder.encode(
        JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin: config.origin, crossOrigin: false }),
      )
      return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: b64url(clientDataJSON),
          attestationObject: b64url(attestationObject),
          transports: ['internal', 'hybrid'],
        },
      }
    },

    async authenticate(options, overrides) {
      let config = settings(overrides)
      counter++
      let data = await authData(options.rpId ?? 'localhost', flags(config, false))
      let clientDataJSON = encoder.encode(
        JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin: config.origin, crossOrigin: false }),
      )
      let clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
      let signature = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, concat(data, clientHash)),
      )
      return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(data),
          signature: b64url(derSignature(signature)),
          userHandle,
        },
      }
    },
  }
}

// --- encoding helpers ------------------------------------------------------

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (let part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(text: string): Uint8Array {
  let base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

/** Raw r||s (Web Crypto) to the ASN.1 DER that WebAuthn ES256 signatures use. */
function derSignature(raw: Uint8Array): Uint8Array {
  let integer = (bytes: Uint8Array) => {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) start++
    let trimmed = bytes.slice(start)
    let body = trimmed[0]! & 0x80 ? concat(Uint8Array.of(0), trimmed) : trimmed
    return concat(Uint8Array.of(0x02, body.length), body)
  }
  let body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)))
  return concat(Uint8Array.of(0x30, body.length), body)
}

/** Just enough CBOR for attestation objects: ints, byte/text strings, maps. */
function cbor(value: unknown): Uint8Array {
  let head = (major: number, length: number): Uint8Array => {
    if (length < 24) return Uint8Array.of((major << 5) | length)
    if (length < 0x100) return Uint8Array.of((major << 5) | 24, length)
    return Uint8Array.of((major << 5) | 25, length >> 8, length & 0xff)
  }
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value)
  if (typeof value === 'string') {
    let bytes = encoder.encode(value)
    return concat(head(3, bytes.length), bytes)
  }
  if (value instanceof Uint8Array) return concat(head(2, value.length), value)
  if (value instanceof Map) {
    let parts: Uint8Array[] = [head(5, value.size)]
    for (let [key, item] of value) parts.push(cbor(key), cbor(item))
    return concat(...parts)
  }
  throw new Error(`cbor: unsupported value ${String(value)}`)
}
