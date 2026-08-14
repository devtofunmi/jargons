import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  FileCode,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { FindingCard } from '../components/issues/finding-card'
import { DetailPageSkeleton } from '../components/skeletons'
import { timeAgo } from '../lib/format'
import { getCodebaseScan } from '../server/scans'
import type { CodebaseScanDetail, CodebaseScanFinding } from '../server/scans'

export const Route = createFileRoute('/app/scans/$scanId/')({
  component: ScanDetailPage,
  pendingComponent: DetailPageSkeleton,
  loader: async ({ params }) => {
    const scan = await getCodebaseScan({ data: { scanId: params.scanId } })

    if (!scan) {
      throw notFound()
    }

    return { scan }
  },
})

const severityStyles: Record<CodebaseScanFinding['severity'], string> = {
  critical: 'border-red-300/25 bg-red-300/[0.08] text-red-200',
  high: 'border-orange-300/20 bg-orange-300/[0.06] text-orange-300',
  medium: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-300',
  low: 'border-sky-300/20 bg-sky-300/[0.06] text-sky-300',
  note: 'border-white/[0.1] bg-white/[0.04] text-zinc-400',
}

function ScanDetailPage() {
  const loaderData = Route.useLoaderData()
  const [scan, setScan] = useState(loaderData.scan)

  // Re-sync when the route loader re-runs (e.g. navigating to another scan).
  useEffect(() => {
    setScan(loaderData.scan)
  }, [loaderData.scan])

  const isScanning = scan.status === 'queued' || scan.status === 'running'

  // The loader fetches the scan once. While it's still running, poll for the
  // result so the page fills in live instead of appearing stuck on "running"
  // until a manual reload.
  useEffect(() => {
    if (!isScanning) return
    let active = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const next = await getCodebaseScan({ data: { scanId: scan.id } })
        if (active && next) setScan(next)
      } catch {
        // transient — keep polling
      }
      if (active) timer = setTimeout(() => void poll(), 2500)
    }

    timer = setTimeout(() => void poll(), 2000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isScanning, scan.id])

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-200"
        to="/app/scans"
      >
        <ArrowLeft className="size-4" />
        scans
      </Link>

      <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            codebase scan
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
            {scan.repository}
          </h1>
          <p className="mt-4 font-mono text-xs text-zinc-600">
            {scan.scannedFiles} files scanned ·{' '}
            {scan.completedAt
              ? `finished ${timeAgo(scan.completedAt)}`
              : scan.startedAt
                ? `started ${timeAgo(scan.startedAt)}`
                : 'queued'}
          </p>
        </div>
        <ScanStatusBadge status={scan.status} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScanStat label="files scanned" value={String(scan.scannedFiles)} />
        <ScanStat label="findings" value={String(scan.findingsCount)} />
        <ScanStat
          label="critical + high"
          value={String(scan.counts.critical + scan.counts.high)}
        />
        <ScanStat label="status" value={scan.status} />
      </div>

      {scan.findingsCount > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {(['critical', 'high', 'medium', 'low', 'note'] as const)
            .filter((severity) => scan.counts[severity] > 0)
            .map((severity) => (
              <span
                key={severity}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase ${severityStyles[severity]}`}
              >
                {scan.counts[severity]} {severity}
              </span>
            ))}
        </div>
      ) : null}

      <article className="app-card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ScanSearch className="size-4 text-cyan-300" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">Findings</h2>
        </div>

        {isScanning ? (
          <ScanningFindings repository={scan.repository} />
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {scan.findings.length > 0 ? (
              scan.findings.map((finding, index) => (
                <Link
                  key={`${finding.filePath}-${finding.lineNumber ?? 'x'}-${index}`}
                  to="/app/scans/$scanId/$findingId"
                  params={{ scanId: scan.id, findingId: String(index) }}
                  className="block"
                >
                  <FindingCard
                    title={finding.title}
                    description={finding.description}
                    filePath={finding.filePath}
                    lineNumber={finding.lineNumber}
                    severity={finding.severity}
                    interactive
                  />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#09090b] p-5">
                <Sparkles className="size-5 text-emerald-300" />
                <h3 className="mt-4 text-sm font-semibold text-zinc-200">
                  {scan.status === 'complete'
                    ? 'No findings'
                    : scan.status === 'failed'
                      ? 'Scan failed'
                      : 'Scan in progress'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {scan.status === 'complete'
                    ? 'Jargons did not find anything risky in the scanned files.'
                    : scan.status === 'failed'
                      ? 'This scan did not finish. Try starting a new scan.'
                      : 'Findings will appear here once the scan finishes.'}
                </p>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  )
}

// Contained "scanning" state for the Findings card: a cyan radar pulse, a live
// status line, and placeholder cards that glow in sequence — shown while the
// scan is queued/running (the page polls for the real findings).
function ScanningFindings({ repository }: { repository: string }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.03] p-5">
        <div className="relative grid size-14 shrink-0 place-items-center">
          <span className="absolute size-full animate-ping rounded-full bg-cyan-400/10" />
          <span className="absolute size-2/3 animate-ping rounded-full bg-cyan-400/20 [animation-delay:500ms]" />
          <span className="grid size-11 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-300">
            <ScanSearch className="size-5 animate-pulse" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="flex items-center text-sm font-medium text-zinc-200">
            Scanning {repository}
            <span className="ml-0.5 inline-flex">
              <span className="animate-[soft-blink_1.4s_infinite]">.</span>
              <span className="animate-[soft-blink_1.4s_infinite] [animation-delay:200ms]">
                .
              </span>
              <span className="animate-[soft-blink_1.4s_infinite] [animation-delay:400ms]">
                .
              </span>
            </span>
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Reading files and hunting for bugs, security issues, and structural
            risks.
          </p>
          <div className="mt-3 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-cyan-400/30 to-cyan-300 animate-[progress-run_1.8s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-[context-focus_2.6s_ease-in-out_infinite] rounded-2xl border border-white/[0.07] bg-[#09090b] p-5"
            style={{ animationDelay: `${i * 260}ms` }}
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-4 w-12 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
            <div className="mt-3 h-2.5 w-2/5 animate-pulse rounded bg-white/[0.04]" />
            <div className="mt-4 space-y-2">
              <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-2.5 w-4/6 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScanStatusBadge({ status }: { status: CodebaseScanDetail['status'] }) {
  const isComplete = status === 'complete'
  const isFailed = status === 'failed'
  const Icon = isComplete ? Check : isFailed ? AlertTriangle : Clock3
  const tone = isComplete
    ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300'
    : isFailed
      ? 'border-red-300/20 bg-red-300/[0.06] text-red-300'
      : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-300'

  return (
    <span
      className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-3 font-mono text-xs ${tone}`}
    >
      <Icon className="size-4" />
      {status}
    </span>
  )
}

function ScanStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-center gap-2">
        <FileCode className="size-3.5 text-zinc-600" />
        <p className="font-mono text-[10px] text-zinc-600">{label}</p>
      </div>
      <p className="mt-4 font-mono text-sm text-zinc-100">{value}</p>
    </article>
  )
}
