// Where to send someone after sign-in. Only same-site paths are allowed, so a
// crafted `?next=` can never bounce users to another origin (open redirect).
// Anything else falls back to the dashboard.

export const DEFAULT_NEXT = '/app'

export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return DEFAULT_NEXT
  // Must be a root-relative path. `//host` and `/\host` are protocol-relative
  // in browsers, so reject them before parsing.
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return DEFAULT_NEXT
  }

  const base = 'https://jargons.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return DEFAULT_NEXT
  }
  if (url.origin !== base) return DEFAULT_NEXT

  return `${url.pathname}${url.search}${url.hash}`
}
