import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  LoaderCircle,
  Radar,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { ListPageSkeleton } from '../components/skeletons'
import { SearchableSelect } from '../components/searchable-select'
import { padCount, timeAgo } from '../lib/format'
import { getSyncedRepositories } from '../server/github-app'
import { getCodebaseScans } from '../server/scans'
import type { CodebaseScanItem } from '../server/scans'

export const Route = createFileRoute('/app/scans/')({
  loader: async () => {
    const [scans, repositories] = await Promise.all([
      getCodebaseScans(),
      getSyncedRepositories(),
    ])
    return { scans, repositories }
  },
  pendingComponent: ListPageSkeleton,
  component: ScansPage,
})

function ScansPage() {
  const { scans, repositories } = Route.useLoaderData()
  const router = useRouter()
  const [selectedRepo, setSelectedRepo] = useState('')
  const [starting, setStarting] = useState(false)

  const hasActiveScan = scans.some(
    (scan) => scan.status === 'queued' || scan.status === 'running',
  )

  // Auto-refresh while a scan is queued/running so completion shows up live.
  useEffect(() => {
    if (!hasActiveScan) return
    const id = setInterval(() => {
      void router.invalidate()
    }, 5000)
    return () => clearInterval(id)
  }, [hasActiveScan, router])

  async function startScan() {
    const repositoryId = selectedRepo || repositories[0]?.id
    if (!repositoryId) return
    setStarting(true)
    try {
      await fetch('/api/scans/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryId }),
      })
      await router.invalidate()
    } finally {
      setStarting(false)
    }
  }

  const countByStatus = (status: CodebaseScanItem['status']) =>
    scans.filter((scan) => scan.status === status).length

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            codebase scans
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            Find risks beyond the pull request.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Scan connected repositories for bugs, vulnerabilities, dependency
            risks, and structural issues.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchableSelect
            options={repositories.map((repo) => ({
              value: repo.id,
              label: repo.fullName,
            }))}
            value={selectedRepo || repositories[0]?.id || ''}
            onChange={setSelectedRepo}
            placeholder="Select a repository"
            searchPlaceholder="Search repositories..."
            emptyLabel="No repositories connected"
            disabled={repositories.length === 0 || starting || hasActiveScan}
          />
          <button
            className="button-primary shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
            disabled={repositories.length === 0 || starting || hasActiveScan}
            onClick={() => {
              void startScan()
            }}
          >
            {starting ? (
              <>
                Starting...
                <LoaderCircle className="size-4 animate-spin" />
              </>
            ) : hasActiveScan ? (
              <>
                Scanning...
                <LoaderCircle className="size-4 animate-spin" />
              </>
            ) : (
              <>
                <ScanSearch className="size-4" />
                Start new scan
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ScanMetric
          icon={<ScanSearch className="size-4" />}
          label="total scans"
          value={padCount(scans.length)}
        />
        <ScanMetric
          icon={<Check className="size-4" />}
          label="complete"
          value={padCount(countByStatus('complete'))}
        />
        <ScanMetric
          icon={<Clock3 className="size-4" />}
          label="running"
          value={padCount(countByStatus('running') + countByStatus('queued'))}
        />
        <ScanMetric
          icon={<AlertTriangle className="size-4" />}
          label="failed"
          value={padCount(countByStatus('failed'))}
        />
      </div>

      <article className="app-card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-cyan-300" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">Scan runs</h2>
        </div>

        <div className="mt-6 space-y-3">
          {scans.length > 0 ? (
            scans.map((scan) => (
              <Link
                key={scan.id}
                to="/app/scans/$scanId"
                params={{ scanId: scan.id }}
                className="block rounded-2xl border border-white/[0.07] bg-[#09090b] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.025]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-zinc-200">
                      {scan.repository}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">
                      {scan.scannedFiles} files ·{' '}
                      {scan.status === 'complete'
                        ? `${scan.findingsCount} findings · finished ${timeAgo(scan.completedAt)}`
                        : scan.startedAt
                          ? `started ${timeAgo(scan.startedAt)}`
                          : 'queued'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {scan.status === 'complete' && scan.findingsCount > 0 ? (
                      <SeverityBadges counts={scan.counts} />
                    ) : null}
                    <ScanStatus status={scan.status} />
                    <span className="grid size-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500">
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#09090b] p-8 text-center">
              <Sparkles className="mx-auto size-6 text-amber-300" />
              <h3 className="mt-4 text-lg font-medium tracking-[-0.03em] text-zinc-100">
                No scans yet
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                Pick a repository above and start a scan. Jargons walks the
                codebase for bugs, vulnerabilities, and structural issues, and
                the run will appear here.
              </p>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function ScanMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <article className="app-card p-5">
      <div className="text-amber-300">{icon}</div>
      <p className="mt-4 font-mono text-[10px] text-zinc-600">{label}</p>
      <p className="mt-3 font-mono text-3xl text-zinc-100">{value}</p>
    </article>
  )
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-300',
  low: 'text-sky-400',
  note: 'text-zinc-400',
}

function SeverityBadges({ counts }: { counts: CodebaseScanItem['counts'] }) {
  const shown = (['critical', 'high', 'medium', 'low', 'note'] as const).filter(
    (severity) => counts[severity] > 0,
  )

  return (
    <span className="hidden items-center gap-1.5 font-mono text-[9px] sm:flex">
      {shown.map((severity) => (
        <span
          key={severity}
          className={`inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 ${SEVERITY_STYLES[severity]}`}
          title={severity}
        >
          {counts[severity]} {severity}
        </span>
      ))}
    </span>
  )
}

function ScanStatus({ status }: { status: CodebaseScanItem['status'] }) {
  const Icon =
    status === 'complete' ? Check : status === 'failed' ? AlertTriangle : Clock3

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] text-zinc-400">
      <Icon className="size-3 text-amber-300" />
      {status}
    </span>
  )
}
