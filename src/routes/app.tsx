import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppShell } from '../components/app-shell'
import { AppShellSkeleton } from '../components/skeletons'
import { getCurrentUser } from '../server/github-auth'

export const Route = createFileRoute('/app')({
  pendingComponent: AppShellSkeleton,
  beforeLoad: async () => {
    const user = await getCurrentUser()

    if (!user) {
      throw redirect({ to: '/auth/sign-in' })
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
