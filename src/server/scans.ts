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
      { getBranchHeadSha },
      { tracer },
      { SpanStatusCode },
    ] = await Promise.all([
      import('./review-engine/open-fix-pr'),
      import('./review-engine/github'),
      import('./observability'),
      import('@opentelemetry/api'),
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

    return tracer.startActiveSpan('github.open_scan_fix_pr', async (span) => {
      span.setAttributes({
        'jargons.repository': `${owner}/${repo}`,
        'jargons.scan_id': data.scanId,
      })

      try {
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
        // Cheap validation failures above (unknown scan, no installation, no
        // findings, unreadable branch) return before this and cost nothing.
        await incrementWorkspaceRuns(workspaceId)

        const result = await applyFindingsAsFixPr({
          installationId,
          owner,
          repo,
          findings,
          fromSha: headSha,
          base: baseBranch,
          branch: single
            ? `jargons/fix-scan-${data.scanId.slice(0, 8)}-f${data.findingIndex}`
            : `jargons/fix-scan-${data.scanId.slice(0, 8)}`,
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

        span.setAttribute('jargons.fix_pr_opened', result.ok)
        span.setStatus({ code: SpanStatusCode.OK })
        if (result.ok) {
          return { url: result.url }
        }
        return {
          url: null,
          reason: {
            no_paths: 'This scan has no findings to fix.',
            no_files: 'Affected files could not be read.',
            no_fixes: 'No applicable fixes were generated.',
            pr_rejected: 'GitHub rejected the pull request.',
          }[result.reason],
        }
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            error instanceof Error ? error.message : 'open scan fix PR failed',
        })
        span.recordException(error as Error)
        return {
          url: null,
          reason:
            error instanceof Error ? error.message : 'Could not open fix PR.',
        }
      } finally {
        span.end()
      }
    })
  })
