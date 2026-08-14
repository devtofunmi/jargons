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

import type { AdminOverview } from '../../server/admin'
import { useMounted } from './use-mounted'

const SIGNUP_COLOR = '#34d399' // emerald — signups
const REVIEW_COLOR = '#d97706' // amber — reviews
const SCAN_COLOR = '#0284c7' // sky — scans

// Monthly signups / reviews / scans over the last 12 months.
export function AdminTrendsChart({ data }: { data: AdminOverview['trends'] }) {
  const mounted = useMounted()
  const hasData = data.some(
    (point) => point.signups + point.reviews + point.scans > 0,
  )

  return (
    <article className="app-card mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-medium tracking-[-0.03em]">
        Growth &amp; activity (12 months)
      </h2>
      {!hasData ? (
        <p className="mt-6 font-mono text-xs text-zinc-600">
          No activity recorded yet.
        </p>
      ) : mounted ? (
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 14, bottom: 0, left: -14 }}
            >
              <defs>
                {[
                  ['grad-signups', SIGNUP_COLOR],
                  ['grad-reviews2', REVIEW_COLOR],
                  ['grad-scans2', SCAN_COLOR],
                ].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tick={{
                  fill: '#71717a',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                dy={8}
              />
              <YAxis
                allowDecimals={false}
                tick={{
                  fill: '#52525b',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
                tickLine={false}
                axisLine={false}
                width={40}
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
                dataKey="signups"
                name="signups"
                stroke={SIGNUP_COLOR}
                strokeWidth={2}
                fill="url(#grad-signups)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="reviews"
                name="reviews"
                stroke={REVIEW_COLOR}
                strokeWidth={2}
                fill="url(#grad-reviews2)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="scans"
                name="scans"
                stroke={SCAN_COLOR}
                strokeWidth={2}
                fill="url(#grad-scans2)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 h-64" />
      )}
    </article>
  )
}
