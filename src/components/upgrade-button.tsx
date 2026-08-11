import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

// Sends the user to the public pricing page, which explains the plans and
// starts the Bachs checkout. Kept as a component so every upgrade CTA routes
// through pricing consistently.
export function UpgradeButton({ className }: { className?: string }) {
  return (
    <Link
      to="/pricing"
      className={className ?? 'button-primary shrink-0 justify-center'}
    >
      Upgrade to Pro
      <ArrowRight className="size-4" />
    </Link>
  )
}
