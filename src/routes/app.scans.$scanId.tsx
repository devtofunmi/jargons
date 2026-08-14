import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DetailPageSkeleton } from '../components/skeletons'

// Layout for a single scan: the detail (index) and each finding's own issue
// page ($findingId) render as siblings here.
export const Route = createFileRoute('/app/scans/$scanId')({
  // Show the detail skeleton (not the global blinking-owl fallback) while a
  // child loads.
  pendingComponent: DetailPageSkeleton,
  component: () => <Outlet />,
})
