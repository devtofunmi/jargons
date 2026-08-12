// Orchestrates one codebase scan under a root `scan.run` span. Invoked
// fire-and-forget, so it never throws — failures are recorded and persisted.

import { SpanStatusCode, context, trace } from '@opentelemetry/api'

import { loadDb } from '../../db/load'
import {
  llmCostUsdTotal,
  llmTokensTotal,
  logError,
  logInfo,
  scanDuration,
  scanFailuresTotal,
  scanFilesTotal,
  scanFindingsTotal,
  scansTotal,
  tracer,
} from '../observability'
import type { LlmFinding, ReviewSeverity } from '../review-engine/llm'
import { fetchFileContent, fetchRepoTree } from './github'
import type { RepoFile } from './github'
import { scanCodebase } from './llm'

// Budgets keep a scan fast + free-tier friendly.
const MAX_FILES = 20
const MAX_TOTAL_CHARS = 50_000

export type RunScanInput = {
  scanId: string
  installationId: string
  workspace: string
  owner: string
  repo: string
  branch: string
}

export async function runScan(input: RunScanInput): Promise<void> {
  const repository = `${input.owner}/${input.repo}`
  const { workspace } = input
  const base = { repository, workspace }
  const startedAt = Date.now()

  await tracer.startActiveSpan('scan.run', async (span) => {
    span.setAttributes({
      'jargons.scan_id': input.scanId,
      'jargons.workspace': workspace,
      'jargons.repository': repository,
    })

    let stage = 'init'

    try {
      await markRunning(input.scanId)
      logInfo('scan.run started', { scanId: input.scanId, repository })

      stage = 'fetch_tree'
      const paths = await withSpan('github.fetch_tree', () =>
        fetchRepoTree({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          branch: input.branch,
        }),
      )

      stage = 'fetch_files'
      const files = await withSpan('github.fetch_files', () =>
        collectFiles(input, paths),
      )
      span.setAttribute('jargons.scanned_files', files.length)

      stage = 'llm_scan'
      const result = await scanCodebase({ repository, files })
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

      stage = 'write_summary'
      const counts = countBySeverity(result.findings)
      await withSpan('db.write_summary', () =>
        markComplete(input.scanId, files.length, {
          findings: result.findings,
          counts,
          scannedFiles: files.length,
          model: result.model,
        }),
      )
      recordFindingMetrics(result.findings, base)
      scanFilesTotal.add(files.length, base)

      stage = 'complete'
      scansTotal.add(1, { status: 'complete', ...base })
      logInfo('scan.run complete', {
        scanId: input.scanId,
        repository,
        scannedFiles: files.length,
        findingsCount: result.findings.length,
      })
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan run failed'
      await markFailed(input.scanId).catch(() => undefined)
      scansTotal.add(1, { status: 'failed', ...base })
      scanFailuresTotal.add(1, { stage, ...base })
      span.setStatus({ code: SpanStatusCode.ERROR, message })
      span.recordException(error as Error)
      logError('scan.run failed', {
        scanId: input.scanId,
        repository,
        stage,
        error: message,
      })
    } finally {
      scanDuration.record((Date.now() - startedAt) / 1000, base)
      span.end()
    }
  })
}

async function collectFiles(
  input: RunScanInput,
  paths: string[],
): Promise<RepoFile[]> {
  const files: RepoFile[] = []
  let totalChars = 0

  for (const path of paths) {
    if (files.length >= MAX_FILES || totalChars >= MAX_TOTAL_CHARS) {
      break
    }
    const content = await fetchFileContent({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      path,
    })
    if (!content) continue

    const remaining = MAX_TOTAL_CHARS - totalChars
    const slice =
      content.length > remaining ? content.slice(0, remaining) : content
    files.push({ path, content: slice })
    totalChars += slice.length
  }

  return files
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
    scanFindingsTotal.add(1, { severity: finding.severity, ...base })
  }
}

function countBySeverity(
  findings: LlmFinding[],
): Record<ReviewSeverity, number> {
  const counts: Record<ReviewSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    note: 0,
  }
  for (const finding of findings) {
    counts[finding.severity] += 1
  }
  return counts
}

async function markRunning(scanId: string) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}

async function markComplete(
  scanId: string,
  scannedFiles: number,
  summary: unknown,
) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'complete', scannedFiles, summary, completedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}

async function markFailed(scanId: string) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'failed', completedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}
