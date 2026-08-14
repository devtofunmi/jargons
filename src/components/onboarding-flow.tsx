import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitPullRequest,
  LoaderCircle,
  Lock,
  ScanSearch,
} from 'lucide-react'
import { Fragment, useState } from 'react'

import { GitHubAppInstallButton } from './github-app-install-button'
import { OwlMark } from './owl-mark'
import { ScanModal } from './scan-modal'

export type OnboardingRepo = { id: string; fullName: string }

type Choice = 'scan' | 'pr' | null

// The continuous onboarding stepper: connect, then choose how to try Jargons
// (a scan or a pull request), then do the one you picked. Data + side effects
// are injected so the real route and the mockup preview share the same UI.
export function OnboardingFlow({
  installed,
  accountLogin,
  repos,
  onFinish,
  onScanStarted,
}: {
  installed: boolean
  accountLogin: string
  repos: OnboardingRepo[]
  onFinish: () => Promise<void>
  onScanStarted?: (scanId: string) => void
}) {
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<Choice>(null)
  const [leaving, setLeaving] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)

  const hasRepos = repos.length > 0
  const githubReposUrl = `https://github.com/${accountLogin}?tab=repositories`

  const labels = [
    'Connect',
    'Choose',
    choice === 'scan' ? 'Scan' : choice === 'pr' ? 'Pull request' : 'Try it',
  ]
  const isLast = step === labels.length - 1

  // Gating: step 0 needs the app connected; the choice step needs a pick.
  const canAdvance =
    (step === 0 && installed) || (step === 1 && choice !== null)

  async function finish() {
    setLeaving(true)
    await onFinish()
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#070708] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
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
          onClick={() => void finish()}
        >
          Skip for now
        </button>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-14">
        <Stepper labels={labels} current={step} installed={installed} />

        {/* Keyed by step so each one fades up as you move through the flow. */}
        <div key={step} className="mt-12 animate-[reveal_0.4s_ease-out]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            Step {step + 1} of {labels.length}
          </p>

          {step === 0 ? (
            <StepBody
              icon={<Check className="size-6" />}
              accent="amber"
              title="Connect your repositories"
              description="Install the Jargons GitHub App and choose which repositories it can review. Everything else builds on this."
            >
              {installed ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3.5 py-2 text-sm text-emerald-300">
                  <Check className="size-4" />
                  Connected as {accountLogin}
                </span>
              ) : (
                <GitHubAppInstallButton
                  className="button-primary justify-center"
                  label="Connect GitHub"
                />
              )}
            </StepBody>
          ) : step === 1 ? (
            <StepBody
              title="How do you want to try Jargons?"
              description="Pick one to see Jargons in action — you can always do the other later from the dashboard."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  selected={choice === 'scan'}
                  onSelect={() => setChoice('scan')}
                  icon={<ScanSearch className="size-5" />}
                  accent="cyan"
                  title="Run a scan"
                  description="Scan a repository for bugs, security issues, and structural risks. Fastest way to see results."
                />
                <ChoiceCard
                  selected={choice === 'pr'}
                  onSelect={() => setChoice('pr')}
                  icon={<GitPullRequest className="size-5" />}
                  accent="emerald"
                  title="Open a pull request"
                  description="Open a PR in a watched repo and Jargons reviews the diff automatically, with fix suggestions."
                />
              </div>
            </StepBody>
          ) : choice === 'scan' ? (
            <StepBody
              icon={<ScanSearch className="size-6" />}
              accent="cyan"
              title="Run your first scan"
              description="Pick a connected repository and scan it for bugs, security issues, and structural risks."
            >
              {installed && hasRepos ? (
                <button
                  type="button"
                  className="button-primary justify-center"
                  onClick={() => setScanModalOpen(true)}
                >
                  Choose a repository
                  <ScanSearch className="size-4" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-500">
                  <Lock className="size-3.5" />
                  {installed
                    ? 'No repositories synced yet'
                    : 'Connect a repository first'}
                </span>
              )}
            </StepBody>
          ) : (
            <StepBody
              icon={<GitPullRequest className="size-6" />}
              accent="emerald"
              title="Open a pull request"
              description="Open a PR in a repository Jargons watches — it reviews the diff automatically, posts findings, and can open a fix PR for you."
            >
              <a
                className="button-secondary justify-center"
                href={githubReposUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open GitHub repositories
                <ArrowRight className="size-4" />
              </a>
            </StepBody>
          )}
        </div>

        <nav className="mt-14 flex items-center justify-between">
          <button
            type="button"
            className="nav-link inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-0"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          {isLast ? (
            <button
              type="button"
              className="button-primary disabled:opacity-60"
              disabled={leaving}
              onClick={() => void finish()}
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
          ) : (
            <button
              type="button"
              className="button-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canAdvance}
              onClick={() => setStep((current) => current + 1)}
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          )}
        </nav>
      </section>

      <ScanModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        repos={repos}
        onScanStarted={onScanStarted}
      />
    </main>
  )
}

