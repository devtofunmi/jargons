import { describe, expect, it } from 'vitest'

import { DEFAULT_NEXT, safeNextPath } from './safe-next'

describe('safeNextPath', () => {
  it('keeps same-site paths with their query', () => {
    expect(safeNextPath('/pricing?checkout=team')).toBe(
      '/pricing?checkout=team',
    )
    expect(safeNextPath('/app')).toBe('/app')
  })

  it.each([
    undefined,
    null,
    42,
    '',
    'pricing',
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    `/${'a'.repeat(600)}`,
  ])('falls back to the dashboard for %j', (value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_NEXT)
  })
})
