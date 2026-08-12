import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { OwlMark } from '../components/owl-mark'
import { FREE_RUN_LIMIT, PRO_PRICE_USD, PRO_RUN_LIMIT } from '../lib/plans'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function subscribe() {
    if (!signedIn) {
      window.location.assign('/auth/sign-in')
      return
    }
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
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
    setBusy(false)
    setError(true)
  }

  return (
    <main className="min-h-screen bg-[#070708] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
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

      <section className="mx-auto max-w-5xl py-14 text-center sm:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
          pricing
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-medium leading-tight tracking-[-0.055em] sm:text-6xl">
          Simple pricing that scales with your reviews.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-500 sm:text-base">
          Every plan includes AI pull request reviews, codebase scans, and
          one-click fix PRs. Upgrade when you need more monthly runs.
        </p>

        <div className="mx-auto mt-14 grid max-w-3xl gap-5 text-left sm:grid-cols-2">
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
              <span className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">
                Your current plan
              </span>
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

          <article className="relative flex flex-col rounded-[24px] border border-amber-300/30 bg-[#0c0c0f] p-6">
            <span className="absolute right-6 top-6 rounded-full border border-amber-300/30 bg-amber-300/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
              Pro
            </span>
            <h2 className="text-lg font-medium tracking-[-0.03em]">Pro</h2>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-semibold tracking-[-0.04em]">
                ${PRO_PRICE_USD}
              </span>
              <span className="pb-1 text-sm text-zinc-600">/month</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              For teams shipping pull requests every day.
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-zinc-300">
              <Feature>
                <span className="font-semibold text-white">
                  {PRO_RUN_LIMIT} agent runs per month
                </span>
              </Feature>
              <Feature>Automatic PR reviews with findings</Feature>
              <Feature>Codebase scans across your repos</Feature>
              <Feature>One-click fix PRs</Feature>
              <Feature>Cancel anytime</Feature>
            </ul>

            {plan === 'pro' ? (
              <span className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-300">
                <Check className="mr-2 size-4" />
                Your current plan
              </span>
            ) : (
              <button
                type="button"
                className="button-primary mt-7 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                onClick={() => {
                  void subscribe()
                }}
              >
                {busy ? (
                  <>
                    Redirecting...
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : signedIn ? (
                  <>
                    Subscribe to Pro
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
        </div>

        <p className="mt-10 text-sm text-zinc-600">
          Runs reset at the start of each calendar month. Payments are handled
          securely by Bachs.
        </p>
      </section>
    </main>
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
