import { createFileRoute } from '@tanstack/react-router'

import { getGitHubAuthorizeUrl, setSignInNext } from '../server/github-auth'

export const Route = createFileRoute('/auth/github/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await setSignInNext(new URL(request.url).searchParams.get('next'))

        // Not Response.redirect() — its immutable headers break if the
        // framework needs to append headers (e.g. Set-Cookie) afterwards.
        return new Response(null, {
          status: 302,
          headers: { location: getGitHubAuthorizeUrl() },
        })
      },
    },
  },
})
