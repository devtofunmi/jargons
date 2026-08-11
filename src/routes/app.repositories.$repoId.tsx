import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitPullRequest,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Radar,
  ScanSearch,
} from 'lucide-react'
import { useState } from 'react'

import { DetailPageSkeleton } from '../components/skeletons'
import { ScanModal } from '../components/scan-modal'
import { getSyncedRepository, setRepositoryWatching } from '../server/github-app'
import { getRepositoryReviewRuns } from '../server/reviews'
import { getWorkspaceSettings } from '../server/workspace'

const DEFAULT_PREFERENCES = {
  reviewPullRequests: true,
  reviewSecurity: true,
  reviewCodebaseScans: true,
}

export const Route = createFileRoute('/app/repositories/$repoId')({
  component: RepositoryDetailPage,
  pendingComponent: DetailPageSkeleton,
  loader: async ({ params }) => {
    const repository = await getSyncedRepository({
      data: { repoId: params.repoId },
    })

    if (!repository) {
      throw notFound()
    }

    const [reviews, settings] = await Promise.all([
      getRepositoryReviewRuns({ data: { repositoryId: repository.id } }),
      getWorkspaceSettings(),
    ])

    return {
      repository,
      reviews,
      preferences: settings?.preferences ?? DEFAULT_PREFERENCES,
    }
  },
})

function RepositoryDetailPage() {
  const {
    repository,
    reviews: repoReviews,
    preferences,
  } = Route.useLoaderData()
  const router = useRouter()
  const [scanOpen, setScanOpen] = useState(false)
  const [pausing, setPausing] = useState(false)

  const isPaused = repository.status === 'paused'
  const repoForScan = { id: repository.id, fullName: repository.fullName }

  async function toggleWatching() {
    setPausing(true)
    try {
      await setRepositoryWatching({
        data: { repositoryId: repository.id, watching: isPaused },
      })
      await router.invalidate()
    } finally {
      setPausing(false)
    }
  }

  const reviewRules = [
    {
      title: 'Pull request reviews',
      description: 'Runs automatically on opened and updated pull requests.',
      active: preferences.reviewPullRequests,
    },
    {
      title: 'Security findings',
      description: 'Flags vulnerabilities, auth gaps, and exposed secrets.',
      active: preferences.reviewSecurity,
    },
    {
      title: 'Codebase scans',
      description: 'Scans the whole repository for bugs and structural risks.',
      active: preferences.reviewCodebaseScans,
    },
  ]

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-200"
        to="/app/repositories"
      >
        <ArrowLeft className="size-4" />
        repositories
      </Link>

      <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            repository
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            {repository.fullName}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Review coverage, pull request activity, scan health, and repository
            configuration.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="button-primary"
            onClick={() => setScanOpen(true)}
          >
            <ScanSearch className="size-4" />
            Run a scan
          </button>
          <button
            type="button"
            className="button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pausing}
            onClick={() => {
              void toggleWatching()
            }}
          >
            {pausing ? (
              <>
                Saving...
                <LoaderCircle className="size-4 animate-spin" />
              </>
            ) : isPaused ? (
              <>
                <Play className="size-4" />
                Resume watching
              </>
            ) : (
              <>
                <Pause className="size-4" />
                Pause watching
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <RepoMetric label="status" value={repository.status} />
        <RepoMetric label="default branch" value={repository.defaultBranch} />
        <RepoMetric label="review coverage" value={repository.coverage} />
        <RepoMetric label="scan status" value={repository.scanStatus} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ScanSearch className="size-4 text-cyan-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">
              Codebase scan
            </h2>
          </div>
          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#09090b] p-5">
            <p className="font-mono text-[10px] text-zinc-600">last scan</p>
            <p className="mt-3 text-2xl font-medium tracking-[-0.04em] text-zinc-100">
              {repository.lastScan}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ScanStat label="findings" value={repository.findings} />
              <ScanStat
                label="critical"
                value={repository.findingsBySeverity.critical}
              />
              <ScanStat
                label="high"
                value={repository.findingsBySeverity.high}
              />
              <ScanStat
                label="medium"
                value={repository.findingsBySeverity.medium}
              />
            </div>
          </div>
        </article>

        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-4 text-amber-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">
              Recent reviews
            </h2>
          </div>

          <div className="mt-6 space-y-3">
            {repoReviews.length > 0 ? (
              repoReviews.map((review) => (
                <Link
                  key={review.id}
                  to="/app/reviews/$reviewId"
                  params={{ reviewId: review.id }}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#09090b] p-4 transition-colors hover:bg-white/[0.025]"
                >
                  <span className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-amber-300">
                    <GitPullRequest className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-200">
                      {review.title}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] text-zinc-600">
                      #{review.prNumber} · {review.findingsCount} findings
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-zinc-600" />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 text-sm leading-6 text-zinc-600">
                No pull request reviews yet. Jargons will start reviewing once a
                new pull request opens.
              </div>
            )}
          </div>
        </article>
      </div>

      <article className="app-card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-emerald-300" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">
            Review configuration
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {reviewRules.map((rule) => (
            <div
              key={rule.title}
              className={`rounded-2xl border border-white/[0.07] bg-[#09090b] p-4 ${
                rule.active ? '' : 'opacity-50'
              }`}
            >
              {rule.active ? (
                <Check className="size-4 text-emerald-300" />
              ) : (
                <Minus className="size-4 text-zinc-600" />
              )}
              <p className="mt-4 text-sm font-semibold text-zinc-200">
                {rule.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {rule.description}
              </p>
              <p
                className={`mt-3 font-mono text-[9px] uppercase tracking-[0.12em] ${
                  rule.active ? 'text-emerald-300' : 'text-zinc-600'
                }`}
              >
                {rule.active ? 'active' : 'disabled'}
              </p>
            </div>
          ))}
        </div>
      </article>

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        repos={[repoForScan]}
        initialRepo={repoForScan}
      />
    </section>
  )
}

function RepoMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <p className="font-mono text-[10px] text-zinc-600">{label}</p>
      <p className="mt-4 font-mono text-sm text-zinc-100">{value}</p>
    </article>
  )
}

function ScanStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="font-mono text-[9px] text-zinc-700">{label}</p>
      <p className="mt-2 font-mono text-sm text-zinc-200">{value}</p>
    </div>
  )
}
