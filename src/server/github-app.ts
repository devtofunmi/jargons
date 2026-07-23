import { createServerFn } from '@tanstack/react-start'

import { getEnv } from './env'
import { getCurrentUserFromCookie } from './github-auth'

type GitHubInstallation = {
  id: number
  account: {
    login: string
    type: string
  } | null
}

type GitHubRepository = {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  default_branch: string
  language: string | null
}

type GitHubInstallationRepositoriesResponse = {
  total_count: number
  repositories: GitHubRepository[]
}

export type SeverityCounts = {
  critical: number
  high: number
  medium: number
  low: number
  note: number
}

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

export const getGitHubAppInstallUrl = createServerFn({
  method: 'GET',
}).handler(async () => {
  const appSlug = getEnv('GITHUB_APP_SLUG')
  const appUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`)

  return {
    url: appUrl.toString(),
  }
})

export const getGitHubAppStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return { signedIn: Boolean(currentUser), installed: false }
    }

    const [{ eq }, { db }, { githubInstallations }] = await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
    ])

    const rows = await db
      .select({ id: githubInstallations.id })
      .from(githubInstallations)
      .where(eq(githubInstallations.workspaceId, currentUser.workspace.id))
      .limit(1)

    return { signedIn: true, installed: rows.length > 0 }
  },
)

export const completeGitHubAppInstallation = createServerFn({ method: 'POST' })
  .validator((input: { installationId?: string }) => input)
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      throw new Error('Sign in before installing the GitHub app.')
    }

    // GitHub omits installation_id when redirecting after an update to an
    // existing installation (setup_action=update), so fall back to finding
    // the installation ourselves.
    const installationId =
      data.installationId ??
      (await findInstallationId(currentUser.workspace.id, currentUser.username))
    const installation = await getInstallation(installationId)
    const [{ db }, { githubInstallations }] = await Promise.all([
      import('../db/client'),
      import('../db/schema'),
    ])
    const accountLogin = installation.account?.login ?? currentUser.username
    const accountType = installation.account?.type ?? 'User'
    const now = new Date()

    await db
      .insert(githubInstallations)
      .values({
        workspaceId: currentUser.workspace.id,
        installationId: String(installation.id),
        accountLogin,
        accountType,
        status: 'active',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          workspaceId: currentUser.workspace.id,
          accountLogin,
          accountType,
          status: 'active',
          updatedAt: now,
        },
      })

    const syncedRepositories = await syncInstallationRepositories({
      installationId: String(installation.id),
      workspaceId: currentUser.workspace.id,
    })

    return {
      accountLogin,
      syncedRepositories,
    }
  })

export const getSyncedRepositories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SyncedRepository[]> => {
    const [{ eq }, { db }, { repositories: repositoryTable }] =
      await Promise.all([
        import('drizzle-orm'),
        import('../db/client'),
        import('../db/schema'),
      ])
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return []
    }

    const repositories = await db
      .select({
        id: repositoryTable.id,
        githubRepoId: repositoryTable.githubRepoId,
        owner: repositoryTable.owner,
        name: repositoryTable.name,
        defaultBranch: repositoryTable.defaultBranch,
        language: repositoryTable.language,
        status: repositoryTable.status,
      })
      .from(repositoryTable)
      .where(eq(repositoryTable.workspaceId, currentUser.workspace.id))

    const stats = await loadRepositoryStats(currentUser.workspace.id)

    return repositories.map((repository) =>
      toSyncedRepository(repository, stats.get(repository.id)),
    )
  },
)

export const getSyncedRepository = createServerFn({ method: 'GET' })
  .validator((input: { repoId: string }) => input)
  .handler(async ({ data }): Promise<SyncedRepository | null> => {
    const [{ and, eq }, { db }, { repositories: repositoryTable }] =
      await Promise.all([
        import('drizzle-orm'),
        import('../db/client'),
        import('../db/schema'),
      ])
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return null
    }

    const repositoryRows = await db
      .select({
        id: repositoryTable.id,
        githubRepoId: repositoryTable.githubRepoId,
        owner: repositoryTable.owner,
        name: repositoryTable.name,
        defaultBranch: repositoryTable.defaultBranch,
        language: repositoryTable.language,
        status: repositoryTable.status,
      })
      .from(repositoryTable)
      .where(
        and(
          eq(repositoryTable.githubRepoId, data.repoId),
          eq(repositoryTable.workspaceId, currentUser.workspace.id),
        ),
      )
      .limit(1)

    if (repositoryRows.length === 0) {
      return null
    }

    const stats = await loadRepositoryStats(currentUser.workspace.id)

    return toSyncedRepository(repositoryRows[0], stats.get(repositoryRows[0].id))
  })

async function syncInstallationRepositories({
  installationId,
  workspaceId,
}: {
  installationId: string
  workspaceId: string
}) {
  const [{ and, eq, notInArray }, { db }, { repositories: repositoryTable }] =
    await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
    ])
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

async function findInstallationId(workspaceId: string, username: string) {
  const [{ eq }, { db }, { githubInstallations }] = await Promise.all([
    import('drizzle-orm'),
    import('../db/client'),
    import('../db/schema'),
  ])

  const existing = await db
    .select({ installationId: githubInstallations.installationId })
    .from(githubInstallations)
    .where(eq(githubInstallations.workspaceId, workspaceId))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].installationId
  }

  const jwt = await createGitHubAppJwt()
  const response = await fetch('https://api.github.com/app/installations', {
    headers: githubHeaders(`Bearer ${jwt}`),
  })

  if (!response.ok) {
    throw new Error('Unable to list GitHub App installations.')
  }

  const installations = (await response.json()) as GitHubInstallation[]
  const match = installations.find(
    (installation) =>
      installation.account?.login.toLowerCase() === username.toLowerCase(),
  )

  if (!match) {
    throw new Error(
      'No Jargons installation found for your GitHub account. Install the app first.',
    )
  }

  return String(match.id)
}

async function getInstallation(installationId: string) {
  const jwt = await createGitHubAppJwt()
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: githubHeaders(`Bearer ${jwt}`),
    },
  )

  if (!response.ok) {
    throw new Error('Unable to read GitHub App installation.')
  }

  return (await response.json()) as GitHubInstallation
}

export async function createInstallationAccessToken(installationId: string) {
  const jwt = await createGitHubAppJwt()
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: githubHeaders(`Bearer ${jwt}`),
    },
  )

  if (!response.ok) {
    throw new Error('Unable to create GitHub installation access token.')
  }

  const token = (await response.json()) as { token?: string }

  if (!token.token) {
    throw new Error('GitHub did not return an installation token.')
  }

  return token.token
}

async function createGitHubAppJwt() {
  const [{ createSign }, { Buffer }] = await Promise.all([
    import('node:crypto'),
    import('node:buffer'),
  ])
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(
    JSON.stringify({
      alg: 'RS256',
      typ: 'JWT',
    }),
    Buffer,
  )
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: getEnv('GITHUB_APP_ID'),
    }),
    Buffer,
  )
  const unsignedToken = `${header}.${payload}`
  const privateKey = getEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n')
  const signature = createSign('RSA-SHA256')
    .update(unsignedToken)
    .sign(privateKey)

  return `${unsignedToken}.${base64UrlEncode(signature, Buffer)}`
}

function base64UrlEncode(
  value: string | Uint8Array,
  BufferCtor: typeof Buffer,
) {
  return BufferCtor.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export function githubHeaders(authorization: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization,
    'x-github-api-version': '2022-11-28',
  }
}

type RepoStats = {
  openPrs: number
  findings: number
  bySeverity: SeverityCounts
  lastScanAt: Date | null
}

const SEVERITIES: Array<keyof SeverityCounts> = [
  'critical',
  'high',
  'medium',
  'low',
  'note',
]

function emptySeverity(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, note: 0 }
}

// Real per-repo counts for every repo in the workspace, keyed by repository id.
// Findings-by-severity combines PR-review findings (findings table) and
// codebase-scan findings (stored in the scan summary JSON); totals derive from
// those so there's a single source of truth.
async function loadRepositoryStats(
  workspaceId: string,
): Promise<Map<string, RepoStats>> {
  const { sqlClient: db } = await import('../db/client')

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

function toSyncedRepository(
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
