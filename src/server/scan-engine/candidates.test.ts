import { describe, expect, it } from 'vitest'

import { MAX_GRAPH_FILES, scorePath, selectGraphCandidates } from './candidates'

describe('scorePath', () => {
  it('ranks application source above everything else', () => {
    expect(scorePath('src/server/scans.ts')).toBeGreaterThan(
      scorePath('rollup.config.ts'),
    )
  })

  it('ranks a test below the module it tests', () => {
    expect(scorePath('src/server/scans.test.ts')).toBeLessThan(
      scorePath('src/server/scans.ts'),
    )
  })

  it('recognises test files across language conventions', () => {
    const plain = scorePath('internal/db/store.go')
    expect(scorePath('internal/db/store_test.go')).toBeLessThan(plain)
    expect(scorePath('app/__tests__/main.py')).toBeLessThan(plain)
    expect(scorePath('src/components/button.spec.tsx')).toBeLessThan(plain)
  })

  it('ranks generated code below hand-written code', () => {
    expect(scorePath('src/routeTree.gen.ts')).toBeLessThan(
      scorePath('src/routes/index.tsx'),
    )
    expect(scorePath('src/db/migrations/0001_init.ts')).toBeLessThan(
      scorePath('src/db/schema.ts'),
    )
  })

  it('matches a marker directory at the top level as well as nested', () => {
    expect(scorePath('tests/smoke.ts')).toBeLessThan(scorePath('other.ts'))
  })
})

describe('selectGraphCandidates', () => {
  it('reads application source before supporting material', () => {
    const selected = selectGraphCandidates(
      [
        'scripts/release.ts',
        'src/server/scans.test.ts',
        'src/server/scans.ts',
        'vite.config.ts',
      ],
      2,
    )

    expect(selected).toEqual(['src/server/scans.ts', 'scripts/release.ts'])
  })

  it('caps how many files are ever read', () => {
    const paths = Array.from({ length: 500 }, (_, i) => `src/mod-${i}.ts`)
    expect(selectGraphCandidates(paths)).toHaveLength(MAX_GRAPH_FILES)
    expect(selectGraphCandidates(paths, 10)).toHaveLength(10)
  })

  it('returns the same list for the same repository', () => {
    const paths = ['src/b.ts', 'src/a.ts', 'src/c.ts']
    expect(selectGraphCandidates(paths, 2)).toEqual(
      selectGraphCandidates([...paths].reverse(), 2),
    )
  })

  it('breaks ties on path so the order never depends on the tree', () => {
    expect(selectGraphCandidates(['src/b.ts', 'src/a.ts'], 2)).toEqual([
      'src/a.ts',
      'src/b.ts',
    ])
  })

  it('does not mutate the paths it was given', () => {
    const paths = ['src/b.ts', 'src/a.ts']
    selectGraphCandidates(paths)
    expect(paths).toEqual(['src/b.ts', 'src/a.ts'])
  })

  it('reads nothing when the cap is zero or negative', () => {
    expect(selectGraphCandidates(['src/a.ts'], 0)).toEqual([])
    expect(selectGraphCandidates(['src/a.ts'], -5)).toEqual([])
  })
})
