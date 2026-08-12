import { describe, expect, it } from 'vitest'

import {
  FREE_RUN_LIMIT,
  isStalePeriod,
  PRO_PRICE_USD,
  PRO_RUN_LIMIT,
} from './plans'

describe('plan constants', () => {
  it('has the expected values', () => {
    expect(FREE_RUN_LIMIT).toBe(1)
    expect(PRO_RUN_LIMIT).toBe(75)
    expect(PRO_PRICE_USD).toBe(15)
  })
})

describe('isStalePeriod', () => {
  const now = new Date('2026-03-15T12:00:00.000Z')

  it('is stale when there is no period start', () => {
    expect(isStalePeriod(null, now)).toBe(true)
  })

  it('is not stale within the same calendar month', () => {
    expect(isStalePeriod(new Date('2026-03-01T00:00:00.000Z'), now)).toBe(false)
  })

  it('is stale in an earlier month of the same year', () => {
    expect(isStalePeriod(new Date('2026-02-28T23:59:59.000Z'), now)).toBe(true)
  })

  it('is stale in the same month number of a previous year', () => {
    expect(isStalePeriod(new Date('2025-03-31T00:00:00.000Z'), now)).toBe(true)
  })
})
