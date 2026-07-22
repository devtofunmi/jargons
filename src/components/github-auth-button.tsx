import { MarkGithubIcon } from '@primer/octicons-react'
import { ArrowRight } from 'lucide-react'

export function GitHubAuthButton({ label }: { label: string }) {
  return (
    <a
      className="button-primary mt-7 w-full justify-center"
      href="/auth/github/start"
    >
      <MarkGithubIcon size={18} />
      {label}
      <ArrowRight className="size-4" />
    </a>
  )
}
