import { createFileRoute } from '@tanstack/react-router'
import { MarkGithubIcon } from '@primer/octicons-react'
import {
  ArrowRight,
  Check,
  CircleDot,
  FileCode2,
  GitPullRequest,
  Menu,
  MessageSquareCode,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

import { OwlMark } from '../components/owl-mark'
import { PageView } from '../components/page-view'
import {
  featureItems,
  footerColumns,
  navigationItems,
  reviewCodeLines,
  workflowSteps,
} from '../data/landing-page'
import type { CodeLineData, FeatureKey, FooterLink } from '../data/landing-page'
import { getGitHubAppStatus } from '../server/github-app'

export const Route = createFileRoute('/')({
  loader: () => getGitHubAppStatus(),
  component: Home,
})

function Brand() {
  return (
    <a
      href="#top"
      className="group flex items-center gap-2.5"
      aria-label="Jargons home"
    >
      <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113] transition-colors group-hover:border-amber-500/40">
        <OwlMark className="size-8" />
      </span>
      <span className="text-[19px] font-semibold tracking-[-0.04em] text-white">
        jargons
      </span>
    </a>
  )
}

function Header({ isSignedIn }: { isSignedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#080809]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand />

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Primary navigation"
        >
          {navigationItems.map(({ label, href }) => (
            <a className="nav-link" href={href} key={label}>
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isSignedIn ? (
            <a className="button-primary py-2.5" href="/app">
              Open dashboard
              <ArrowRight className="size-4" />
            </a>
          ) : (
            <>
              <a className="nav-link px-3" href="/auth/sign-in">
                Sign in
              </a>
              <a className="button-primary py-2.5" href="/auth/sign-up">
                <MarkGithubIcon size={16} />
                Start reviewing
              </a>
            </>
          )}
        </div>

        <button
          className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 md:hidden"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <nav className="border-t border-white/[0.07] bg-[#080809] px-5 py-5 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigationItems.map(({ label, href }) => (
              <a
                key={label}
                className="rounded-xl px-3 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                href={href}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <a
              className="button-primary mt-3 justify-center"
              href={isSignedIn ? '/app' : '/auth/sign-up'}
            >
              <MarkGithubIcon size={16} />
              {isSignedIn ? 'Open dashboard' : 'Start reviewing'}
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  )
}

function CodeLine({ number, content, variant }: CodeLineData) {
  return (
    <div
      className={`grid min-w-[590px] grid-cols-[44px_24px_1fr] px-4 ${
        variant === 'added'
          ? 'bg-emerald-500/[0.07] text-emerald-200'
          : variant === 'removed'
            ? 'bg-red-500/[0.07] text-red-300'
            : 'text-zinc-500'
      }`}
    >
      <span className="select-none text-right text-zinc-700">{number}</span>
      <span className="select-none text-center text-zinc-600">
        {variant === 'added' ? '+' : variant === 'removed' ? '−' : ''}
      </span>
      <span className="whitespace-pre">{content}</span>
    </div>
  )
}

function ReviewPreview({ hero = false }: { hero?: boolean }) {
  return (
    <div
      className={
        hero
          ? 'hero-preview relative w-full min-w-0'
          : 'relative mx-auto mt-16 max-w-5xl px-1 sm:px-6 lg:mt-20'
      }
    >
      <div className="preview-shell relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0d0d0f] text-left">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-amber-400">
              <GitPullRequest className="size-4" />
            </div>
            <div>
              <p className="review-title text-xs font-semibold text-zinc-100 sm:text-sm">
                feat: improve session validation
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-zinc-600 sm:text-[10px]">
                acme/web-app · pull request #248
              </p>
            </div>
          </div>
          <span className="review-status hidden items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1.5 font-mono text-[10px] text-emerald-300 sm:flex">
            <Check className="size-3" />
            review.complete
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.28fr_0.72fr]">
          <div className="overflow-hidden border-b border-white/[0.07] bg-[#0a0a0b] lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3 font-mono text-[10px] text-zinc-500">
              <CircleDot className="size-3.5 text-amber-500" />
              src/lib/auth/session.ts
              <span className="ml-auto text-zinc-700">+12 −4</span>
            </div>
            <div className="code-panel review-code relative overflow-x-auto py-4 font-mono text-[11px] leading-7 sm:text-xs">
              {reviewCodeLines.map((line, index) => (
                <CodeLine key={`${line.number}-${index}`} {...line} />
              ))}
            </div>
          </div>

          <div className="review-sidebar bg-[#111118] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400" />
                <span className="font-mono text-[10px] text-zinc-300">
                  jargons/review
                </span>
              </div>
              <span className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1 font-mono text-[9px] text-amber-400">
                2 findings
              </span>
            </div>

            <div className="finding-card rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <ScanSearch className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-zinc-200">
                      Race condition
                    </p>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-amber-500">
                      high
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-500 sm:text-xs">
                    Two requests can pass this check before the expired session
                    is deleted. Use a transaction to make the read and delete
                    atomic.
                  </p>
                </div>
              </div>
            </div>

            <div className="finding-card finding-card-secondary mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.035] p-4">
              <div className="flex items-start gap-3">
                <MessageSquareCode className="mt-0.5 size-4 shrink-0 text-sky-400" />
                <div>
                  <p className="text-xs font-semibold text-zinc-300">
                    Nice improvement
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-600 sm:text-xs">
                    Cleaning up expired sessions here keeps downstream
                    authorization checks simpler.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 font-mono text-[9px] text-zinc-700">
              <span className="size-1.5 rounded-full bg-emerald-400" />8 files ·
              42 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RiskDiagram() {
  return (
    <div className="diagram-stage">
      <div className="absolute inset-x-5 top-5 flex items-center justify-between font-mono text-[9px] text-zinc-700">
        <span>analysis.pipeline</span>
        <span>03 signals</span>
      </div>
      <div className="absolute left-1/2 top-[58%] h-px w-3/5 -translate-x-1/2 bg-white/[0.08]" />
      {[
        ['auth.ts', 'critical', 'left-[8%] top-[35%]', 'border-red-500/30'],
        ['api.ts', 'clear', 'left-[38%] top-[53%]', 'border-emerald-500/20'],
        ['cache.ts', 'warning', 'right-[7%] top-[30%]', 'border-amber-500/30'],
      ].map(([file, status, position, border], index) => (
        <div
          key={file}
          className={`diagram-node absolute ${position} w-28 rounded-xl border ${border} bg-[#111116] p-3 shadow-xl shadow-black/40`}
          style={{ animationDelay: `${index * 500}ms` }}
        >
          <FileCode2 className="size-4 text-zinc-500" />
          <p className="mt-5 font-mono text-[9px] text-zinc-300">{file}</p>
          <p className="mt-1 font-mono text-[8px] text-zinc-700">{status}</p>
        </div>
      ))}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0b] px-3 py-1.5 font-mono text-[8px] text-zinc-500">
        <ScanSearch className="size-3 text-amber-400" />
        tracing dependencies
      </div>
    </div>
  )
}

function ContextDiagram() {
  return (
    <div className="diagram-stage overflow-hidden">
      <div className="absolute left-6 top-5 font-mono text-[9px] text-zinc-700">
        review.context
      </div>
      <div className="absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 space-y-2">
        <div className="ml-12 rounded-xl border border-white/[0.07] bg-[#0c0c0e] px-4 py-3 opacity-40">
          <div className="h-1.5 w-24 rounded-full bg-zinc-800" />
        </div>
        <div className="context-card relative rounded-xl border border-cyan-400/30 bg-[#111116] p-4 shadow-2xl shadow-black">
          <div className="flex items-center gap-2 font-mono text-[9px] text-sky-400">
            <MessageSquareCode className="size-3.5" />
            jargons
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-400">
            This bypasses the rate limiter when the forwarded host header is
            missing.
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded border border-white/[0.07] px-2 py-1 font-mono text-[8px] text-zinc-600">
              why it matters
            </span>
            <span className="rounded border border-white/[0.07] px-2 py-1 font-mono text-[8px] text-zinc-600">
              suggested fix
            </span>
          </div>
        </div>
        <div className="mr-12 rounded-xl border border-white/[0.07] bg-[#0c0c0e] px-4 py-3 opacity-40">
          <div className="h-1.5 w-36 rounded-full bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function SpeedDiagram() {
  return (
    <div className="diagram-stage">
      <div className="absolute inset-x-6 top-5 flex justify-between font-mono text-[9px] text-zinc-700">
        <span>review.run</span>
        <span className="text-emerald-500">live</span>
      </div>
      <div className="absolute inset-x-7 top-[42%] h-px bg-white/[0.08]">
        <div className="progress-beam absolute left-0 top-1/2 h-px w-[78%] -translate-y-1/2 bg-amber-400" />
        {[0, 32, 58, 78, 100].map((position, index) => (
          <span
            key={position}
            className={`absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-[#0b0b0c] font-mono text-[8px] ${
              index < 4
                ? 'border-amber-500 text-amber-400'
                : 'border-white/10 text-zinc-700'
            }`}
            style={{ left: `${position}%` }}
          >
            {index < 4 ? <Check className="size-3" /> : '5'}
          </span>
        ))}
      </div>
      <div className="absolute bottom-8 left-7 right-7 grid grid-cols-3 gap-2 font-mono text-[8px]">
        <div>
          <p className="text-zinc-700">files</p>
          <p className="mt-1 text-zinc-300">08</p>
        </div>
        <div>
          <p className="text-zinc-700">findings</p>
          <p className="mt-1 text-zinc-300">02</p>
        </div>
        <div>
          <p className="text-zinc-700">elapsed</p>
          <p className="mt-1 text-amber-400">00:42</p>
        </div>
      </div>
    </div>
  )
}

function CodebaseDiagram() {
  return (
    <div className="diagram-stage">
      <div className="absolute inset-x-5 top-5 flex items-center justify-between font-mono text-[9px] text-zinc-700">
        <span>repository.scan</span>
        <span className="text-violet-400">1,248 files</span>
      </div>
      <div className="absolute left-1/2 top-[48%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/25">
        <div className="absolute inset-3 grid place-items-center rounded-full border border-cyan-400/25 bg-[#101014]">
          <ScanSearch className="size-6 text-violet-300" />
        </div>
        <span className="workflow-ring absolute inset-[-8px] rounded-full border border-transparent" />
      </div>
      {[
        ['api', 'left-[9%] top-[32%]', 'text-red-300', '4 risks'],
        ['auth', 'right-[9%] top-[31%]', 'text-amber-300', '2 risks'],
        ['core', 'left-[14%] bottom-[17%]', 'text-cyan-300', 'structure'],
        ['worker', 'right-[10%] bottom-[17%]', 'text-emerald-300', 'clear'],
      ].map(([name, position, color, result]) => (
        <div
          key={name}
          className={`diagram-node absolute ${position} rounded-lg border border-white/10 bg-[#111116] px-3 py-2 font-mono text-[8px]`}
        >
          <p className={color}>{name}/</p>
          <p className="mt-1 text-zinc-700">{result}</p>
        </div>
      ))}
    </div>
  )
}

const featureComponents: Record<
  FeatureKey,
  { icon: typeof ShieldCheck; diagram: typeof RiskDiagram }
> = {
  risk: { icon: ShieldCheck, diagram: RiskDiagram },
  context: { icon: MessageSquareCode, diagram: ContextDiagram },
  speed: { icon: Zap, diagram: SpeedDiagram },
  codebase: { icon: ScanSearch, diagram: CodebaseDiagram },
}

function WorkflowDiagram() {
  return (
    <div className="relative mt-20">
      <div className="workflow-line absolute left-[16.66%] right-[16.66%] top-7 hidden h-px bg-white/10 md:block" />
      <div className="relative z-10 grid gap-14 md:grid-cols-3 md:gap-8">
        {workflowSteps.map(({ number, state, title, description }, index) => (
          <article
            key={number}
            className="workflow-step relative text-center"
            style={{ animationDelay: `${index * 700}ms` }}
          >
            <span className="relative mx-auto grid size-14 place-items-center rounded-full border border-white/15 bg-[#0b0b0c]">
              {index === 0 ? (
                <GitPullRequest className="size-4 text-violet-400" />
              ) : index === 1 ? (
                <OwlMark className="size-8" />
              ) : (
                <Check className="size-4 text-emerald-300" />
              )}
              <span className="workflow-ring absolute inset-[-5px] rounded-full border border-transparent" />
            </span>
            <p className="mt-6 font-mono text-[9px] text-amber-400">{number}</p>
            <p className="mt-2 font-mono text-[8px] uppercase tracking-wider text-zinc-700">
              {state}
            </p>
            <h3 className="mt-5 text-lg font-medium tracking-[-0.025em] text-zinc-100">
              {title}
            </h3>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-zinc-500">
              {description}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

function Home() {
  const { signedIn: isSignedIn, installed } = Route.useLoaderData()

  return (
    <main id="top" className="overflow-hidden bg-[#080809] text-white">
      <PageView path="/" />
      <Header isSignedIn={isSignedIn} />

      <section className="hero-stage relative border-b border-white/[0.07] bg-[#080809] px-5 pb-24 pt-36 sm:px-8 sm:pt-44 lg:pb-32">
        <div className="relative mx-auto max-w-7xl text-center">
          <h1 className="mx-auto max-w-5xl text-balance text-[48px] font-medium leading-[0.98] tracking-[-0.06em] text-white sm:text-7xl lg:text-[88px]">
            Code review that{' '}
            <span className="text-[#ffe04b]">gets your code.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-balance text-base leading-7 text-zinc-200 sm:text-lg sm:leading-8">
            Jargons reads every pull request, catches real issues, and leaves
            thoughtful feedback. It also scans existing codebases for bugs,
            vulnerabilities, and structural problems.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              id="start"
              className="button-primary w-full justify-center sm:w-auto"
              href={isSignedIn ? '/app' : '/auth/sign-up'}
            >
              <MarkGithubIcon size={18} />
              {isSignedIn ? 'Go to your dashboard' : 'Start reviewing for free'}
              <ArrowRight className="size-4" />
            </a>
            <a
              className="button-secondary w-full justify-center sm:w-auto"
              href="#workflow"
            >
              See the workflow
            </a>
          </div>
          <p className="mt-4 font-mono text-[9px] text-zinc-400">
            free for public repositories · setup in under 2 minutes
          </p>

          <ReviewPreview />
        </div>
      </section>

      <section
        id="features"
        className="border-t border-white/[0.07] px-5 py-24 sm:px-8 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="section-title">
              A second set of eyes that understands the system.
            </h2>
            <p className="section-copy mx-auto mt-5">
              Review pull requests and scan existing codebases for bugs,
              vulnerabilities, dependency risks, and structural issues.
            </p>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            {featureItems.map((feature) => {
              const Icon = featureComponents[feature.key].icon
              const Diagram = featureComponents[feature.key].diagram

              return (
                <article
                  key={feature.title}
                  className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0b0b0d]"
                >
                  <Diagram />
                  <div className="border-t border-white/[0.07] p-6 sm:p-7">
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                      <Icon className="size-3.5 text-amber-400" />
                      {feature.label}
                    </div>
                    <h3 className="mt-5 text-xl font-medium tracking-[-0.035em] text-zinc-100">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-500">
                      {feature.description}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="border-y border-white/[0.07] bg-[#0b0b0c] px-5 py-24 sm:px-8 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="section-title mx-auto max-w-2xl">
              From pull request to better code.
            </h2>
          </div>

          <WorkflowDiagram />
        </div>
      </section>

      <section id="docs" className="px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="cta-panel relative overflow-hidden rounded-[28px]">
            <div className="cta-inner grid items-center gap-12 px-6 py-14 sm:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 lg:py-20">
              <div>
                <OwlMark className="size-14" />
                <h2 className="mt-7 max-w-2xl text-balance text-4xl font-medium leading-tight tracking-[-0.05em] text-white sm:text-5xl">
                  Give your next pull request a sharper review.
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                  Connect a repository and get your first Jargons review in
                  minutes. No credit card required.
                </p>
                <a
                  className="button-primary mt-9"
                  href={
                    installed
                      ? '/app/repositories'
                      : isSignedIn
                        ? '/auth/connect'
                        : '/auth/sign-up'
                  }
                >
                  <MarkGithubIcon size={18} />
                  {installed
                    ? 'Open your repositories'
                    : 'Install the GitHub app'}
                  <ArrowRight className="size-4" />
                </a>
              </div>

              <div className="cta-console overflow-hidden rounded-2xl border border-white/10 bg-[#09090c]">
                <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
                  <span className="size-2 rounded-full bg-red-400" />
                  <span className="size-2 rounded-full bg-amber-300" />
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="ml-auto font-mono text-[8px] text-zinc-600">
                    terminal
                  </span>
                </div>
                <div className="space-y-4 p-5 font-mono text-[10px] sm:p-7 sm:text-xs">
                  <p className="text-zinc-500">
                    <span className="text-cyan-300">$</span> jargons connect
                    acme/web-app
                  </p>
                  <p className="cta-line text-zinc-400">
                    <span className="text-emerald-300">✓</span> repository
                    connected
                  </p>
                  <p className="cta-line text-zinc-400">
                    <span className="text-emerald-300">✓</span> pull request
                    events enabled
                  </p>
                  <p className="cta-line text-amber-200">
                    <span className="text-violet-300">◆</span> ready for first
                    review_
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-5 pb-8 pt-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 pb-16 md:grid-cols-[1.8fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-5 max-w-xs text-sm leading-6 text-zinc-600">
                Thoughtful AI code review for teams that care about what they
                merge.
              </p>
            </div>

            {footerColumns.map((column) => (
              <FooterColumn key={column.title} {...column} />
            ))}
          </div>

          <div className="border-t border-white/[0.07] pt-7 text-[11px] text-zinc-700">
            <p>© 2026 Jargons, Inc.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly FooterLink[]
}) {
  return (
    <nav aria-label={`${title} links`}>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <a
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-200"
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
