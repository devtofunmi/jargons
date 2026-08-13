import { createFileRoute } from '@tanstack/react-router'

import { completeGitHubAuthWithCode } from '../server/github-auth'

export const Route = createFileRoute('/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return redirectToSignIn(
            'GitHub did not return an authorization code.',
            url.origin,
          )
        }

        try {
          await completeGitHubAuthWithCode(code)

          return redirectTo(new URL('/app', url.origin))
        } catch (error) {
          console.error('GitHub auth callback failed', error)

          return redirectToSignIn(getSafeMessage(error), url.origin)
        }
      },
    },
  },
})

function redirectToSignIn(message: string, origin: string) {
  const url = new URL('/auth/sign-in', origin)

  url.searchParams.set('error', message)

  return redirectTo(url)
}

// Response.redirect() returns a Response with immutable headers, which
// breaks when the framework appends the Set-Cookie header after the
// handler returns — so build the redirect with mutable headers instead.
function redirectTo(url: URL) {
  return new Response(null, {
    status: 302,
    headers: { location: url.toString() },
  })
}

// Never surface the raw error to the user: it ends up in the ?error= query and
// is rendered on the sign-in page, and an auth failure can wrap a DB error
// whose message contains SQL and params (e.g. the user's email). The real error
// is logged above; return a safe, generic message — and treat connectivity/DB
// failures as a temporary outage. The message is only inspected here, not shown.
function getSafeMessage(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : ''
  const looksTransient =
    text.includes('failed query') ||
    text.includes('etimedout') ||
    text.includes('econnrefused') ||
    text.includes('connect_timeout') ||
    text.includes('econnreset') ||
    text.includes('connection') ||
    text.includes('timeout') ||
    text.includes('fetch failed')

  return looksTransient
    ? 'We could not reach our systems. Please try again in a moment.'
    : 'We could not complete GitHub sign in. Please try again.'
}
