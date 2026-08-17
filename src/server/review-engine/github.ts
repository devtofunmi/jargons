// GitHub REST calls used by the review engine: fetch a PR's unified diff, and
// post the review back as a PR review comment. Both use a short-lived
// installation access token minted by the GitHub App helpers.

import { severityRank } from '../../lib/severity'
import { getEnv } from '../env'
import { createInstallationAccessToken, githubHeaders } from '../github-app'
import type { LlmFinding, ReviewSeverity } from './llm'

// The GitHub App's avatar is the Jargons logo, so the review header renders it
// inline (via the public app-avatar URL) instead of an emoji.
function reviewHeader(): string {
  const appId = getEnv('GITHUB_APP_ID').trim()
  return `## <img src="https://avatars.githubusercontent.com/in/${appId}?s=40" width="20" align="top" alt="Jargons" /> Jargons review`
}

// Cap the diff we send to the model so a huge PR can't blow the token budget.
const MAX_DIFF_CHARS = 60_000

export type RepoFileAtRef = { path: string; content: string; sha: string }

// Read a file's full content + blob SHA at a given ref (branch/sha).
export async function fetchFileAtRef({
  installationId,
  owner,
  repo,
  ref,
  path,
}: {
  installationId: string
  owner: string
  repo: string
  ref: string
  path: string
}): Promise<RepoFileAtRef | null> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(`Bearer ${token}`) },
  )
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as {
    content?: string
    encoding?: string
    sha?: string
  }
  if (data.encoding !== 'base64' || !data.content || !data.sha) {
    return null
  }
  return {
    path,
    content: Buffer.from(data.content, 'base64').toString('utf8'),
    sha: data.sha,
  }
}

// Resolve the head commit SHA of a branch (e.g. a repo's default branch).
export async function getBranchHeadSha({
  installationId,
  owner,
  repo,
  branch,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
}): Promise<string | null> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(`Bearer ${token}`) },
  )
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as { object?: { sha?: string } }
  return data.object?.sha ?? null
}

// Create a branch pointing at fromSha. Returns false if it already exists.
export async function createBranch({
  installationId,
  owner,
  repo,
  branch,
  fromSha,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
  fromSha: string
}): Promise<boolean> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: githubHeaders(`Bearer ${token}`),
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
    },
  )
  if (response.status === 422) {
    return false // already exists
  }
  if (!response.ok) {
    throw new Error(`Unable to create branch ${branch} (${response.status})`)
  }
  return true
}

// Commit a file's new content onto a branch (create or update).
export async function commitFileToBranch({
  installationId,
  owner,
  repo,
  branch,
  path,
  content,
  sha,
  message,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
  path: string
  content: string
  sha: string | undefined
  message: string
}): Promise<void> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: githubHeaders(`Bearer ${token}`),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        sha,
      }),
    },
  )
  if (!response.ok) {
    throw new Error(
      `Unable to commit ${path} to ${branch} (${response.status}): ${await response.text()}`,
    )
  }
}

// Open a pull request. Returns its html_url, or null if GitHub rejects it
// (e.g. no diff between branches).
export async function openPullRequest({
  installationId,
  owner,
  repo,
  head,
  base,
  title,
  body,
}: {
  installationId: string
  owner: string
  repo: string
  head: string
  base: string
  title: string
  body: string
}): Promise<string | null> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: githubHeaders(`Bearer ${token}`),
      body: JSON.stringify({ title, body, head, base }),
    },
  )
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as { html_url?: string }
  return data.html_url ?? null
}

