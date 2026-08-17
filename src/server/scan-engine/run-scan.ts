// Orchestrates one codebase scan. Invoked fire-and-forget, so it never throws —
// failures are recorded and persisted. `stage` tracks how far the run got, so a
// failure log says which step broke.

import { loadDb } from '../../db/load'
import type { LlmUsage } from '../review-engine/autofix'
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

  let stage = 'init'

  try {
    await markRunning(input.scanId)
    console.log('scan.run started', { scanId: input.scanId, repository })

    stage = 'fetch_tree'
    const paths = await fetchRepoTree({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
    })

    stage = 'fetch_files'
    const files = await collectFiles(input, paths)

    stage = 'llm_scan'
    const result = await scanCodebase({ repository, files })

    stage = 'write_summary'
    const counts = countBySeverity(result.findings)
    await markComplete(
      input.scanId,
      files.length,
      {
        findings: result.findings,
        counts,
        scannedFiles: files.length,
        model: result.model,
      },
      {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    )

    stage = 'complete'
    console.log('scan.run complete', {
      scanId: input.scanId,
      repository,
      scannedFiles: files.length,
      findingsCount: result.findings.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan run failed'

    await markFailed(input.scanId).catch(() => undefined)
    console.error('scan.run failed', {
      scanId: input.scanId,
      repository,
      stage,
      error: message,
    })
  }
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
  usage: LlmUsage,
) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({
      status: 'complete',
      scannedFiles,
      summary,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      completedAt: new Date(),
    })
    .where(eq(schema.codebaseScans.id, scanId))
}

async function markFailed(scanId: string) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'failed', completedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}
