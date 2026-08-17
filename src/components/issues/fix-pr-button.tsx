import { ExternalLink, GitPullRequest, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { OwlMark } from '../owl-mark'

// Per-issue "open a fix PR" button. The caller supplies the action, so this
// stays reusable. On success it links to the opened PR; on failure it shows the
// reason and returns to idle so the user can retry. While the PR is being
// opened it shows a full-screen overlay animation.
export function IssueFixPrButton({
  onOpen,
}: {
  onOpen: () => Promise<{ url: string | null; reason?: string }>
}) {
  const [state, setState] = useState<'idle' | 'opening' | 'done'>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setState('opening')
    setError(null)
    try {
      const result = await onOpen()
      if (result.url) {
        setUrl(result.url)
        setState('done')
        return
      }
      // A null url with no reason means the caller already handled it by
      // navigating away (e.g. to /pricing when the plan is used up), so there
      // is nothing to report here.
      setError(result.reason ?? null)
    } catch {
      setError('Could not open the fix PR. Please try again.')
    }
    // Back to idle either way, so the button stays available for a retry.
    setState('idle')
  }

  if (state === 'done' && url) {
    return (
      <a className="button-primary" href={url} target="_blank" rel="noreferrer">
        View fix PR
        <ExternalLink className="size-4" />
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state === 'opening'}
        onClick={() => void open()}
      >
        {state === 'opening' ? (
          <>
            Opening fix PR…
            <LoaderCircle className="size-4 animate-spin" />
          </>
        ) : (
          <>
            Open fix PR for this issue
            <GitPullRequest className="size-4" />
          </>
        )}
      </button>
      {error ? (
        <p className="mt-3 font-mono text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {state === 'opening' ? <FixPrOverlay /> : null}
    </>
  )
}

const PHASES = [
  'Reading the finding',
  'Generating a fix with Jargons',
  'Committing the change',
  'Opening the pull request',
]

const CODE_LINES: Array<{ n: number; kind: 'ctx' | 'del' | 'add'; w: string }> =
  [
    { n: 66, kind: 'ctx', w: '58%' },
    { n: 67, kind: 'ctx', w: '44%' },
    { n: 68, kind: 'del', w: '74%' },
    { n: 68, kind: 'add', w: '82%' },
    { n: 69, kind: 'add', w: '52%' },
    { n: 70, kind: 'ctx', w: '38%' },
  ]

// Full-screen, on-brand loading state: an animated code-diff editor with an
// amber review beam sweeping down it, on the app's dark background (no modal).
function FixPrOverlay() {
  const [phase, setPhase] = useState(0)

  // Advance through the stages (we don't get live progress from the one call,
  // so this paces to roughly match the real backend steps), holding on the last.
  useEffect(() => {
    const id = setInterval(
      () => setPhase((current) => Math.min(current + 1, PHASES.length - 1)),
      2600,
    )
    return () => clearInterval(id)
  }, [])

  // Lock page scroll while the overlay is up.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070708] px-6 text-center animate-[reveal_0.4s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <OwlMark className="size-6" />
        <span className="text-sm font-semibold tracking-[-0.03em] text-zinc-300">
          jargons
        </span>
      </div>

      <div className="relative mt-8 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b0b0e] text-left shadow-2xl shadow-black/50">
        <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/40" />
          <span className="size-2.5 rounded-full bg-amber-400/50" />
          <span className="size-2.5 rounded-full bg-emerald-400/40" />
          <span className="ml-2 font-mono text-[10px] text-zinc-600">
            applying fix
          </span>
        </div>

        <div className="space-y-1.5 p-5">
          {CODE_LINES.map((line, index) => (
            <div
              key={index}
              className={`flex animate-[terminal-line_2.2s_ease-in-out_infinite] items-center gap-3 rounded px-2 py-0.5 ${
                line.kind === 'del'
                  ? 'bg-red-500/[0.06]'
                  : line.kind === 'add'
                    ? 'bg-emerald-500/[0.06]'
                    : ''
              }`}
              style={{ animationDelay: `${index * 220}ms` }}
            >
              <span className="w-4 text-right font-mono text-[10px] text-zinc-700">
                {line.n}
              </span>
              <span
                className={`w-2 text-center font-mono text-[11px] ${
                  line.kind === 'del'
                    ? 'text-red-400'
                    : line.kind === 'add'
                      ? 'text-emerald-400'
                      : 'text-zinc-700'
                }`}
              >
                {line.kind === 'del' ? '-' : line.kind === 'add' ? '+' : '·'}
              </span>
              <span
                className={`h-2 rounded-full ${
                  line.kind === 'del'
                    ? 'bg-red-400/25'
                    : line.kind === 'add'
                      ? 'bg-emerald-400/30'
                      : 'bg-white/[0.08]'
                }`}
                style={{ width: line.w }}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-lg font-medium tracking-[-0.02em] text-zinc-100">
        Opening a fix PR
      </p>
      <p
        key={phase}
        className="mt-2 flex h-5 animate-[reveal_0.4s_ease-out] items-center font-mono text-xs text-amber-300/80"
      >
        {PHASES[phase]}
        <span className="ml-0.5 inline-flex">
          <span className="animate-[soft-blink_1.4s_infinite]">.</span>
          <span className="animate-[soft-blink_1.4s_infinite] [animation-delay:200ms]">
            .
          </span>
          <span className="animate-[soft-blink_1.4s_infinite] [animation-delay:400ms]">
            .
          </span>
        </span>
      </p>

      <div className="mt-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-amber-400/40 to-amber-300 animate-[progress-run_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}
