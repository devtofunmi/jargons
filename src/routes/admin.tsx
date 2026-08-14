import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

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

function AdminPage() {
  const { overview, users } = Route.useLoaderData()

  return (
    <main className="min-h-screen bg-[#070708] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
              operator
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em]">
              Admin
            </h1>
          </div>
          <Link
            className="nav-link inline-flex items-center gap-2"
            to="/app"
            aria-label="Back to app"
          >
            <ArrowLeft className="size-4" />
            App
          </Link>
        </div>

        <AdminStats totals={overview.totals} />
        <AdminTrendsChart data={overview.trends} />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AdminCountries
            countries={overview.countries}
            total={overview.totals.landingViews}
          />
          <AdminViewsChart data={overview.viewsByDay} />
        </div>

        <AdminUsersTable users={users} />
        <AdminRecentActivity recent={overview.recent} />
      </div>
    </main>
  )
}
