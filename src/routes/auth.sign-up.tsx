import { createFileRoute, Link } from '@tanstack/react-router'
import { MarkGithubIcon } from '@primer/octicons-react'
import { GitPullRequest, Radar, ShieldCheck } from 'lucide-react'

import { AuthShell } from '../components/auth-shell'
import { GitHubAuthButton } from '../components/github-auth-button'

export const Route = createFileRoute('/auth/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <AuthShell
      eyebrow="create workspace"
      title="Set up AI code review for your repositories."
      description="Create a Jargons workspace with GitHub, choose the repositories to watch, and start receiving focused review findings on pull requests."
    >
      <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 sm:p-6">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#ffe04b] text-zinc-950">
          <MarkGithubIcon size={24} />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em]">
          Create your Jargons workspace
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Use GitHub to create your workspace and install Jargons on selected
          repositories.
        </p>

        <GitHubAuthButton label="Sign up with GitHub" />

        <div className="mt-5 grid gap-3">
          <SignupBenefit
            icon={<GitPullRequest className="size-4" />}
            title="Pull request reviews"
            description="Get focused findings on correctness, security, maintainability, and risky diffs."
          />
          <SignupBenefit
            icon={<Radar className="size-4" />}
            title="Codebase scans"
            description="Scan existing repositories for bugs, vulnerabilities, dependency risks, and structure issues."
          />
          <SignupBenefit
            icon={<ShieldCheck className="size-4" />}
            title="GitHub-native workflow"
            description="Keep review feedback close to the merge decision without changing how your team ships."
          />
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Already have an account?{' '}
          <Link
            className="text-amber-300 hover:text-amber-200"
            to="/auth/sign-in"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}

function SignupBenefit({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <article className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mt-0.5 text-amber-300">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{description}</p>
      </div>
    </article>
  )
}
