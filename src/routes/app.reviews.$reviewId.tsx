import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Clock3,
  GitPullRequest,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { DetailPageSkeleton } from '../components/skeletons'
import { timeAgo } from '../lib/format'
import { getReviewRun } from '../server/reviews'
import type { ReviewFindingItem, ReviewRunDetail } from '../server/reviews'

export const Route = createFileRoute('/app/reviews/$reviewId')({
  component: ReviewDetailPage,
  pendingComponent: DetailPageSkeleton,
  loader: async ({ params }) => {
    const review = await getReviewRun({ data: { reviewId: params.reviewId } })

    if (!review) {
      throw notFound()
    }

    return review
  },
})

const severityStyles: Record<ReviewFindingItem['severity'], string> = {
  critical: 'border-red-300/25 bg-red-300/[0.08] text-red-200',
  high: 'border-red-300/20 bg-red-300/[0.06] text-red-300',
  medium: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-300',
  low: 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-300',
  note: 'border-white/[0.1] bg-white/[0.04] text-zinc-400',
}

function ReviewDetailPage() {
  const review = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-200"
        to="/app/reviews"
      >
        <ArrowLeft className="size-4" />
        reviews
      </Link>

      <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            pull request review
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
            {review.title}
          </h1>
          <p className="mt-4 font-mono text-xs text-zinc-600">
            {review.repository} · {review.branch} · opened by {review.author}
          </p>
        </div>
        <ReviewStatusBadge status={review.status} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReviewStat label="pull request" value={`#${review.prNumber}`} />
        <ReviewStat label="files changed" value={String(review.filesChanged)} />
        <ReviewStat label="findings" value={String(review.findingsCount)} />
        <ReviewStat label="started" value={timeAgo(review.createdAt)} />
      </div>

      <article className="app-card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-red-300" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">Findings</h2>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {review.findings.length > 0 ? (
            review.findings.map((finding) => (
              <div
                key={finding.id}
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
                <p className="mt-3 font-mono text-[10px] text-zinc-600">
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
                {review.status === 'complete'
                  ? 'No findings'
                  : 'Review in progress'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {review.status === 'complete'
                  ? 'Jargons did not find anything risky in this pull request.'
                  : 'Findings will appear here once the review finishes.'}
              </p>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function ReviewStatusBadge({ status }: { status: ReviewRunDetail['status'] }) {
  const isComplete = status === 'complete'
  const isFailed = status === 'failed'
  const Icon = isComplete ? Check : isFailed ? ShieldAlert : Clock3
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

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-center gap-2">
        <GitPullRequest className="size-3.5 text-zinc-600" />
        <p className="font-mono text-[10px] text-zinc-600">{label}</p>
      </div>
      <p className="mt-4 font-mono text-sm text-zinc-100">{value}</p>
    </article>
  )
}
