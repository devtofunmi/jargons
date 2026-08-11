import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { OwlMark } from './owl-mark'

// Shared layout for the public content pages (privacy, terms, docs): a brand
// header, a titled body, and a compact footer with the same links.
export function ContentShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <main className="min-h-dvh bg-[#080809] text-white">
      <header className="border-b border-white/[0.07] px-5 sm:px-8">
        <div className="mx-auto flex h-[72px] max-w-4xl items-center justify-between gap-4">
          <a
            href="/"
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
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to home</span>
            <span className="sm:hidden">Home</span>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            {description}
          </p>
        ) : null}
        <div className="mt-14 space-y-12">{children}</div>
      </section>

      <footer className="border-t border-white/[0.07] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 text-[11px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Jargons, Inc.</p>
          <div className="flex items-center gap-5">
            <a
              href="/privacy"
              className="transition-colors hover:text-zinc-300"
            >
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-zinc-300">
              Terms
            </a>
            <a href="/docs" className="transition-colors hover:text-zinc-300">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

// A titled prose block used within a ContentShell.
export function ContentSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-medium tracking-[-0.03em] text-zinc-100">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-400">
        {children}
      </div>
    </section>
  )
}
