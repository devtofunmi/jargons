// Best-effort: turn a review's findings into an actual pull request that
// applies the fixes. Fetches the affected files, asks the LLM for corrected
// content, commits it to a new branch, and opens a PR into the author's branch.
// Any failure (fork with no write access, LLM error, etc.) returns null — the
// review itself is never blocked.

import { generateFixes } from './autofix'
import type { FileToFix } from './autofix'
import {
  commitFileToBranch,
  createBranch,
  fetchFileAtRef,
  openPullRequest,
} from './github'
import type { LlmFinding } from './llm'

export type OpenFixPrInput = {
  installationId: string
  owner: string
  repo: string
  prNumber: number
  headSha: string
  headRef: string
}

export async function openFixPr(
  input: OpenFixPrInput,
  findings: LlmFinding[],
): Promise<string | null> {
  try {
    const result = await applyFindingsAsFixPr({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      findings,
      fromSha: input.headSha,
      base: input.headRef,
      branch: `jargons/fix-pr-${input.prNumber}-${input.headSha.slice(0, 7)}`,
      commitMessage: (path) =>
        `fix: apply Jargons review suggestions to ${path}`,
      prTitle: `Jargons: apply suggested fixes for #${input.prNumber}`,
      prBody: (paths) => fixBody(paths, input.prNumber),
    })

    return result.ok ? result.url : null
  } catch {
    return null
  }
}

export type ApplyFindingsInput = {
  installationId: string
  owner: string
  repo: string
  findings: LlmFinding[]
  /** Sha to branch from and to read each affected file's original content at. */
  fromSha: string
  /** Ref the fix PR is opened against. */
  base: string
  branch: string
  commitMessage: (path: string) => string
  prTitle: string
  prBody: (paths: string[]) => string
}

export type ApplyFindingsResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'no_paths' | 'no_files' | 'no_fixes' | 'pr_rejected' }

// Shared mechanics behind both the review and scan fix-PR flows: group findings
// by file, fetch each file, ask the LLM for corrected content, commit the
// changed files to a fresh branch, and open the PR. Returns a structured result
// so each caller can map the "nothing happened" cases to its own behaviour (the
// review flow treats them all as null; the scan flow surfaces a reason to the
// user). Throws only on a real error — callers own the error handling.
export async function applyFindingsAsFixPr(
  input: ApplyFindingsInput,
): Promise<ApplyFindingsResult> {
  // Group findings by file (skip any without a real path).
  const byPath = new Map<string, LlmFinding[]>()
  for (const finding of input.findings) {
    if (!finding.filePath) continue
    byPath.set(finding.filePath, [
      ...(byPath.get(finding.filePath) ?? []),
      finding,
    ])
  }
  if (byPath.size === 0) return { ok: false, reason: 'no_paths' }

  // Pull the current content of each affected file at the base sha.
  const files: FileToFix[] = []
  for (const [path, fileFindings] of byPath) {
    const file = await fetchFileAtRef({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      ref: input.fromSha,
      path,
    })
    if (file) {
      files.push({ path, content: file.content, findings: fileFindings })
    }
  }
  if (files.length === 0) return { ok: false, reason: 'no_files' }

  const fixes = await generateFixes({ files })
  if (fixes.length === 0) return { ok: false, reason: 'no_fixes' }

  await createBranch({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    fromSha: input.fromSha,
  })

  for (const fix of fixes) {
    // Re-read the blob sha on the branch (handles a pre-existing branch).
    const current = await fetchFileAtRef({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      ref: input.branch,
      path: fix.path,
    })
    await commitFileToBranch({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      path: fix.path,
      content: fix.content,
      sha: current?.sha,
      message: input.commitMessage(fix.path),
    })
  }

  const url = await openPullRequest({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    head: input.branch,
    base: input.base,
    title: input.prTitle,
    body: input.prBody(fixes.map((f) => f.path)),
  })

  return url ? { ok: true, url } : { ok: false, reason: 'pr_rejected' }
}

function fixBody(paths: string[], prNumber: number): string {
  return [
    `This PR applies the fixes Jargons suggested while reviewing #${prNumber}.`,
    '',
    'Files changed:',
    ...paths.map((p) => `- \`${p}\``),
    '',
    '_Review the changes before merging — Jargons proposes, you decide._',
  ].join('\n')
}
