import { useRouter } from '@tanstack/react-router'
import { Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'

import { timeAgo } from '../../lib/format'
import type { AdminUserRow } from '../../server/admin'

// Every user with their workspace plan + usage, and an inline plan toggle.
export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  return (
    <article className="app-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <UsersIcon className="size-4 text-cyan-300" />
        <h2 className="text-lg font-medium tracking-[-0.03em]">
          Users ({users.length})
        </h2>
      </div>

      <div className="mt-5 overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
              <th className="py-2 pr-4 font-normal">User</th>
              <th className="py-2 pr-4 font-normal">Plan</th>
              <th className="py-2 pr-4 text-right font-normal">Runs</th>
              <th className="py-2 pr-4 text-right font-normal">Repos</th>
              <th className="py-2 pr-4 text-right font-normal">Reviews</th>
              <th className="py-2 pr-4 text-right font-normal">Scans</th>
              <th className="py-2 pr-4 font-normal">Joined</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.userId}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="size-8 rounded-full border border-white/10"
                      />
                    ) : (
                      <span className="size-8 rounded-full bg-white/[0.06]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">
                        {user.username}
                      </p>
                      <p className="truncate font-mono text-[10px] text-zinc-600">
                        {user.email ?? 'no email'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <PlanBadge plan={user.plan} />
                </td>
                <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                  {user.runsUsed}
                  {user.bonusRuns > 0 ? (
                    <span
                      className="ml-1 text-[10px] text-cyan-300/80"
                      title="Operator-granted bonus runs"
                    >
                      +{user.bonusRuns}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                  {user.repos}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                  {user.reviews}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-zinc-400">
                  {user.scans}
                </td>
                <td className="py-3 pr-4 font-mono text-[11px] text-zinc-500">
                  {timeAgo(user.createdAt)}
                </td>
                <td className="py-3">
                  {user.workspaceId && user.plan ? (
                    <div className="flex items-center justify-end gap-2">
                      {user.plan === 'free' ? (
                        <RunsGrant workspaceId={user.workspaceId} />
                      ) : null}
                      <PlanToggle
                        workspaceId={user.workspaceId}
                        plan={user.plan}
                      />
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-zinc-600">
                      no workspace
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function PlanBadge({ plan }: { plan: 'free' | 'pro' | null }) {
  if (plan === 'pro') {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/[0.1] px-2.5 py-1 font-mono text-[10px] uppercase text-amber-300">
        pro
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase text-zinc-500">
      {plan ?? 'none'}
    </span>
  )
}

function PlanToggle({
  workspaceId,
  plan,
}: {
  workspaceId: string
  plan: 'free' | 'pro'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const next = plan === 'pro' ? 'free' : 'pro'

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/set-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId, plan: next }),
      })
      if (res.ok) {
        await router.invalidate()
      }
    } catch {
      // ignore — the button re-enables and the operator can retry
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={busy}
      onClick={() => void toggle()}
    >
      {busy ? '…' : next === 'pro' ? 'Make Pro' : 'Make Free'}
    </button>
  )
}

// Grant a free workspace one-time bonus runs for its current window.
function RunsGrant({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [runs, setRuns] = useState(5)
  const [busy, setBusy] = useState(false)

  async function grant() {
    if (busy || runs < 1) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/add-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId, runs }),
      })
      if (res.ok) {
        await router.invalidate()
      }
    } catch {
      // ignore — the control re-enables and the operator can retry
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.03]">
      <input
        type="number"
        min={1}
        max={1000}
        value={runs}
        onChange={(event) =>
          setRuns(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))
        }
        aria-label="Runs to grant"
        className="w-11 bg-transparent px-2 py-1.5 text-right font-mono text-[11px] text-zinc-200 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="border-l border-white/[0.1] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-cyan-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={() => void grant()}
      >
        {busy ? '…' : '+ runs'}
      </button>
    </div>
  )
}
