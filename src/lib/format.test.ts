import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { padCount, timeAgo } from './format'

describe('padCount', () => {
  it('pads single digits to two characters', () => {
    expect(padCount(0)).toBe('00')
    expect(padCount(7)).toBe('07')
  })

  it('leaves multi-digit numbers unchanged', () => {
    expect(padCount(42)).toBe('42')
    expect(padCount(100)).toBe('100')
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('returns "not yet" for null', () => {
    expect(timeAgo(null)).toBe('not yet')
  })

  it('formats seconds', () => {
    expect(timeAgo(ago(5_000))).toBe('5 seconds ago')
  })

  it('formats minutes and pluralizes', () => {
    expect(timeAgo(ago(60_000))).toBe('1 minute ago')
    expect(timeAgo(ago(5 * 60_000))).toBe('5 minutes ago')
  })

  it('formats hours', () => {
    expect(timeAgo(ago(3 * 3_600_000))).toBe('3 hours ago')
  })

  it('formats days', () => {
    expect(timeAgo(ago(2 * 86_400_000))).toBe('2 days ago')
  })

  it('clamps future timestamps to 0 seconds', () => {
    expect(timeAgo(new Date(Date.now() + 10_000).toISOString())).toBe(
      '0 seconds ago',
    )
  })
})
