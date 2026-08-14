// GitHub App server functions — the app-facing API for installing the app,
// reporting install status, and reading synced repositories. The GitHub REST
// client lives in ./client and the repository sync + read models in
// ./repositories; this module composes them behind createServerFn handlers.

import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../../db/load'
import { getEnv } from '../env'
import { getCurrentUserFromCookie } from '../github-auth'
import { findInstallationId, getInstallation } from './client'
import {
  loadRepositoryStats,
  syncInstallationRepositories,
  toSyncedRepository,
} from './repositories'
import type { SyncedRepository } from './repositories'

export type { SeverityCounts } from '../../lib/severity'
export type { SyncedRepository } from './repositories'
export {
  createInstallationAccessToken,
  githubHeaders,
  uninstallGitHubApp,
} from './client'

export const getGitHubAppInstallUrl = createServerFn({
  method: 'GET',
}).handler(async () => {
  const appSlug = getEnv('GITHUB_APP_SLUG')
  const appUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`)

  return {
    url: appUrl.toString(),
  }
})

export const getGitHubAppStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return { signedIn: Boolean(currentUser), installed: false }
    }

    const { eq, db, githubInstallations } = await loadDb()

    const rows = await db
      .select({ id: githubInstallations.id })
      .from(githubInstallations)
      .where(eq(githubInstallations.workspaceId, currentUser.workspace.id))
      .limit(1)

    return { signedIn: true, installed: rows.length > 0 }
  },
)

export const completeGitHubAppInstallation = createServerFn({ method: 'POST' })
  .validator((input: { installationId?: string }) => input)
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in before installing the GitHub app.')
    }

    // GitHub omits installation_id when redirecting after an update to an
    // existing installation (setup_action=update), so fall back to finding
    // the installation ourselves.
    const installationId =
      data.installationId ??
      (await findInstallationId(currentUser.workspace.id, currentUser.username))
    const installation = await getInstallation(installationId)
    const { db, githubInstallations } = await loadDb()
    const accountLogin = installation.account?.login ?? currentUser.username
    const accountType = installation.account?.type ?? 'User'
    const now = new Date()

    await db
      .insert(githubInstallations)
      .values({
        workspaceId: currentUser.workspace.id,
        installationId: String(installation.id),
        accountLogin,
        accountType,
        status: 'active',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          workspaceId: currentUser.workspace.id,
          accountLogin,
          accountType,
          status: 'active',
          updatedAt: now,
        },
      })

    const syncedRepositories = await syncInstallationRepositories({
      installationId: String(installation.id),
      workspaceId: currentUser.workspace.id,
    })

    return {
      accountLogin,
      syncedRepositories,
      // Already-onboarded users (e.g. updating repo access) shouldn't be sent
      // back through onboarding after installing.
      onboarded: Boolean(currentUser.onboardedAt),
    }
  })

// Pause or resume Jargons watching a single repository. Paused repositories are
// skipped by the pull-request webhook.
export const setRepositoryWatching = createServerFn({ method: 'POST' })
  .validator((input: { repositoryId: string; watching: boolean }) => input)
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in to change repository settings.')
    }

    const { and, eq, db, repositories } = await loadDb()

    await db
      .update(repositories)
      .set({
        status: data.watching ? 'watching' : 'paused',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(repositories.id, data.repositoryId),
          eq(repositories.workspaceId, currentUser.workspace.id),
        ),
      )

    return { ok: true }
  })

export const getSyncedRepositories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SyncedRepository[]> => {
    const { eq, db, repositories: repositoryTable } = await loadDb()
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return []
    }

    const repositories = await db
      .select({
        id: repositoryTable.id,
        githubRepoId: repositoryTable.githubRepoId,
        owner: repositoryTable.owner,
        name: repositoryTable.name,
        defaultBranch: repositoryTable.defaultBranch,
        language: repositoryTable.language,
        status: repositoryTable.status,
      })
      .from(repositoryTable)
      .where(eq(repositoryTable.workspaceId, currentUser.workspace.id))

    const stats = await loadRepositoryStats(currentUser.workspace.id)

    return repositories.map((repository) =>
      toSyncedRepository(repository, stats.get(repository.id)),
    )
  },
)

export const getSyncedRepository = createServerFn({ method: 'GET' })
  .validator((input: { repoId: string }) => input)
  .handler(async ({ data }): Promise<SyncedRepository | null> => {
    const { and, eq, db, repositories: repositoryTable } = await loadDb()
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return null
    }

    const repositoryRows = await db
      .select({
        id: repositoryTable.id,
        githubRepoId: repositoryTable.githubRepoId,
        owner: repositoryTable.owner,
        name: repositoryTable.name,
        defaultBranch: repositoryTable.defaultBranch,
        language: repositoryTable.language,
        status: repositoryTable.status,
      })
      .from(repositoryTable)
      .where(
        and(
          eq(repositoryTable.githubRepoId, data.repoId),
          eq(repositoryTable.workspaceId, currentUser.workspace.id),
        ),
      )
      .limit(1)

    if (repositoryRows.length === 0) {
      return null
    }

    const stats = await loadRepositoryStats(currentUser.workspace.id)

    return toSyncedRepository(
      repositoryRows[0],
      stats.get(repositoryRows[0].id),
    )
  })
