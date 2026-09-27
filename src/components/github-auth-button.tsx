import { MarkGithubIcon } from '@primer/octicons-react'
import { ArrowRight } from 'lucide-react'

export function GitHubAuthButton({
  label,
  next,
}: {
  label: string
  // Same-site path to return to after sign-in; validated on the server.
  next?: string
}) {
  const href = next
    ? `/auth/github/start?next=${encodeURIComponent(next)}`
    : '/auth/github/start'

  return (
    <a className="button-primary mt-7 w-full justify-center" href={href}>
      <MarkGithubIcon size={18} />
      {label}
      <ArrowRight className="size-4" />
    </a>
  )
}
