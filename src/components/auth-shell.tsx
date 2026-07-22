import { Link } from '@tanstack/react-router'

import { authSteps } from '../data/auth'
import { OwlMark } from './owl-mark'

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: React.ReactNode
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <main className="auth-stage min-h-screen bg-[#070708] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]">
            <OwlMark className="size-8" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.04em]">
            jargons
          </span>
        </Link>
        <Link className="nav-link" to="/">
          Back home
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-medium leading-tight tracking-[-0.055em] text-white sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-zinc-500 sm:text-base">
            {description}
          </p>

          <div className="mt-10 space-y-4">
            {authSteps.map((step) => (
              <article
                key={step.label}
                className="rounded-2xl border border-white/[0.07] bg-[#0d0d10] p-4"
              >
                <div className="flex gap-4">
                  <span className="font-mono text-[10px] text-amber-300">
                    {step.label}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-200">
                      {step.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="auth-card mx-auto w-full max-w-xl rounded-[28px] border border-white/[0.08] bg-[#0c0c0f] p-5 sm:p-7">
          {children}
        </div>
      </section>
    </main>
  )
}
