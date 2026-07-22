import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/repositories')({
  component: RepositoriesLayout,
})

function RepositoriesLayout() {
  return <Outlet />
}
