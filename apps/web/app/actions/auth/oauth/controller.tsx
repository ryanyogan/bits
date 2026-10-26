import { finishExternalAuth, startExternalAuth } from 'remix/auth'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { currentUser } from '../../../auth/identity.ts'
import { githubProfile, githubProvider, googleProfile, googleProvider, isOAuthProviderName } from '../../../auth/oauth.ts'
import { startUserSession, userForOAuth, type OAuthProfile } from '../../../auth/users.ts'
import { routes } from '../../../routes.ts'
import { safeNextPath } from '../../login/schema.ts'

const toLogin = (error: string) => redirect(routes.login.index.href(undefined, { searchParams: { error } }), 303)

const toSettings = (saved: string, provider: string) =>
  redirect(`${routes.settings.index.href(undefined, { searchParams: { saved, method: provider } })}#sign-in`, 303)

// GitHub and Google (remix/auth): start redirects to the provider with PKCE
// and state kept in the session; the callback verifies them, then signs in,
// links, or creates the account (decision 015).
export default createController(routes.auth.oauth, {
  actions: {
    start(context) {
      let name = context.params.provider
      let returnTo = safeNextPath(context.url.searchParams.get('next')) ?? null
      if (name === 'github') {
        let provider = githubProvider(context.url.origin)
        return provider ? startExternalAuth(provider, context, { returnTo }) : toLogin('github-unavailable')
      }
      if (name === 'google') {
        let provider = googleProvider(context.url.origin)
        return provider ? startExternalAuth(provider, context, { returnTo }) : toLogin('google-unavailable')
      }
      return new Response('Unknown sign-in provider', { status: 404 })
    },

    async callback(context) {
      let name = context.params.provider
      if (!isOAuthProviderName(name)) return new Response('Unknown sign-in provider', { status: 404 })

      let profile: OAuthProfile
      let returnTo: string | undefined
      try {
        if (name === 'github') {
          let provider = githubProvider(context.url.origin)
          if (!provider) return toLogin('github-unavailable')
          let finished = await finishExternalAuth(provider, context)
          profile = githubProfile(finished.result)
          returnTo = finished.returnTo
        } else {
          let provider = googleProvider(context.url.origin)
          if (!provider) return toLogin('google-unavailable')
          let finished = await finishExternalAuth(provider, context)
          profile = googleProfile(finished.result)
          returnTo = finished.returnTo
        }
      } catch (error) {
        // Denied consent, a replayed or forged state, or a provider error.
        console.error(JSON.stringify({ level: 'warn', message: 'OAuth callback failed', provider: name, error: String(error) }))
        return toLogin('oauth-failed')
      }

      let signedIn = currentUser(context)
      let outcome = await userForOAuth(context.db, profile, signedIn)
      if (!outcome.ok) {
        return outcome.reason === 'taken' ? toSettings('already-linked', name) : toLogin('oauth-no-email')
      }
      // Connecting from /settings: the session already belongs to this user.
      if (signedIn) return toSettings('connected', name)

      startUserSession(context, outcome.user, name)
      return redirect(safeNextPath(returnTo) ?? routes.courses.index.href(), 303)
    },
  },
})
