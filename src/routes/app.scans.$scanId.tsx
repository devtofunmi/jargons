import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  FileCode,
  GitPullRequest,
  LoaderCircle,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { DetailPageSkeleton } from '../components/skeletons'
import { timeAgo } from '../lib/format'
import { getBilling } from '../server/billing'
import { getCodebaseScan, openScanFixPr } from '../server/scans'
import type { CodebaseScanDetail, CodebaseScanFinding } from '../server/scans'

export const Route = createFileRoute('/app/scans/$scanId')({
  component: ScanDetailPage,
  pendingComponent: DetailPageSkeleton,
  loader: async ({ params }) => {
    const [scan, billing] = await Promise.all([
      getCodebaseScan({ data: { scanId: params.scanId } }),
      getBilling(),
    ])

    if (!scan) {
      throw notFound()
    }

    return { scan, canRun: billing?.canRun ?? false }
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
  const { scan, canRun } = Route.useLoaderData()

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
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <ScanStatusBadge status={scan.status} />
          {scan.status === 'complete' && scan.findingsCount > 0 ? (
            <FixPrButton scanId={scan.id} canRun={canRun} />
          ) : null}
        </div>
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

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {scan.findings.length > 0 ? (
            scan.findings.map((finding, index) => (
              <div
                key={`${finding.filePath}-${finding.lineNumber ?? 'x'}-${index}`}
                className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {finding.title}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase ${severityStyles[finding.severity]}`}
                  >
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
                  <FileCode className="size-3" />
                  {finding.filePath}
                  {finding.lineNumber ? `:${finding.lineNumber}` : ''}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {finding.description}
                </p>
                {finding.suggestion ? (
                  <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-300">
                      suggested fix
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {finding.suggestion}
                    </p>
                  </div>
                ) : null}
              </div>
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
      </article>
    </section>
  )
}

function FixPrButton({ scanId, canRun }: { scanId: string; canRun: boolean }) {
  const [state, setState] = useState<'idle' | 'opening' | 'done' | 'error'>(
    'idle',
  )
  const [url, setUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Free tier used up: send the user to the pricing page instead of opening a
  // fix PR.
  function goToPricing() {
    window.location.assign('/pricing')
  }

  async function open() {
    if (!canRun) {
      goToPricing()
      return
    }

    setState('opening')
    setMessage(null)

    try {
      const result = await openScanFixPr({ data: { scanId } })

      if (result.reason === 'upgrade_required') {
        goToPricing()
        return
      }

      if (result.url) {
        setUrl(result.url)
        setState('done')
      } else {
        setMessage(result.reason ?? 'Could not open a fix PR.')
        setState('error')
      }
    } catch {
      setMessage('Something went wrong opening the fix PR.')
      setState('error')
    }
  }

  if (state === 'done' && url) {
    return (
      <a className="button-primary" href={url} target="_blank" rel="noreferrer">
        View fix PR
        <ExternalLink className="size-4" />
      </a>
    )
  }

  const busy = state === 'opening'

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={() => {
          void open()
        }}
      >
        {state === 'opening' ? (
          <>
            Opening fix PR...
            <LoaderCircle className="size-4 animate-spin" />
          </>
        ) : canRun ? (
          <>
            Open fix PR with Jargons
            <GitPullRequest className="size-4" />
          </>
        ) : (
          <>
            Upgrade to open fix PR
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
      {state === 'error' && message ? (
        <p className="max-w-xs text-right font-mono text-[10px] text-red-300">
          {message}
        </p>
      ) : null}
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
