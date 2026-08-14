import { ExternalLink, GitPullRequest, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

// Per-issue "open a fix PR" button. The caller supplies the action, so this
// stays reusable. On success it links to the opened PR; on failure it just
// returns to idle so the user can retry (no error banner). While the PR is
// being opened it shows a full-screen overlay animation.
export function IssueFixPrButton({
  onOpen,
}: {
  onOpen: () => Promise<{ url: string | null }>
}) {
  const [state, setState] = useState<'idle' | 'opening' | 'done'>('idle')
  const [url, setUrl] = useState<string | null>(null)

  async function open() {
    setState('opening')
    try {
      const result = await onOpen()
      if (result.url) {
        setUrl(result.url)
        setState('done')
        return
      }
    } catch {
      // fall through
    }
    // On failure just return to idle so the user can retry — no error banner.
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

// The diff "materializing" rows: sign + a shimmer bar of a fixed width.
const DIFF_ROWS: Array<{ sign: string; tone: string; width: string }> = [
  { sign: '-', tone: 'text-red-300', width: '72%' },
  { sign: '+', tone: 'text-emerald-300', width: '88%' },
  { sign: '+', tone: 'text-emerald-300', width: '54%' },
  { sign: ' ', tone: 'text-zinc-600', width: '40%' },
]

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
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-[28px] border border-white/[0.1] bg-[#0c0c0f] p-8 text-center animate-[reveal_0.35s_ease-out]">
        <div className="relative mx-auto grid size-24 place-items-center">
          <span className="absolute size-full animate-ping rounded-full bg-amber-400/10" />
          <span className="absolute size-2/3 animate-ping rounded-full bg-amber-400/20 [animation-delay:500ms]" />
          <span
            className="absolute size-20 animate-spin rounded-full [animation-duration:2.4s]"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.55) 300deg, transparent 360deg)',
            }}
          />
          <span className="absolute size-20 rounded-full border border-white/[0.08]" />
          <span className="relative grid size-14 place-items-center rounded-full border border-amber-300/40 bg-[#0c0c0f] text-amber-300">
            <GitPullRequest className="size-6" />
          </span>
        </div>

        <p className="mt-7 text-lg font-medium tracking-[-0.02em] text-zinc-100">
          Opening a fix PR
        </p>
        <p
          key={phase}
          className="mx-auto mt-2 flex h-5 animate-[reveal_0.4s_ease-out] items-center justify-center font-mono text-xs text-amber-300/80"
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

        <div className="mt-6 space-y-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b] p-4 text-left">
          {DIFF_ROWS.map((row, index) => (
            <div
              key={index}
              className="flex animate-[reveal_0.5s_ease-out] items-center gap-2.5"
              style={{ animationDelay: `${index * 180}ms` }}
            >
              <span className={`w-2 font-mono text-xs ${row.tone}`}>
                {row.sign}
              </span>
              <span
                className="h-2 animate-pulse rounded-full bg-white/[0.08]"
                style={{ width: row.width }}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-amber-400/40 to-amber-300 animate-[progress-run_1.8s_ease-in-out_infinite]" />
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          This can take up to a minute.
        </p>
      </div>
    </div>
  )
}