const accentStyles = {
  amber: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-300',
  cyan: 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-300',
  emerald: 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300',
} as const

function StepBody({
  icon,
  accent = 'amber',
  title,
  description,
  children,
}: {
  icon?: React.ReactNode
  accent?: keyof typeof accentStyles
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <>
      {icon ? (
        <span
          className={`mt-6 grid size-14 place-items-center rounded-2xl border ${accentStyles[accent]}`}
        >
          {icon}
        </span>
      ) : null}
      <h1
        className={`${icon ? 'mt-6' : 'mt-4'} text-3xl font-medium tracking-[-0.04em] sm:text-4xl`}
      >
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-zinc-500 sm:text-base">
        {description}
      </p>
      <div className="mt-8">{children}</div>
    </>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  icon,
  accent,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  accent: keyof typeof accentStyles
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start rounded-2xl border p-5 text-left transition-colors ${
        selected
          ? 'border-amber-300/50 bg-amber-300/[0.06]'
          : 'border-white/[0.08] bg-[#0c0c0f] hover:bg-white/[0.03]'
      }`}
    >
      <span
        className={`grid size-11 place-items-center rounded-xl border ${accentStyles[accent]}`}
      >
        {icon}
      </span>
      <span className="mt-4 flex items-center gap-2 text-base font-medium text-zinc-100">
        {title}
        {selected ? <Check className="size-4 text-amber-300" /> : null}
      </span>
      <span className="mt-2 text-sm leading-6 text-zinc-500">
        {description}
      </span>
    </button>
  )
}

function Stepper({
  labels,
  current,
  installed,
}: {
  labels: string[]
  current: number
  installed: boolean
}) {
  return (
    <div className="flex items-center">
      {labels.map((label, index) => {
        const done = index < current || (index === 0 && installed)
        const active = index === current

        return (
          <Fragment key={index}>
            <div className="flex items-center gap-2.5">
              <span
                className={`grid size-7 place-items-center rounded-full border font-mono text-[11px] transition-colors ${
                  done
                    ? 'border-emerald-300/30 bg-emerald-300/[0.1] text-emerald-300'
                    : active
                      ? 'border-amber-300/40 bg-amber-300/[0.1] text-amber-300'
                      : 'border-white/[0.1] bg-white/[0.02] text-zinc-600'
                }`}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={`hidden font-mono text-[11px] uppercase tracking-[0.12em] sm:inline ${
                  active ? 'text-zinc-200' : 'text-zinc-600'
                }`}
              >
                {label}
              </span>
            </div>
            {index < labels.length - 1 ? (
              <span
                className={`mx-3 h-px flex-1 transition-colors ${
                  index < current ? 'bg-emerald-300/30' : 'bg-white/[0.08]'
                }`}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
