import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  Clock3,
  GitPullRequest,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { ListPageSkeleton } from '../components/skeletons'
import { padCount, timeAgo } from '../lib/format'
import { getReviewRuns } from '../server/reviews'
import type { ReviewRunListItem } from '../server/reviews'

export const Route = createFileRoute('/app/reviews/')({
  loader: () => getReviewRuns(),
  pendingComponent: ListPageSkeleton,
  component: ReviewsPage,
})

function ReviewsPage() {
  const reviews = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredReviews = normalizedQuery
    ? reviews.filter((review) =>
        `${review.title} ${review.repository} ${review.branch} ${review.author} ${review.status}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : reviews
  const countByStatus = (status: ReviewRunListItem['status']) =>
    reviews.filter((review) => review.status === status).length

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            reviews
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            Pull request reviews across your workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Track running reviews, high-risk findings, and recent pull request
            feedback from one place.
          </p>
        </div>
        <label className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#09090b] px-4 py-3 transition-colors focus-within:border-amber-300/40 lg:w-80">
          <Search className="size-4 shrink-0 text-zinc-600" />
          <input
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            placeholder="Search reviews"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReviewMetric
          label="complete"
          value={padCount(countByStatus('complete'))}
        />
        <ReviewMetric
          label="running"
          value={padCount(countByStatus('running'))}
        />
        <ReviewMetric
          label="queued"
          value={padCount(countByStatus('queued'))}
        />
      </div>

      {reviews.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-white/[0.1] bg-[#0d0d10] p-8 text-center">
          <Sparkles className="mx-auto size-6 text-amber-300" />
          <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] text-zinc-100">
            No reviews yet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            Jargons reviews pull requests opened in your connected repositories.
            Open a pull request and the review will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0d0d10]">
          {filteredReviews.map((review) => (
            <Link
              key={review.id}
              to="/app/reviews/$reviewId"
              params={{ reviewId: review.id }}
              className="grid gap-5 border-b border-white/[0.07] p-5 transition-colors last:border-b-0 hover:bg-white/[0.025] lg:grid-cols-[1fr_auto] lg:items-center sm:p-6"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={review.status} />
                  <span className="font-mono text-[10px] text-zinc-600">
                    {review.repository} · pull request #{review.prNumber}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-medium tracking-[-0.035em] text-zinc-100">
                  {review.title}
                </h2>
                <div className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] text-zinc-600">
                  <span>{review.filesChanged} files changed</span>
                  <span>{review.findingsCount} findings</span>
                  <span>started {timeAgo(review.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <SeveritySummary count={review.findingsCount} />
                <span className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-zinc-400">
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
          {filteredReviews.length === 0 ? (
            <div className="p-8 text-center text-sm leading-6 text-zinc-500">
              No reviews match &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <p className="font-mono text-[10px] text-zinc-600">{label}</p>
      <p className="mt-4 font-mono text-3xl text-zinc-100">{value}</p>
    </article>
  )
}

function StatusPill({ status }: { status: ReviewRunListItem['status'] }) {
  const Icon =
    status === 'complete'
      ? Check
      : status === 'running'
        ? GitPullRequest
        : status === 'failed'
          ? ShieldAlert
          : Clock3

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] text-zinc-400">
      <Icon className="size-3 text-amber-300" />
      {status}
    </span>
  )
}

function SeveritySummary({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-red-300/15 bg-red-300/[0.035] px-3 py-2 font-mono text-[10px] text-red-300">
      <ShieldAlert className="size-3.5" />
      {count} findings
    </span>
  )
}
