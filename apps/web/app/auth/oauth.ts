// GitHub and Google sign-in through remix/auth's built-in providers (OAuth 2
// with PKCE and state; the transaction lives in the session).
//
// Providers are created once per origin and cached, so the callback URL
// always matches the host the browser is on (localhost in development, the
// workers.dev host in production). Each OAuth app must register that URL.
import type { OAuthProvider as OAuthProviderName } from '@bits/db'
import {
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  type GitHubAuthProfile,
  type GoogleAuthProfile,
  type OAuthProvider,
  type OAuthResult,
} from 'remix/auth'

import { routes } from '../routes.ts'
import { oauthCredentials } from './config.ts'
import type { OAuthProfile } from './users.ts'

export type GitHubProvider = OAuthProvider<GitHubAuthProfile, 'github'>
export type GoogleProvider = OAuthProvider<GoogleAuthProfile, 'google'>

const cache = new Map<string, GitHubProvider | GoogleProvider>()

export function isOAuthProviderName(value: string): value is OAuthProviderName {
  return value === 'github' || value === 'google'
}

function redirectUri(name: OAuthProviderName, origin: string): URL {
  return new URL(routes.auth.oauth.callback.href({ provider: name }), origin)
}

/** The GitHub provider for this origin, or null when GITHUB_CLIENT_ID/SECRET are unset. */
export function githubProvider(origin: string): GitHubProvider | null {
  let credentials = oauthCredentials('github')
  if (!credentials) return null
  let key = `github ${origin}`
  let provider = cache.get(key) as GitHubProvider | undefined
  if (!provider) {
    provider = createGitHubAuthProvider({ ...credentials, redirectUri: redirectUri('github', origin) })
    cache.set(key, provider)
  }
  return provider
}

/** The Google provider for this origin, or null when GOOGLE_CLIENT_ID/SECRET are unset. */
export function googleProvider(origin: string): GoogleProvider | null {
  let credentials = oauthCredentials('google')
  if (!credentials) return null
  let key = `google ${origin}`
  let provider = cache.get(key) as GoogleProvider | undefined
  if (!provider) {
    provider = createGoogleAuthProvider({ ...credentials, redirectUri: redirectUri('google', origin) })
    cache.set(key, provider)
  }
  return provider
}

/**
 * GitHub's email is the profile email or a verified address from the email
 * API (remix/auth picks only verified ones), so it counts as verified.
 */
export function githubProfile(result: OAuthResult<GitHubAuthProfile, 'github'>): OAuthProfile {
  return {
    provider: 'github',
    providerUserId: result.account.providerAccountId,
    email: result.profile.email?.toLowerCase() ?? null,
    name: result.profile.name ?? null,
    username: result.profile.login,
  }
}

/** Google's email is used only when the provider says it is verified. */
export function googleProfile(result: OAuthResult<GoogleAuthProfile, 'google'>): OAuthProfile {
  let { email, email_verified, name } = result.profile
  return {
    provider: 'google',
    providerUserId: result.account.providerAccountId,
    email: email && email_verified ? email.toLowerCase() : null,
    name: name ?? null,
    username: email ? email.split('@')[0]! : null,
  }
}
