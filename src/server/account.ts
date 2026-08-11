import { createServerFn } from '@tanstack/react-start'

import { deleteSessionCookie, getCurrentUserFromCookie } from './github-auth'

// Permanently delete the signed-in user's account and everything attached to
// it. Deleting the user row cascades to the workspace, sessions, GitHub
// installations, repositories, pull requests, review runs, findings, and
// codebase scans (see the onDelete: 'cascade' foreign keys in the schema).
export const deleteAccount = createServerFn({ method: 'POST' }).handler(
  async () => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser) {
      throw new Error('Sign in before deleting your account.')
    }

    const [{ eq }, { db }, schema, { uninstallGitHubApp }] = await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
      import('./github-app'),
    ])

    // Best-effort: uninstall the GitHub App from the user's account so no
    // installation is left orphaned once the workspace is gone. Never blocks
    // the deletion — a failed uninstall must not strand the account.
    if (currentUser.workspace) {
      const installations = await db
        .select({ installationId: schema.githubInstallations.installationId })
        .from(schema.githubInstallations)
        .where(
          eq(schema.githubInstallations.workspaceId, currentUser.workspace.id),
        )

      for (const { installationId } of installations) {
        await uninstallGitHubApp(installationId)
      }
    }

    await db.delete(schema.users).where(eq(schema.users.id, currentUser.id))

    // Log the browser out immediately; the session row is already gone via the
    // cascade, so the cookie is dead server-side regardless.
    await deleteSessionCookie()

    return { ok: true }
  },
)
