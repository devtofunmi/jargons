import { describe, expect, it } from 'vitest'

import {
  MAX_MODULES,
  ROOT_MODULE,
  buildModuleGraph,
  fanInCounts,
  moduleOf,
  rankFilesByFanIn,
} from './graph'

describe('moduleOf', () => {
  it('uses the directory holding the file', () => {
    expect(moduleOf('src/server/scan-engine/graph.ts')).toBe(
      'src/server/scan-engine',
    )
  })

  it('gives repository-root files a module of their own', () => {
    expect(moduleOf('vite.config.ts')).toBe(ROOT_MODULE)
  })
})

describe('fanInCounts', () => {
  it('counts how many files import each target', () => {
    const counts = fanInCounts([
      { from: 'a.ts', to: 'shared.ts' },
      { from: 'b.ts', to: 'shared.ts' },
      { from: 'a.ts', to: 'leaf.ts' },
    ])

    expect(counts.get('shared.ts')).toBe(2)
    expect(counts.get('leaf.ts')).toBe(1)
    expect(counts.get('a.ts')).toBeUndefined()
  })
})

describe('rankFilesByFanIn', () => {
  it('reads the most-depended-upon file first', () => {
    const ranked = rankFilesByFanIn(
      ['entry.ts', 'shared.ts', 'leaf.ts'],
      [
        { from: 'entry.ts', to: 'shared.ts' },
        { from: 'leaf.ts', to: 'shared.ts' },
        { from: 'entry.ts', to: 'leaf.ts' },
      ],
    )

    expect(ranked).toEqual(['shared.ts', 'leaf.ts', 'entry.ts'])
  })

  it('leaves files nothing imports in the order it was given', () => {
    expect(rankFilesByFanIn(['b.ts', 'a.ts', 'c.ts'], [])).toEqual([
      'b.ts',
      'a.ts',
      'c.ts',
    ])
  })

  it('does not mutate the paths it was given', () => {
    const paths = ['entry.ts', 'shared.ts']
    rankFilesByFanIn(paths, [{ from: 'entry.ts', to: 'shared.ts' }])
    expect(paths).toEqual(['entry.ts', 'shared.ts'])
  })
})

