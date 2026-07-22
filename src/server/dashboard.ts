import { createServerFn } from '@tanstack/react-start'

import { getCurrentUserFromCookie } from './github-auth'
import type { ReviewRunListItem } from './reviews'

export type DashboardData = {
  metrics: {
    repositories: number
    openReviews: number
    findingsThisWeek: number
    codebaseScans: number
  }
  repositories: Array<{
    githubRepoId: string
    owner: string
    name: string
  }>
  latestReview: ReviewRunListItem | null
  priorityFindings: Array<{
    id: string
    reviewId: string
    title: string
    description: string
    filePath: string
    lineNumber: number | null
  }>
}

const emptyDashboard: DashboardData = {
  metrics: {
    repositories: 0,
    openReviews: 0,
    findingsThisWeek: 0,
    codebaseScans: 0,
  },
  repositories: [],
  latestReview: null,
  priorityFindings: [],
}

export const getDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardData> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return emptyDashboard
    }

    const [
      { and, count, countDistinct, desc, eq, gt, inArray },
      { db },
      { codebaseScans, findings, pullRequests, repositories, reviewRuns },
      { getReviewRuns },
    ] = await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
      import('./reviews'),
    ])

    const workspaceId = currentUser.workspace.id
    const weekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)

    const [
      repositoryRows,
      repositoryCountRows,
      openReviewRows,
      findingsWeekRows,
      scanCountRows,
      reviewRunsList,
      priorityFindingRows,
    ] = await Promise.all([
      db
        .select({
          githubRepoId: repositories.githubRepoId,
          owner: repositories.owner,
          name: repositories.name,
        })
        .from(repositories)
        .where(eq(repositories.workspaceId, workspaceId))
        .limit(4),
      db
        .select({ value: count() })
        .from(repositories)
        .where(eq(repositories.workspaceId, workspaceId)),
      // "Open reviews" = open pull requests Jargons has reviewed. Counting
      // queued/running runs was near-always 0 since reviews finish in seconds.
      db
        .select({ value: countDistinct(pullRequests.id) })
        .from(pullRequests)
        .innerJoin(reviewRuns, eq(reviewRuns.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(
          and(
            eq(repositories.workspaceId, workspaceId),
            eq(pullRequests.isOpen, true),
          ),
        ),
      db
        .select({ value: count() })
        .from(findings)
        .innerJoin(reviewRuns, eq(findings.reviewRunId, reviewRuns.id))
        .innerJoin(pullRequests, eq(reviewRuns.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(
          and(
            eq(repositories.workspaceId, workspaceId),
            gt(findings.createdAt, weekAgo),
          ),
        ),
      db
        .select({ value: count() })
        .from(codebaseScans)
        .innerJoin(repositories, eq(codebaseScans.repositoryId, repositories.id))
        .where(eq(repositories.workspaceId, workspaceId)),
      getReviewRuns(),
      db
        .select({
          id: findings.id,
          reviewId: findings.reviewRunId,
          title: findings.title,
          description: findings.description,
          filePath: findings.filePath,
          lineNumber: findings.lineNumber,
        })
        .from(findings)
        .innerJoin(reviewRuns, eq(findings.reviewRunId, reviewRuns.id))
        .innerJoin(pullRequests, eq(reviewRuns.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(
          and(
            eq(repositories.workspaceId, workspaceId),
            inArray(findings.severity, ['critical', 'high']),
          ),
        )
        .orderBy(desc(findings.createdAt))
        .limit(6),
    ])

    return {
      metrics: {
        repositories: repositoryCountRows[0]?.value ?? 0,
        openReviews: openReviewRows[0]?.value ?? 0,
        findingsThisWeek: findingsWeekRows[0]?.value ?? 0,
        codebaseScans: scanCountRows[0]?.value ?? 0,
      },
      repositories: repositoryRows,
      latestReview: reviewRunsList[0] ?? null,
      priorityFindings: priorityFindingRows,
    }
  },
)
