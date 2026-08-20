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

  it('gives a token up a clear margin before GitHub expires it', () => {
    expect(tokenIsFresh(now + minute, now)).toBe(false)
  })
})
