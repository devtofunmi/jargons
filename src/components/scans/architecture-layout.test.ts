import { describe, expect, it } from 'vitest'

import {
  GAP_X,
  GAP_Y,
  NODE_HEIGHT,
  NODE_WIDTH,
  PADDING,
  assignLayers,
  layoutArchitecture,
  moduleName,
  moduleParent,
} from './architecture-layout'
import type { ScanArchitectureModule } from '../../server/scan-engine/summary'

const asModule = (id: string): ScanArchitectureModule => ({
  id,
  label: null,
  files: 1,
  findings: 0,
  counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
  topSeverity: null,
})

describe('assignLayers', () => {
  it('puts a module one column right of what imports it', () => {
    const layers = assignLayers(['routes', 'server', 'db'].map(asModule), [
      { from: 'routes', to: 'server', weight: 1 },
      { from: 'server', to: 'db', weight: 1 },
    ])

    expect(layers.get('routes')).toBe(0)
    expect(layers.get('server')).toBe(1)
    expect(layers.get('db')).toBe(2)
  })

  it('uses the longest path when a module has two importers', () => {
    const layers = assignLayers(['a', 'b', 'c'].map(asModule), [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'c', weight: 1 },
      { from: 'a', to: 'c', weight: 1 },
    ])

    // Reachable at depth 1 directly and depth 2 via b; the deeper one wins so
    // the arrow never points backwards.
    expect(layers.get('c')).toBe(2)
  })

  it('ignores the edge that closes a cycle when placing columns', () => {
    const layers = assignLayers(['a', 'b', 'c'].map(asModule), [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'c', weight: 1 },
      { from: 'c', to: 'a', weight: 1 },
    ])

    // Without dropping c -> a from the maths, the cycle would push every module
    // to the last column and the diagram would collapse into one stack.
    expect(layers.get('a')).toBe(0)
    expect(layers.get('b')).toBe(1)
    expect(layers.get('c')).toBe(2)
  })

  it('keeps a module out of a column its own dependents pushed it past', () => {
    // A two-module cycle plus a third importer: the cycle must not drag `hub`
    // rightwards past everything that depends on it.
    const layers = assignLayers(['app', 'hub', 'util'].map(asModule), [
      { from: 'app', to: 'hub', weight: 1 },
      { from: 'hub', to: 'util', weight: 1 },
      { from: 'util', to: 'hub', weight: 1 },
    ])

    expect(layers.get('app')).toBe(0)
    expect(layers.get('hub')).toBe(1)
    expect(layers.get('util')).toBe(2)
  })

  it('still terminates when every module is in one cycle', () => {
    const ids = ['a', 'b', 'c', 'd']
    const layers = assignLayers(
      ids.map(asModule),
      ids.map((id, index) => ({
        from: id,
        to: ids[(index + 1) % ids.length],
        weight: 1,
      })),
    )

    for (const id of ids) {
      expect(layers.get(id)).toBeLessThanOrEqual(ids.length - 1)
      expect(layers.get(id)).toBeGreaterThanOrEqual(0)
    }
  })

  it('ignores an edge naming a module that is not present', () => {
    const layers = assignLayers(
      [asModule('a')],
      [
        { from: 'a', to: 'ghost', weight: 1 },
        { from: 'ghost', to: 'a', weight: 1 },
      ],
    )

    expect(layers.get('a')).toBe(0)
    expect(layers.has('ghost')).toBe(false)
  })
})

describe('layoutArchitecture', () => {
  it('lays out nothing for an empty map', () => {
    expect(layoutArchitecture([], [])).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    })
  })

  it('sizes the canvas from the column count and the tallest column', () => {
    const layout = layoutArchitecture(['a', 'b', 'c'].map(asModule), [
      { from: 'a', to: 'c', weight: 1 },
      { from: 'b', to: 'c', weight: 1 },
    ])

    // Two columns: [a, b] then [c].
    expect(layout.width).toBe(2 * NODE_WIDTH + GAP_X + PADDING * 2)
    expect(layout.height).toBe(2 * NODE_HEIGHT + GAP_Y + PADDING * 2)
  })

  it('centres a short column against the tallest one', () => {
    const layout = layoutArchitecture(['a', 'b', 'c'].map(asModule), [
      { from: 'a', to: 'c', weight: 1 },
      { from: 'b', to: 'c', weight: 1 },
    ])

    const c = layout.nodes.find((node) => node.id === 'c')!
    const a = layout.nodes.find((node) => node.id === 'a')!
    const b = layout.nodes.find((node) => node.id === 'b')!

    expect(c.y).toBeCloseTo((a.y + b.y) / 2)
    expect(c.x).toBeGreaterThan(a.x)
  })

  it('draws an edge between the two boxes it connects', () => {
    const layout = layoutArchitecture(['a', 'b'].map(asModule), [
      { from: 'a', to: 'b', weight: 3 },
    ])

    const a = layout.nodes.find((node) => node.id === 'a')!
    const b = layout.nodes.find((node) => node.id === 'b')!

    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0].weight).toBe(3)
    expect(layout.edges[0].path).toContain(
      `M ${a.x + NODE_WIDTH} ${a.y + NODE_HEIGHT / 2}`,
    )
    expect(layout.edges[0].path).toContain(`${b.x} ${b.y + NODE_HEIGHT / 2}`)
  })

  it('drops an edge whose endpoint is not on the map', () => {
    const layout = layoutArchitecture(
      [asModule('a')],
      [{ from: 'a', to: 'ghost', weight: 1 }],
    )

    expect(layout.edges).toEqual([])
  })

  it('draws the same picture for the same map', () => {
    const modules = ['a', 'b', 'c'].map(asModule)
    const edges = [{ from: 'a', to: 'b', weight: 1 }]

    expect(layoutArchitecture(modules, edges)).toEqual(
      layoutArchitecture(modules, edges),
    )
  })
})

describe('moduleName', () => {
  it('emphasises the segment that distinguishes the module', () => {
    expect(moduleName('src/server/scan-engine')).toBe('scan-engine')
    expect(moduleParent('src/server/scan-engine')).toBe('src/server')
  })

  it('has no parent for a top-level module', () => {
    expect(moduleName('src')).toBe('src')
    expect(moduleParent('src')).toBeNull()
  })

  it('shortens a parent path that would not fit', () => {
    const parent = moduleParent(
      'packages/platform/services/internal/deep/nested/leaf',
    )
    expect(parent!.length).toBeLessThanOrEqual(24)
    expect(parent).toContain('…')
  })
})
