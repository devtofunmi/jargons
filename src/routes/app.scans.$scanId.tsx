import { createFileRoute, Outlet } from '@tanstack/react-router'

// Layout for a single scan: the detail (index) and each finding's own issue
// page ($findingId) render as siblings here.
export const Route = createFileRoute('/app/scans/$scanId')({
  component: () => <Outlet />,
})
