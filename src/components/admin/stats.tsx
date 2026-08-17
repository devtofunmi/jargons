import {
  BadgeCheck,
  Coins,
  DollarSign,
  FileWarning,
  Globe,
  LayoutDashboard,
  Receipt,
  ScanSearch,
  Users as UsersIcon,
} from 'lucide-react'

import type { AdminOverview } from '../../server/admin'

// Small LLM costs need more precision than currency formatting gives: a run
// lands around a fraction of a cent, so $0.00 would read as free.
function usd(value: number) {
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toFixed(4)}`
  if (value < 1) return `$${value.toFixed(3)}`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function compactTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

// Platform-wide overview tiles: users, workspaces (pro/free), MRR, agent
// activity, landing views, and operator-only LLM spend.
export function AdminStats({ totals }: { totals: AdminOverview['totals'] }) {
  const cards = [
    { label: 'users', value: String(totals.users), icon: UsersIcon },
    {
      label: 'workspaces',
      value: String(totals.workspaces),
      sub: `${totals.pro} pro · ${totals.free} free`,
      icon: LayoutDashboard,
    },
    {
      label: 'MRR',
      value: `$${totals.mrrUsd.toLocaleString()}`,
      sub: `${totals.pro} × $15`,
      icon: DollarSign,
    },
    { label: 'reviews', value: String(totals.reviews), icon: BadgeCheck },
    { label: 'scans', value: String(totals.scans), icon: ScanSearch },
    { label: 'findings', value: String(totals.findings), icon: FileWarning },
    {
      label: 'landing views',
      value: totals.landingViews.toLocaleString(),
      icon: Globe,
    },
    {
      label: 'llm tokens',
      value: compactTokens(totals.llmTokens),
      sub: 'input + output',
      icon: Coins,
    },
    {
      label: 'llm spend',
      value: usd(totals.llmCostUsd),
      sub: 'estimated, all runs',
      icon: Receipt,
    },
    {
      label: 'cost / run',
      value: totals.costPerRunUsd === null ? '—' : usd(totals.costPerRunUsd),
      // The number this is meant to be read against: a Pro run earns ~$0.20.
      sub: 'vs ~$0.20 earned',
      icon: DollarSign,
    },
  ]

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, sub, icon: Icon }) => (
        <article key={label} className="app-card p-4">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5 text-zinc-600" />
            <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
              {label}
            </p>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {value}
          </p>
          {sub ? (
            <p className="mt-1 font-mono text-[10px] text-zinc-600">{sub}</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}
