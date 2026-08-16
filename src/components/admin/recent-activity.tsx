import { BadgeCheck, ScanSearch } from 'lucide-react'

import { timeAgo } from '../../lib/format'
import type { AdminOverview } from '../../server/admin'

// The latest reviews and scans across all workspaces.
export function AdminRecentActivity({
  recent,
}: {
  recent: AdminOverview['recent']
}) {
  return (
    <article className="app-card mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-medium tracking-[-0.03em]">
        Recent activity
      </h2>
      {recent.length === 0 ? (
        <p className="mt-6 font-mono text-xs text-zinc-600">No activity yet.</p>
      ) : (
        <div className="custom-scrollbar mt-5 max-h-[560px] overflow-y-auto pr-1">
          <ul className="divide-y divide-white/[0.04]">
            {recent.map((item, index) => (
              <li
                key={`${item.type}-${item.at}-${index}`}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                    item.type === 'review'
                      ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-300'
                      : 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-300'
                  }`}
                >
                  {item.type === 'review' ? (
                    <BadgeCheck className="size-4" />
                  ) : (
                    <ScanSearch className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {item.repository}
                  </p>
                  <p className="truncate font-mono text-[10px] text-zinc-600">
                    {item.workspace} · {item.type} · {item.status}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                  {timeAgo(item.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
