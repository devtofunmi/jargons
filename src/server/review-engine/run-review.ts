// Orchestrates one review run. Invoked fire-and-forget, so it never throws —
// failures are recorded and persisted. `stage` tracks how far the run got, so a
// failure log says which step broke.

import { loadDb } from '../../db/load'
import { fetchPullRequestDiff, postReviewComment } from './github'
import { reviewDiff } from './llm'
import type { LlmFinding } from './llm'
import { openFixPr } from './open-fix-pr'

export type RunReviewInput = {
  reviewRunId: string
  installationId: string
  workspace: string
  owner: string
  repo: string
  prNumber: number
  prTitle: string
  headSha: string
  headRef: string
  reviewSecurity: boolean
}

// Cap a best-effort step so it can never block the review: resolves the
// fallback if the promise hasn't settled within `ms` (the underlying work is
// abandoned, not awaited further).
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

export async function runReview(input: RunReviewInput): Promise<void> {
  const repository = `${input.owner}/${input.repo}`

  let stage = 'init'

  try {
    await markRunning(input.reviewRunId)
    console.log('review.run started', {
      reviewRunId: input.reviewRunId,
      repository,
      prNumber: input.prNumber,
    })

    stage = 'fetch_diff'
    const { diff, truncated } = await fetchPullRequestDiff({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      prNumber: input.prNumber,
    })
    const filesChanged = countChangedFiles(diff)

    stage = 'llm_review'
    const result = await reviewDiff({
      repository,
      prNumber: input.prNumber,
      prTitle: input.prTitle,
      diff,
      reviewSecurity: input.reviewSecurity,
    })

    stage = 'write_findings'
    await writeFindings(input.reviewRunId, result.findings)

    // Best-effort: open a PR that applies the fixes. Hard-capped so a slow or
    // stalled fix step can never block posting the review comment. The cap
    // must clear a full autofix pass: the LLM regenerates entire files
    // (~20s on gemini-2.5-flash) plus branch/commit/PR calls, which together
    // overran the old 25s cap and silently dropped the fix-PR link.
    stage = 'open_fix_pr'
    const fixPrUrl =
      result.findings.length > 0
        ? await withTimeout(
            openFixPr(
              {
                installationId: input.installationId,
                owner: input.owner,
                repo: input.repo,
                prNumber: input.prNumber,
                headSha: input.headSha,
                headRef: input.headRef,
              },
              result.findings,
            ),
            45_000,
            null,
          )
        : null

    stage = 'post_review'
    await postReviewComment({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      prNumber: input.prNumber,
      findings: result.findings,
      truncated,
      fixPrUrl,
    })

    stage = 'complete'
    await markComplete(input.reviewRunId, filesChanged)

    console.log('review.run complete', {
      reviewRunId: input.reviewRunId,
      repository,
      prNumber: input.prNumber,
      filesChanged,
      findingsCount: result.findings.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review run failed'

    await markFailed(input.reviewRunId).catch(() => undefined)
    console.error('review.run failed', {
      reviewRunId: input.reviewRunId,
      repository,
      prNumber: input.prNumber,
      stage,
      error: message,
    })
  }
}

function countChangedFiles(diff: string): number {
  const matches = diff.match(/^diff --git /gm)

  return matches ? matches.length : 0
}

async function markRunning(reviewRunId: string) {
  const { eq, db, schema } = await loadDb()

  await db
    .update(schema.reviewRuns)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(schema.reviewRuns.id, reviewRunId))
}

async function markComplete(reviewRunId: string, filesChanged: number) {
  const { eq, db, schema } = await loadDb()

  await db
    .update(schema.reviewRuns)
    .set({ status: 'complete', filesChanged, completedAt: new Date() })
    .where(eq(schema.reviewRuns.id, reviewRunId))
}

async function markFailed(reviewRunId: string) {
  const { eq, db, schema } = await loadDb()

  await db
    .update(schema.reviewRuns)
    .set({ status: 'failed', completedAt: new Date() })
    .where(eq(schema.reviewRuns.id, reviewRunId))
}

async function writeFindings(reviewRunId: string, findings: LlmFinding[]) {
  if (findings.length === 0) {
    return
  }

  const { db, schema } = await loadDb()

  await db.insert(schema.findings).values(
    findings.map((finding) => ({
      reviewRunId,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      filePath: finding.filePath,
      lineNumber: finding.lineNumber,
      suggestion: finding.suggestion,
    })),
  )
}