describe('buildModuleGraph', () => {
  const paths = [
    'src/routes/index.tsx',
    'src/routes/scans.tsx',
    'src/server/scans.ts',
    'src/db/load.ts',
  ]

  // These fixtures are deliberately one or two files per directory, which the
  // real defaults would fold away. Keeping every directory isolates the edge
  // and severity behaviour under test; folding has its own block below.
  const keepEveryDirectory = { minModuleFiles: 0 }

  it('counts every file in the repository, not only the ones read', () => {
    const graph = buildModuleGraph({
      paths,
      edges: [],
      findings: [],
      ...keepEveryDirectory,
    })

    expect(graph.modules).toEqual([
      {
        id: 'src/db',
        files: 1,
        findings: 0,
        counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
        topSeverity: null,
      },
      {
        id: 'src/routes',
        files: 2,
        findings: 0,
        counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
        topSeverity: null,
      },
      {
        id: 'src/server',
        files: 1,
        findings: 0,
        counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
        topSeverity: null,
      },
    ])
  })

  it('collapses file imports into one weighted arrow per module pair', () => {
    const graph = buildModuleGraph({
      paths,
      edges: [
        { from: 'src/routes/index.tsx', to: 'src/server/scans.ts' },
        { from: 'src/routes/scans.tsx', to: 'src/server/scans.ts' },
        { from: 'src/server/scans.ts', to: 'src/db/load.ts' },
      ],
      findings: [],
      ...keepEveryDirectory,
    })

    expect(graph.edges).toEqual([
      { from: 'src/routes', to: 'src/server', weight: 2 },
      { from: 'src/server', to: 'src/db', weight: 1 },
    ])
  })

  it('drops an edge that stays inside one module', () => {
    const graph = buildModuleGraph({
      paths,
      edges: [{ from: 'src/routes/index.tsx', to: 'src/routes/scans.tsx' }],
      findings: [],
      ...keepEveryDirectory,
    })

    expect(graph.edges).toEqual([])
  })

  it('resolves an edge that targets a directory rather than a file', () => {
    const graph = buildModuleGraph({
      paths: ['cmd/main.go', 'internal/db/store.go'],
      edges: [{ from: 'cmd/main.go', to: 'internal/db' }],
      findings: [],
      ...keepEveryDirectory,
    })

    expect(graph.edges).toEqual([{ from: 'cmd', to: 'internal/db', weight: 1 }])
  })

  it('colours a module by its most severe finding', () => {
    const graph = buildModuleGraph({
      paths,
      edges: [],
      findings: [
        { filePath: 'src/server/scans.ts', severity: 'low' },
        { filePath: 'src/server/scans.ts', severity: 'critical' },
        { filePath: 'src/db/load.ts', severity: 'medium' },
      ],
      ...keepEveryDirectory,
    })

    const server = graph.modules.find((m) => m.id === 'src/server')
    expect(server?.topSeverity).toBe('critical')
    expect(server?.findings).toBe(2)
    expect(graph.modules.find((m) => m.id === 'src/db')?.topSeverity).toBe(
      'medium',
    )
    expect(graph.modules.find((m) => m.id === 'src/routes')?.topSeverity).toBe(
      null,
    )
  })

  it('counts a finding whose file is not in the tree instead of dropping it', () => {
    const graph = buildModuleGraph({
      paths,
      edges: [],
      findings: [{ filePath: 'imagined/place.ts', severity: 'high' }],
      ...keepEveryDirectory,
    })

    expect(graph.unattributedFindings).toBe(1)
    expect(graph.modules.every((m) => m.findings === 0)).toBe(true)
  })

  it('collapses deep modules into their parents to fit the cap', () => {
    const deep = [
      'src/a/one.ts',
      'src/b/two.ts',
      'src/c/three.ts',
      'src/d/four.ts',
    ]
    const graph = buildModuleGraph({
      paths: deep,
      edges: [],
      findings: [],
      maxNodes: 1,
      ...keepEveryDirectory,
    })

    expect(graph.modules).toHaveLength(1)
    expect(graph.modules[0].id).toBe('src')
    // Collapsing loses a level of detail, never a file.
    expect(graph.modules[0].files).toBe(4)
    expect(graph.omittedModules).toBe(0)
  })

  it('re-points edges at the surviving ancestor after a collapse', () => {
    const graph = buildModuleGraph({
      paths: ['src/web/page.ts', 'src/api/route.ts', 'core/db/load.ts'],
      edges: [{ from: 'src/web/page.ts', to: 'core/db/load.ts' }],
      findings: [],
      maxNodes: 2,
      ...keepEveryDirectory,
    })

    // Three modules do not fit, so each side of the edge folds up one level.
    expect(graph.modules.map((m) => m.id)).toEqual(['core', 'src'])
    expect(graph.edges).toEqual([{ from: 'src', to: 'core', weight: 1 }])
  })

  it('keeps the modules that matter and reports the rest as omitted', () => {
    const graph = buildModuleGraph({
      paths: ['a/one.ts', 'b/two.ts', 'c/three.ts'],
      edges: [],
      findings: [{ filePath: 'c/three.ts', severity: 'critical' }],
      maxNodes: 1,
    })

    expect(graph.modules.map((m) => m.id)).toEqual(['c'])
    expect(graph.omittedModules).toBe(2)
  })

  it('never draws a container beside its own contents', () => {
    // The shape a real scan produced: nested API route directories each got a
    // box, so `pages/api` sat next to `pages/api/admin` as though they were
    // siblings. A reader takes boxes at the same level to be peers.
    const graph = buildModuleGraph({
      paths: [
        'pages/index.tsx',
        'pages/about.tsx',
        'pages/contact.tsx',
        'pages/api/health.ts',
        'pages/api/admin/list.ts',
        'pages/api/admin/users/index.ts',
      ],
      edges: [],
      findings: [],
    })

    expect(graph.modules.map((m) => m.id)).toEqual(['pages'])
    expect(graph.modules[0].files).toBe(6)
  })

  it('folds a directory too small to be a module of its own', () => {
    const graph = buildModuleGraph({
      paths: [
        'src/core/a.ts',
        'src/core/b.ts',
        'src/core/c.ts',
        'src/odds/one.ts',
      ],
      edges: [],
      findings: [],
    })

    // `src/odds` holds a single file, so it joins its parent rather than
    // claiming a box; `src/core` clears the floor and keeps its own.
    expect(graph.modules.map((m) => m.id)).toEqual(['src', 'src/core'])
    expect(graph.modules.find((m) => m.id === 'src')?.files).toBe(1)
  })

  it('keeps findings and files when a small module folds away', () => {
    const graph = buildModuleGraph({
      paths: [
        'src/tiny/one.ts',
        'src/big/a.ts',
        'src/big/b.ts',
        'src/big/c.ts',
      ],
      edges: [],
      findings: [{ filePath: 'src/tiny/one.ts', severity: 'critical' }],
    })

    const parent = graph.modules.find((m) => m.id === 'src')
    expect(parent?.findings).toBe(1)
    expect(parent?.topSeverity).toBe('critical')
    expect(graph.modules.reduce((sum, m) => sum + m.files, 0)).toBe(4)
  })

  it('re-points edges onto the module a folded directory joined', () => {
    const graph = buildModuleGraph({
      paths: [
        'app/page.tsx',
        'app/other.tsx',
        'app/third.tsx',
        'app/util/one.ts',
      ],
      edges: [{ from: 'app/util/one.ts', to: 'app/page.tsx' }],
      findings: [],
    })

    // Both ends now sit in `app`, so the arrow is internal and disappears
    // rather than pointing at a module that is no longer drawn.
    expect(graph.modules.map((m) => m.id)).toEqual(['app'])
    expect(graph.edges).toEqual([])
  })

  it('leaves a top-level module alone however small it is', () => {
    const graph = buildModuleGraph({
      paths: ['a/one.ts', 'b/one.ts'],
      edges: [],
      findings: [],
    })

    // Nothing to fold into: these are already as shallow as a module gets.
    expect(graph.modules.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('defaults to a cap a reader can actually take in', () => {
    const manyPaths = Array.from({ length: 60 }, (_, i) => `mod${i}/file.ts`)
    const graph = buildModuleGraph({
      paths: manyPaths,
      edges: [],
      findings: [],
    })

    expect(graph.modules.length).toBeLessThanOrEqual(MAX_MODULES)
    expect(graph.modules.length + graph.omittedModules).toBe(60)
  })
})
