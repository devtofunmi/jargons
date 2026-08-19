import { describe, expect, it } from 'vitest'

import { tokenIsFresh } from './client'

// The margin arithmetic is the part of the token cache worth pinning: too
// generous and a scan reuses a token that expires mid-request, which surfaces
// as a spurious GitHub 401 rather than as a cache bug.
describe('tokenIsFresh', () => {
  const now = 1_700_000_000_000
  const minute = 60_000

  it('reuses a token with plenty of life left', () => {
    expect(tokenIsFresh(now + 30 * minute, now)).toBe(true)
  })

  it('stops reusing a token before GitHub expires it', () => {
    expect(tokenIsFresh(now + minute / 2, now)).toBe(false)
  })

  it('treats an already-expired token as stale', () => {
    expect(tokenIsFresh(now - minute, now)).toBe(false)
  })

  it('does not sit exactly on the boundary', () => {
    expect(tokenIsFresh(now + minute, now)).toBe(false)
  })
})
