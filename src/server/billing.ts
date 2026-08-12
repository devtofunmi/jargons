// Freemium gating + Bachs billing. A free workspace gets one lifetime agent run
// (a pull request review OR a codebase scan); after that it must upgrade to a
// paid 'pro' plan. Payment runs through Bachs (bachs.io): the app creates a
// checkout, and a signed webhook flips the workspace to 'pro'.

import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../db/load'
import {
  FREE_RUN_LIMIT,
  isStalePeriod,
  PRO_PRICE_USD,
  PRO_RUN_LIMIT,
} from '../lib/plans'
import { getOptionalEnv } from './env'
import { getCurrentUserFromCookie } from './github-auth'

export { FREE_RUN_LIMIT, PRO_PRICE_USD, PRO_RUN_LIMIT }

export type WorkspaceBilling = {
  plan: 'free' | 'pro'
  runsUsed: number
  limit: number
  canRun: boolean
  upgradeUrl: string
}

// Where "upgrade" CTAs send people: the public pricing page, which explains the
// plans and starts a workspace-linked Bachs checkout.
export function getUpgradeUrl(): string {
  return `${getOptionalEnv('APP_URL', 'http://localhost:3000')}/pricing`
}

export async function getWorkspaceBilling(
  workspaceId: string,
): Promise<WorkspaceBilling> {
  const { eq, db, workspaces } = await loadDb()

  const rows = await db
    .select({
      plan: workspaces.plan,
      runsUsed: workspaces.runsUsed,
      runsPeriodStart: workspaces.runsPeriodStart,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  const plan = rows[0]?.plan === 'pro' ? 'pro' : 'free'
  // Runs reset each calendar month; a stale period reads as zero used.
  const runsUsed = isStalePeriod(rows[0]?.runsPeriodStart ?? null, new Date())
    ? 0
    : (rows[0]?.runsUsed ?? 0)
  const limit = plan === 'pro' ? PRO_RUN_LIMIT : FREE_RUN_LIMIT

  return {
    plan,
    runsUsed,
    limit,
    canRun: runsUsed < limit,
    upgradeUrl: getUpgradeUrl(),
  }
}

// Increment the run counter when a workspace starts an agent run (review,
// scan, or fix PR). Atomic, and rolls the monthly window: if the stored period
// is from a previous month, the count resets to 1 and the period moves to now.
export async function incrementWorkspaceRuns(
  workspaceId: string,
): Promise<void> {
  const { eq, sql, db, workspaces } = await loadDb()

  const isNewPeriod = sql`(${workspaces.runsPeriodStart} is null or date_trunc('month', ${workspaces.runsPeriodStart}) < date_trunc('month', now()))`

  await db
    .update(workspaces)
    .set({
      runsUsed: sql`case when ${isNewPeriod} then 1 else ${workspaces.runsUsed} + 1 end`,
      runsPeriodStart: sql`case when ${isNewPeriod} then now() else ${workspaces.runsPeriodStart} end`,
    })
    .where(eq(workspaces.id, workspaceId))
}

// Billing for the signed-in user's workspace, for display in the app.
export const getBilling = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WorkspaceBilling | null> => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser?.workspace) {
      return null
    }

    return getWorkspaceBilling(currentUser.workspace.id)
  },
)

