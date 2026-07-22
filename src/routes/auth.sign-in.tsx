import { createFileRoute, Link } from '@tanstack/react-router'
import { MarkGithubIcon } from '@primer/octicons-react'
import { KeyRound, LockKeyhole } from 'lucide-react'

import { AuthShell } from '../components/auth-shell'
import { GitHubAuthButton } from '../components/github-auth-button'

export const Route = createFileRoute('/auth/sign-in')({
  validateSearch: (search): { error?: string } => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { error } = Route.useSearch()

  return (
    <AuthShell
      eyebrow="secure sign in"
      title="Welcome back to your review console."
      description="Sign in with GitHub to open your repositories, review runs, and codebase scan results."
    >
      <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 sm:p-6">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#ffe04b] text-zinc-950">
          <MarkGithubIcon size={24} />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em]">
          Sign in to Jargons
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Continue with the GitHub account connected to your Jargons workspace.
        </p>

        <GitHubAuthButton label="Continue with GitHub" />

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm leading-6 text-red-200">
            {error}
          </p>
        ) : null}

        <p className="mt-5 text-center text-sm text-zinc-600">
          New to Jargons?{' '}
          <Link
            className="text-amber-300 hover:text-amber-200"
            to="/auth/sign-up"
          >
            Create an account
          </Link>
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SecurityNote
            icon={<LockKeyhole className="size-4" />}
            title="No code stored"
            description="Reviews can run from diffs first, then codebase scans by permission."
          />
          <SecurityNote
            icon={<KeyRound className="size-4" />}
            title="Scoped access"
            description="Repository permissions stay explicit and easy to revoke."
          />
        </div>
      </div>
    </AuthShell>
  )
}

function SecurityNote({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="text-amber-300">{icon}</div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-zinc-600">{description}</p>
    </article>
  )
}
