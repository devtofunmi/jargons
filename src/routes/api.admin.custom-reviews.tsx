import { createFileRoute } from '@tanstack/react-router'

import { isAdmin, setCustomReviewsGrantAsAdmin } from '../server/admin'
import { getCurrentUserFromRequest } from '../server/github-auth'

// Admin-only: grant or revoke custom review instructions for a workspace.
// Re-checks the admin on the server; the UI gate is never trusted.
export const Route = createFileRoute('/api/admin/custom-reviews')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getCurrentUserFromRequest(request)
        if (!user || !(await isAdmin(user))) {
          return json({ error: 'forbidden' }, 403)
        }

        let body: { workspaceId?: unknown; granted?: unknown } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          return json({ error: 'invalid body' }, 400)
        }

        const workspaceId =
          typeof body.workspaceId === 'string' ? body.workspaceId : ''
        if (!workspaceId || typeof body.granted !== 'boolean') {
          return json({ error: 'workspaceId and granted are required' }, 400)
        }

        try {
          await setCustomReviewsGrantAsAdmin(workspaceId, body.granted)
          return json({ ok: true, granted: body.granted }, 200)
        } catch (error) {
          console.error('[admin] custom-reviews failed', error)
          return json({ error: 'Unable to update custom reviews' }, 500)
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
