import { createFileRoute } from '@tanstack/react-router'

import { addWorkspaceRunsAsAdmin, isAdmin } from '../server/admin'
import { getCurrentUserFromRequest } from '../server/github-auth'

// Admin-only: grant one-time bonus runs to a workspace's current window.
// Re-checks the admin on the server; the UI gate is never trusted.
export const Route = createFileRoute('/api/admin/add-runs')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getCurrentUserFromRequest(request)
        if (!user || !(await isAdmin(user))) {
          return json({ error: 'forbidden' }, 403)
        }

        let body: { workspaceId?: unknown; runs?: unknown } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          return json({ error: 'invalid body' }, 400)
        }

        const workspaceId =
          typeof body.workspaceId === 'string' ? body.workspaceId : ''
        const runs =
          typeof body.runs === 'number' && Number.isInteger(body.runs)
            ? body.runs
            : NaN

        if (
          !workspaceId ||
          !Number.isInteger(runs) ||
          runs < 1 ||
          runs > 1000
        ) {
          return json(
            {
              error:
                'workspaceId and a runs count between 1 and 1000 are required',
            },
            400,
          )
        }

        try {
          await addWorkspaceRunsAsAdmin(workspaceId, runs)
          return json({ ok: true, runs }, 200)
        } catch (error) {
          console.error('[admin] add-runs failed', error)
          return json({ error: 'Unable to grant runs' }, 500)
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
