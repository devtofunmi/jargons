import { describe, expect, it } from 'vitest'

import { emptyCounts, summaryToCounts } from './summary'

describe('summaryToCounts', () => {
  it('reads a null/undefined summary as all-zero', () => {
    expect(summaryToCounts(null)).toEqual({
      counts: emptyCounts,
      findingsCount: 0,
    })
    expect(summaryToCounts(undefined)).toEqual({
      counts: emptyCounts,
      findingsCount: 0,
    })
  })

  it('reads a non-object summary as all-zero', () => {
    expect(summaryToCounts('nonsense')).toEqual({
      counts: emptyCounts,
      findingsCount: 0,
    })
  })

  it('merges partial counts over the zero baseline', () => {
    const { counts } = summaryToCounts({ counts: { high: 2, note: 1 } })
    expect(counts).toEqual({
      critical: 0,
      high: 2,
      medium: 0,
      low: 0,
      note: 1,
    })
  })

  it('sums the counts when no findings array is present', () => {
    const { findingsCount } = summaryToCounts({
      counts: { critical: 1, high: 2, medium: 0, low: 3, note: 4 },
    })
    expect(findingsCount).toBe(10)
  })

  it('prefers the findings array length over the summed counts', () => {
    const { findingsCount } = summaryToCounts({
      counts: { high: 99 },
      findings: [{}, {}, {}],
    })
    expect(findingsCount).toBe(3)
  })

  it('does not mutate the shared emptyCounts baseline', () => {
    summaryToCounts({ counts: { critical: 5 } })
    expect(emptyCounts.critical).toBe(0)
  })
})
