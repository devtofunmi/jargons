// Operator/admin surface: platform-wide analytics and light user management.
// This exposes EVERY workspace's data, so access is gated server-side on every
// call (never trust the UI). Admin access is granted via the users.is_admin
// flag on a user's own row — never a mutable username or a hardcoded id.

import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../db/load'
import { PRO_PRICE_USD } from '../lib/plans'
import { getCurrentUserFromCookie } from './github-auth'
import type { CurrentUser } from './github-auth'

/** True if the signed-in user has the is_admin flag set on their row. */
export async function isAdmin(user: CurrentUser): Promise<boolean> {
  const { eq, db, users } = await loadDb()
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  return rows.length > 0 && rows[0].isAdmin
}

/** Throws unless the signed-in user is an admin. Returns the admin user. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUserFromCookie()
  if (!user || !(await isAdmin(user))) {
    throw new Error('forbidden')
  }
  return user
}

// Used by the route's beforeLoad to gate access (returns null instead of
// throwing so the route can redirect cleanly).
export const getAdminContext = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ username: string } | null> => {
    const user = await getCurrentUserFromCookie()
    if (!user || !(await isAdmin(user))) {
      return null
    }
    return { username: user.username }
  },
)

export type AdminOverview = {
  totals: {
    users: number
    workspaces: number
    pro: number
    free: number
    mrrUsd: number
    reviews: number
    scans: number
    findings: number
    landingViews: number
    // Operator-only LLM cost telemetry. Deliberately exposed here and nowhere
    // else: workspaces see their run quota, not what a run costs to serve.
    llmTokens: number
    llmCostUsd: number
    // Estimated spend per agent run, the number to read against the ~$0.20 of
    // revenue a Pro run earns. Null until there has been at least one run.
    costPerRunUsd: number | null
  }
  trends: Array<{
    month: string
    signups: number
    reviews: number
    scans: number
  }>
  countries: Array<{ country: string; count: number }>
  viewsByDay: Array<{ day: string; count: number }>
  recent: Array<{
    type: 'review' | 'scan'
    repository: string
    workspace: string
    status: string
    at: string
  }>
}

function lastMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(
      `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`,
    )
  }
  return out
}

export const getAdminOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminOverview> => {
    await requireAdmin()
    const { sqlClient } = await loadDb()

    const [
      totals,
      signups,
      reviewsByMonth,
      scansByMonth,
      countries,
      byDay,
      recent,
    ] = await Promise.all([
      sqlClient`
          select
            (select count(*)::int from users) as users,
            (select count(*)::int from workspaces) as workspaces,
            (select count(*)::int from workspaces where plan = 'pro') as pro,
            (select count(*)::int from review_runs) as reviews,
            (select count(*)::int from codebase_scans) as scans,
            (select count(*)::int from findings) as findings,
            (select count(*)::int from page_views) as views,
            (
              (select coalesce(sum(input_tokens + output_tokens), 0) from review_runs)
              + (select coalesce(sum(input_tokens + output_tokens), 0) from codebase_scans)
            )::bigint as llm_tokens,
            (
              (select coalesce(sum(cost_usd), 0) from review_runs)
              + (select coalesce(sum(cost_usd), 0) from codebase_scans)
            )::float8 as llm_cost`,
      sqlClient`
          select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count
          from users where created_at > now() - interval '12 months'
          group by 1`,
      sqlClient`
          select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count
          from review_runs where created_at > now() - interval '12 months'
          group by 1`,
      sqlClient`
          select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count
          from codebase_scans where created_at > now() - interval '12 months'
          group by 1`,
      sqlClient`
          select coalesce(country, '??') as country, count(*)::int as count
          from page_views group by 1 order by count desc limit 8`,
      sqlClient`
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as count
          from page_views where created_at > now() - interval '30 days'
          group by 1 order by 1`,
      sqlClient`
          (select 'review' as type, r.owner || '/' || r.name as repository, w.slug as workspace,
                  rr.status::text as status, rr.created_at as at
             from review_runs rr
             join pull_requests pr on pr.id = rr.pull_request_id
             join repositories r on r.id = pr.repository_id
             join workspaces w on w.id = r.workspace_id)
          union all
          (select 'scan' as type, r.owner || '/' || r.name as repository, w.slug as workspace,
                  cs.status::text as status, cs.created_at as at
             from codebase_scans cs
             join repositories r on r.id = cs.repository_id
             join workspaces w on w.id = r.workspace_id)
          order by at desc limit 12`,
    ])

    const t = totals[0]
    const pro = Number(t.pro ?? 0)
    const workspaces = Number(t.workspaces ?? 0)
    // sum() over bigint comes back as a string from postgres-js.
    const llmTokens = Number(t.llm_tokens ?? 0)
    const llmCostUsd = Number(t.llm_cost ?? 0)
    const reviews = Number(t.reviews ?? 0)
    const scans = Number(t.scans ?? 0)
    const runs = reviews + scans

    const signupMap = new Map(signups.map((r) => [r.month, Number(r.count)]))
    const reviewMap = new Map(
      reviewsByMonth.map((r) => [r.month, Number(r.count)]),
    )
    const scanMap = new Map(scansByMonth.map((r) => [r.month, Number(r.count)]))

    return {
      totals: {
        users: Number(t.users ?? 0),
        workspaces,
        pro,
        free: Math.max(0, workspaces - pro),
        mrrUsd: pro * PRO_PRICE_USD,
        reviews,
        scans,
        findings: Number(t.findings ?? 0),
        landingViews: Number(t.views ?? 0),
        llmTokens,
        llmCostUsd,
        costPerRunUsd: runs > 0 ? llmCostUsd / runs : null,
      },
      trends: lastMonths(12).map((month) => ({
        month,
        signups: signupMap.get(month) ?? 0,
        reviews: reviewMap.get(month) ?? 0,
        scans: scanMap.get(month) ?? 0,
      })),
      countries: countries.map((r) => ({
        country: String(r.country),
        count: Number(r.count),
      })),
      viewsByDay: byDay.map((r) => ({
        day: String(r.day),
        count: Number(r.count),
      })),
      recent: recent.map((r) => ({
        type: r.type === 'scan' ? 'scan' : 'review',
        repository: String(r.repository),
        workspace: String(r.workspace),
        status: String(r.status),
        at: new Date(r.at).toISOString(),
      })),
    }
  },
)

export type AdminUserRow = {
  userId: string
  username: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: string
  workspaceId: string | null
  workspaceName: string | null
  plan: 'free' | 'pro' | null
  runsUsed: number
  bonusRuns: number
  repos: number
  reviews: number
  scans: number
}

export const getAdminUsers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminUserRow[]> => {
    await requireAdmin()
    const { sqlClient } = await loadDb()

    const rows = await sqlClient`
      select
        u.id as user_id, u.username, u.name, u.email, u.avatar_url, u.created_at,
        w.id as workspace_id, w.name as workspace_name, w.plan, w.runs_used, w.bonus_runs,
        (select count(*)::int from repositories rp where rp.workspace_id = w.id) as repos,
        (select count(*)::int from review_runs rr
           join pull_requests pr on pr.id = rr.pull_request_id
           join repositories rp on rp.id = pr.repository_id
           where rp.workspace_id = w.id) as reviews,
        (select count(*)::int from codebase_scans cs
           join repositories rp on rp.id = cs.repository_id
           where rp.workspace_id = w.id) as scans
      from users u
      left join workspaces w on w.owner_id = u.id
      order by u.created_at desc`

    return rows.map((r) => ({
      userId: String(r.user_id),
      username: String(r.username),
      name: r.name ? String(r.name) : null,
      email: r.email ? String(r.email) : null,
      avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
      createdAt: new Date(r.created_at).toISOString(),
      workspaceId: r.workspace_id ? String(r.workspace_id) : null,
      workspaceName: r.workspace_name ? String(r.workspace_name) : null,
      plan: r.plan === 'pro' ? 'pro' : r.workspace_id ? 'free' : null,
      runsUsed: Number(r.runs_used ?? 0),
      bonusRuns: Number(r.bonus_runs ?? 0),
      repos: Number(r.repos ?? 0),
      reviews: Number(r.reviews ?? 0),
      scans: Number(r.scans ?? 0),
    }))
  },
)

// Admin-only plan override. Kept here (not the API route) so the gate and the
// dispatch live together; the API route calls this after re-checking the admin.
export async function setWorkspacePlanAsAdmin(
  workspaceId: string,
  plan: 'free' | 'pro',
): Promise<void> {
  const { markWorkspacePro, downgradeWorkspace } = await import('./billing')
  if (plan === 'pro') {
    await markWorkspacePro(workspaceId)
  } else {
    await downgradeWorkspace(workspaceId)
  }
}

// Admin-only: grant one-time bonus runs to a workspace's current window. The
// API route re-checks the admin before calling this.
export async function addWorkspaceRunsAsAdmin(
  workspaceId: string,
  runs: number,
): Promise<void> {
  const { grantWorkspaceRuns } = await import('./billing')
  await grantWorkspaceRuns(workspaceId, runs)
}
