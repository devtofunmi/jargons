import { FileCode } from 'lucide-react'

import { IssueFixPrButton } from './fix-pr-button'
import { SeverityBadge, StatusBadge } from './issue-badges'
import { MarkdownBody } from './markdown-body'
import type { Issue } from './issue-types'

// The dedicated issue page content: severity + status, title, location, the
// markdown-rendered body, and a per-issue fix-PR action. The surrounding page
// (back link, layout) is owned by the route so `onOpenFixPr` can be wired to
// mock data now or a real endpoint later.
export function IssueDetail({
  issue,
  onOpenFixPr,
}: {
  issue: Issue
  onOpenFixPr: () => Promise<{ url: string | null; reason?: string }>
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <StatusBadge status={issue.status} />
      </div>

      <h1 className="mt-4 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
        {issue.title}
      </h1>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-zinc-600">
        <FileCode className="size-3.5" />
        {issue.repository} · {issue.filePath}
        {issue.lineNumber ? `:${issue.lineNumber}` : ''}
      </p>

      <article className="app-card mt-6 p-5 sm:p-6">
        <MarkdownBody>{issue.body}</MarkdownBody>
      </article>

      <div className="mt-6">
        {issue.status === 'open' ? (
          <IssueFixPrButton onOpen={onOpenFixPr} />
        ) : issue.status === 'fixed' ? (
          <p className="font-mono text-xs text-emerald-300">
            This issue has been fixed.
          </p>
        ) : (
          <p className="font-mono text-xs text-cyan-300">
            A fix PR is already open for this issue.
          </p>
        )}
      </div>
    </>
  )
}
