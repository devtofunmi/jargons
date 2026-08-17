import { createServerFn } from '@tanstack/react-start'

import { SEVERITIES, severityRank } from '../lib/severity'
import type { Severity } from '../lib/severity'
import { loadDb } from '../db/load'
import { getCurrentUserFromCookie } from './github-auth'
import { summaryToCounts } from './scan-engine/summary'
import type { ScanFindingCounts, ScanSummary } from './scan-engine/summary'

export type { ScanFindingCounts }

export type CodebaseScanItem = {
  id: string
  repository: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  scannedFiles: number
  findingsCount: number
  counts: ScanFindingCounts
  startedAt: string | null
  completedAt: string | null
}

export const getCodebaseScans = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CodebaseScanItem[]> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return []
    }

    const { desc, eq, db, codebaseScans, repositories } = await loadDb()

    const scans = await db
      .select({
        id: codebaseScans.id,
        owner: repositories.owner,
        name: repositories.name,
        status: codebaseScans.status,
        scannedFiles: codebaseScans.scannedFiles,
        summary: codebaseScans.summary,
        startedAt: codebaseScans.startedAt,
        completedAt: codebaseScans.completedAt,
      })
      .from(codebaseScans)
      .innerJoin(repositories, eq(codebaseScans.repositoryId, repositories.id))
      .where(eq(repositories.workspaceId, currentUser.workspace.id))
      .orderBy(desc(codebaseScans.createdAt))
      .limit(50)

    return scans.map((scan) => {
      const { counts, findingsCount } = summaryToCounts(scan.summary)
      return {
        id: scan.id,
        repository: `${scan.owner}/${scan.name}`,
        status: scan.status,
        scannedFiles: scan.scannedFiles,
        findingsCount,
        counts,
        startedAt: scan.startedAt?.toISOString() ?? null,
        completedAt: scan.completedAt?.toISOString() ?? null,
      }
    })
  },
)

export type CodebaseScanFinding = {
  severity: Severity
  title: string
  description: string
  filePath: string
  lineNumber: number | null
  suggestion: string | null
}

export type CodebaseScanDetail = CodebaseScanItem & {
  findings: CodebaseScanFinding[]
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function summaryToFindings(summary: unknown): CodebaseScanFinding[] {
  const parsed = (summary ?? {}) as ScanSummary
  const raw = Array.isArray(parsed.findings) ? parsed.findings : []

  const findings = raw.flatMap((item): CodebaseScanFinding[] => {
    if (!item || typeof item !== 'object') return []
    const r = item as Record<string, unknown>
    const severity = SEVERITIES.includes(r.severity as Severity)
      ? (r.severity as Severity)
      : 'note'
    const title = typeof r.title === 'string' ? r.title : ''
    const filePath = typeof r.filePath === 'string' ? r.filePath : ''
    if (!title || !filePath) return []
    return [
      {
        severity,
        title,
        description: typeof r.description === 'string' ? r.description : '',
        filePath,
        lineNumber: typeof r.lineNumber === 'number' ? r.lineNumber : null,
        suggestion: typeof r.suggestion === 'string' ? r.suggestion : null,
      },
    ]
  })

  return findings.sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  )
}

export const getCodebaseScan = createServerFn({ method: 'GET' })
  .validator((input: { scanId: string }) => input)
  .handler(async ({ data }): Promise<CodebaseScanDetail | null> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace || !uuidPattern.test(data.scanId)) {
      return null
    }

    const { and, eq, db, codebaseScans, repositories } = await loadDb()

    const rows = await db
      .select({
        id: codebaseScans.id,
        owner: repositories.owner,
        name: repositories.name,
        status: codebaseScans.status,
        scannedFiles: codebaseScans.scannedFiles,
        summary: codebaseScans.summary,
        startedAt: codebaseScans.startedAt,
        completedAt: codebaseScans.completedAt,
      })
      .from(codebaseScans)
      .innerJoin(repositories, eq(codebaseScans.repositoryId, repositories.id))
      .where(
        and(
          eq(codebaseScans.id, data.scanId),
          eq(repositories.workspaceId, currentUser.workspace.id),
        ),
      )
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    const scan = rows[0]
    const { counts, findingsCount } = summaryToCounts(scan.summary)

    return {
      id: scan.id,
      repository: `${scan.owner}/${scan.name}`,
      status: scan.status,
      scannedFiles: scan.scannedFiles,
      findingsCount,
      counts,
      startedAt: scan.startedAt?.toISOString() ?? null,
      completedAt: scan.completedAt?.toISOString() ?? null,
      findings: summaryToFindings(scan.summary),
    }
  })

