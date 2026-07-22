// Best-effort: turn a review's findings into an actual pull request that
// applies the fixes. Fetches the affected files, asks the LLM for corrected
// content, commits it to a new branch, and opens a PR into the author's branch.
// Any failure (fork with no write access, LLM error, etc.) returns null — the
// review itself is never blocked.

import { SpanStatusCode } from '@opentelemetry/api'

import { tracer } from '../observability'
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
  return tracer.startActiveSpan('github.open_fix_pr', async (span) => {
    try {
      const repository = `${input.owner}/${input.repo}`

      // Group findings by file (skip any without a real path).
      const byPath = new Map<string, LlmFinding[]>()
      for (const finding of findings) {
        if (!finding.filePath) continue
        byPath.set(finding.filePath, [
          ...(byPath.get(finding.filePath) ?? []),
          finding,
        ])
      }
      if (byPath.size === 0) return null

      // Pull the current content of each affected file at the PR head.
      const files: FileToFix[] = []
      for (const [path, fileFindings] of byPath) {
        const file = await fetchFileAtRef({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          ref: input.headSha,
          path,
        })
        if (file) {
          files.push({ path, content: file.content, findings: fileFindings })
        }
      }
      if (files.length === 0) return null

      const fixes = await generateFixes({ repository, files })
      if (fixes.length === 0) return null

      const branch = `jargons/fix-pr-${input.prNumber}-${input.headSha.slice(0, 7)}`
      await createBranch({
        installationId: input.installationId,
        owner: input.owner,
        repo: input.repo,
        branch,
        fromSha: input.headSha,
      })

      for (const fix of fixes) {
        // Re-read the blob sha on the branch (handles a pre-existing branch).
        const current = await fetchFileAtRef({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          ref: branch,
          path: fix.path,
        })
        await commitFileToBranch({
          installationId: input.installationId,
          owner: input.owner,
          repo: input.repo,
          branch,
          path: fix.path,
          content: fix.content,
          sha: current?.sha,
          message: `fix: apply Jargons review suggestions to ${fix.path}`,
        })
      }

      const url = await openPullRequest({
        installationId: input.installationId,
        owner: input.owner,
        repo: input.repo,
        head: branch,
        base: input.headRef,
        title: `Jargons: apply suggested fixes for #${input.prNumber}`,
        body: fixBody(fixes.map((f) => f.path), input.prNumber),
      })

      span.setAttribute('jargons.fix_pr_opened', Boolean(url))
      span.setStatus({ code: SpanStatusCode.OK })
      return url
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'open fix PR failed',
      })
      span.recordException(error as Error)
      return null
    } finally {
      span.end()
    }
  })
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
