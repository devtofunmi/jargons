import { createServerFn } from '@tanstack/react-start'

import { loadDb as loadDatabase } from '../db/load'
import { getCurrentUserFromCookie } from './github-auth'

export type ReviewRunListItem = {
  id: string
  title: string
  repository: string
  branch: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  author: string
  filesChanged: number
  prNumber: number
  findingsCount: number
  createdAt: string
}

export type ReviewFindingItem = {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'note'
  title: string
  description: string
  filePath: string
  lineNumber: number | null
  suggestion: string | null
}

export type ReviewRunDetail = ReviewRunListItem & {
  findings: ReviewFindingItem[]
}

async function loadDb() {
  const loaded = await loadDatabase()

  return { drizzle: loaded, db: loaded.db, schema: loaded.schema }
}

async function queryReviewRuns(
  workspaceId: string,
  repositoryId?: string,
): Promise<ReviewRunListItem[]> {
  const { drizzle, db, schema } = await loadDb()
  const { and, count, desc, eq, inArray } = drizzle
  const { findings, pullRequests, repositories, reviewRuns } = schema

  const runs = await db
    .select({
      id: reviewRuns.id,
      title: pullRequests.title,
      owner: repositories.owner,
      name: repositories.name,
      branch: pullRequests.branch,
      status: reviewRuns.status,
      author: pullRequests.authorLogin,
      filesChanged: reviewRuns.filesChanged,
      prNumber: pullRequests.number,
      createdAt: reviewRuns.createdAt,
    })
    .from(reviewRuns)
    .innerJoin(pullRequests, eq(reviewRuns.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(
      repositoryId
        ? and(
            eq(repositories.workspaceId, workspaceId),
            eq(repositories.id, repositoryId),
          )
        : eq(repositories.workspaceId, workspaceId),
    )
    .orderBy(desc(reviewRuns.createdAt))
    .limit(50)

  if (runs.length === 0) {
    return []
  }

  const findingCounts = await db
    .select({
      reviewRunId: findings.reviewRunId,
      value: count(),
    })
    .from(findings)
    .where(
      inArray(
        findings.reviewRunId,
        runs.map((run) => run.id),
      ),
    )
    .groupBy(findings.reviewRunId)
  const countByRun = new Map(
    findingCounts.map((row) => [row.reviewRunId, row.value]),
  )

  return runs.map((run) => ({
    id: run.id,
    title: run.title,
    repository: `${run.owner}/${run.name}`,
    branch: run.branch,
    status: run.status,
    author: run.author,
    filesChanged: run.filesChanged,
    prNumber: run.prNumber,
    findingsCount: countByRun.get(run.id) ?? 0,
    createdAt: run.createdAt.toISOString(),
  }))
}

export const getReviewRuns = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReviewRunListItem[]> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return []
    }

    return queryReviewRuns(currentUser.workspace.id)
  },
)

export const getRepositoryReviewRuns = createServerFn({ method: 'GET' })
  .validator((input: { repositoryId: string }) => input)
  .handler(async ({ data }): Promise<ReviewRunListItem[]> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return []
    }

    return queryReviewRuns(currentUser.workspace.id, data.repositoryId)
  })

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getReviewRun = createServerFn({ method: 'GET' })
  .validator((input: { reviewId: string }) => input)
  .handler(async ({ data }): Promise<ReviewRunDetail | null> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace || !uuidPattern.test(data.reviewId)) {
      return null
    }

    const { drizzle, db, schema } = await loadDb()
    const { and, eq } = drizzle
    const { findings, pullRequests, repositories, reviewRuns } = schema

    const runs = await db
      .select({
        id: reviewRuns.id,
        title: pullRequests.title,
        owner: repositories.owner,
        name: repositories.name,
        branch: pullRequests.branch,
        status: reviewRuns.status,
        author: pullRequests.authorLogin,
        filesChanged: reviewRuns.filesChanged,
        prNumber: pullRequests.number,
        createdAt: reviewRuns.createdAt,
      })
      .from(reviewRuns)
      .innerJoin(pullRequests, eq(reviewRuns.pullRequestId, pullRequests.id))
      .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
      .where(
        and(
          eq(reviewRuns.id, data.reviewId),
          eq(repositories.workspaceId, currentUser.workspace.id),
        ),
      )
      .limit(1)

    if (runs.length === 0) {
      return null
    }

    const run = runs[0]
    const findingRows = await db
      .select({
        id: findings.id,
        severity: findings.severity,
        title: findings.title,
        description: findings.description,
        filePath: findings.filePath,
        lineNumber: findings.lineNumber,
        suggestion: findings.suggestion,
      })
      .from(findings)
      .where(eq(findings.reviewRunId, run.id))

    return {
      id: run.id,
      title: run.title,
      repository: `${run.owner}/${run.name}`,
      branch: run.branch,
      status: run.status,
      author: run.author,
      filesChanged: run.filesChanged,
      prNumber: run.prNumber,
      findingsCount: findingRows.length,
      createdAt: run.createdAt.toISOString(),
      findings: findingRows,
    }
  })
