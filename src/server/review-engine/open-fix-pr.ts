// Best-effort: turn a review's findings into an actual pull request that
// applies the fixes. Fetches the affected files, asks the LLM for corrected
// content, commits it to a new branch, and opens a PR into the author's branch.
// Any failure (fork with no write access, LLM error, etc.) returns null — the
// review itself is never blocked.

import { severityRank } from '../../lib/severity'
import { NO_USAGE } from '../llm/usage'
import type { LlmUsage } from '../llm/usage'
import { generateFixes } from './autofix'
import type { FileToFix } from './autofix'
import {
  commitFileToBranch,
  createBranch,
  fetchFileAtRef,
  findOpenPullRequestForBranch,
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
  signal?: AbortSignal,
): Promise<{ url: string | null; usage: LlmUsage }> {
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
      signal,
    })

    if (!result.ok) {
      console.log('open_fix_pr: no fix PR opened', {
        repository: `${input.owner}/${input.repo}`,
        prNumber: input.prNumber,
        reason: result.reason,
      })
    }

    // The fix PR is best-effort, but its token spend is real either way, so the
    // usage is reported even when no PR came out of it.
    return { url: result.ok ? result.url : null, usage: result.usage }
  } catch (error) {
    // Logged, not swallowed. This catch being silent is why a cancelled fix PR
    // left no trace at all and had to be diagnosed by reproducing the run.
    console.error('open_fix_pr: failed', {
      repository: `${input.owner}/${input.repo}`,
      prNumber: input.prNumber,
      error: error instanceof Error ? error.message : String(error),
    })

    // A thrown autofix call may still have burned tokens, but the usage is lost
    // with the exception — treat it as zero rather than guess.
    return { url: null, usage: NO_USAGE }
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
  /** Cancels the autofix call if the caller's deadline passes. */
  signal?: AbortSignal
}

// `usage` is reported on every branch, including the failures that happen after
// the autofix call — those still cost tokens, so dropping them would understate
// what a run actually spent. It is NO_USAGE only on the paths that return before
// the LLM is reached.
export type ApplyFindingsResult =
  | { ok: true; url: string; usage: LlmUsage }
  | {
      ok: false
      reason:
        | 'no_paths'
        | 'no_files'
        | 'no_fixes'
        | 'no_write_access'
        | 'pr_rejected'
      usage: LlmUsage
    }

// Budgets for the fix pass, mirroring the scan engine's MAX_FILES /
// MAX_TOTAL_CHARS. Autofix sends every affected file's FULL content in one
// prompt, so a review with findings spread across many large files would
// otherwise build an unbounded request. Fixing the most severe files is worth
// more than attempting all of them and blowing the context.
const MAX_FILES_TO_FIX = 6
const MAX_FIX_CHARS = 60_000

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
  if (byPath.size === 0)
    return { ok: false, reason: 'no_paths', usage: NO_USAGE }

  // Most severe file first, so if the budget cuts the list short it keeps the
  // findings that matter most.
  const candidates = [...byPath.entries()].sort(
    ([, a], [, b]) => worstSeverity(a) - worstSeverity(b),
  )
  if (candidates.length > MAX_FILES_TO_FIX) {
    console.log('open_fix_pr: capping files to fix', {
      repository: `${input.owner}/${input.repo}`,
      candidates: candidates.length,
      cap: MAX_FILES_TO_FIX,
      skipped: candidates.slice(MAX_FILES_TO_FIX).map(([path]) => path),
    })
  }

  // Pull the current content of each affected file at the base sha, within the
  // file-count and total-size budget.
  const files: FileToFix[] = []
  let totalChars = 0
  for (const [path, fileFindings] of candidates.slice(0, MAX_FILES_TO_FIX)) {
    const file = await fetchFileAtRef({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      ref: input.fromSha,
      path,
    })
    if (!file) continue

    // Never send a partial file: autofix must return the COMPLETE corrected
    // content, and a truncated original would be "fixed" into a truncated file.
    if (totalChars + file.content.length > MAX_FIX_CHARS) {
      console.log('open_fix_pr: skipping file, over the size budget', {
        repository: `${input.owner}/${input.repo}`,
        path,
        chars: file.content.length,
        budgetLeft: MAX_FIX_CHARS - totalChars,
      })
      continue
    }

    files.push({ path, content: file.content, findings: fileFindings })
    totalChars += file.content.length
  }
  if (files.length === 0)
    return { ok: false, reason: 'no_files', usage: NO_USAGE }

  const { files: fixes, usage } = await generateFixes({
    files,
    signal: input.signal,
  })
  if (fixes.length === 0) return { ok: false, reason: 'no_fixes', usage }

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

  const opened = await openPullRequest({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    head: input.branch,
    base: input.base,
    title: input.prTitle,
    body: input.prBody(fixes.map((f) => f.path)),
  })
  if (opened.url) {
    return { ok: true, url: opened.url, usage }
  }

  // A 422 is usually "a pull request already exists for this head branch". If
  // one is open, hand it back rather than reporting a failure — the fixes were
  // just committed to its branch, so it's the right answer.
  const existing = await findOpenPullRequestForBranch({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
  })
  if (existing) {
    return { ok: true, url: existing, usage }
  }

  // 403 means the installation can't write here (missing Contents/Pull requests
  // permission, or an outside-collaborator repo). Worth telling apart from a
  // generic rejection, because the user has to act on it.
  if (opened.status === 403) {
    return { ok: false, reason: 'no_write_access', usage }
  }

  console.log('open_fix_pr: GitHub rejected the pull request', {
    repository: `${input.owner}/${input.repo}`,
    branch: input.branch,
    base: input.base,
    status: opened.status,
  })

  return { ok: false, reason: 'pr_rejected', usage }
}

function worstSeverity(findings: LlmFinding[]): number {
  return Math.min(...findings.map((f) => severityRank(f.severity)))
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
