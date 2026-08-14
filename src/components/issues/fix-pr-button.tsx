import { ExternalLink, GitPullRequest, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

// Per-issue "open a fix PR" button. The caller supplies the action, so this
// stays reusable. On success it links to the opened PR; on failure it just
// returns to idle so the user can retry (no error banner).
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
  )
}
