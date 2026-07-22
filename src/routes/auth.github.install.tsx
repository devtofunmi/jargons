import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Check, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AuthShell } from '../components/auth-shell'
import { completeGitHubAppInstallation } from '../server/github-app'

export const Route = createFileRoute('/auth/github/install')({
  validateSearch: (search: Record<string, unknown>) => ({
    installation_id:
      typeof search.installation_id === 'string'
        ? search.installation_id
        : undefined,
    setup_action:
      typeof search.setup_action === 'string' ? search.setup_action : undefined,
  }),
  component: GitHubInstallCallbackPage,
})

function GitHubInstallCallbackPage() {
  const { installation_id: installationId, setup_action: setupAction } =
    Route.useSearch()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [message, setMessage] = useState('Syncing selected repositories...')

  useEffect(() => {
    let active = true

    async function completeInstallation() {
      try {
        const result = await completeGitHubAppInstallation({
          data: { installationId },
        })

        if (!active) return

        setStatus('success')
        setMessage(
          `${result.accountLogin} connected. ${result.syncedRepositories} repositories synced.`,
        )

        window.setTimeout(() => {
          window.location.assign('/app/repositories')
        }, 900)
      } catch (error) {
        if (!active) return

        setStatus('error')
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to complete GitHub App installation.',
        )
      }
    }

    void completeInstallation()

    return () => {
      active = false
    }
  }, [installationId])

  const isLoading = status === 'loading'
  const isSuccess = status === 'success'

  return (
    <AuthShell
      eyebrow="github app"
      title={
        isLoading
          ? 'Connecting repositories...'
          : isSuccess
            ? 'Repositories connected.'
            : 'GitHub installation failed.'
      }
      description="Jargons is finishing the GitHub App installation and preparing your repository list."
    >
      <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 sm:p-6">
        <div
          className={`grid size-14 place-items-center rounded-2xl ${
            isSuccess
              ? 'bg-emerald-300 text-zinc-950'
              : status === 'error'
                ? 'bg-red-300 text-zinc-950'
                : 'bg-amber-300 text-zinc-950'
          }`}
        >
          {isLoading ? (
            <LoaderCircle className="size-7 animate-spin" />
          ) : isSuccess ? (
            <Check className="size-7" />
          ) : (
            <TriangleAlert className="size-7" />
          )}
        </div>

        <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em]">
          {isLoading
            ? 'Reading installation'
            : isSuccess
              ? 'Installation complete'
              : 'Setup needs attention'}
        </h2>

        <p className="mt-3 text-sm leading-6 text-zinc-500">{message}</p>

        {setupAction ? (
          <p className="mt-5 font-mono text-[10px] text-zinc-700">
            setup_action={setupAction}
          </p>
        ) : null}

        {isLoading ? (
          <button
            type="button"
            disabled
            className="button-primary mt-7 w-full cursor-not-allowed justify-center opacity-60"
          >
            Connecting...
            <LoaderCircle className="size-4 animate-spin" />
          </button>
        ) : (
          <Link
            className="button-primary mt-7 w-full justify-center"
            to={isSuccess ? '/app/repositories' : '/auth/connect'}
          >
            {isSuccess ? 'Open repositories' : 'Try installation again'}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </AuthShell>
  )
}
