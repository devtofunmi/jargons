// Repository sync + read models: reconcile the workspace's repositories against
// what an installation grants, aggregate real per-repo stats (open PRs,
// findings by severity, last scan), and shape a repository row into the
// SyncedRepository view the UI renders.

import { SEVERITIES } from '../../lib/severity'
import type { SeverityCounts } from '../../lib/severity'
import { loadDb } from '../../db/load'
import { createInstallationAccessToken, githubHeaders } from './client'
import type {
  GitHubInstallationRepositoriesResponse,
  GitHubRepository,
} from './client'

export type SyncedRepository = {
  id: string
  githubRepoId: string
  name: string
  owner: string
  fullName: string
  status: 'watching' | 'needs setup' | 'paused'
  language: string
  pullRequests: number
  findings: number
  findingsBySeverity: SeverityCounts
  lastScan: string
  slug: string
  defaultBranch: string
  coverage: string
  scanStatus: 'complete' | 'running' | 'not configured'
}

// Fetch every repository the installation grants, upsert them for the
// workspace, then drop any the installation no longer covers. Returns the
// number of repositories synced.
export async function syncInstallationRepositories({
  installationId,
  workspaceId,
}: {
  installationId: string
  workspaceId: string
}) {
  const {
    and,
    eq,
    notInArray,
    db,
    repositories: repositoryTable,
  } = await loadDb()
  const accessToken = await createInstallationAccessToken(installationId)
  const allRepositories: GitHubRepository[] = []

  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: githubHeaders(`Bearer ${accessToken}`),
      },
    )

    if (!response.ok) {
      throw new Error('Unable to fetch GitHub installation repositories.')
    }

    const data =
      (await response.json()) as GitHubInstallationRepositoriesResponse

    allRepositories.push(...data.repositories)

    if (
      data.repositories.length === 0 ||
      allRepositories.length >= data.total_count
    ) {
      break
    }
  }

  const now = new Date()

  for (const repository of allRepositories) {
    await db
      .insert(repositoryTable)
      .values({
        workspaceId,
        githubRepoId: String(repository.id),
        owner: repository.owner.login,
        name: repository.name,
        defaultBranch: repository.default_branch,
        language: repository.language,
        status: 'watching',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [repositoryTable.workspaceId, repositoryTable.githubRepoId],
        set: {
          owner: repository.owner.login,
          name: repository.name,
          defaultBranch: repository.default_branch,
          language: repository.language,
          status: 'watching',
          updatedAt: now,
        },
      })
  }

  // Reconcile: drop repositories the installation no longer grants access to.
  const fetchedRepoIds = allRepositories.map((repository) =>
    String(repository.id),
  )

  await db
    .delete(repositoryTable)
    .where(
      fetchedRepoIds.length > 0
        ? and(
            eq(repositoryTable.workspaceId, workspaceId),
            notInArray(repositoryTable.githubRepoId, fetchedRepoIds),
          )
        : eq(repositoryTable.workspaceId, workspaceId),
    )

  return allRepositories.length
}

type RepoStats = {
  openPrs: number
  findings: number
  bySeverity: SeverityCounts
  lastScanAt: Date | null
}

function emptySeverity(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, note: 0 }
}

// Real per-repo counts for every repo in the workspace, keyed by repository id.
// Findings-by-severity combines PR-review findings (findings table) and
// codebase-scan findings (stored in the scan summary JSON); totals derive from
// those so there's a single source of truth.
export async function loadRepositoryStats(
  workspaceId: string,
): Promise<Map<string, RepoStats>> {
  const { sqlClient: db } = await import('../../db/client')

  const [prRows, reviewSevRows, scanSevRows, scanMetaRows] = await Promise.all([
    db<Array<{ rid: string; open_prs: number }>>`
      SELECT pr.repository_id AS rid,
             count(*) FILTER (WHERE pr.is_open)::int AS open_prs
      FROM pull_requests pr
      JOIN repositories r ON r.id = pr.repository_id
      WHERE r.workspace_id = ${workspaceId}
      GROUP BY pr.repository_id`,
    db<Array<{ rid: string; sev: string; n: number }>>`
      SELECT pr.repository_id AS rid, f.severity AS sev, count(*)::int AS n
      FROM findings f
      JOIN review_runs rr ON rr.id = f.review_run_id
      JOIN pull_requests pr ON pr.id = rr.pull_request_id
      JOIN repositories r ON r.id = pr.repository_id
      WHERE r.workspace_id = ${workspaceId}
      GROUP BY pr.repository_id, f.severity`,
    db<Array<{ rid: string; sev: string; n: number }>>`
      SELECT cs.repository_id AS rid, elem->>'severity' AS sev, count(*)::int AS n
      FROM codebase_scans cs
      JOIN repositories r ON r.id = cs.repository_id,
           LATERAL jsonb_array_elements(cs.summary->'findings') AS elem
      WHERE r.workspace_id = ${workspaceId}
        AND jsonb_typeof(cs.summary->'findings') = 'array'
      GROUP BY cs.repository_id, elem->>'severity'`,
    db<Array<{ rid: string; last_scan: string | null }>>`
      SELECT cs.repository_id AS rid, max(cs.completed_at) AS last_scan
      FROM codebase_scans cs
      JOIN repositories r ON r.id = cs.repository_id
      WHERE r.workspace_id = ${workspaceId}
      GROUP BY cs.repository_id`,
  ])

  const stats = new Map<string, RepoStats>()
  const get = (rid: string): RepoStats =>
    stats.get(rid) ?? {
      openPrs: 0,
      findings: 0,
      bySeverity: emptySeverity(),
      lastScanAt: null,
    }

  for (const row of prRows) {
    stats.set(row.rid, { ...get(row.rid), openPrs: Number(row.open_prs) || 0 })
  }
  for (const row of [...reviewSevRows, ...scanSevRows]) {
    const s = get(row.rid)
    const sev = SEVERITIES.includes(row.sev as keyof SeverityCounts)
      ? (row.sev as keyof SeverityCounts)
      : 'note'
    const n = Number(row.n) || 0
    s.bySeverity[sev] += n
    s.findings += n
    stats.set(row.rid, s)
  }
  for (const row of scanMetaRows) {
    const s = get(row.rid)
    stats.set(row.rid, {
      ...s,
      lastScanAt: row.last_scan ? new Date(row.last_scan) : s.lastScanAt,
    })
  }
  return stats
}

export function toSyncedRepository(
  repository: {
    id: string
    githubRepoId: string
    owner: string
    name: string
    defaultBranch: string
    language: string | null
    status: 'watching' | 'needs_setup' | 'paused'
  },
  stats?: RepoStats,
): SyncedRepository {
  const lastScanAt = stats?.lastScanAt ?? null
  return {
    id: repository.id,
    githubRepoId: repository.githubRepoId,
    owner: repository.owner,
    name: repository.name,
    fullName: `${repository.owner}/${repository.name}`,
    status:
      repository.status === 'needs_setup' ? 'needs setup' : repository.status,
    language: repository.language ?? 'Unknown',
    pullRequests: stats?.openPrs ?? 0,
    findings: stats?.findings ?? 0,
    findingsBySeverity: stats?.bySeverity ?? emptySeverity(),
    lastScan: lastScanAt ? relativeTime(lastScanAt) : 'not scanned',
    slug: repository.githubRepoId,
    defaultBranch: repository.defaultBranch,
    coverage: lastScanAt ? 'scanned' : 'not started',
    scanStatus: lastScanAt ? 'complete' : 'not configured',
  }
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
