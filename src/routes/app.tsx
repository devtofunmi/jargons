import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppShell } from '../components/app-shell'
import { AppShellSkeleton } from '../components/skeletons'
import { getCurrentUser } from '../server/github-auth'

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
  pendingComponent: AppShellSkeleton,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser()

    if (!user) {
      throw redirect({ to: '/auth/sign-in' })
    }

    // Onboarding gate: a user who hasn't finished or skipped the guided
    // onboarding is sent there instead of landing on an empty dashboard.
    // Settings stays reachable so they can still manage or delete their account.
    if (!user.onboardedAt && !location.pathname.startsWith('/app/settings')) {
      throw redirect({ to: '/onboarding' })
    }

    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}
