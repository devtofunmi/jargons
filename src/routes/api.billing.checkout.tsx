import { createFileRoute } from '@tanstack/react-router'

import { getCurrentUserFromRequest } from '../server/github-auth'

// Starts a Bachs checkout for the signed-in user's workspace and returns the
// hosted checkout URL for the client to redirect to.
export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentUser = await getCurrentUserFromRequest(request)

        if (!currentUser?.workspace) {
          return json({ error: 'unauthorized' }, 401)
        }

        try {
          const { createProCheckout } = await import('../server/billing')
          const url = await createProCheckout(
            currentUser.workspace.id,
            currentUser.email,
            currentUser.name,
          )
          return json({ url }, 200)
        } catch (error) {
          console.error('[billing] checkout failed', error)
          return json({ error: 'Unable to start checkout' }, 500)
        }
      },
    },
  },
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
