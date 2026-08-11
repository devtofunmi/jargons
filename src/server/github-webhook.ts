// GitHub App webhook: HMAC signature is the trust boundary (verified before
// the body is read as data), then pull-request events kick off a review run.

import { getEnv } from './env'
import { runReview } from './review-engine/run-review'

type PullRequestEvent = {
  action: string
  number: number
  pull_request: {
    id: number
    number: number
    title: string
    user: { login: string } | null
    head: { sha: string; ref: string }
    base: { sha: string }
  }
  repository: {
    id: number
    name: string
    owner: { login: string }
  }
  installation: { id: number } | null
}

const REVIEWABLE_ACTIONS = new Set(['opened', 'reopened', 'synchronize'])

// Branch prefix used by the auto-fix pipeline (fix-pr-… for reviews,
// fix-scan-… for scans). Jargons must not review the fix PRs it opens itself,
// or it would loop reviewing its own corrections.
const FIX_BRANCH_PREFIX = 'jargons/fix-'

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) {
    return false
  }

  const { createHmac, timingSafeEqual } = await import('node:crypto')
  const expected =
    'sha256=' +
    createHmac('sha256', getEnv('GITHUB_WEBHOOK_SECRET'))
      .update(rawBody)
      .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signatureHeader)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export type WebhookResult =
  | { handled: false; reason: string }
  | { handled: true; reviewRunId: string }

export async function handlePullRequestEvent(
  payload: PullRequestEvent,
): Promise<WebhookResult> {
  if (!REVIEWABLE_ACTIONS.has(payload.action)) {
    return { handled: false, reason: `ignored action: ${payload.action}` }
  }

  if (!payload.installation) {
    return { handled: false, reason: 'no installation on payload' }
  }

  // Don't review our own auto-fix PRs (by branch prefix, or by bot author).
  const botLogin = `${getEnv('GITHUB_APP_SLUG')}[bot]`
  if (
    payload.pull_request.head.ref.startsWith(FIX_BRANCH_PREFIX) ||
    payload.pull_request.user?.login === botLogin
  ) {
    return { handled: false, reason: 'skipping Jargons-authored fix PR' }
  }

  const [{ and, eq }, { db }, schema] = await Promise.all([
    import('drizzle-orm'),
    import('../db/client'),
    import('../db/schema'),
  ])

  const installationRows = await db
    .select({
      workspaceId: schema.githubInstallations.workspaceId,
      workspaceSlug: schema.workspaces.slug,
    })
    .from(schema.githubInstallations)
    .innerJoin(
      schema.workspaces,
      eq(schema.workspaces.id, schema.githubInstallations.workspaceId),
    )
    .where(
      eq(
        schema.githubInstallations.installationId,
        String(payload.installation.id),
      ),
    )
    .limit(1)

  const workspaceId = installationRows[0]?.workspaceId
  const workspaceSlug = installationRows[0]?.workspaceSlug

  if (!workspaceId || !workspaceSlug) {
    return { handled: false, reason: 'unknown installation' }
  }

  const settingsRows = await db
    .select({
      reviewPullRequests: schema.workspaceSettings.reviewPullRequests,
      reviewSecurity: schema.workspaceSettings.reviewSecurity,
    })
    .from(schema.workspaceSettings)
    .where(eq(schema.workspaceSettings.workspaceId, workspaceId))
    .limit(1)

  const settings = settingsRows[0] ?? {
    reviewPullRequests: true,
    reviewSecurity: true,
  }

  if (!settings.reviewPullRequests) {
    return { handled: false, reason: 'PR reviews disabled for workspace' }
  }

  const repositoryRows = await db
    .select({
      id: schema.repositories.id,
      status: schema.repositories.status,
    })
    .from(schema.repositories)
    .where(
      and(
        eq(schema.repositories.workspaceId, workspaceId),
        eq(schema.repositories.githubRepoId, String(payload.repository.id)),
      ),
    )
    .limit(1)

  const repositoryId = repositoryRows[0]?.id

  if (!repositoryId) {
    return { handled: false, reason: 'repository not synced' }
  }

  if (repositoryRows[0]?.status === 'paused') {
    return { handled: false, reason: 'repository paused' }
  }

  // Freemium gate: a free workspace gets one lifetime agent run. Once used,
  // skip the review and (on open/reopen) nudge them to upgrade.
  const { getWorkspaceBilling, incrementWorkspaceRuns } =
    await import('./billing')
  const billing = await getWorkspaceBilling(workspaceId)
  if (!billing.canRun) {
    if (payload.action === 'opened' || payload.action === 'reopened') {
      const { postUpgradeComment } = await import('./review-engine/github')
      void postUpgradeComment({
        installationId: String(payload.installation.id),
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        prNumber: payload.pull_request.number,
        upgradeUrl: billing.upgradeUrl,
      })
    }
    return { handled: false, reason: 'free trial used — upgrade required' }
  }

  const now = new Date()
  const pr = payload.pull_request

  // Upsert the pull request, then read its id back (onConflict has no unique
  // target defined in schema, so upsert-by-select).
  const existingPr = await db
    .select({ id: schema.pullRequests.id })
    .from(schema.pullRequests)
    .where(
      and(
        eq(schema.pullRequests.repositoryId, repositoryId),
        eq(schema.pullRequests.githubPullRequestId, String(pr.id)),
      ),
    )
    .limit(1)

  let pullRequestId: string

  if (existingPr[0]) {
    pullRequestId = existingPr[0].id
    await db
      .update(schema.pullRequests)
      .set({
        title: pr.title,
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
        branch: pr.head.ref,
        isOpen: true,
        updatedAt: now,
      })
      .where(eq(schema.pullRequests.id, pullRequestId))
  } else {
    const inserted = await db
      .insert(schema.pullRequests)
      .values({
        repositoryId,
        githubPullRequestId: String(pr.id),
        number: pr.number,
        title: pr.title,
        authorLogin: pr.user?.login ?? 'unknown',
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
        branch: pr.head.ref,
        isOpen: true,
        updatedAt: now,
      })
      .returning({ id: schema.pullRequests.id })
    pullRequestId = inserted[0].id
  }

  const reviewRun = await db
    .insert(schema.reviewRuns)
    .values({ pullRequestId, headSha: pr.head.sha, status: 'queued' })
    .onConflictDoNothing({
      target: [schema.reviewRuns.pullRequestId, schema.reviewRuns.headSha],
    })
    .returning({ id: schema.reviewRuns.id })

  // A run for this exact commit already exists (duplicate/concurrent delivery).
  if (!reviewRun[0]) {
    return {
      handled: false,
      reason: 'duplicate delivery: commit already reviewed',
    }
  }

  const reviewRunId = reviewRun[0].id

  // Count this run against the workspace's plan (only for a newly created run).
  await incrementWorkspaceRuns(workspaceId)

  // Fire-and-forget: the engine owns its own tracing and never throws.
  void runReview({
    reviewRunId,
    installationId: String(payload.installation.id),
    workspace: workspaceSlug,
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    prNumber: pr.number,
    prTitle: pr.title,
    headSha: pr.head.sha,
    headRef: pr.head.ref,
    reviewSecurity: settings.reviewSecurity,
  })

  return { handled: true, reviewRunId }
}

export function parsePullRequestEvent(body: string): PullRequestEvent {
  return JSON.parse(body) as PullRequestEvent
}
