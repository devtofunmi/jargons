import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { IssueDetail } from '../components/issues/issue-detail'
import type { Issue } from '../components/issues/issue-types'
import { DetailPageSkeleton } from '../components/skeletons'
import { getBilling } from '../server/billing'
import { getCodebaseScan, openScanFixPr } from '../server/scans'

export const Route = createFileRoute('/app/scans/$scanId/$findingId')({
  pendingComponent: DetailPageSkeleton,
  loader: async ({ params }) => {
    const [scan, billing] = await Promise.all([
      getCodebaseScan({ data: { scanId: params.scanId } }),
      getBilling(),
    ])

    if (!scan) {
      throw notFound()
    }

    const index = Number(params.findingId)
    const finding = Number.isInteger(index) ? scan.findings[index] : undefined

    if (!finding) {
      throw notFound()
    }

    return {
      scanId: params.scanId,
      index,
      finding,
      repository: scan.repository,
      canRun: billing?.canRun ?? false,
    }
  },
  component: ScanFindingPage,
})

function ScanFindingPage() {
  const { scanId, index, finding, repository, canRun } = Route.useLoaderData()

  const issue: Issue = {
    id: String(index),
    title: finding.title,
    repository,
    filePath: finding.filePath,
    lineNumber: finding.lineNumber,
    severity: finding.severity,
    // Scans don't track per-finding fix state, so every finding reads as open.
    status: 'open',
    body: finding.suggestion
      ? `${finding.description}\n\n## Suggested fix\n\n${finding.suggestion}`
      : finding.description,
  }

  async function openFixPr(): Promise<{ url: string | null }> {
    // Free tier used up → send them to pricing instead of opening a PR.
    if (!canRun) {
      window.location.assign('/pricing')
      return { url: null }
    }
    const result = await openScanFixPr({
      data: { scanId, findingIndex: index },
    })
    if (result.reason === 'upgrade_required') {
      window.location.assign('/pricing')
      return { url: null }
    }
    return { url: result.url }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        to="/app/scans/$scanId"
        params={{ scanId }}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" />
        {repository}
      </Link>

      <div className="mt-8">
        <IssueDetail issue={issue} onOpenFixPr={openFixPr} />
      </div>
    </section>
  )
}
