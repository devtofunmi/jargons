import { describe, expect, it } from 'vitest'

import { emptyCounts, summaryToArchitecture, summaryToCounts } from './summary'

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

describe('summaryToArchitecture', () => {
  const module = (id: string) => ({
    id,
    label: `${id} does things`,
    files: 3,
    findings: 0,
    counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
    topSeverity: null,
  })

  it('reads a scan that predates the map as having none', () => {
    expect(summaryToArchitecture(null)).toBeNull()
    expect(summaryToArchitecture({ counts: { high: 1 } })).toBeNull()
  })

  it('reads a non-object summary or architecture as having none', () => {
    expect(summaryToArchitecture('nonsense')).toBeNull()
    expect(summaryToArchitecture({ architecture: 'nonsense' })).toBeNull()
  })

  it('reads a map with no usable modules as having none', () => {
    expect(summaryToArchitecture({ architecture: { modules: [] } })).toBeNull()
    expect(
      summaryToArchitecture({ architecture: { modules: [{ files: 2 }] } }),
    ).toBeNull()
  })

  it('keeps modules and the edges between them', () => {
    const architecture = summaryToArchitecture({
      architecture: {
        modules: [module('src/routes'), module('src/server')],
        edges: [{ from: 'src/routes', to: 'src/server', weight: 4 }],
        omittedModules: 2,
        graphedFiles: 180,
        totalFiles: 940,
      },
    })

    expect(architecture?.modules.map((m) => m.id)).toEqual([
      'src/routes',
      'src/server',
    ])
    expect(architecture?.edges).toEqual([
      { from: 'src/routes', to: 'src/server', weight: 4 },
    ])
    expect(architecture?.omittedModules).toBe(2)
    expect(architecture?.graphedFiles).toBe(180)
    expect(architecture?.totalFiles).toBe(940)
  })

  it('drops an edge pointing at a module that is not on the map', () => {
    const architecture = summaryToArchitecture({
      architecture: {
        modules: [module('src/routes')],
        edges: [
          { from: 'src/routes', to: 'src/gone', weight: 1 },
          { from: 'src/gone', to: 'src/routes', weight: 1 },
          { from: 'src/routes', to: 'src/routes', weight: 1 },
        ],
      },
    })

    expect(architecture?.edges).toEqual([])
  })

  it('coerces a missing or malformed weight to a drawable one', () => {
    const architecture = summaryToArchitecture({
      architecture: {
        modules: [module('a'), module('b')],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a', weight: -7 },
        ],
      },
    })

    expect(architecture?.edges.map((e) => e.weight)).toEqual([1, 1])
  })

  it('fills in missing counts rather than trusting the stored shape', () => {
    const architecture = summaryToArchitecture({
      architecture: {
        modules: [{ id: 'src', counts: { high: 2, bogus: 9 } }],
      },
    })

    expect(architecture?.modules[0].counts).toEqual({
      critical: 0,
      high: 2,
      medium: 0,
      low: 0,
      note: 0,
    })
    expect(architecture?.modules[0].label).toBeNull()
    expect(architecture?.modules[0].files).toBe(0)
  })

  it('rejects a severity it does not recognise', () => {
    const architecture = summaryToArchitecture({
      architecture: {
        modules: [{ id: 'src', topSeverity: 'catastrophic' }],
      },
    })

    expect(architecture?.modules[0].topSeverity).toBeNull()
  })

  it('does not mutate the shared emptyCounts baseline', () => {
    summaryToArchitecture({
      architecture: { modules: [{ id: 'src', counts: { critical: 4 } }] },
    })
    expect(emptyCounts.critical).toBe(0)
  })
})
