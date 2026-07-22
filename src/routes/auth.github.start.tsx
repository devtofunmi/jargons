import { createFileRoute } from '@tanstack/react-router'

import { getGitHubAuthorizeUrl } from '../server/github-auth'

export const Route = createFileRoute('/auth/github/start')({
  server: {
    handlers: {
      GET: async () =>
        // Not Response.redirect() — its immutable headers break if the
        // framework needs to append headers (e.g. Set-Cookie) afterwards.
        new Response(null, {
          status: 302,
          headers: { location: getGitHubAuthorizeUrl() },
        }),
    },
  },
})
