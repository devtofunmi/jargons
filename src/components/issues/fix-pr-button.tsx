import { ExternalLink, GitPullRequest, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

// Per-issue "open a fix PR" button. The caller supplies the action (a mock
// now; a real per-issue endpoint once the DB is back), so this component stays
// reusable across the mockup and the wired-up flow.
export function IssueFixPrButton({
  onOpen,
}: {
  onOpen: () => Promise<{ url: string | null }>
}) {
  const [state, setState] = useState<'idle' | 'opening' | 'done' | 'error'>(
    'idle',
  )
  const [url, setUrl] = useState<string | null>(null)

  async function open() {
    setState('opening')
    try {
      const result = await onOpen()
      if (result.url) {
        setUrl(result.url)
        setState('done')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
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
    <div className="flex flex-col items-start gap-2">
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
      {state === 'error' ? (
        <p className="font-mono text-[10px] text-red-300">
          Couldn&apos;t open a fix PR. Please try again.
        </p>
      ) : null}
    </div>
  )
}
