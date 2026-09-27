import { describe, expect, it } from 'vitest'

import {
  FREE_RUN_LIMIT,
  isPaidPlan,
  isStalePeriod,
  PAID_PLANS,
  parsePlan,
  planRunLimit,
  PRO_PRICE_USD,
  PRO_RUN_LIMIT,
} from './plans'

describe('plan constants', () => {
  it('has the expected values', () => {
    expect(FREE_RUN_LIMIT).toBe(1)
    expect(PRO_RUN_LIMIT).toBe(50)
    expect(PRO_PRICE_USD).toBe(15)
  })

  it('offers Team at $45 and Business at $90, with Team recommended', () => {
    expect(PAID_PLANS.team).toMatchObject({ priceUsd: 45, runLimit: 200 })
    expect(PAID_PLANS.business).toMatchObject({ priceUsd: 90, runLimit: 500 })
    expect(
      Object.entries(PAID_PLANS)
        .filter(([, p]) => p.recommended)
        .map(([id]) => id),
    ).toEqual(['team'])
  })

  it('makes each bigger tier cheaper per run', () => {
    const perRun = (p: { priceUsd: number; runLimit: number }) =>
      p.priceUsd / p.runLimit
    expect(perRun(PAID_PLANS.team)).toBeLessThan(perRun(PAID_PLANS.pro))
    expect(perRun(PAID_PLANS.business)).toBeLessThan(perRun(PAID_PLANS.team))
  })
})

describe('plan parsing', () => {
  it('recognises paid plans and treats anything else as free', () => {
    expect(isPaidPlan('team')).toBe(true)
    expect(isPaidPlan('free')).toBe(false)
    expect(parsePlan('business')).toBe('business')
    expect(parsePlan('enterprise')).toBe('free')
    expect(parsePlan('toString')).toBe('free')
    expect(parsePlan(null)).toBe('free')
  })

  it('maps each plan to its monthly run limit', () => {
    expect(planRunLimit('free')).toBe(FREE_RUN_LIMIT)
    expect(planRunLimit('pro')).toBe(50)
    expect(planRunLimit('team')).toBe(200)
    expect(planRunLimit('business')).toBe(500)
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
