import { Globe } from 'lucide-react'

import { countryFlag } from '../../lib/country'
import type { AdminOverview } from '../../server/admin'

// Top landing-page visitor countries, as share-of-total bars.
export function AdminCountries({
  countries,
  total,
}: {
  countries: AdminOverview['countries']
  total: number
}) {
  const max = Math.max(1, ...countries.map((entry) => entry.count))

  return (
    <article className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-cyan-300" />
        <h2 className="text-lg font-medium tracking-[-0.03em]">
          Top countries
        </h2>
      </div>
      {countries.length === 0 ? (
        <p className="mt-6 font-mono text-xs text-zinc-600">No views yet.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {countries.map((entry) => (
            <li key={entry.country} className="flex items-center gap-3">
              <span className="w-7 text-center text-base leading-none">
                {countryFlag(entry.country)}
              </span>
              <span className="w-8 font-mono text-[11px] uppercase text-zinc-400">
                {entry.country}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-cyan-400/60"
                  style={{ width: `${(entry.count / max) * 100}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono text-xs text-zinc-300">
                {entry.count}
              </span>
              <span className="w-12 text-right font-mono text-[10px] text-zinc-600">
                {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
