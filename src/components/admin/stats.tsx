import {
  BadgeCheck,
  DollarSign,
  FileWarning,
  Globe,
  LayoutDashboard,
  ScanSearch,
  Users as UsersIcon,
} from 'lucide-react'

import type { AdminOverview } from '../../server/admin'

// Platform-wide overview tiles: users, workspaces (pro/free), MRR, agent
// activity, and landing views.
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
  ]

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
      {cards.map(({ label, value, sub, icon: Icon }) => (
        <article key={label} className="app-card p-4">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5 text-zinc-600" />
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
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
