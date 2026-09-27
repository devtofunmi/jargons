// Plan constants shared by server billing logic and client pricing UI. Kept in
// a dependency-free module so importing it never pulls server-only code into
// the client bundle.

// Free workspaces get one agent run per calendar month.
export const FREE_RUN_LIMIT = 1

// Paid plans get a fixed number of agent runs (reviews, scans, fix PRs) per
// calendar month. Limits are meant to be reachable (every PR push is a run), and
// bigger tiers are cheaper per run so upgrading is the obvious step.
export type PaidPlan = 'pro' | 'team' | 'business'
export type Plan = 'free' | PaidPlan

export type PaidPlanDetails = {
  name: string
  // Monthly price in USD (display only; the real charge is set in Bachs).
  priceUsd: number
  runLimit: number
  tagline: string
  recommended?: boolean
}

export const PAID_PLANS: Record<PaidPlan, PaidPlanDetails> = {
  pro: {
    name: 'Pro',
    priceUsd: 15,
    runLimit: 50,
    tagline: 'For developers shipping pull requests every day.',
  },
  team: {
    name: 'Team',
    priceUsd: 45,
    runLimit: 200,
    tagline: 'For teams reviewing and scanning several busy repos.',
    recommended: true,
  },
  business: {
    name: 'Business',
    priceUsd: 90,
    runLimit: 500,
    tagline: 'For large codebases and organisations at full speed.',
  },
}

export const PAID_PLAN_IDS: PaidPlan[] = ['pro', 'team', 'business']

export const PRO_RUN_LIMIT = PAID_PLANS.pro.runLimit
export const PRO_PRICE_USD = PAID_PLANS.pro.priceUsd

export function isPaidPlan(value: unknown): value is PaidPlan {
  return (PAID_PLAN_IDS as unknown[]).includes(value)
}

// Narrow an untrusted value (a DB column, a request body) to a known plan,
// treating anything unrecognised as free.
export function parsePlan(value: unknown): Plan {
  return isPaidPlan(value) ? value : 'free'
}

export function planRunLimit(plan: Plan): number {
  return plan === 'free' ? FREE_RUN_LIMIT : PAID_PLANS[plan].runLimit
}

// True when `periodStart` is in an earlier calendar month than `now` (UTC) —
// i.e. the monthly run quota should reset. Pure and dependency-free so billing
// can import it and it stays easy to unit test.
export function isStalePeriod(periodStart: Date | null, now: Date): boolean {
  if (!periodStart) return true
  return (
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth()
  )
}
