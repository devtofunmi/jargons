import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Globe } from 'lucide-react'

import type { AdminOverview } from '../../server/admin'
import { useMounted } from './use-mounted'

// Landing-page views per day over the last 30 days.
export function AdminViewsChart({
  data,
}: {
  data: AdminOverview['viewsByDay']
}) {
  const mounted = useMounted()
  const hasData = data.some((point) => point.count > 0)

  return (
    <article className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-cyan-300" />
        <h2 className="text-lg font-medium tracking-[-0.03em]">
          Landing views (30 days)
        </h2>
      </div>
      {!hasData ? (
        <p className="mt-6 font-mono text-xs text-zinc-600">No views yet.</p>
      ) : mounted ? (
        <div className="mt-6 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="grad-views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" hide />
              <YAxis
                allowDecimals={false}
                tick={{
                  fill: '#52525b',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
                contentStyle={{
                  background: '#0c0c0f',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="views"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#grad-views)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 h-48" />
      )}
    </article>
  )
}
