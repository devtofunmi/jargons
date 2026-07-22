import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  GitPullRequest,
  Radar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { AppPageSkeleton } from '../components/skeletons'
import { padCount } from '../lib/format'
import { getDashboardData } from '../server/dashboard'

export const Route = createFileRoute('/app/')({
  loader: () => getDashboardData(),
  pendingComponent: AppPageSkeleton,
  component: Dashboard,
})

function Dashboard() {
  const { metrics, repositories, latestReview, priorityFindings } =
    Route.useLoaderData()
  const hasRepositories = metrics.repositories > 0

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            review workspace
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            Catch risky changes before they merge.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Repositories, pull request reviews, findings, and codebase scans in
            one place.
          </p>
        </div>
        {hasRepositories ? (
          <Link className="button-primary self-start" to="/app/repositories">
            View repositories
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <a className="button-primary self-start" href="/auth/connect">
            Connect repository
            <ArrowRight className="size-4" />
          </a>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="repositories watched"
          value={padCount(metrics.repositories)}
        />
        <MetricCard label="open reviews" value={padCount(metrics.openReviews)} />
        <MetricCard
          label="findings this week"
          value={padCount(metrics.findingsThisWeek)}
        />
        <MetricCard
          label="codebase scans"
          value={padCount(metrics.codebaseScans)}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="app-card overflow-hidden">
          <div className="border-b border-white/[0.07] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <GitPullRequest className="size-4 text-amber-300" />
              <h2 className="text-lg font-medium tracking-[-0.03em]">
                Latest review
              </h2>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            {latestReview ? (
              <>
                <p className="font-mono text-[10px] text-zinc-600">
                  {latestReview.repository} / {latestReview.branch}
                </p>
                <h3 className="mt-4 text-2xl font-medium tracking-[-0.04em]">
                  {latestReview.title}
                </h3>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MiniStat label="status" value={latestReview.status} />
                  <MiniStat
                    label="files changed"
                    value={latestReview.filesChanged}
                  />
                  <MiniStat
                    label="findings"
                    value={latestReview.findingsCount}
                  />
                </div>
                <Link
                  className="button-secondary mt-6"
                  to="/app/reviews/$reviewId"
                  params={{ reviewId: latestReview.id }}
                >
                  Open review
                </Link>
              </>
            ) : (
              <EmptyState
                title="No reviews yet"
                description={
                  hasRepositories
                    ? 'Jargons will review the next pull request opened in a connected repository.'
                    : 'Connect a repository and Jargons will review incoming pull requests automatically.'
                }
              />
            )}
          </div>
        </article>

        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radar className="size-4 text-cyan-300" />
              <h2 className="text-lg font-medium tracking-[-0.03em]">
                Connected repositories
              </h2>
            </div>
            {hasRepositories ? (
              <Link
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-zinc-200"
                to="/app/repositories"
              >
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
          <div className="mt-6 space-y-3">
            {repositories.length > 0 ? (
              repositories.map((repo) => (
                <Link
                  key={repo.githubRepoId}
                  to="/app/repositories/$repoId"
                  params={{ repoId: repo.githubRepoId }}
                  className="block rounded-2xl border border-white/[0.07] bg-[#09090b] p-4 transition-colors hover:bg-white/[0.025]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-xs text-zinc-300">
                      {repo.owner}/{repo.name}
                    </p>
                    <ArrowRight className="size-4 shrink-0 text-zinc-600" />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No repositories connected"
                description="Install the GitHub app to sync repositories into this workspace."
              />
            )}
          </div>
        </article>
      </div>

      <article className="app-card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-red-300" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">
            Priority findings
          </h2>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {priorityFindings.length > 0 ? (
            priorityFindings.map((finding) => (
              <Link
                key={finding.id}
                to="/app/reviews/$reviewId"
                params={{ reviewId: finding.reviewId }}
                className="group block rounded-2xl border border-white/[0.07] bg-[#09090b] p-4 transition-colors hover:bg-white/[0.025]"
              >
                <p className="font-mono text-[10px] text-zinc-600">
                  {finding.filePath}
                  {finding.lineNumber ? `:${finding.lineNumber}` : ''}
                </p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {finding.title}
                  </h3>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {finding.description}
                </p>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No critical or high findings"
              description="High-priority findings from pull request reviews will show up here."
            />
          )}
        </div>
      </article>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <p className="font-mono text-[10px] text-zinc-600">{label}</p>
      <p className="mt-5 font-mono text-3xl text-zinc-100">{value}</p>
    </article>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string | number
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-4">
      <p className="font-mono text-[9px] text-zinc-600">{label}</p>
      <p className="mt-2 font-mono text-sm text-zinc-200">{value}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#09090b] p-5">
      <Sparkles className="size-5 text-amber-300" />
      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  )
}
