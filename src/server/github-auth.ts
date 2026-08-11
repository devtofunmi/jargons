import { createServerFn } from '@tanstack/react-start'

import { getEnv, getOptionalEnv } from './env'

type GitHubTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type GitHubUser = {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

const githubAuthorizeUrl = 'https://github.com/login/oauth/authorize'
const githubTokenUrl = 'https://github.com/login/oauth/access_token'
const githubUserUrl = 'https://api.github.com/user'
const sessionCookieName = 'jargons_session'

export type CurrentUser = {
  id: string
  username: string
  name: string
  email: string | null
  avatarUrl: string | null
  workspace: {
    id: string
    name: string
    slug: string
  } | null
}

export const getGitHubAuthUrl = createServerFn({ method: 'GET' }).handler(
  () => {
    const { state, url } = createGitHubAuthorizeUrl()

    return {
      url,
      state,
      callbackUrl: new URL(
        '/auth/github/callback',
        getOptionalEnv('APP_URL', 'http://localhost:3000'),
      ).toString(),
    }
  },
)

export function getGitHubAuthorizeUrl() {
  return createGitHubAuthorizeUrl().url
}

export const completeGitHubAuth = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => completeGitHubAuthWithCode(data.code))

export const completeGitHubAuthForCallback = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    try {
      await completeGitHubAuthWithCode(data.code)

      return {
        ok: true,
        error: null,
      }
    } catch (error) {
      console.error('GitHub auth callback failed', error)

      return {
        ok: false,
        error: getAuthErrorMessage(error),
      }
    }
  })

export async function completeGitHubAuthWithCode(code: string) {
  const [{ db }, { sessions, users, workspaces }] = await Promise.all([
    import('../db/client'),
    import('../db/schema'),
  ])
  const accessToken = await exchangeGitHubCode(code)
  const githubUser = await getGitHubUser(accessToken)
  const now = new Date()

  const [user] = await db
    .insert(users)
    .values({
      githubId: String(githubUser.id),
      username: githubUser.login,
      name: githubUser.name,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        username: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        updatedAt: now,
      },
    })
    .returning()

  const workspaceSlug = githubUser.login.toLowerCase()
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: githubUser.name ?? githubUser.login,
      slug: workspaceSlug,
      ownerId: user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workspaces.slug,
      set: {
        name: githubUser.name ?? githubUser.login,
        ownerId: user.id,
        updatedAt: now,
      },
    })
    .returning()

  const sessionToken = crypto.randomUUID()
  const tokenHash = await hashSessionToken(sessionToken)
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  })

  await setSessionCookie({
    expiresAt,
    token: sessionToken,
  })

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    },
  }
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => getCurrentUserFromCookie(),
)

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionToken = await getSessionCookie()

  if (sessionToken) {
    const [{ eq }, { db }, { sessions }] = await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
    ])
    const tokenHash = await hashSessionToken(sessionToken)

    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }

  await deleteSessionCookie()

  return { ok: true }
})

export async function getCurrentUserFromCookie(): Promise<CurrentUser | null> {
  const sessionToken = await getSessionCookie()

  if (!sessionToken) {
    return null
  }

  const currentUser = await getCurrentUserFromToken(sessionToken)

  if (!currentUser) {
    await deleteSessionCookie()
  }

  return currentUser
}

/** Resolve the current user from an incoming Request's Cookie header. Used by
 * API routes, where the framework cookie helpers are not bound. */
export async function getCurrentUserFromRequest(
  request: Request,
): Promise<CurrentUser | null> {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) {
    return null
  }

  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1)

  if (!token) {
    return null
  }

  return getCurrentUserFromToken(decodeURIComponent(token))
}

/** Resolve the current user from a raw session token (no cookie context). */
export async function getCurrentUserFromToken(
  sessionToken: string,
): Promise<CurrentUser | null> {
  if (!sessionToken) {
    return null
  }

  const [{ and, eq, gt }, { db }, { sessions, users, workspaces }] =
    await Promise.all([
      import('drizzle-orm'),
      import('../db/client'),
      import('../db/schema'),
    ])

  const tokenHash = await hashSessionToken(sessionToken)
  const currentUserRows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(workspaces, eq(workspaces.ownerId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (currentUserRows.length === 0) {
    return null
  }

  const currentUser = currentUserRows[0]

  return {
    id: currentUser.userId,
    username: currentUser.username,
    name: currentUser.name ?? currentUser.username,
    email: currentUser.email,
    avatarUrl: currentUser.avatarUrl,
    workspace:
      currentUser.workspaceId &&
      currentUser.workspaceName &&
      currentUser.workspaceSlug
        ? {
            id: currentUser.workspaceId,
            name: currentUser.workspaceName,
            slug: currentUser.workspaceSlug,
          }
        : null,
  }
}

async function getSessionCookie() {
  const { getCookie } = await import('@tanstack/react-start/server')

  return getCookie(sessionCookieName)
}

async function setSessionCookie({
  expiresAt,
  token,
}: {
  expiresAt: Date
  token: string
}) {
  const { setCookie } = await import('@tanstack/react-start/server')

  setCookie(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: getOptionalEnv('NODE_ENV', 'development') === 'production',
  })
}

export async function deleteSessionCookie() {
  const { deleteCookie } = await import('@tanstack/react-start/server')

  deleteCookie(sessionCookieName, { path: '/' })
}

export async function exchangeGitHubCode(code: string) {
  const response = await fetch(githubTokenUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: getEnv('GITHUB_CLIENT_ID'),
      client_secret: getEnv('GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: getEnv('GITHUB_REDIRECT_URI'),
    }),
  })

  const token = (await response.json()) as GitHubTokenResponse

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description ?? 'Unable to exchange GitHub code')
  }

  return token.access_token
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to finish GitHub sign in.'
  }

  return error.message || 'Unable to finish GitHub sign in.'
}

export async function getGitHubUser(accessToken: string) {
  const response = await fetch(githubUserUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'x-github-api-version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error('Unable to fetch GitHub user')
  }

  return (await response.json()) as GitHubUser
}

async function hashSessionToken(token: string) {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createGitHubAuthorizeUrl() {
  const state = crypto.randomUUID()
  const redirectUri = getEnv('GITHUB_REDIRECT_URI')
  const url = new URL(githubAuthorizeUrl)

  url.searchParams.set('client_id', getEnv('GITHUB_CLIENT_ID'))
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)

  return {
    state,
    url: url.toString(),
  }
}
