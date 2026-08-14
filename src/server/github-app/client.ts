// Low-level GitHub App auth + REST client: mint an app JWT, exchange it for a
// short-lived installation access token, and the installation lookups the
// install flow needs. Everything here talks to api.github.com; no app DB or
// server-function concerns leak in.

import { loadDb } from '../../db/load'
import { getEnv } from '../env'

export type GitHubInstallation = {
  id: number
  account: {
    login: string
    type: string
  } | null
}

export type GitHubRepository = {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  default_branch: string
  language: string | null
}

export type GitHubInstallationRepositoriesResponse = {
  total_count: number
  repositories: GitHubRepository[]
}

export function githubHeaders(authorization: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization,
    'x-github-api-version': '2022-11-28',
  }
}

// Look up the installation id for a workspace: prefer the one we've stored,
// otherwise ask GitHub for the account's installations and match by login.
export async function findInstallationId(
  workspaceId: string,
  username: string,
) {
  const { eq, db, githubInstallations } = await loadDb()

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

export async function getInstallation(installationId: string) {
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

// Uninstall the GitHub App from an account (removes the installation on
// GitHub's side). Best-effort: returns false instead of throwing so callers
// like account deletion are never blocked by a GitHub-side failure.
export async function uninstallGitHubApp(
  installationId: string,
): Promise<boolean> {
  try {
    const jwt = await createGitHubAppJwt()
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        method: 'DELETE',
        headers: githubHeaders(`Bearer ${jwt}`),
      },
    )

    return response.ok
  } catch {
    return false
  }
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
