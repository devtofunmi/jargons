import { Outlet, createFileRoute } from '@tanstack/react-router'

import { ListPageSkeleton } from '../components/skeletons'

export const Route = createFileRoute('/app/reviews')({
  // Show the section skeleton (not the global blinking-owl fallback) while the
  // list/detail child loads.
  pendingComponent: ListPageSkeleton,
  component: ReviewsLayout,
})

function ReviewsLayout() {
  return <Outlet />
}
