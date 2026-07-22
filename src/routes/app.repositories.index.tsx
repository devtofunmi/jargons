import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Search,
  Settings2,
} from 'lucide-react'
import { useState } from 'react'

import { GitHubAppInstallButton } from '../components/github-app-install-button'
import { ListPageSkeleton } from '../components/skeletons'
import { getSyncedRepositories } from '../server/github-app'
import type { SyncedRepository } from '../server/github-app'

export const Route = createFileRoute('/app/repositories/')({
  loader: () => getSyncedRepositories(),
  pendingComponent: ListPageSkeleton,
  component: RepositoriesPage,
})

const PAGE_SIZE = 10

function RepositoriesPage() {
  const repositories = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredRepositories = normalizedQuery
    ? repositories.filter((repo) =>
        `${repo.fullName} ${repo.language} ${repo.status}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : repositories
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRepositories.length / PAGE_SIZE),
  )
  const currentPage = Math.min(page, totalPages)
  const pagedRepositories = filteredRepositories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            repositories
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
            Choose what Jargons should watch.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Select repositories for pull request monitoring, review comments,
            vulnerability checks, and recurring codebase scans.
          </p>
        </div>
        <GitHubAppInstallButton
          className="button-primary self-start"
          label={
            repositories.length > 0 ? 'Manage GitHub app' : 'Install GitHub app'
          }
        />
      </div>

      {repositories.length > 0 ? (
        <label className="mt-10 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#09090b] px-4 py-3 transition-colors focus-within:border-amber-300/40 lg:max-w-md">
          <Search className="size-4 shrink-0 text-zinc-600" />
          <input
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            placeholder="Search repositories by name, language, or status..."
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
      ) : null}

      {repositories.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {pagedRepositories.map((repo) => (
            <Link
              key={repo.githubRepoId}
              to="/app/repositories/$repoId"
              params={{ repoId: repo.slug }}
              className="app-card grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center sm:p-6"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-mono text-base text-zinc-100">
                    {repo.fullName}
                  </h2>
                  <StatusPill status={repo.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <RepoStat label="language" value={repo.language} />
                  <RepoStat label="open PRs" value={repo.pullRequests} />
                  <RepoStat label="findings" value={repo.findings} />
                  <RepoStat label="last scan" value={repo.lastScan} />
                </div>
              </div>
              <span className="button-secondary justify-center">
                Open repository
                <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
          {filteredRepositories.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm leading-6 text-zinc-500">
              No repositories match &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] text-zinc-600">
                page {currentPage} of {totalPages} ·{' '}
                {filteredRepositories.length} repositories
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="button-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </button>
                <button
                  className="button-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
            no repositories yet
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-zinc-100">
            Install the GitHub app to sync repositories.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            Once GitHub returns the installation id, Jargons will fetch the
            selected repositories and save them to this workspace.
          </p>
          <GitHubAppInstallButton
            className="button-primary mx-auto mt-6 justify-center"
            label="Connect repositories"
          />
        </div>
      )}
    </section>
  )
}

function StatusPill({ status }: { status: SyncedRepository['status'] }) {
  const isWatching = status === 'watching'
  const isPaused = status === 'paused'

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] text-zinc-400">
      {isWatching ? (
        <Check className="size-3 text-emerald-300" />
      ) : isPaused ? (
        <CirclePause className="size-3 text-zinc-500" />
      ) : (
        <Settings2 className="size-3 text-amber-300" />
      )}
      {status}
    </span>
  )
}

function RepoStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[9px] text-zinc-700">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{value}</p>
    </div>
  )
}
