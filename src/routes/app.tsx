import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppShell } from '../components/app-shell'
import { AppShellSkeleton } from '../components/skeletons'
import { getGitHubAppStatus } from '../server/github-app'
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

    // Onboarding gate: a signed-in user who hasn't installed the GitHub App yet
    // is sent to the connect flow instead of an empty dashboard. Settings stays
    // reachable so they can still manage or delete their account first.
    if (!location.pathname.startsWith('/app/settings')) {
      const { installed } = await getGitHubAppStatus()

      if (!installed) {
        throw redirect({ to: '/auth/connect' })
      }
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
