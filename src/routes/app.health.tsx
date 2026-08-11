import { createFileRoute } from '@tanstack/react-router'
import {
  CheckCircle2,
  Coins,
  Cpu,
  GitPullRequest,
  Radar,
  ShieldAlert,
  Timer,
} from 'lucide-react'

import { AppPageSkeleton } from '../components/skeletons'
import { ThroughputChart } from '../components/throughput-chart'
import { getAgentHealth } from '../server/agent-health'

export const Route = createFileRoute('/app/health')({
  loader: () => getAgentHealth(),
  pendingComponent: AppPageSkeleton,
  component: AgentHealthPage,
})

function AgentHealthPage() {
  const health = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            agent health
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            Observe the agent behind the reviews.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Health of the Jargons review &amp; scan agent over the last{' '}
            {health.windowHours} hours — throughput, latency, success rate, and
            findings, with live LLM token &amp; cost telemetry from SigNoz.
          </p>
        </div>
        <SigNozBadge available={health.signozAvailable} />
      </div>

      <>
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HealthStat
            icon={<CheckCircle2 className="size-4" />}
            label="success rate (24h)"
            value={
              health.successRatePct != null ? `${health.successRatePct}%` : '—'
            }
            tone={
              health.successRatePct == null
                ? 'default'
                : health.successRatePct >= 95
                  ? 'good'
                  : health.successRatePct >= 80
                    ? 'default'
                    : 'alert'
            }
          />
          <HealthStat
            icon={<Timer className="size-4" />}
            label="avg review latency"
            value={
              health.avgReviewLatencySeconds != null
                ? `${health.avgReviewLatencySeconds.toFixed(1)}s`
                : '—'
            }
          />
          <HealthStat
            icon={<Cpu className="size-4" />}
            label="llm tokens (24h)"
            value={
              health.signozAvailable ? health.llmTokens.toLocaleString() : '—'
            }
            sub={
              health.avgTokensPerRun != null
                ? `${health.avgTokensPerRun.toLocaleString()} / run`
                : undefined
            }
          />
          <HealthStat
            icon={<Coins className="size-4" />}
            label="llm cost (24h)"
            value={
              health.signozAvailable ? `$${health.llmCostUsd.toFixed(2)}` : '—'
            }
            sub={
              health.costPerRunUsd != null
                ? `$${health.costPerRunUsd.toFixed(4)} / run`
                : undefined
            }
          />
          <HealthStat
            icon={<GitPullRequest className="size-4" />}
            label="reviews (24h)"
            value={String(health.reviews)}
          />
          <HealthStat
            icon={<Timer className="size-4" />}
            label="avg scan latency"
            value={
              health.avgScanLatencySeconds != null
                ? `${health.avgScanLatencySeconds.toFixed(1)}s`
                : '—'
            }
          />
          <HealthStat
            icon={<Radar className="size-4" />}
            label="findings (24h)"
            value={String(health.findings)}
          />
          <HealthStat
            icon={<ShieldAlert className="size-4" />}
            label="failures (24h)"
            value={String(health.failures)}
            tone={health.failures > 0 ? 'alert' : 'default'}
          />
        </div>

        <ThroughputChart data={health.throughput} />
      </>
    </section>
  )
}

function SigNozBadge({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-3 font-mono text-xs ${
        available
          ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300'
          : 'border-white/[0.1] bg-white/[0.04] text-zinc-500'
      }`}
    >
      <span
        className={`size-2 rounded-full ${
          available ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'
        }`}
      />
      {available ? 'Live from SigNoz' : 'SigNoz offline'}
    </span>
  )
}

function HealthStat({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'alert' | 'good'
}) {
  const iconColor =
    tone === 'alert'
      ? 'text-red-400'
      : tone === 'good'
        ? 'text-emerald-300'
        : 'text-amber-300'
  const valueColor =
    tone === 'alert'
      ? 'text-red-300'
      : tone === 'good'
        ? 'text-emerald-300'
        : 'text-zinc-100'

  return (
    <article className="app-card p-5">
      <div className={iconColor}>{icon}</div>
      <p className="mt-4 font-mono text-[10px] text-zinc-600">{label}</p>
      <p className={`mt-3 font-mono text-3xl ${valueColor}`}>{value}</p>
      {sub ? (
        <p className="mt-1 font-mono text-[10px] text-zinc-600">{sub}</p>
      ) : null}
    </article>
  )
}
