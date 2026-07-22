import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  CheckCircle2,
  Coins,
  Cpu,
  GitPullRequest,
  Radar,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AppPageSkeleton } from '../components/skeletons'
import { getAgentHealth } from '../server/agent-health'
import type { AgentHealth } from '../server/agent-health'

// Validated categorical pair (dataviz validator, dark mode: all six checks pass —
// lightness band, chroma, CVD ΔE 23, contrast). Legend provides secondary encoding.
const REVIEW_COLOR = '#d97706' // amber-600 — reviews
const SCAN_COLOR = '#0284c7' // sky-600 — scans

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

function ThroughputChart({ data }: { data: AgentHealth['throughput'] }) {
  const hasActivity = data.some((point) => point.reviews + point.scans > 0)

  return (
    <article className="app-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-cyan-300" />
        <h2 className="text-lg font-medium tracking-[-0.03em]">
          Agent throughput (24h)
        </h2>
      </div>

      {hasActivity ? (
        <div className="mt-6 h-64">
          <ThroughputBars data={data} />
        </div>
      ) : (
        <p className="mt-6 font-mono text-xs text-zinc-600">
          No agent runs in the last 24 hours. Open a pull request or start a
          scan to see live throughput.
        </p>
      )}
    </article>
  )
}

type ChartRow = { label: string; reviews: number; scans: number }

function ThroughputBars({ data }: { data: AgentHealth['throughput'] }) {
  // Recharts needs the DOM to size the ResponsiveContainer, so render it only
  // after mount to avoid an SSR/hydration size mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="size-full" />
  }

  const rows: ChartRow[] = data.map((point) => ({
    label: new Date(point.timestamp).toLocaleTimeString([], {
      hour: 'numeric',
    }),
    reviews: point.reviews,
    scans: point.scans,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={rows}
        margin={{ top: 12, right: 14, bottom: 0, left: -14 }}
      >
        <defs>
          <linearGradient id="grad-reviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={REVIEW_COLOR} stopOpacity={0.4} />
            <stop offset="95%" stopColor={REVIEW_COLOR} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="grad-scans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SCAN_COLOR} stopOpacity={0.4} />
            <stop offset="95%" stopColor={SCAN_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          minTickGap={44}
          dy={8}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
          content={<ThroughputTooltip />}
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#a1a1aa',
            paddingTop: 14,
          }}
        />
        <Area
          type="monotone"
          dataKey="reviews"
          name="reviews"
          stackId="1"
          stroke={REVIEW_COLOR}
          strokeWidth={2}
          fill="url(#grad-reviews)"
          dot={false}
          activeDot={{
            r: 4,
            strokeWidth: 2,
            stroke: REVIEW_COLOR,
            fill: '#0d0d10',
          }}
        />
        <Area
          type="monotone"
          dataKey="scans"
          name="scans"
          stackId="1"
          stroke={SCAN_COLOR}
          strokeWidth={2}
          fill="url(#grad-scans)"
          dot={false}
          activeDot={{
            r: 4,
            strokeWidth: 2,
            stroke: SCAN_COLOR,
            fill: '#0d0d10',
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ThroughputTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value?: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) {
    return null
  }
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#0c0c0f] p-3 shadow-2xl shadow-black/60">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="mt-1.5 flex items-center gap-2 font-mono text-xs text-zinc-300"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value} {entry.name}
        </p>
      ))}
      <p className="mt-2 border-t border-white/[0.07] pt-2 font-mono text-[10px] text-zinc-500">
        {total} total runs
      </p>
    </div>
  )
}
