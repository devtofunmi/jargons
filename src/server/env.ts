type RequiredEnvKey =
  | 'DATABASE_URL'
  | 'GITHUB_CLIENT_ID'
  | 'GITHUB_CLIENT_SECRET'
  | 'GITHUB_REDIRECT_URI'
  | 'GITHUB_APP_ID'
  | 'GITHUB_APP_PRIVATE_KEY'
  | 'GITHUB_APP_SLUG'
  | 'GITHUB_WEBHOOK_SECRET'
  | 'SESSION_SECRET'

type OptionalEnvKey =
  | 'APP_URL'
  | 'NODE_ENV'
  | 'ADMIN_USERNAMES'
  | 'LLM_PROVIDER'
  | 'LLM_MODEL'
  | 'GEMINI_API_KEY'
  | 'SIGNOZ_API_KEY'
  | 'SIGNOZ_URL'
  | 'BACHS_CHECKOUT_URL'
  | 'BACHS_WEBHOOK_SECRET'
  | 'BACHS_API_KEY'
  | 'BACHS_API_BASE'
  | 'BACHS_PRO_PRODUCT_ID'

export function getEnv(key: RequiredEnvKey) {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function getOptionalEnv(key: OptionalEnvKey, fallback: string) {
  return process.env[key] ?? fallback
}
