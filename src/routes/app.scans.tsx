import { Outlet, createFileRoute } from '@tanstack/react-router'

import { ListPageSkeleton } from '../components/skeletons'

export const Route = createFileRoute('/app/scans')({
  // Show the section skeleton (not the global blinking-owl fallback) while a
  // child loads.
  pendingComponent: ListPageSkeleton,
  component: ScansLayout,
})

function ScansLayout() {
  return <Outlet />
}
