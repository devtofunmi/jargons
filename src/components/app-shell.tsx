import { Link } from '@tanstack/react-router'
import { MarkGithubIcon } from '@primer/octicons-react'
import {
  Activity,
  ChevronDown,
  GitPullRequest,
  LogOut,
  Menu,
  ScanSearch,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { appNavItems } from '../data/app-shell'
import { signOut } from '../server/github-auth'
import type { CurrentUser } from '../server/github-auth'
import { OwlMark } from './owl-mark'

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: CurrentUser | null
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070708]/90 px-5 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <Brand />
          <button
            className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 transition lg:hidden ${
          mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            className="size-full"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
        </div>
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col border-r border-white/[0.07] bg-[#070708] p-5 transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <button
              className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
          <ProfileMenu
            open={profileOpen}
            user={user}
            onToggle={() => setProfileOpen((current) => !current)}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </aside>
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/[0.07] bg-[#070708] p-5 lg:flex">
        <Brand />
        <SidebarNav />
        <ProfileMenu
          open={profileOpen}
          user={user}
          onToggle={() => setProfileOpen((current) => !current)}
        />
      </aside>

      <section className="lg:pl-72">
        <div className="px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      </section>
    </main>
  )
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]">
        <OwlMark className="size-8" />
      </span>
      <span className="text-[19px] font-semibold tracking-[-0.04em]">
        jargons
      </span>
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-8 space-y-1" aria-label="Application navigation">
      {appNavItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className="app-nav-link"
          activeProps={{ className: 'app-nav-link app-nav-link-active' }}
          activeOptions={{ exact: item.href === '/app' }}
          onClick={onNavigate}
        >
          {item.label === 'Dashboard' ? (
            <Search className="size-4" />
          ) : item.label === 'Repositories' ? (
            <MarkGithubIcon size={16} />
          ) : item.label === 'Scans' ? (
            <ScanSearch className="size-4" />
          ) : item.label === 'Agent Health' ? (
            <Activity className="size-4" />
          ) : (
            <GitPullRequest className="size-4" />
          )}
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

function ProfileMenu({
  open,
  user,
  onToggle,
  onNavigate,
}: {
  open: boolean
  user: CurrentUser | null
  onToggle: () => void
  onNavigate?: () => void
}) {
  const displayName = user?.name ?? 'Signed out'
  const workspaceName =
    user?.workspace?.name ?? user?.username ?? 'Connect GitHub'
  const avatarUrl =
    user?.avatarUrl ??
    `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(
      user?.username ?? 'jargons',
    )}`

  return (
    <div className="absolute bottom-5 left-5 right-5">
      <div className="relative">
        {open ? (
          <div
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 rounded-2xl border border-white/[0.08] bg-[#0d0d10] p-2"
            role="menu"
          >
            <Link
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              to="/app/settings"
              role="menuitem"
              onClick={onNavigate}
            >
              <Settings className="size-4" />
              Workspace settings
            </Link>
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              role="menuitem"
              type="button"
              onClick={() => {
                onNavigate?.()
                void signOut().then(() => {
                  window.location.assign('/auth/sign-in')
                })
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        ) : null}

        <button
          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 text-left transition-colors hover:bg-white/[0.06]"
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <img
            className="size-10 rounded-xl object-cover"
            src={avatarUrl}
            alt={displayName}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {displayName}
            </span>
            <span className="block truncate font-mono text-[10px] text-zinc-600">
              {workspaceName}
            </span>
          </span>
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
      </div>
    </div>
  )
}
