import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  GitPullRequest,
  LoaderCircle,
  Lock,
  ScanSearch,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { GitHubAppInstallButton } from '../components/github-app-install-button'
import { OwlMark } from '../components/owl-mark'
import { FullPageLoader } from '../components/skeletons'
import { getSyncedRepositories } from '../server/github-app'
import { markOnboarded } from '../server/onboarding'
import { getWorkspaceSettings } from '../server/workspace'

export const Route = createFileRoute('/onboarding')({
  pendingComponent: FullPageLoader,
  loader: async () => {
    const settings = await getWorkspaceSettings()

    if (!settings) {
      throw redirect({ to: '/auth/sign-in', search: { error: undefined } })
    }

    const repos = settings.installation ? await getSyncedRepositories() : []

    return {
      installed: Boolean(settings.installation),
      accountLogin: settings.installation?.accountLogin ?? settings.workspace.slug,
      repos: repos.map((repo) => ({ id: repo.id, fullName: repo.fullName })),
    }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { installed, accountLogin, repos } = Route.useLoaderData()
  const [busy, setBusy] = useState<'idle' | 'scanning' | 'leaving'>('idle')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanModalOpen, setScanModalOpen] = useState(false)

  const hasRepos = repos.length > 0
  const githubReposUrl = `https://github.com/${accountLogin}?tab=repositories`

  async function dismissTo(destination: string) {
    setBusy('leaving')
    try {
      await markOnboarded()
    } catch {
      // Non-fatal: let the user through even if the flag write fails.
    }
    window.location.assign(destination)
  }

  async function scanRepository(repositoryId: string) {
    setBusy('scanning')
    setScanError(null)

    try {
      const response = await fetch('/api/scans/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryId }),
      })

      if (response.status === 202) {
        const { scanId } = (await response.json()) as { scanId: string }
        await markOnboarded()
        window.location.assign(`/app/scans/${scanId}`)
        return
      }

      setScanError(
        response.status === 402
          ? "You've used your free run. Upgrade to run more scans."
          : 'Could not start the scan. Please try again.',
      )
    } catch {
      setScanError('Could not start the scan. Please try again.')
    }

    setBusy('idle')
  }

  const leaving = busy === 'leaving'
  const lockedLabel = !installed
    ? 'Connect a repository first'
    : 'No repositories synced yet'

  return (
    <main className="min-h-screen bg-[#070708] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]">
            <OwlMark className="size-8" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.04em]">
            jargons
          </span>
        </Link>
        <button
          type="button"
          className="nav-link disabled:opacity-50"
          disabled={leaving}
          onClick={() => {
            void dismissTo('/app')
          }}
        >
          Skip for now
        </button>
      </header>

      <section className="mx-auto max-w-6xl py-14 sm:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
          welcome to jargons
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-tight tracking-[-0.055em] sm:text-6xl">
          Let&apos;s see Jargons review your code.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base">
          Your GitHub App is connected. Run a scan on a repository you choose,
          or open a pull request to watch Jargons review it — or skip and
          explore the dashboard on your own.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {/* 1 — Connect (already done by the time you reach onboarding) */}
          <OnboardingCard
            step="01"
            icon={
              <span className="grid size-11 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-amber-300">
                <Check className="size-5" />
              </span>
            }
            title="Connect a repository"
            description="Install the Jargons GitHub App and choose which repositories it can review."
            done={installed}
            doneLabel={`Connected as ${accountLogin}`}
          >
            {!installed ? (
              <GitHubAppInstallButton
                className="button-primary w-full justify-center"
                label="Connect GitHub"
              />
            ) : null}
          </OnboardingCard>

          {/* 2 — Run a scan (user picks the repo) */}
          <OnboardingCard
            step="02"
            icon={
              <span className="grid size-11 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-cyan-300">
                <ScanSearch className="size-5" />
              </span>
            }
            title="Run your first scan"
            description="Pick a connected repository and scan it for bugs, security issues, and structural risks."
            locked={!installed || !hasRepos}
            lockedLabel={lockedLabel}
          >
            <button
              type="button"
              className="button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy !== 'idle'}
              onClick={() => {
                setScanError(null)
                setScanModalOpen(true)
              }}
            >
              Choose a repository
              <ScanSearch className="size-4" />
            </button>
          </OnboardingCard>

          {/* 3 — Open a PR (link out to GitHub) */}
          <OnboardingCard
            step="03"
            icon={
              <span className="grid size-11 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-emerald-300">
                <GitPullRequest className="size-5" />
              </span>
            }
            title="Open a pull request"
            description="Open a PR in a repository Jargons watches — it reviews the diff automatically and can suggest fixes."
            locked={!installed}
            lockedLabel={lockedLabel}
          >
            <a
              className="button-secondary w-full justify-center"
              href={githubReposUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub repositories
              <ArrowRight className="size-4" />
            </a>
          </OnboardingCard>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="button-primary disabled:opacity-60"
            disabled={leaving}
            onClick={() => {
              void dismissTo('/app')
            }}
          >
            {leaving ? (
              <>
                Opening dashboard...
                <LoaderCircle className="size-4 animate-spin" />
              </>
            ) : (
              <>
                Go to dashboard
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <span className="text-sm text-zinc-600">
            You can always scan and open PRs later from the dashboard.
          </span>
        </div>
      </section>

      {scanModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (busy !== 'scanning') setScanModalOpen(false)
          }}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-white/[0.1] bg-[#0c0c0f] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium tracking-[-0.03em]">
                Choose a repository to scan
              </h2>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                disabled={busy === 'scanning'}
                onClick={() => setScanModalOpen(false)}
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 max-h-80 space-y-2 overflow-y-auto pr-1">
              {repos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  disabled={busy === 'scanning'}
                  onClick={() => {
                    void scanRepository(repo.id)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#09090b] p-3 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="truncate font-mono text-sm text-zinc-300">
                    {repo.fullName}
                  </span>
                  {busy === 'scanning' ? (
                    <LoaderCircle className="size-4 shrink-0 animate-spin text-cyan-300" />
                  ) : (
                    <ScanSearch className="size-4 shrink-0 text-zinc-600" />
                  )}
                </button>
              ))}
            </div>

            {scanError ? (
              <p className="mt-4 text-sm text-red-400">{scanError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}

function OnboardingCard({
  step,
  icon,
  title,
  description,
  children,
  done = false,
  doneLabel,
  locked = false,
  lockedLabel,
}: {
  step: string
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
  done?: boolean
  doneLabel?: string
  locked?: boolean
  lockedLabel?: string
}) {
  return (
    <article className="flex flex-col rounded-[24px] border border-white/[0.08] bg-[#0c0c0f] p-6">
      <div className="flex items-center justify-between">
        {icon}
        <span className="font-mono text-[10px] text-zinc-700">{step}</span>
      </div>
      <h2 className="mt-6 text-xl font-medium tracking-[-0.035em] text-zinc-100">
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-500">
        {description}
      </p>

      <div className="mt-6">
        {done ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-sm text-emerald-300">
            <Check className="size-4" />
            {doneLabel}
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-500">
            <Lock className="size-3.5" />
            {lockedLabel}
          </span>
        ) : (
          children
        )}
      </div>
    </article>
  )
}