// Find the open pull request whose head is `branch`, if there is one. Fix-PR
// branch names are deterministic, so this is what makes the flow idempotent: a
// repeat attempt can hand back the PR that already exists instead of
// regenerating the fixes and then failing on GitHub's "a pull request already
// exists for this branch" (422). Returns null on any non-ok response, so a
// lookup failure just falls through to the normal path.
export async function findOpenPullRequestForBranch({
  installationId,
  owner,
  repo,
  branch,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
}): Promise<string | null> {
  const token = await createInstallationAccessToken(installationId)
  // `head` must be qualified as owner:ref. Fix branches live in the same repo,
  // so the repo owner is always the right qualifier.
  const head = encodeURIComponent(`${owner}:${branch}`)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${head}&per_page=1`,
    { headers: githubHeaders(`Bearer ${token}`) },
  )

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as Array<{ html_url?: string }>

  return data[0]?.html_url ?? null
}

// Nudge a free workspace to upgrade once it has used its trial run. Posted as
// a plain PR comment. Best-effort — never throws.
export async function postUpgradeComment({
  installationId,
  owner,
  repo,
  prNumber,
  upgradeUrl,
}: {
  installationId: string
  owner: string
  repo: string
  prNumber: number
  upgradeUrl: string
}): Promise<void> {
  try {
    const token = await createInstallationAccessToken(installationId)
    const body = [
      reviewHeader(),
      '',
      "You've used the free Jargons run for this workspace. Upgrade to keep reviewing pull requests and scanning your codebase.",
      '',
      `**[Upgrade to Jargons Pro →](${upgradeUrl})**`,
    ].join('\n')
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: githubHeaders(`Bearer ${token}`),
        body: JSON.stringify({ body }),
      },
    )
  } catch {
    // best-effort
  }
}

export async function fetchPullRequestDiff({
  installationId,
  owner,
  repo,
  prNumber,
}: {
  installationId: string
  owner: string
  repo: string
  prNumber: number
}): Promise<{ diff: string; truncated: boolean }> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        ...githubHeaders(`Bearer ${token}`),
        accept: 'application/vnd.github.v3.diff',
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `Unable to fetch PR diff (${response.status}) for ${owner}/${repo}#${prNumber}`,
    )
  }

  const raw = await response.text()
  const truncated = raw.length > MAX_DIFF_CHARS

  return {
    diff: truncated ? raw.slice(0, MAX_DIFF_CHARS) : raw,
    truncated,
  }
}

export async function postReviewComment({
  installationId,
  owner,
  repo,
  prNumber,
  findings,
  truncated,
  fixPrUrl,
}: {
  installationId: string
  owner: string
  repo: string
  prNumber: number
  findings: LlmFinding[]
  truncated: boolean
  fixPrUrl?: string | null
}): Promise<void> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: githubHeaders(`Bearer ${token}`),
      body: JSON.stringify({
        event: 'COMMENT',
        body: renderReviewBody(findings, truncated, fixPrUrl),
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `Unable to post review (${response.status}) to ${owner}/${repo}#${prNumber}: ${detail}`,
    )
  }
}

const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🔵 Low',
  note: '⚪ Note',
}

function renderReviewBody(
  findings: LlmFinding[],
  truncated: boolean,
  fixPrUrl?: string | null,
): string {
  const fixLine = fixPrUrl
    ? `\n\n**🔧 Suggested fixes:** [open the fix PR →](${fixPrUrl})`
    : ''

  if (findings.length === 0) {
    return [
      reviewHeader(),
      '',
      'No blocking issues found in this diff. Nice work.',
      truncated ? '\n_Note: the diff was large and reviewed in part._' : '',
    ]
      .join('\n')
      .trim()
  }

  const sorted = [...findings].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  )

  const lines = [
    reviewHeader(),
    '',
    `Found **${findings.length}** issue${findings.length === 1 ? '' : 's'} worth a look:`,
    '',
  ]

  for (const finding of sorted) {
    const location = finding.lineNumber
      ? `\`${finding.filePath}:${finding.lineNumber}\``
      : `\`${finding.filePath}\``

    lines.push(`### ${SEVERITY_LABEL[finding.severity]} — ${finding.title}`)
    lines.push(location)
    lines.push('')
    lines.push(finding.description)

    if (finding.suggestion) {
      lines.push('')
      lines.push(`**Suggestion:** ${finding.suggestion}`)
    }

    lines.push('')
  }

  if (truncated) {
    lines.push('_Note: the diff was large and reviewed in part._')
  }

  return (lines.join('\n').trim() + fixLine).trim()
}
