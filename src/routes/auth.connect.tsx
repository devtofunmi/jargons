import { createFileRoute } from '@tanstack/react-router'
import { Github, ShieldCheck } from 'lucide-react'

import { AuthShell } from '../components/auth-shell'
import { GitHubAppInstallButton } from '../components/github-app-install-button'

export const Route = createFileRoute('/auth/connect')({
  component: ConnectPage,
})

function ConnectPage() {
  return (
    <AuthShell
      eyebrow="github app"
      title="Choose the repositories Jargons can review."
      description="Install Jargons for the repositories where you want pull request reviews, vulnerability checks, and codebase scans."
    >
      <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] text-zinc-600">
              github.com/apps
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
              Install Jargons
            </h2>
          </div>
          <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200">
            <Github className="size-5" />
          </span>
        </div>

        <div className="mt-7 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            repository access
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            GitHub will open the official installation screen where you can
            choose all repositories or select only the repositories Jargons
            should review.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" />
            <p className="text-sm leading-6 text-zinc-500">
              Jargons needs repository metadata and pull request access first.
              Review comments, commit statuses, and webhook permissions will
              power the automated review workflow.
            </p>
          </div>
        </div>

        <GitHubAppInstallButton
          className="button-primary mt-7 w-full justify-center"
          label="Choose repositories on GitHub"
        />
      </div>
    </AuthShell>
  )
}
