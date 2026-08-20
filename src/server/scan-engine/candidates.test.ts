import { describe, expect, it } from 'vitest'

import {
  MAX_GRAPH_FILES,
  scorePath,
  selectGraphCandidates,
  withinCharBudget,
} from './candidates'

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

describe('withinCharBudget', () => {
  const file = (path: string, length: number) => ({
    path,
    content: 'x'.repeat(length),
  })

  it('does not let one large file starve the rest', () => {
    // The top-ranked file is the most-imported one, so it is exactly the file
    // most likely to be huge. Spending the budget in rank order would leave the
    // other three unread.
    const kept = withinCharBudget(
      [
        file('huge.ts', 5000),
        file('b.ts', 100),
        file('c.ts', 100),
        file('d.ts', 100),
      ],
      1000,
    )

    expect(kept.map((f) => f.path)).toEqual(['huge.ts', 'b.ts', 'c.ts', 'd.ts'])
    expect(kept[0].content.length).toBe(700)
  })

  it('never exceeds the budget', () => {
    const kept = withinCharBudget(
      [file('a.ts', 900), file('b.ts', 900), file('c.ts', 900)],
      1000,
    )

    const total = kept.reduce((sum, f) => sum + f.content.length, 0)
    expect(total).toBeLessThanOrEqual(1000)
  })

  it('leaves small files whole and spends the remainder on the ranked leader', () => {
    const kept = withinCharBudget(
      [file('big.ts', 800), file('small.ts', 10)],
      1000,
    )

    expect(kept[1].content.length).toBe(10)
    // 500 share, plus the 490 left unspent by the small file.
    expect(kept[0].content.length).toBe(800)
  })

  it('keeps every file whole when they all fit', () => {
    const kept = withinCharBudget([file('a.ts', 10), file('b.ts', 20)], 1000)

    expect(kept.map((f) => f.content.length)).toEqual([10, 20])
  })

  it('reads nothing with no files or no budget', () => {
    expect(withinCharBudget([], 1000)).toEqual([])
    expect(withinCharBudget([file('a.ts', 10)], 0)).toEqual([])
  })
})
