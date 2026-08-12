import { Link } from '@tanstack/react-router'

import { OwlMark } from './owl-mark'

function ErrorShell({
  eyebrow,
  title,
  message,
}: {
  eyebrow: string
  title: string
  message: string
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
          <Link className="button-primary" to="/">
            Back home
          </Link>
          <Link className="button-secondary" to="/app">
            Go to dashboard
          </Link>
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

export function RootErrorComponent({ error }: { error: Error }) {
  return (
    <ErrorShell
      eyebrow="error"
      title="Something went wrong"
      message={
        error.message
          ? `We hit an unexpected error: ${error.message}`
          : 'We hit an unexpected error. Please try again.'
      }
    />
  )
}
