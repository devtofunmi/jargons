// GitHub REST calls used by the codebase scan engine: list a repo's file tree
// and read file contents, using a short-lived installation access token.

import { createInstallationAccessToken, githubHeaders } from '../github-app'

// Only source files worth scanning; skip lockfiles, assets, vendored code.
const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'php',
  'cs',
  'swift',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'vue',
  'svelte',
])
const SKIP_DIRS = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  'vendor/',
  '.output/',
  'coverage/',
]

export type RepoFile = { path: string; content: string }

export async function fetchRepoTree({
  installationId,
  owner,
  repo,
  branch,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
}): Promise<string[]> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: githubHeaders(`Bearer ${token}`) },
  )

  if (!response.ok) {
    throw new Error(
      `Unable to fetch repo tree (${response.status}) for ${owner}/${repo}@${branch}`,
    )
  }

  const data = (await response.json()) as {
    tree?: Array<{ path: string; type: string }>
  }

  return (data.tree ?? [])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((path) => {
      if (SKIP_DIRS.some((dir) => path.includes(dir))) {
        return false
      }
      const ext = path.split('.').pop()?.toLowerCase() ?? ''
      return CODE_EXTENSIONS.has(ext)
    })
}

export async function fetchFileContent({
  installationId,
  owner,
  repo,
  branch,
  path,
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
  path: string
}): Promise<string | null> {
  const token = await createInstallationAccessToken(installationId)
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: githubHeaders(`Bearer ${token}`) },
  )

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    content?: string
    encoding?: string
  }

  if (data.encoding !== 'base64' || !data.content) {
    return null
  }

  return Buffer.from(data.content, 'base64').toString('utf8')
}
