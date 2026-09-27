import { createFileRoute } from '@tanstack/react-router'

import { isPaidPlan } from '../lib/plans'
import { getCurrentUserFromRequest } from '../server/github-auth'

// Starts a Bachs checkout for the signed-in user's workspace on the requested
// paid plan (`{ plan }` in the body, defaulting to Pro) and returns the hosted
// checkout URL for the client to redirect to.
export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentUser = await getCurrentUserFromRequest(request)

        if (!currentUser?.workspace) {
          return json({ error: 'unauthorized' }, 401)
        }

        let body: { plan?: unknown } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          // no body: fall back to Pro, the original single plan
        }
        const plan = body.plan === undefined ? 'pro' : body.plan
        if (!isPaidPlan(plan)) {
          return json({ error: 'unknown plan' }, 400)
        }

        try {
          const { createCheckout, getWorkspaceBilling } =
            await import('../server/billing')
          // A second checkout would start a second subscription alongside the
          // first, so switching plans isn't self-serve yet.
          const billing = await getWorkspaceBilling(currentUser.workspace.id)
          if (billing.plan !== 'free') {
            return json({ error: 'already_subscribed' }, 409)
          }
          const url = await createCheckout(
            currentUser.workspace.id,
            plan,
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
