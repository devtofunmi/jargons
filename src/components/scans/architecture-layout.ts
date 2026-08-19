// Geometry for the architecture map. Pure and React-free so the layout can be
// unit-tested without rendering: the part worth testing is the arithmetic, not
// the SVG.

import type {
  ScanArchitectureEdge,
  ScanArchitectureModule,
} from '../../server/scan-engine/summary'

export const NODE_WIDTH = 176
export const NODE_HEIGHT = 66
export const GAP_X = 76
export const GAP_Y = 22
export const PADDING = 24

export type PositionedModule = ScanArchitectureModule & {
  layer: number
  x: number
  y: number
}

export type PositionedEdge = ScanArchitectureEdge & {
  // An SVG cubic path from the right edge of the source to the left edge of the
  // target.
  path: string
}

export type ArchitectureLayout = {
  nodes: PositionedModule[]
  edges: PositionedEdge[]
  width: number
  height: number
}

// Edges that close a cycle, found by depth-first search: an edge onto a module
// still open on the search stack.
//
// Real codebases have import cycles, and letting one drive the column maths
// pushes every module in the cycle to the far right and drags everything it
// touches with it — the whole graph collapses into one tall column with arrows
// looping back across the diagram. Cycle-closing edges are still drawn; they
// just do not get a say in where the boxes go.
//
// Indexes rather than composite keys, since a repository path may contain any
// character and there is no separator safe to join on.
function backEdgeIndexes(
  modules: ScanArchitectureModule[],
  edges: ScanArchitectureEdge[],
): Set<number> {
  const adjacency = new Map<string, Array<{ to: string; index: number }>>()
  edges.forEach((edge, index) => {
    const list = adjacency.get(edge.from) ?? []
    list.push({ to: edge.to, index })
    adjacency.set(edge.from, list)
  })

  const OPEN = 1
  const DONE = 2
  const state = new Map<string, number>()
  const backEdges = new Set<number>()

  // Iterative, and started from every module in the order given, so the result
  // does not depend on which module happens to come first in a cycle.
  for (const module of modules) {
    if (state.has(module.id)) continue

    state.set(module.id, OPEN)
    const stack = [{ id: module.id, next: 0 }]

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const neighbours = adjacency.get(frame.id) ?? []

      if (frame.next >= neighbours.length) {
        state.set(frame.id, DONE)
        stack.pop()
        continue
      }

      const { to, index } = neighbours[frame.next]
      frame.next += 1

      if (state.get(to) === OPEN) {
        backEdges.add(index)
      } else if (!state.has(to) && modules.some((m) => m.id === to)) {
        state.set(to, OPEN)
        stack.push({ id: to, next: 0 })
      }
    }
  }

  return backEdges
}

// Push every module one column to the right of everything that imports it, so
// dependencies read left to right.
//
// Relaxed rather than walked, and bounded by the module count: cycle-closing
// edges are already excluded, so the bound is a guard rather than the mechanism.
export function assignLayers(
  modules: ScanArchitectureModule[],
  edges: ScanArchitectureEdge[],
): Map<string, number> {
  const layers = new Map<string, number>(
    modules.map((module) => [module.id, 0]),
  )
  const backEdges = backEdgeIndexes(modules, edges)

  // One pass per module is the worst case: a chain that long cannot need more,
  // and the counter caps the work if an edge set ever fails to settle.
  let passesLeft = modules.length

  while (passesLeft > 0) {
    passesLeft -= 1
    let moved = false

    for (const [index, edge] of edges.entries()) {
      if (backEdges.has(index)) continue
      const from = layers.get(edge.from)
      const to = layers.get(edge.to)
      if (from === undefined || to === undefined) continue
      const wanted = Math.min(from + 1, modules.length - 1)
      if (wanted > to) {
        layers.set(edge.to, wanted)
        moved = true
      }
    }

    if (!moved) break
  }

  return layers
}

function truncateMiddle(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

// Shown inside the box. The trailing segment is what distinguishes one module
// from another, so it gets the emphasis and the parent path sits above it.
export function moduleName(id: string): string {
  const cut = id.lastIndexOf('/')
  return cut === -1 ? id : id.slice(cut + 1)
}

export function moduleParent(id: string): string | null {
  const cut = id.lastIndexOf('/')
  return cut === -1 ? null : truncateMiddle(id.slice(0, cut), 24)
}

export function layoutArchitecture(
  modules: ScanArchitectureModule[],
  edges: ScanArchitectureEdge[],
): ArchitectureLayout {
  if (modules.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 }
  }

  const layers = assignLayers(modules, edges)

  // Modules arrive sorted by id and stay that way within a column, so the same
  // scan always draws the same picture.
  const columns = new Map<number, ScanArchitectureModule[]>()
  for (const module of modules) {
    const layer = layers.get(module.id) ?? 0
    const column = columns.get(layer) ?? []
    column.push(module)
    columns.set(layer, column)
  }

  const layerIndexes = [...columns.keys()].sort((a, b) => a - b)
  const tallest = Math.max(
    ...layerIndexes.map((layer) => columns.get(layer)!.length),
  )

  const contentHeight = tallest * NODE_HEIGHT + (tallest - 1) * GAP_Y
  const height = contentHeight + PADDING * 2
  const width =
    layerIndexes.length * NODE_WIDTH +
    (layerIndexes.length - 1) * GAP_X +
    PADDING * 2

  const nodes: PositionedModule[] = []
  const positions = new Map<string, PositionedModule>()

  layerIndexes.forEach((layer, columnIndex) => {
    const column = columns.get(layer)!
    const columnHeight =
      column.length * NODE_HEIGHT + (column.length - 1) * GAP_Y
    // Centre each column against the tallest one, so a sparse column does not
    // hug the top edge.
    const startY = PADDING + (contentHeight - columnHeight) / 2

    column.forEach((module, rowIndex) => {
      const positioned: PositionedModule = {
        ...module,
        layer,
        x: PADDING + columnIndex * (NODE_WIDTH + GAP_X),
        y: startY + rowIndex * (NODE_HEIGHT + GAP_Y),
      }
      nodes.push(positioned)
      positions.set(module.id, positioned)
    })
  })

  const positionedEdges = edges.flatMap((edge): PositionedEdge[] => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (!from || !to) return []

    const startX = from.x + NODE_WIDTH
    const startY = from.y + NODE_HEIGHT / 2
    const endX = to.x
    const endY = to.y + NODE_HEIGHT / 2
    // Enough horizontal pull that an edge inside one column, or one pointing
    // back to an earlier column, still reads as a curve rather than a spike.
    const pull = Math.max(GAP_X / 2, Math.abs(endX - startX) / 2)

    return [
      {
        ...edge,
        path: `M ${startX} ${startY} C ${startX + pull} ${startY}, ${endX - pull} ${endY}, ${endX} ${endY}`,
      },
    ]
  })

  return { nodes, edges: positionedEdges, width, height }
}
