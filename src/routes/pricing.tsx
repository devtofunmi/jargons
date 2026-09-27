import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { OwlMark } from '../components/owl-mark'
import { FREE_RUN_LIMIT, PAID_PLAN_IDS, PAID_PLANS } from '../lib/plans'
import type { PaidPlan, Plan } from '../lib/plans'
import { getBilling } from '../server/billing'

export const Route = createFileRoute('/pricing')({
  loader: async () => {
    const billing = await getBilling()
    return {
      signedIn: billing !== null,
      plan: billing?.plan ?? 'free',
    }
  },
  component: PricingPage,
})

function PricingPage() {
  const { signedIn, plan } = Route.useLoaderData()
  const [busy, setBusy] = useState<PaidPlan | null>(null)
  const [error, setError] = useState<PaidPlan | null>(null)

  async function subscribe(target: PaidPlan) {
    if (!signedIn) {
      window.location.assign('/auth/sign-in')
      return
    }
    setBusy(target)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: target }),
      })
      if (res.status === 401) {
        window.location.assign('/auth/sign-in')
        return
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through to the error state
    }
    setBusy(null)
    setError(target)
  }

  return (
    <main className="min-h-screen bg-[#070708] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]">
            <OwlMark className="size-8" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.04em]">
            jargons
          </span>
        </Link>
        <Link className="nav-link" to={signedIn ? '/app' : '/auth/sign-in'}>
          {signedIn ? 'Dashboard' : 'Sign in'}
        </Link>
      </header>

      <section className="mx-auto max-w-6xl py-14 text-center sm:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
          pricing
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-medium leading-tight tracking-[-0.055em] sm:text-6xl">
          Simple pricing that scales with your reviews.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-500 sm:text-base">
          Every plan includes AI pull request reviews, codebase scans, and
          one-click fix PRs. From a single repo to a whole engineering org, pick
          the monthly runs you need.
        </p>

        <div className="mx-auto mt-14 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          <article className="flex flex-col rounded-[24px] border border-white/[0.08] bg-[#0c0c0f] p-6">
            <h2 className="text-lg font-medium tracking-[-0.03em]">Free</h2>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-semibold tracking-[-0.04em]">
                $0
              </span>
              <span className="pb-1 text-sm text-zinc-600">/month</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Try Jargons on a real pull request or scan.
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-zinc-400">
              <Feature>
                {FREE_RUN_LIMIT} agent run per month (review, scan, or fix PR)
              </Feature>
              <Feature>Automatic PR reviews with findings</Feature>
              <Feature>Codebase scans</Feature>
              <Feature>One-click fix PRs</Feature>
            </ul>
            {plan === 'free' && signedIn ? (
              <CurrentPlan />
            ) : (
              <Link
                className="button-secondary mt-7 w-full justify-center"
                to={signedIn ? '/app' : '/auth/sign-in'}
              >
                {signedIn ? 'Go to dashboard' : 'Get started'}
                <ArrowRight className="size-4" />
              </Link>
            )}
          </article>

          {PAID_PLAN_IDS.map((id) => (
            <PaidPlanCard
              key={id}
              id={id}
              currentPlan={plan}
              signedIn={signedIn}
              busy={busy === id}
              disabled={busy !== null}
              error={error === id}
              onSubscribe={() => {
                void subscribe(id)
              }}
            />
          ))}
        </div>

        <p className="mt-10 text-sm text-zinc-600">
          Runs reset at the start of each calendar month. Payments are handled
          securely by{' '}
          <a
            href="https://bachs.io/"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200"
          >
            Bachs
          </a>
          .
        </p>
      </section>
    </main>
  )
}

function PaidPlanCard({
  id,
  currentPlan,
  signedIn,
  busy,
  disabled,
  error,
  onSubscribe,
}: {
  id: PaidPlan
  currentPlan: Plan
  signedIn: boolean
  busy: boolean
  disabled: boolean
  error: boolean
  onSubscribe: () => void
}) {
  const details = PAID_PLANS[id]

  return (
    <article
      className={`relative flex flex-col rounded-[24px] border bg-[#0c0c0f] p-6 ${
        details.recommended
          ? 'border-amber-300/40 shadow-[0_0_60px_-20px_rgba(252,211,77,0.35)]'
          : 'border-white/[0.08]'
      }`}
    >
      {details.recommended ? (
        <span className="absolute right-6 top-6 rounded-full border border-amber-300/30 bg-amber-300/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
          Recommended
        </span>
      ) : null}
      <h2 className="text-lg font-medium tracking-[-0.03em]">{details.name}</h2>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-semibold tracking-[-0.04em]">
          ${details.priceUsd}
        </span>
        <span className="pb-1 text-sm text-zinc-600">/month</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{details.tagline}</p>
      <ul className="mt-6 flex-1 space-y-3 text-sm text-zinc-300">
        <Feature>
          <span className="font-semibold text-white">
            {details.runLimit} agent runs per month
          </span>
        </Feature>
        <Feature>Automatic PR reviews with findings</Feature>
        <Feature>Codebase scans across your repos</Feature>
        <Feature>One-click fix PRs</Feature>
        <Feature>Cancel anytime</Feature>
      </ul>

      {currentPlan === id ? (
        <CurrentPlan paid />
      ) : currentPlan !== 'free' ? (
        <span className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">
          You&apos;re on {PAID_PLANS[currentPlan].name}
        </span>
      ) : (
        <button
          type="button"
          className={`${
            details.recommended ? 'button-primary' : 'button-secondary'
          } mt-7 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={disabled}
          onClick={onSubscribe}
        >
          {busy ? (
            <>
              Redirecting...
              <LoaderCircle className="size-4 animate-spin" />
            </>
          ) : signedIn ? (
            <>
              Subscribe to {details.name}
              <ArrowRight className="size-4" />
            </>
          ) : (
            <>
              Sign in to subscribe
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      )}
      {error ? (
        <p className="mt-3 text-center text-sm text-red-400">
          Couldn&apos;t start checkout. Please try again.
        </p>
      ) : null}
    </article>
  )
}

function CurrentPlan({ paid = false }: { paid?: boolean }) {
  return paid ? (
    <span className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-300">
      <Check className="mr-2 size-4" />
      Your current plan
    </span>
  ) : (
    <span className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">
      Your current plan
    </span>
  )
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </li>
  )
}
