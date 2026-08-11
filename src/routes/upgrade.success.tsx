import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { OwlMark } from '../components/owl-mark'

// Public confirmation page users land on after a successful Bachs checkout.
// Deliberately requires no auth so the return redirect always lands cleanly.
export const Route = createFileRoute('/upgrade/success')({
  component: UpgradeSuccessPage,
})

function UpgradeSuccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#080809] px-5 text-white">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/10 bg-[#111113]">
          <OwlMark className="size-9" />
        </span>

        <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
          <CheckCircle2 className="size-3.5" />
          payment complete
        </span>

        <h1 className="mt-6 text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
          You&rsquo;re on Jargons Pro.
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-500">
          Unlimited pull request reviews and codebase scans are now unlocked for
          your workspace. Thanks for upgrading.
        </p>

        <a
          href="/app"
          className="button-primary mt-8 inline-flex justify-center"
        >
          Open dashboard
          <ArrowRight className="size-4" />
        </a>

        <p className="mt-6 text-[11px] leading-5 text-zinc-700">
          It can take a few seconds for your plan to update. If you still see
          the free banner, refresh the dashboard.
        </p>
      </div>
    </main>
  )
}
