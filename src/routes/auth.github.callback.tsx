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

          return redirectToSignIn(getErrorMessage(error), url.origin)
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message

    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }

  return 'Unable to finish GitHub sign in.'
}
