import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../db/load'
import type { Plan } from '../lib/plans'
import {
  DEFAULT_REVIEW_GUIDANCE,
  normalizeCustomInstructions,
  parseMinSeverity,
} from '../lib/review-guidance'
import type { ReviewGuidance } from '../lib/review-guidance'
import { getWorkspaceBilling } from './billing'
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
  guidance: ReviewGuidance
  canCustomizeReviews: boolean
  billing: {
    plan: Plan
    runsUsed: number
    limit: number
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
    const [installationRows, repositoryCountRows, settingsRows, billing] =
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
            customInstructions: workspaceSettings.customInstructions,
            minSeverity: workspaceSettings.minSeverity,
          })
          .from(workspaceSettings)
          .where(eq(workspaceSettings.workspaceId, workspaceId))
          .limit(1),
        getWorkspaceBilling(workspaceId),
      ])

    const settingsRow = settingsRows.at(0)

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
      preferences: settingsRow
        ? {
            reviewPullRequests: settingsRow.reviewPullRequests,
            reviewSecurity: settingsRow.reviewSecurity,
            reviewCodebaseScans: settingsRow.reviewCodebaseScans,
          }
        : {
            reviewPullRequests: true,
            reviewSecurity: true,
            reviewCodebaseScans: true,
          },
      guidance: settingsRow
        ? {
            customInstructions: settingsRow.customInstructions,
            minSeverity: settingsRow.minSeverity,
          }
        : DEFAULT_REVIEW_GUIDANCE,
      canCustomizeReviews: billing.canCustomizeReviews,
      billing: {
        plan: billing.plan,
        runsUsed: billing.runsUsed,
        limit: billing.limit,
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
      guidance?: { customInstructions?: unknown; minSeverity?: unknown }
    }) => ({
      reviewPullRequests: input.reviewPullRequests === true,
      reviewSecurity: input.reviewSecurity === true,
      reviewCodebaseScans: input.reviewCodebaseScans === true,
      guidance: input.guidance
        ? {
            customInstructions: normalizeCustomInstructions(
              input.guidance.customInstructions,
            ),
            minSeverity: parseMinSeverity(input.guidance.minSeverity),
          }
        : null,
    }),
  )
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in before updating workspace settings.')
    }

    const workspaceId = currentUser.workspace.id
    const { guidance, ...preferences } = data

    // Review guidance is a paid feature: free workspaces can't change it.
    if (guidance) {
      const billing = await getWorkspaceBilling(workspaceId)
      if (!billing.canCustomizeReviews) {
        throw new Error('Custom review instructions need a paid plan.')
      }
    }

    const values = { ...preferences, ...(guidance ?? {}) }
    const { db, workspaceSettings } = await loadDb()

    await db
      .insert(workspaceSettings)
      .values({
        workspaceId,
        ...values,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: {
          ...values,
          updatedAt: new Date(),
        },
      })

    return { ok: true }
  })
