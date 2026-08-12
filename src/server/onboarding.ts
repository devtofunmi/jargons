import { createServerFn } from '@tanstack/react-start'

import { loadDb } from '../db/load'
import { getCurrentUserFromCookie } from './github-auth'

// Mark the guided onboarding as dismissed for the signed-in user, whether they
// finished a step or chose to skip. Stamping users.onboarded_at is what stops
// the /app gate from redirecting them back into onboarding.
export const markOnboarded = createServerFn({ method: 'POST' }).handler(
  async () => {
    const currentUser = await getCurrentUserFromCookie()

    if (!currentUser) {
      throw new Error('Sign in before completing onboarding.')
    }

    const { eq, db, users } = await loadDb()

    await db
      .update(users)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, currentUser.id))

    return { ok: true }
  },
)
