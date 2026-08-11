import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitPullRequest,
  LoaderCircle,
  Lock,
  ScanSearch,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { GitHubAppInstallButton } from '../components/github-app-install-button'
import { OwlMark } from '../components/owl-mark'
import { FullPageLoader } from '../components/skeletons'
import { getSyncedRepositories } from '../server/github-app'
import { markOnboarded } from '../server/onboarding'
import { getCodebaseScan } from '../server/scans'
import { getWorkspaceSettings } from '../server/workspace'

type Repo = { id: string; fullName: string }
type ScanStep = 'list' | 'confirm' | 'scanning' | 'done' | 'error'

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
  const [leaving, setLeaving] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<ScanStep>('list')
  const [selected, setSelected] = useState<Repo | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [result, setResult] = useState<{ findingsCount: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const hasRepos = repos.length > 0
  const githubReposUrl = `https://github.com/${accountLogin}?tab=repositories`

  // Lock page scroll while the modal is open.
  useEffect(() => {
    if (!modalOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [modalOpen])

  // Poll the scan until it completes or fails, so the whole run happens in the
  // modal instead of navigating away immediately.
  useEffect(() => {
    if (step !== 'scanning' || !scanId) return
    let active = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const scan = await getCodebaseScan({ data: { scanId } })
        if (!active) return
        if (scan?.status === 'complete') {
          setResult({ findingsCount: scan.findingsCount })
          setStep('done')
          return
        }
        if (scan?.status === 'failed') {
          setErrorMsg('The scan failed. You can try again.')
          setStep('error')
          return
        }
      } catch {
        // transient — keep polling
      }
      timer = setTimeout(() => void poll(), 2500)
    }

    timer = setTimeout(() => void poll(), 1500)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [step, scanId])

  async function dismissTo(destination: string) {
    setLeaving(true)
    try {
      await markOnboarded()
    } catch {
      // Non-fatal: let the user through even if the flag write fails.
    }
    window.location.assign(destination)
  }

  function openScanModal() {
    setSelected(null)
    setScanId(null)
    setResult(null)
    setErrorMsg(null)
    setStep('list')
    setModalOpen(true)
  }

  function closeScanModal() {
    if (step === 'scanning') return
    setModalOpen(false)
  }

  async function startScan() {
    if (!selected) return
    setErrorMsg(null)
    setStep('scanning')

    try {
      const response = await fetch('/api/scans/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryId: selected.id }),
      })

      if (response.status === 202) {
        const { scanId: id } = (await response.json()) as { scanId: string }
        // Starting a scan counts as onboarded, regardless of what they do next.
        void markOnboarded()
        setScanId(id)
        return
      }

      setErrorMsg(
        response.status === 402
          ? "You've used your free run. Upgrade to run more scans."
          : 'Could not start the scan. Please try again.',
      )
      setStep('error')
    } catch {
      setErrorMsg('Could not start the scan. Please try again.')
      setStep('error')
    }
  }

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
              className="button-primary w-full justify-center"
              onClick={openScanModal}
            >
              Choose a repository
              <ScanSearch className="size-4" />
            </button>
          </OnboardingCard>

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

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeScanModal}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-white/[0.1] bg-[#0c0c0f] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step === 'confirm' ? (
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-200"
                    onClick={() => setStep('list')}
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                ) : null}
                <h2 className="text-lg font-medium tracking-[-0.03em]">
                  {step === 'list'
                    ? 'Choose a repository to scan'
                    : step === 'confirm'
                      ? 'Scan this repository?'
                      : step === 'scanning'
                        ? 'Scanning…'
                        : step === 'done'
                          ? 'Scan complete'
                          : 'Scan failed'}
                </h2>
              </div>
              {step !== 'scanning' ? (
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-200"
                  onClick={closeScanModal}
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              ) : null}
            </div>

            {step === 'list' ? (
              <div className="mt-5 max-h-80 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
                {repos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => {
                      setSelected(repo)
                      setStep('confirm')
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#09090b] p-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="truncate font-mono text-sm text-zinc-300">
                      {repo.fullName}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-zinc-600" />
                  </button>
                ))}
              </div>
            ) : null}

            {step === 'confirm' && selected ? (
              <div className="mt-5">
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#09090b] p-4">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-cyan-300">
                    <ScanSearch className="size-5" />
                  </span>
                  <span className="truncate font-mono text-sm text-zinc-200">
                    {selected.fullName}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-500">
                  Jargons will scan this repository for bugs, security issues,
                  and structural risks. This uses one agent run.
                </p>
                <button
                  type="button"
                  className="button-primary mt-5 w-full justify-center"
                  onClick={() => {
                    void startScan()
                  }}
                >
                  Start scan
                  <ScanSearch className="size-4" />
                </button>
              </div>
            ) : null}

            {step === 'scanning' ? (
              <div className="mt-6 flex flex-col items-center py-6 text-center">
                <div className="relative grid size-28 place-items-center">
                  <span className="absolute size-full animate-ping rounded-full bg-cyan-400/10" />
                  <span className="absolute size-2/3 animate-ping rounded-full bg-cyan-400/15 [animation-delay:400ms]" />
                  <span className="grid size-16 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-300">
                    <ScanSearch className="size-7 animate-pulse" />
                  </span>
                </div>
                <p className="mt-6 text-sm font-medium text-zinc-200">
                  Scanning {selected?.fullName}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Reading the codebase and hunting for issues. This can take a
                  minute — hang tight.
                </p>
                {scanId ? (
                  <button
                    type="button"
                    className="mt-5 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
                    onClick={() => window.location.assign(`/app/scans/${scanId}`)}
                  >
                    Taking a while? Continue in the dashboard →
                  </button>
                ) : null}
              </div>
            ) : null}

            {step === 'done' ? (
              <div className="mt-6 flex flex-col items-center py-4 text-center">
                <span className="grid size-16 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/[0.1] text-emerald-300">
                  <Check className="size-8" />
                </span>
                <p className="mt-5 text-sm font-medium text-zinc-200">
                  Scanned {selected?.fullName}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {result && result.findingsCount > 0
                    ? `Found ${result.findingsCount} ${
                        result.findingsCount === 1 ? 'issue' : 'issues'
                      } worth a look.`
                    : 'No issues found — nice and clean.'}
                </p>
                <button
                  type="button"
                  className="button-primary mt-6 w-full justify-center"
                  onClick={() => {
                    if (scanId) window.location.assign(`/app/scans/${scanId}`)
                  }}
                >
                  View results in dashboard
                  <ArrowRight className="size-4" />
                </button>
              </div>
            ) : null}

            {step === 'error' ? (
              <div className="mt-6 flex flex-col items-center py-4 text-center">
                <span className="grid size-16 place-items-center rounded-full border border-red-500/25 bg-red-500/[0.08] text-red-400">
                  <TriangleAlert className="size-7" />
                </span>
                <p className="mt-5 text-sm leading-6 text-zinc-400">
                  {errorMsg ?? 'Something went wrong.'}
                </p>
                <button
                  type="button"
                  className="button-secondary mt-6 w-full justify-center"
                  onClick={() => setStep('list')}
                >
                  Back to repositories
                </button>
              </div>
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
