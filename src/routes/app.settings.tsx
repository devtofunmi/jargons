import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  Check,
  GitPullRequest,
  KeyRound,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useState } from 'react'

import { GitHubAppInstallButton } from '../components/github-app-install-button'
import { AppPageSkeleton } from '../components/skeletons'
import { deleteAccount } from '../server/account'
import {
  getWorkspaceSettings,
  updateReviewPreferences,
} from '../server/workspace'

export const Route = createFileRoute('/app/settings')({
  pendingComponent: AppPageSkeleton,
  loader: async () => {
    const settings = await getWorkspaceSettings()

    if (!settings) {
      throw redirect({ to: '/auth/sign-in', search: { error: undefined } })
    }

    return settings
  },
  component: WorkspaceSettingsPage,
})

type PreferenceKey =
  | 'reviewPullRequests'
  | 'reviewSecurity'
  | 'reviewCodebaseScans'

const reviewPreferenceItems: Array<{
  key: PreferenceKey
  title: string
  description: string
  icon: typeof GitPullRequest
}> = [
  {
    key: 'reviewPullRequests',
    title: 'Pull request reviews',
    description:
      'Run Jargons automatically on opened and updated pull requests.',
    icon: GitPullRequest,
  },
  {
    key: 'reviewSecurity',
    title: 'Security findings',
    description:
      'Surface vulnerabilities, unsafe auth flows, and risky secrets.',
    icon: ShieldCheck,
  },
  {
    key: 'reviewCodebaseScans',
    title: 'Codebase scans',
    description: 'Scan connected repositories for bugs and structural issues.',
    icon: ScanSearch,
  },
]

