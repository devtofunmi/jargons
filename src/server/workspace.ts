import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../db/load'
import { getCurrentUserFromCookie } from './github-auth'

export type WorkspaceSettingsData = {
  workspace: {
    name: string
    slug: string
  }
  owner: {
    name: string
    username: string
    email: string | null
    avatarUrl: string | null
  }
  installation: {
    accountLogin: string
    status: string
  } | null
  repositoryCount: number
  preferences: {
    reviewPullRequests: boolean
    reviewSecurity: boolean
    reviewCodebaseScans: boolean
  }
}

export const getWorkspaceSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WorkspaceSettingsData | null> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return null
    }

    const {
      count,
      eq,
      db,
      githubInstallations,
      repositories,
      workspaceSettings,
    } = await loadDb()

    const workspaceId = currentUser.workspace.id
    const [installationRows, repositoryCountRows, settingsRows] =
      await Promise.all([
        db
          .select({
            accountLogin: githubInstallations.accountLogin,
            status: githubInstallations.status,
          })
          .from(githubInstallations)
          .where(eq(githubInstallations.workspaceId, workspaceId))
          .limit(1),
        db
          .select({ value: count() })
          .from(repositories)
          .where(eq(repositories.workspaceId, workspaceId)),
        db
          .select({
            reviewPullRequests: workspaceSettings.reviewPullRequests,
            reviewSecurity: workspaceSettings.reviewSecurity,
            reviewCodebaseScans: workspaceSettings.reviewCodebaseScans,
          })
          .from(workspaceSettings)
          .where(eq(workspaceSettings.workspaceId, workspaceId))
          .limit(1),
      ])

    return {
      workspace: {
        name: currentUser.workspace.name,
        slug: currentUser.workspace.slug,
      },
      owner: {
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
      },
      installation: installationRows[0] ?? null,
      repositoryCount: repositoryCountRows[0]?.value ?? 0,
      preferences: settingsRows[0] ?? {
        reviewPullRequests: true,
        reviewSecurity: true,
        reviewCodebaseScans: true,
      },
    }
  },
)

export const updateReviewPreferences = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      reviewPullRequests: boolean
      reviewSecurity: boolean
      reviewCodebaseScans: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in before updating workspace settings.')
    }

    const { db, workspaceSettings } = await loadDb()

    await db
      .insert(workspaceSettings)
      .values({
        workspaceId: currentUser.workspace.id,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })

    return { ok: true }
  })
