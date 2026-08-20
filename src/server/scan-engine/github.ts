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

// How many file reads run at once. The installation token is cached, so these
// are one request each; the ceiling is about not hammering GitHub rather than
// about rate-limit arithmetic.
const FETCH_CONCURRENCY = 8

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

// Read an explicit list of files, a few at a time. Only these paths are
// fetched — the scan never pulls a whole repository, so what it reads is always
// a list something decided on rather than everything that happened to be there.
//
// Results keep the order of `paths` regardless of which read finishes first, so
// a scan of an unchanged repository always produces the same input. A file that
// cannot be read is skipped rather than failing the run: one unreadable file
// should cost its own edges, not the entire map.
export async function fetchFiles({
  installationId,
  owner,
  repo,
  branch,
  paths,
  maxChars = 0, // Default to 0 if not provided, ensuring it's always a number
}: {
  installationId: string
  owner: string
  repo: string
  branch: string
  paths: string[]
  // Per-file cap. The graph pass only needs the head of a file, since that is
  // where import statements live.
  maxChars?: number
}): Promise<RepoFile[]> {
  const results: Array<RepoFile | null> = new Array(paths.length).fill(null)
  let next = 0

  const worker = async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= paths.length) return

      const path = paths[index]
      try {
        const content = await fetchFileContent({
          installationId,
          owner,
          repo,
          branch,
          path,
        })
        if (content === null) continue
        results[index] = {
          path,
          content: maxChars > 0 ? content.slice(0, maxChars) : content,
        }
      } catch {
        // Unreadable file: leave the slot empty and keep going.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker),
  )

  return results.filter((file): file is RepoFile => file !== null)
}
