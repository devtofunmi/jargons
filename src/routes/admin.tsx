import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Activity, ArrowLeft, LayoutDashboard, Users } from 'lucide-react'
import { useState } from 'react'

import { AdminCountries } from '../components/admin/countries'
import { AdminRecentActivity } from '../components/admin/recent-activity'
import { AdminStats } from '../components/admin/stats'
import { AdminTrendsChart } from '../components/admin/trends-chart'
import { AdminUsersTable } from '../components/admin/users-table'
import { AdminViewsChart } from '../components/admin/views-chart'
import {
  getAdminContext,
  getAdminOverview,
  getAdminUsers,
} from '../server/admin'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
  beforeLoad: async () => {
    const ctx = await getAdminContext()
    if (!ctx) {
      throw redirect({ to: '/app' })
    }
    return { admin: ctx }
  },
  loader: async () => {
    const [overview, users] = await Promise.all([
      getAdminOverview(),
      getAdminUsers(),
    ])
    return { overview, users }
  },
  component: AdminPage,
})

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activity', icon: Activity },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function AdminPage() {
  const { overview, users } = Route.useLoaderData()
  const [section, setSection] = useState<SectionId>('overview')

  return (
    <div className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-white/[0.06] px-5 py-6 sm:px-6 lg:sticky lg:top-0 lg:h-screen lg:w-40 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
                operator
              </p>
              <h1 className="mt-1 text-xl font-medium tracking-[-0.04em]">
                Admin
              </h1>
            </div>
            <Link
              className="nav-link inline-flex items-center gap-1.5 lg:hidden"
              to="/app"
              aria-label="Back to app"
            >
              <ArrowLeft className="size-4" />
              App
            </Link>
          </div>

          <nav className="mt-5 flex gap-1 overflow-x-auto [scrollbar-width:none] lg:mt-8 lg:flex-col">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-white/[0.07] text-white'
                      : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <Link
            className="nav-link mt-8 hidden items-center gap-2 lg:inline-flex"
            to="/app"
            aria-label="Back to app"
          >
            <ArrowLeft className="size-4" />
            Back to app
          </Link>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
          {section === 'overview' ? (
            <>
              <AdminStats totals={overview.totals} />
              <AdminTrendsChart data={overview.trends} />
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <AdminCountries
                  countries={overview.countries}
                  total={overview.totals.landingViews}
                />
                <AdminViewsChart data={overview.viewsByDay} />
              </div>
            </>
          ) : null}

          {section === 'users' ? <AdminUsersTable users={users} /> : null}

          {section === 'activity' ? (
            <AdminRecentActivity recent={overview.recent} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
