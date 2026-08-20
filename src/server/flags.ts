// Feature flags gated to named GitHub logins.
//
// Deliberately not stored per-workspace in the database: these gate work that
// is still being proven out, and the set of people who should see it changes by
// editing an environment variable rather than by a migration.

import { getOptionalEnv } from './env'

// The architecture map runs an extra LLM call and a few hundred extra file
// reads per scan, so it is gated on both sides: it is not built for anyone
// outside this list, and it is not returned to them either.
const ARCHITECTURE_MAP_DEFAULT_LOGINS = 'devtofunmi,xt42io'

// Opens a flag to everyone. Set the variable to this once the feature is ready
// to ship broadly, instead of listing logins forever.
const EVERYONE = '*'

function allowedLogins(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((login) => login.trim().toLowerCase())
      .filter(Boolean),
  )
}

// Exported for tests and for callers that want the raw list; comparison is
// case-insensitive because GitHub logins are.
export function isLoginAllowed(
  username: string | null | undefined,
  value: string,
): boolean {
  const allowed = allowedLogins(value)
  if (allowed.has(EVERYONE)) return true
  if (!username) return false
  return allowed.has(username.trim().toLowerCase())
}

export function isArchitectureMapEnabled(
  username: string | null | undefined,
): boolean {
  return isLoginAllowed(
    username,
    getOptionalEnv('ARCHITECTURE_MAP_LOGINS', ARCHITECTURE_MAP_DEFAULT_LOGINS),
  )
}
