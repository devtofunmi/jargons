import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/reviews')({
  component: ReviewsLayout,
})

function ReviewsLayout() {
  return <Outlet />
}
