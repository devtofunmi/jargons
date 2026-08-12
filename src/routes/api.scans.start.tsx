import { createFileRoute } from '@tanstack/react-router'

import { loadDb } from '../db/load'
import { getCurrentUserFromRequest } from '../server/github-auth'

export const Route = createFileRoute('/api/scans/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentUser = await getCurrentUserFromRequest(request)

        if (!currentUser?.workspace) {
          return json({ error: 'unauthorized' }, 401)
        }

        // Freemium gate: a free workspace gets one lifetime agent run.
        const { getWorkspaceBilling, incrementWorkspaceRuns } =
          await import('../server/billing')
        const billing = await getWorkspaceBilling(currentUser.workspace.id)
        if (!billing.canRun) {
          return json(
            { error: 'upgrade_required', upgradeUrl: billing.upgradeUrl },
            402,
          )
        }

        let body: { repositoryId?: string }
        try {
          body = (await request.json()) as { repositoryId?: string }
        } catch {
          return json({ error: 'invalid body' }, 400)
        }

        if (!body.repositoryId) {
          return json({ error: 'repositoryId is required' }, 400)
        }

        const {
          and,
          eq,
          db,
          codebaseScans,
          githubInstallations,
          repositories,
        } = await loadDb()

        const repositoryRows = await db
          .select({
            id: repositories.id,
            owner: repositories.owner,
            name: repositories.name,
            defaultBranch: repositories.defaultBranch,
            status: repositories.status,
          })
          .from(repositories)
          .where(
            and(
              eq(repositories.id, body.repositoryId),
              eq(repositories.workspaceId, currentUser.workspace.id),
            ),
          )
          .limit(1)

        if (repositoryRows.length === 0) {
          return json({ error: 'repository not found' }, 404)
        }

        const repository = repositoryRows[0]

        // Paused repositories are excluded from all agent runs.
        if (repository.status === 'paused') {
          return json({ error: 'repository_paused' }, 409)
        }

        const installationRows = await db
          .select({ installationId: githubInstallations.installationId })
          .from(githubInstallations)
          .where(eq(githubInstallations.workspaceId, currentUser.workspace.id))
          .limit(1)

        const installationId = installationRows[0]?.installationId

        if (!installationId) {
          return json({ error: 'github app not connected' }, 400)
        }

        const inserted = await db
          .insert(codebaseScans)
          .values({ repositoryId: repository.id, status: 'queued' })
          .returning({ id: codebaseScans.id })

        const scanId = inserted[0].id

        await incrementWorkspaceRuns(currentUser.workspace.id)

        // Background: kept alive after the response via waitUntil so serverless
        // doesn't tear the run down. The engine owns its tracing and never throws.
        const [{ runScan }, { runInBackground }] = await Promise.all([
          import('../server/scan-engine/run-scan'),
          import('../server/background'),
        ])
        runInBackground(
          runScan({
            scanId,
            installationId,
            workspace: currentUser.workspace.slug,
            owner: repository.owner,
            repo: repository.name,
            branch: repository.defaultBranch,
          }),
        )

        return json({ scanId }, 202)
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