function WorkspaceSettingsPage() {
  const settings = Route.useLoaderData()
  const [preferences, setPreferences] = useState(settings.preferences)
  const [savedPreferences, setSavedPreferences] = useState(
    settings.preferences,
  )
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'error'>(
    'idle',
  )

  // Require the user to type their exact GitHub username before the delete
  // button is enabled — a deliberate, hard-to-fat-finger confirmation.
  const confirmPhrase = settings.owner.username
  const canDelete =
    confirmText.trim() === confirmPhrase && deleteState !== 'deleting'

  async function deleteAccountAndSignOut() {
    setDeleteState('deleting')

    try {
      await deleteAccount()
      // Full reload so all in-memory router/query state is dropped and the
      // (now signed-out) landing page loads fresh.
      window.location.assign('/')
    } catch {
      setDeleteState('error')
    }
  }

  const isDirty =
    preferences.reviewPullRequests !== savedPreferences.reviewPullRequests ||
    preferences.reviewSecurity !== savedPreferences.reviewSecurity ||
    preferences.reviewCodebaseScans !== savedPreferences.reviewCodebaseScans

  async function saveChanges() {
    setSaveState('saving')

    try {
      await updateReviewPreferences({ data: preferences })
      setSavedPreferences(preferences)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
            workspace settings
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            Manage how Jargons reviews your code.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
            Configure repository access, review behavior, and team permissions
            for your workspace.
          </p>
        </div>
        <button
          className="button-primary self-start disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saveState === 'saving' || (!isDirty && saveState !== 'error')}
          onClick={() => {
            void saveChanges()
          }}
        >
          {saveState === 'saving' ? (
            <>
              Saving...
              <LoaderCircle className="size-4 animate-spin" />
            </>
          ) : saveState === 'error' ? (
            'Retry save'
          ) : !isDirty && saveState === 'saved' ? (
            <>
              Saved
              <Check className="size-4" />
            </>
          ) : (
            <>
              Save changes
              <Check className="size-4" />
            </>
          )}
        </button>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-amber-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">
              Workspace
            </h2>
          </div>

          <div className="mt-6 grid gap-4">
            <SettingsField
              label="Workspace name"
              value={settings.workspace.name}
            />
            <SettingsField
              label="GitHub account"
              value={`github.com/${
                settings.installation?.accountLogin ?? settings.workspace.slug
              }`}
            />
            <SettingsField
              label="Connected repositories"
              value={String(settings.repositoryCount)}
            />
          </div>
        </article>

        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-cyan-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">
              Review preferences
            </h2>
          </div>

          <div className="mt-6 space-y-3">
            {reviewPreferenceItems.map((preference) => {
              const Icon = preference.icon
              const enabled = preferences[preference.key]

              return (
                <div
                  key={preference.key}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#09090b] p-4"
                >
                  <span className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-amber-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-200">
                      {preference.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-zinc-600">
                      {preference.description}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`relative h-6 w-11 rounded-full border transition-colors ${
                      enabled
                        ? 'border-amber-300/30 bg-amber-300'
                        : 'border-white/[0.08] bg-white/[0.04]'
                    }`}
                    onClick={() => {
                      setPreferences((current) => ({
                        ...current,
                        [preference.key]: !current[preference.key],
                      }))
                      setSaveState('idle')
                    }}
                    aria-label={`Toggle ${preference.title}`}
                    aria-pressed={enabled}
                  >
                    <span
                      className={`absolute top-1 size-4 rounded-full bg-zinc-950 transition-transform ${
                        enabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-violet-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">Members</h2>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07]">
            <div className="grid gap-3 bg-[#09090b] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-center gap-3">
                {settings.owner.avatarUrl ? (
                  <img
                    alt={settings.owner.username}
                    className="size-10 rounded-full border border-white/10"
                    src={settings.owner.avatarUrl}
                  />
                ) : null}
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {settings.owner.name}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    {settings.owner.email ?? `@${settings.owner.username}`}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 font-mono text-[9px] text-zinc-400">
                Owner
              </span>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Team invites are coming soon. For now, the workspace belongs to the
            GitHub account that signed in.
          </p>
        </article>

        <article className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-4 text-emerald-300" />
            <h2 className="text-lg font-medium tracking-[-0.03em]">
              GitHub app
            </h2>
          </div>

          {settings.installation ? (
            <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-5">
              <p className="font-mono text-[10px] text-emerald-300">
                installation {settings.installation.status}
              </p>
              <h3 className="mt-4 text-xl font-medium tracking-[-0.035em] text-zinc-100">
                {settings.installation.accountLogin} connected
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Jargons can read pull request diffs, create review comments,
                and run codebase scans for {settings.repositoryCount} selected{' '}
                {settings.repositoryCount === 1 ? 'repository' : 'repositories'}
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <GitHubAppInstallButton
                  className="button-secondary"
                  label="Manage on GitHub"
                />
                <Link className="button-secondary" to="/app/repositories">
                  View repositories
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-5">
              <p className="font-mono text-[10px] text-amber-300">
                no installation
              </p>
              <h3 className="mt-4 text-xl font-medium tracking-[-0.035em] text-zinc-100">
                Connect your GitHub account
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Install the Jargons GitHub App to sync repositories and start
                reviewing pull requests.
              </p>
              <GitHubAppInstallButton
                className="button-primary mt-6"
                label="Install GitHub app"
              />
            </div>
          )}
        </article>
      </div>

      <article className="app-card mt-6 border-red-500/25 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-red-400" />
          <h2 className="text-lg font-medium tracking-[-0.03em]">Danger zone</h2>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
          Deleting your account permanently removes your workspace, connected
          repositories, pull request reviews, findings, and codebase scans, and
          uninstalls the Jargons GitHub App from your account. This cannot be
          undone.
        </p>

        {!confirmOpen ? (
          <button
            type="button"
            className="button-secondary mt-6 border-red-500/30 text-red-300 hover:bg-red-500/10"
            onClick={() => {
              setConfirmOpen(true)
              setDeleteState('idle')
            }}
          >
            Delete account
            <Trash2 className="size-4" />
          </button>
        ) : (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
            <label className="block">
              <span className="text-sm text-zinc-400">
                Type{' '}
                <span className="font-mono font-semibold text-zinc-200">
                  {confirmPhrase}
                </span>{' '}
                to confirm.
              </span>
              <input
                type="text"
                autoComplete="off"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="mt-3 block w-full rounded-2xl border border-white/[0.1] bg-[#09090b] px-4 py-3 font-mono text-sm text-zinc-200 outline-none focus:border-red-500/40"
                placeholder={confirmPhrase}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="button-primary border-red-500/40 bg-red-500 text-white hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canDelete}
                onClick={() => {
                  void deleteAccountAndSignOut()
                }}
              >
                {deleteState === 'deleting' ? (
                  <>
                    Deleting...
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Permanently delete account
                    <Trash2 className="size-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                className="button-secondary disabled:opacity-50"
                disabled={deleteState === 'deleting'}
                onClick={() => {
                  setConfirmOpen(false)
                  setConfirmText('')
                  setDeleteState('idle')
                }}
              >
                Cancel
              </button>
            </div>

            {deleteState === 'error' ? (
              <p className="mt-3 text-sm text-red-400">
                Couldn&apos;t delete your account. Please try again.
              </p>
            ) : null}
          </div>
        )}
      </article>
    </section>
  )
}

function SettingsField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-700">
        {label}
      </span>
      <span className="mt-2 block rounded-2xl border border-white/[0.07] bg-[#09090b] px-4 py-3 text-sm text-zinc-300">
        {value}
      </span>
    </label>
  )
}
