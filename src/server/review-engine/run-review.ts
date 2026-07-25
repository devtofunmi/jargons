// Orchestrates one review run under a root `review.run` span. Invoked
// fire-and-forget, so it never throws — failures are recorded and persisted.

import { SpanStatusCode, context, trace } from '@opentelemetry/api'

import {
  findingsTotal,
  llmCostUsdTotal,
  llmTokensTotal,
  logError,
  logInfo,
  reviewDuration,
  reviewFailuresTotal,
  reviewsTotal,
  tracer,
} from '../observability'
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
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
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
  const { workspace } = input
  const base = { repository, workspace }
  const startedAt = Date.now()

  await tracer.startActiveSpan('review.run', async (span) => {
    span.setAttributes({
      'jargons.review_run_id': input.reviewRunId,
      'jargons.workspace': workspace,
      'jargons.repository': repository,
      'jargons.pr_number': input.prNumber,
    })

    let stage = 'init'

    try {
      await markRunning(input.reviewRunId)
      logInfo('review.run started', {
        reviewRunId: input.reviewRunId,
        repository,
        prNumber: input.prNumber,
      })

      stage = 'fetch_diff'
      const { diff, truncated } = await withSpan('github.fetch_diff', () =>
        fetchPullRequestDiff({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          prNumber: input.prNumber,
        }),
      )
      const filesChanged = countChangedFiles(diff)
      span.setAttribute('jargons.files_changed', filesChanged)

      stage = 'llm_review'
      const result = await reviewDiff({
        repository,
        prNumber: input.prNumber,
        prTitle: input.prTitle,
        diff,
        reviewSecurity: input.reviewSecurity,
      })

      llmTokensTotal.add(result.inputTokens, {
        kind: 'input',
        model: result.model,
        ...base,
      })
      llmTokensTotal.add(result.outputTokens, {
        kind: 'output',
        model: result.model,
        ...base,
      })
      llmCostUsdTotal.add(result.costUsd, { model: result.model, ...base })

      stage = 'write_findings'
      await withSpan('db.write_findings', () =>
        writeFindings(input.reviewRunId, result.findings),
      )
      recordFindingMetrics(result.findings, base)

      // Best-effort: open a PR that applies the fixes. Hard-capped so a slow or
      // stalled fix step can never block posting the review comment.
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
              25_000,
              null,
            )
          : null

      stage = 'post_review'
      await withSpan('github.post_review', () =>
        postReviewComment({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          prNumber: input.prNumber,
          findings: result.findings,
          truncated,
          fixPrUrl,
        }),
      )

      stage = 'complete'
      await markComplete(input.reviewRunId, filesChanged)

      reviewsTotal.add(1, { status: 'complete', ...base })
      logInfo('review.run complete', {
        reviewRunId: input.reviewRunId,
        repository,
        prNumber: input.prNumber,
        filesChanged,
        findingsCount: result.findings.length,
      })
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Review run failed'

      await markFailed(input.reviewRunId).catch(() => undefined)
      reviewsTotal.add(1, { status: 'failed', ...base })
      reviewFailuresTotal.add(1, { stage, ...base })
      span.setStatus({ code: SpanStatusCode.ERROR, message })
      span.recordException(error as Error)
      logError('review.run failed', {
        reviewRunId: input.reviewRunId,
        repository,
        prNumber: input.prNumber,
        stage,
        error: message,
      })
    } finally {
      reviewDuration.record((Date.now() - startedAt) / 1000, base)
      span.end()
    }
  })
}

async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name)

  try {
    return await context.with(trace.setSpan(context.active(), span), fn)
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : name,
    })
    span.recordException(error as Error)
    throw error
  } finally {
    span.end()
  }
}

function recordFindingMetrics(
  findings: LlmFinding[],
  base: { repository: string; workspace: string },
) {
  for (const finding of findings) {
    findingsTotal.add(1, { severity: finding.severity, ...base })
  }
}

function countChangedFiles(diff: string): number {
  const matches = diff.match(/^diff --git /gm)

  return matches ? matches.length : 0
}

async function loadDb() {
  const [{ eq }, { db }, schema] = await Promise.all([
    import('drizzle-orm'),
    import('../../db/client'),
    import('../../db/schema'),
  ])

  return { eq, db, schema }
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
