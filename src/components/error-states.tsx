import { Link } from '@tanstack/react-router'

import { OwlMark } from './owl-mark'

function ErrorShell({
  eyebrow,
  title,
  message,
  showRetry = false,
}: {
  eyebrow: string
  title: string
  message: string
  showRetry?: boolean
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070708] px-5 py-16 text-white">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/10 bg-[#111113]">
          <OwlMark className="size-8" />
        </span>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-500">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {showRetry ? (
            <>
              <button
                type="button"
                className="button-primary"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              <Link className="button-secondary" to="/">
                Back home
              </Link>
            </>
          ) : (
            <>
              <Link className="button-primary" to="/">
                Back home
              </Link>
              <Link className="button-secondary" to="/app">
                Go to dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export function RootNotFound() {
  return (
    <ErrorShell
      eyebrow="404"
      title="Page not found"
      message="This page doesn't exist, or the review, scan, or repository you're looking for isn't in your workspace."
    />
  )
}

// Heuristic: does this error look like a transient infrastructure/connectivity
// problem (database unreachable, upstream timeout) rather than a bug? We only
// inspect the message to pick the copy — it is never shown to the user.
function looksLikeServiceOutage(error: Error): boolean {
  const text = `${error.name} ${error.message}`.toLowerCase()
  return (
    text.includes('failed query') ||
    text.includes('etimedout') ||
    text.includes('econnrefused') ||
    text.includes('connect_timeout') ||
    text.includes('connection') ||
    text.includes('timeout') ||
    text.includes('fetch failed') ||
    text.includes('econnreset')
  )
}

export function RootErrorComponent({ error }: { error: Error }) {
  // Log the real error for debugging (server console during SSR, browser
  // console on the client). It is NEVER rendered — messages can contain raw
  // SQL, query params, or session tokens (e.g. a failed database query).
  console.error('Root error boundary:', error)

  const isServiceIssue = looksLikeServiceOutage(error)

  return (
    <ErrorShell
      eyebrow={isServiceIssue ? 'temporarily unavailable' : 'error'}
      title={
        isServiceIssue
          ? 'Service temporarily unavailable'
          : 'Something went wrong'
      }
      message={
        isServiceIssue
          ? "We can't reach our systems right now. This is usually brief — please try again in a moment."
          : 'We hit an unexpected error. Please try again, or head back and start over.'
      }
      showRetry
    />
  )
}
