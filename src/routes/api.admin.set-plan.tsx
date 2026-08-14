import { createFileRoute } from '@tanstack/react-router'

import { isAdmin, setWorkspacePlanAsAdmin } from '../server/admin'
import { getCurrentUserFromRequest } from '../server/github-auth'

// Admin-only: manually set a workspace's plan (free ↔ pro). Re-checks the admin
// on the server; the UI gate is never trusted.
export const Route = createFileRoute('/api/admin/set-plan')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getCurrentUserFromRequest(request)
        if (!user || !(await isAdmin(user))) {
          return json({ error: 'forbidden' }, 403)
        }

        let body: { workspaceId?: unknown; plan?: unknown } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          return json({ error: 'invalid body' }, 400)
        }

        const workspaceId =
          typeof body.workspaceId === 'string' ? body.workspaceId : ''
        const plan =
          body.plan === 'pro' ? 'pro' : body.plan === 'free' ? 'free' : null

        if (!workspaceId || !plan) {
          return json({ error: 'workspaceId and plan are required' }, 400)
        }

        try {
          await setWorkspacePlanAsAdmin(workspaceId, plan)
          return json({ ok: true, plan }, 200)
        } catch (error) {
          console.error('[admin] set-plan failed', error)
          return json({ error: 'Unable to update plan' }, 500)
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
