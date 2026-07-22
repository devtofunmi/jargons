import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/scans')({
  component: ScansLayout,
})

function ScansLayout() {
  return <Outlet />
}