// Unlock the Pro monthly run quota after a successful subscription, storing the
// Bachs ids
// so later webhook events (e.g. cancellation) map back to this workspace.
export async function markWorkspacePro(
  workspaceId: string,
  ids?: { customerId?: string; subscriptionId?: string },
): Promise<void> {
  const { eq, db, workspaces } = await loadDb()

  await db
    .update(workspaces)
    .set({
      plan: 'pro',
      ...(ids?.customerId ? { bachsCustomerId: ids.customerId } : {}),
      ...(ids?.subscriptionId
        ? { bachsSubscriptionId: ids.subscriptionId }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
}

// Downgrade a workspace back to free (e.g. its subscription was canceled).
export async function downgradeWorkspace(workspaceId: string): Promise<void> {
  const { eq, db, workspaces } = await loadDb()

  await db
    .update(workspaces)
    .set({ plan: 'free', bachsSubscriptionId: null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
}

// Resolve a Bachs customer id back to its workspace, for webhook fulfilment.
export async function workspaceByBachsCustomer(
  customerId: string,
): Promise<string | null> {
  const { eq, db, workspaces } = await loadDb()

  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.bachsCustomerId, customerId))
    .limit(1)

  return rows[0]?.id ?? null
}

// --- Bachs API ---

function bachsFetch(path: string, init: RequestInit): Promise<Response> {
  const base = getOptionalEnv('BACHS_API_BASE', 'https://sandbox-api.bachs.io')
  const key = getOptionalEnv('BACHS_API_KEY', '')
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

// Ensure a Bachs customer exists for the workspace and return its id, storing it
// on the workspace so webhook events can be mapped back.
async function ensureBachsCustomer(
  workspaceId: string,
  email: string | null,
  name: string | null,
): Promise<string> {
  const { eq, db, workspaces } = await loadDb()

  const rows = await db
    .select({ customerId: workspaces.bachsCustomerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  const existing = rows[0]?.customerId
  // Reuse the stored customer only if it still exists in Bachs. A stale id
  // (e.g. after an API-key or sandbox change) would otherwise fail every
  // checkout with "customer not found"; fall through and create a fresh one.
  if (existing) {
    const check = await bachsFetch(`/v1/customers/${existing}`, {
      method: 'GET',
    })
    if (check.ok) return existing
  }

  const res = await bachsFetch('/v1/customers', {
    method: 'POST',
    body: JSON.stringify({
      email: email ?? `workspace-${workspaceId}@jargons.run`,
      ...(name ? { name } : {}),
      metadata: { workspace_id: workspaceId },
    }),
  })
  const data = (await res.json()) as {
    customer_id?: string
    id?: string
    detail?: string
  }
  const customerId = data.customer_id ?? data.id
  if (!res.ok || !customerId) {
    throw new Error(data.detail ?? 'Unable to create Bachs customer')
  }

  await db
    .update(workspaces)
    .set({ bachsCustomerId: customerId })
    .where(eq(workspaces.id, workspaceId))

  return customerId
}

// Create a Bachs checkout for the workspace's Pro subscription; returns the
// hosted checkout URL to redirect the user to.
export async function createProCheckout(
  workspaceId: string,
  email: string | null,
  name: string | null,
): Promise<string> {
  const productId = getOptionalEnv('BACHS_PRO_PRODUCT_ID', '')
  const appUrl = getOptionalEnv('APP_URL', 'http://localhost:3000')
  // Bachs requires publicly reachable return URLs (no localhost), so fall back
  // to the live domain when developing locally.
  const returnBase = appUrl.includes('localhost')
    ? 'https://www.jargons.run'
    : appUrl
  const customerId = await ensureBachsCustomer(workspaceId, email, name)

  const payload = JSON.stringify({
    customer: { customer_id: customerId },
    product_cart: [{ product_id: productId, quantity: 1 }],
    success_url: `${returnBase}/upgrade/success`,
    cancel_url: `${returnBase}/app`,
    metadata: { workspace_id: workspaceId },
  })

  // A checkout created immediately after a brand-new customer can fail once
  // (the customer isn't instantly usable), so retry a couple of times.
  let lastError = 'Unable to create checkout'
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await bachsFetch('/v1/checkout-sessions', {
      method: 'POST',
      body: payload,
    })
    const data = (await res.json()) as {
      checkout_url?: string
      detail?: string
    }
    if (res.ok && data.checkout_url) {
      return data.checkout_url
    }
    lastError = data.detail ?? `checkout failed (${res.status})`
    await new Promise((resolve) => setTimeout(resolve, 700))
  }
  throw new Error(lastError)
}
