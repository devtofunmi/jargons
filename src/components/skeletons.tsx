import { OwlMark } from './owl-mark'

export function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.05] ${className}`} />
  )
}

export function AppPageSkeleton() {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="w-full max-w-2xl">
          <Bone className="h-3 w-32" />
          <Bone className="mt-4 h-12 w-full max-w-xl" />
          <Bone className="mt-4 h-4 w-full max-w-md" />
        </div>
        <Bone className="h-12 w-44 shrink-0 rounded-2xl" />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Bone key={index} className="h-28 rounded-[20px]" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Bone className="h-72 rounded-[20px]" />
        <Bone className="h-72 rounded-[20px]" />
      </div>
    </section>
  )
}

export function DetailPageSkeleton() {
  return (
    <section className="mx-auto max-w-7xl">
      <Bone className="h-4 w-36" />

      <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="w-full max-w-2xl">
          <Bone className="h-3 w-32" />
          <Bone className="mt-4 h-12 w-full max-w-xl" />
          <Bone className="mt-4 h-4 w-full max-w-sm" />
        </div>
        <Bone className="h-12 w-36 shrink-0 rounded-2xl" />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Bone key={index} className="h-24 rounded-[20px]" />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((index) => (
          <Bone key={index} className="h-24 rounded-[20px]" />
        ))}
      </div>
    </section>
  )
}

export function ListPageSkeleton() {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="w-full max-w-2xl">
          <Bone className="h-3 w-32" />
          <Bone className="mt-4 h-12 w-full max-w-xl" />
          <Bone className="mt-4 h-4 w-full max-w-md" />
        </div>
        <Bone className="h-12 w-52 shrink-0 rounded-2xl" />
      </div>

      <Bone className="mt-10 h-12 w-full rounded-2xl lg:max-w-md" />

      <div className="mt-6 space-y-4">
        {[0, 1, 2, 3].map((index) => (
          <Bone key={index} className="h-32 rounded-[20px]" />
        ))}
      </div>
    </section>
  )
}

export function AppShellSkeleton() {
  return (
    <main className="min-h-screen bg-[#0a0a0b]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/[0.07] bg-[#070708] p-5 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]">
            <OwlMark className="size-8" />
          </span>
          <Bone className="h-5 w-20" />
        </div>
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Bone key={index} className="h-11 rounded-xl" />
          ))}
        </div>
        <div className="mt-auto">
          <Bone className="h-16 rounded-2xl" />
        </div>
      </aside>

      <section className="lg:pl-72">
        <div className="px-5 py-8 sm:px-8 lg:py-10">
          <AppPageSkeleton />
        </div>
      </section>
    </main>
  )
}

// Mirrors the /admin shell: operator sidebar + the overview section, which is
// the default tab the loader resolves into.
export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <div className="flex flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-white/[0.07] bg-[#070708] px-5 py-6 sm:px-6 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div>
              <Bone className="h-2.5 w-16" />
              <Bone className="mt-2.5 h-6 w-20" />
            </div>
            <Bone className="h-4 w-12 lg:hidden" />
          </div>

          <nav className="mt-5 flex gap-1 lg:mt-8 lg:flex-col">
            {[0, 1, 2].map((index) => (
              <Bone key={index} className="h-11 w-28 shrink-0 lg:w-full" />
            ))}
          </nav>

          <Bone className="mt-8 hidden h-4 w-28 lg:block" />
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <Bone key={index} className="h-28 rounded-[22px]" />
            ))}
          </div>

          <Bone className="mt-6 h-96 rounded-[22px]" />

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Bone className="h-72 rounded-[22px]" />
            <Bone className="h-72 rounded-[22px]" />
          </div>
        </main>
      </div>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080809]">
      <div className="animate-pulse">
        <OwlMark className="size-14" />
      </div>
    </main>
  )
}
