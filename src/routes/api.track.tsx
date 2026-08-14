import { createFileRoute } from '@tanstack/react-router'

import { loadDb } from '../db/load'

// Records a public page view. Best-effort and privacy-light: only the path,
// referrer, and the visitor's country (from the edge geo header) are stored —
// no cookies, no IP, no user id. Always returns 204 so tracking never breaks a
// page load.
export const Route = createFileRoute('/api/track')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { path?: unknown; referrer?: unknown } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          return new Response(null, { status: 204 })
        }

        const path =
          typeof body.path === 'string' ? body.path.slice(0, 512) : ''
        if (!path) {
          return new Response(null, { status: 204 })
        }

        const referrer =
          typeof body.referrer === 'string' ? body.referrer.slice(0, 512) : null
        // Vercel/edge geo header (ISO alpha-2). Absent locally → null.
        const country =
          request.headers.get('x-vercel-ip-country') ||
          request.headers.get('cf-ipcountry') ||
          null

        try {
          const { db, pageViews } = await loadDb()
          await db.insert(pageViews).values({ path, referrer, country })
        } catch (error) {
          console.error('[track] failed to record page view', error)
        }

        return new Response(null, { status: 204 })
      },
    },
  },
})
