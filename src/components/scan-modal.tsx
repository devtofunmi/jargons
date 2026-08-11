import {
  ArrowLeft,
  ArrowRight,
  Check,
  ScanSearch,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { getCodebaseScan } from '../server/scans'
import { OwlMark } from './owl-mark'

export type ScanModalRepo = { id: string; fullName: string }

type Step = 'list' | 'confirm' | 'scanning' | 'done' | 'error' | 'upgrade'

// Self-contained scan wizard: choose a repository, confirm, run the scan while
// polling for status, then view the result — all inside the modal. Shared by
// onboarding and the scans page.
export function ScanModal({
  open,
  onClose,
  repos,
  onScanStarted,
  initialRepo,
}: {
  open: boolean
  onClose: () => void
  repos: ScanModalRepo[]
  onScanStarted?: (scanId: string) => void
  // When set, the modal opens straight to the confirm step for this repo,
  // skipping the picker (used from a single repository's page).
  initialRepo?: ScanModalRepo
}) {
  const [step, setStep] = useState<Step>('list')
  const [selected, setSelected] = useState<ScanModalRepo | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [result, setResult] = useState<{ findingsCount: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Reset to a fresh state every time the modal opens.
  useEffect(() => {
    if (!open) return
    setStep(initialRepo ? 'confirm' : 'list')
    setSelected(initialRepo ?? null)
    setScanId(null)
    setResult(null)
    setErrorMsg(null)
    setQuery('')
  }, [open, initialRepo])

  // Lock page scroll while open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Poll scan status until it completes or fails.
  useEffect(() => {
    if (!open || step !== 'scanning' || !scanId) return
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
  }, [open, step, scanId])

  if (!open) return null

  function close() {
    if (step === 'scanning') return
    onClose()
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
        onScanStarted?.(id)
        setScanId(id)
        return
      }

      if (response.status === 402) {
        setStep('upgrade')
        return
      }

      setErrorMsg('Could not start the scan. Please try again.')
      setStep('error')
    } catch {
      setErrorMsg('Could not start the scan. Please try again.')
      setStep('error')
    }
  }

  const filtered = query.trim()
    ? repos.filter((repo) =>
        repo.fullName.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : repos

  const title =
    step === 'list'
      ? 'Choose a repository to scan'
      : step === 'confirm'
        ? 'Scan this repository?'
        : step === 'scanning'
          ? 'Scanning…'
          : step === 'done'
            ? 'Scan complete'
            : step === 'upgrade'
              ? 'Upgrade to keep scanning'
              : 'Scan failed'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-white/[0.1] bg-[#0c0c0f] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'confirm' && !initialRepo ? (
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200"
                onClick={() => setStep('list')}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>
            ) : null}
            <h2 className="text-lg font-medium tracking-[-0.03em]">{title}</h2>
          </div>
          {step !== 'scanning' ? (
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-200"
              onClick={close}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>

        {step === 'list' ? (
          <>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search repositories"
                className="w-full rounded-2xl border border-white/[0.1] bg-[#09090b] py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25"
              />
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
              {filtered.length > 0 ? (
                filtered.map((repo) => (
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
                ))
              ) : (
                <p className="px-1 py-8 text-center text-sm text-zinc-600">
                  {repos.length === 0
                    ? 'No repositories connected.'
                    : `No repositories match “${query}”.`}
                </p>
              )}
            </div>
          </>
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
              Jargons will scan this repository for bugs, security issues, and
              structural risks. This uses one agent run.
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
              View results
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : null}

        {step === 'upgrade' ? (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            <span className="grid size-16 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04]">
              <OwlMark className="size-9" />
            </span>
            <p className="mt-5 text-sm font-medium text-zinc-200">
              You&apos;re out of runs this month
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              You&apos;ve used all your Jargons runs for this month. See the
              plans to get more, or wait for the monthly reset.
            </p>
            <button
              type="button"
              className="button-primary mt-6 w-full justify-center"
              onClick={() => window.location.assign('/pricing')}
            >
              See plans
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
              onClick={() => setStep(initialRepo ? 'confirm' : 'list')}
            >
              {initialRepo ? 'Try again' : 'Back to repositories'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
