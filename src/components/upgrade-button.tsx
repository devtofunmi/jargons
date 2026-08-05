import { ArrowRight, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

// Starts a Bachs checkout for the current workspace and redirects to it.
export function UpgradeButton({ className }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function upgrade() {
    setState('loading')
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { url?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through to the error state
    }
    setState('error')
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        className={`${
          className ?? 'button-primary shrink-0 justify-center'
        } disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={state === 'loading'}
        onClick={() => {
          void upgrade()
        }}
      >
        {state === 'loading' ? (
          <>
            Redirecting...
            <LoaderCircle className="size-4 animate-spin" />
          </>
        ) : (
          <>
            {state === 'error' ? 'Try again' : 'Upgrade to Pro'}
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
      {state === 'error' ? (
        <p className="font-mono text-[10px] text-red-300">
          Couldn&rsquo;t start checkout — try again.
        </p>
      ) : null}
    </div>
  )
}
