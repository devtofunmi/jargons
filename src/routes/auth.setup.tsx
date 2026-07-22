import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight, Check, Clock3 } from 'lucide-react'

import { AuthShell } from '../components/auth-shell'
import { FullPageLoader } from '../components/skeletons'
import { getWorkspaceSettings } from '../server/workspace'

export const Route = createFileRoute('/auth/setup')({
  pendingComponent: FullPageLoader,
  loader: async () => {
    const settings = await getWorkspaceSettings()

    if (!settings) {
      throw redirect({ to: '/auth/sign-in' })
    }

    return settings
  },
  component: SetupPage,
})

function SetupPage() {
  const settings = Route.useLoaderData()
  const checks = [
    { label: 'GitHub identity verified', done: true },
    {
      label: settings.installation
        ? `GitHub app installed for ${settings.installation.accountLogin}`
        : 'GitHub app installation pending',
      done: Boolean(settings.installation),
    },
    {
      label:
        settings.repositoryCount > 0
          ? `${settings.repositoryCount} ${
              settings.repositoryCount === 1 ? 'repository' : 'repositories'
            } synced`
          : 'Repository sync pending',
      done: settings.repositoryCount > 0,
    },
    { label: 'Waiting for the first pull request', done: false },
  ]
  const ready = Boolean(settings.installation) && settings.repositoryCount > 0

  return (
    <AuthShell
      eyebrow={ready ? 'workspace ready' : 'almost there'}
      title={
        ready
          ? 'Jargons is ready to watch your pull requests.'
          : 'A couple of steps left before reviews start.'
      }
      description="Your workspace is connected. New pull requests will be reviewed automatically and repository scans will surface deeper risks."
    >
      <div className="rounded-2xl border border-white/[0.07] bg-[#09090b] p-5 sm:p-6">
        <div
          className={`grid size-14 place-items-center rounded-2xl ${
            ready ? 'bg-emerald-300' : 'bg-amber-300'
          } text-zinc-950`}
        >
          <Check className="size-7" />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em]">
          {ready ? 'Setup complete' : 'Setup in progress'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          The console shows repositories, reviews, findings, and scan status
          using your installation data.
        </p>

        <div className="mt-7 space-y-3">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
            >
              <span
                className={`grid size-6 place-items-center rounded-full ${
                  check.done
                    ? 'bg-emerald-300/[0.12] text-emerald-300'
                    : 'bg-white/[0.05] text-zinc-500'
                }`}
              >
                {check.done ? (
                  <Check className="size-3.5" />
                ) : (
                  <Clock3 className="size-3.5" />
                )}
              </span>
              <span className="text-sm text-zinc-300">{check.label}</span>
            </div>
          ))}
        </div>

        <Link className="button-primary mt-7 w-full justify-center" to="/app">
          Go to dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </AuthShell>
  )
}