export type OpenScanFixPrResult = { url: string | null; reason?: string }

// Add a fix-PR run's LLM spend to its scan row. Additive rather than a
// replacement because a scan can produce several fix PRs over time, each a
// separate run. Best-effort: cost telemetry must never fail the user's action.
async function addScanLlmUsage(
  scanId: string,
  usage: { inputTokens: number; outputTokens: number; costUsd: number },
): Promise<void> {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) {
    return
  }

  try {
    const { eq, sql, db, codebaseScans } = await loadDb()

    await db
      .update(codebaseScans)
      .set({
        inputTokens: sql`${codebaseScans.inputTokens} + ${usage.inputTokens}`,
        outputTokens: sql`${codebaseScans.outputTokens} + ${usage.outputTokens}`,
        costUsd: sql`${codebaseScans.costUsd} + ${usage.costUsd}`,
      })
      .where(eq(codebaseScans.id, scanId))
  } catch (error) {
    console.error('failed to record scan fix-PR LLM usage', {
      scanId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// User-initiated: turn a scan's findings into a pull request that applies the
// fixes, opened into the repository's default branch. Reuses the review
// engine's LLM autofix + GitHub commit/PR helpers.
export const openScanFixPr = createServerFn({ method: 'POST' })
  .validator((input: { scanId: string; findingIndex?: number }) => input)
  .handler(async ({ data }): Promise<OpenScanFixPrResult> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in to open a fix PR.')
    }
    if (!uuidPattern.test(data.scanId)) {
      return { url: null, reason: 'Invalid scan.' }
    }

    // Freemium gate: opening a fix PR is an agent run, so a free workspace that
    // has used its lifetime run must upgrade first. The matching increment
    // happens further down, once the request has passed validation and is about
    // to do the billable work.
    const { getWorkspaceBilling, incrementWorkspaceRuns } =
      await import('./billing')
    const billing = await getWorkspaceBilling(currentUser.workspace.id)
    if (!billing.canRun) {
      return { url: null, reason: 'upgrade_required' }
    }

    const { and, eq, db, codebaseScans, githubInstallations, repositories } =
      await loadDb()
    const [
      { applyFindingsAsFixPr },
      { findOpenPullRequestForBranch, getBranchHeadSha },
    ] = await Promise.all([
      import('./review-engine/open-fix-pr'),
      import('./review-engine/github'),
    ])

    const workspaceId = currentUser.workspace.id

    const rows = await db
      .select({
        owner: repositories.owner,
        name: repositories.name,
        defaultBranch: repositories.defaultBranch,
        summary: codebaseScans.summary,
      })
      .from(codebaseScans)
      .innerJoin(repositories, eq(codebaseScans.repositoryId, repositories.id))
      .where(
        and(
          eq(codebaseScans.id, data.scanId),
          eq(repositories.workspaceId, workspaceId),
        ),
      )
      .limit(1)

    if (rows.length === 0) {
      return { url: null, reason: 'Scan not found.' }
    }
    const scan = rows[0]

    const installationRows = await db
      .select({ installationId: githubInstallations.installationId })
      .from(githubInstallations)
      .where(eq(githubInstallations.workspaceId, workspaceId))
      .limit(1)
    const installationId = installationRows[0]?.installationId
    if (!installationId) {
      return { url: null, reason: 'No GitHub installation connected.' }
    }

    const allFindings = summaryToFindings(scan.summary)
    if (allFindings.length === 0) {
      return { url: null, reason: 'This scan has no findings to fix.' }
    }

    // With a findingIndex, open a fix PR for just that one finding; otherwise
    // fix them all (the legacy bulk path).
    const single =
      typeof data.findingIndex === 'number'
        ? allFindings[data.findingIndex]
        : null
    if (typeof data.findingIndex === 'number' && !single) {
      return { url: null, reason: 'Finding not found.' }
    }
    const findings = single ? [single] : allFindings

    const owner = scan.owner
    const repo = scan.name
    const baseBranch = scan.defaultBranch || 'main'

    // Deterministic per scan (and per finding), which is what lets the repeat
    // click below be detected instead of turning into a duplicate PR attempt.
    const branch = single
      ? `jargons/fix-scan-${data.scanId.slice(0, 8)}-f${data.findingIndex}`
      : `jargons/fix-scan-${data.scanId.slice(0, 8)}`

    try {
      // Idempotency, and it has to come before the run is counted. Without it a
      // second click regenerates the fixes (a full LLM call), then fails on
      // GitHub's "a pull request already exists for this branch" — spending a
      // run to show the user a generic error, with no link to the PR that is
      // sitting right there. Returning that PR is both the cheap answer and the
      // correct one.
      const alreadyOpen = await findOpenPullRequestForBranch({
        installationId,
        owner,
        repo,
        branch,
      })
      if (alreadyOpen) {
        return { url: alreadyOpen }
      }

      const headSha = await getBranchHeadSha({
        installationId,
        owner,
        repo,
        branch: baseBranch,
      })
      if (!headSha) {
        return { url: null, reason: `Could not read ${baseBranch}.` }
      }

      // Count this against the workspace's plan. Metered on attempt, matching
      // the review and scan paths: everything past this point costs an LLM
      // call, so a run that fails downstream is still a run that was spent.
      // Everything that returns above this line — unknown scan, no
      // installation, no findings, an already-open fix PR, an unreadable
      // default branch — costs nothing.
      await incrementWorkspaceRuns(workspaceId)

      const result = await applyFindingsAsFixPr({
        installationId,
        owner,
        repo,
        findings,
        fromSha: headSha,
        base: baseBranch,
        branch,
        commitMessage: (path) =>
          `fix: apply Jargons scan suggestions to ${path}`,
        prTitle: single
          ? `Jargons: fix "${single.title}"`
          : `Jargons: apply codebase scan fixes`,
        prBody: (paths) => {
          const fileList = paths.map((p) => `- \`${p}\``).join('\n')
          return single
            ? `Automated fix for a Jargons finding: **${single.title}** (\`${single.filePath}\`).\n\nFiles changed:\n${fileList}`
            : `Automated fixes for findings from a Jargons codebase scan.\n\nFiles changed:\n${fileList}`
        },
      })

      // A fix PR opened from a scan is its own metered run but has no row of
      // its own, so its LLM spend accumulates onto the scan it came from. That
      // keeps the operator cost totals complete; without it this spend would be
      // invisible even though it counts against the workspace's quota.
      await addScanLlmUsage(data.scanId, result.usage)

      if (result.ok) {
        return { url: result.url }
      }
      return {
        url: null,
        reason: {
          no_paths: 'This scan has no findings to fix.',
          no_files: 'Affected files could not be read.',
          no_fixes: 'No applicable fixes were generated.',
          no_write_access:
            'Jargons cannot write to this repository. Check that the GitHub App has Contents and Pull requests write access.',
          pr_rejected: 'GitHub rejected the pull request.',
        }[result.reason],
      }
    } catch (error) {
      // Every other `reason` this handler returns is copy written for the user,
      // and the UI renders them. A thrown error is different: its message can
      // carry a raw GitHub response body or query detail, so it follows the
      // same rule as the root error boundary — logged for us, never rendered.
      console.error('open scan fix PR failed', {
        repository: `${owner}/${repo}`,
        scanId: data.scanId,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        url: null,
        reason: 'Could not open the fix PR. Please try again.',
      }
    }
  })
