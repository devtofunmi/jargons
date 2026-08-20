// Turns file-level import edges into the two things the scan needs from them:
// an order to read files in, and a module-level graph to draw.
//
// Everything here is derived from code. No shape in the output is a model's
// opinion — that is the whole point. A wrong label on a module is a shrug; a
// wrong arrow is a false dependency diagram someone pastes into a design doc.

import { severityRank } from '../../lib/severity'
import type { Severity, SeverityCounts } from '../../lib/severity'
import type { ImportEdge } from './imports'

// How many boxes the map may show. Past roughly this many, a dependency
// diagram stops being read and starts being squinted at.
export const MAX_MODULES = 24

// Files at the repository root belong to a module too, and it needs a name.
export const ROOT_MODULE = '.'

// The module a path belongs to: the directory holding it.
export function moduleOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? ROOT_MODULE : path.slice(0, cut)
}

function depthOf(moduleId: string): number {
  return moduleId === ROOT_MODULE ? 1 : moduleId.split('/').length
}

function parentOf(moduleId: string): string | null {
  if (moduleId === ROOT_MODULE) return null
  const cut = moduleId.lastIndexOf('/')
  return cut === -1 ? null : moduleId.slice(0, cut)
}

// How many distinct files import each path. This is the blast radius of a bug:
// a defect in a module twenty other files depend on is worth more attention
// than one in a leaf nothing imports.
export function fanInCounts(edges: ImportEdge[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const edge of edges) {
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1)
  }
  return counts
}

// Reorder already-ranked candidates so the most-depended-upon files come
// first. Sorting on fan-in alone is deliberate: Array.prototype.sort is stable,
// so files nothing imports keep the order the caller gave them rather than
// being reshuffled by a second guess.
export function rankFilesByFanIn(
  paths: string[],
  edges: ImportEdge[],
): string[] {
  const counts = fanInCounts(edges)
  return [...paths].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
}

export type ModuleNode = {
  id: string
  files: number
  findings: number
  counts: SeverityCounts
  // The most severe finding in the module, which is what colours its box.
  topSeverity: Severity | null
}

export type ModuleEdge = {
  from: string
  to: string
  // How many file-level imports this one arrow stands for.
  weight: number
}

export type ModuleGraph = {
  modules: ModuleNode[]
  edges: ModuleEdge[]
  // Set when the repository had more top-level modules than the map can show,
  // so the UI can say so instead of implying it drew everything.
  omittedModules: number
  // Findings whose file did not match anything in the tree. Should be zero;
  // counted rather than silently dropped so a drift shows up.
  unattributedFindings: number
}

const emptyModuleCounts = (): SeverityCounts => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  note: 0,
})

type Accumulator = {
  files: number
  counts: SeverityCounts
}

function blank(): Accumulator {
  return { files: 0, counts: emptyModuleCounts() }
}

function absorb(into: Accumulator, from: Accumulator) {
  into.files += from.files
  for (const severity of Object.keys(from.counts) as Array<Severity>) {
    into.counts[severity] += from.counts[severity]
  }
}

function totalFindings(counts: SeverityCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

function mostSevere(counts: SeverityCounts): Severity | null {
  const present = (Object.keys(counts) as Array<Severity>).filter(
    (severity) => counts[severity] > 0,
  )
  if (present.length === 0) return null
  return present.sort((a, b) => severityRank(a) - severityRank(b))[0]
}

// Merge the deepest modules into their parents until the map fits. Collapsing
// rather than dropping keeps every file accounted for: `src/server/llm` folding
// into `src/server` loses a level of detail, not a number.
//
// Modules are bucketed by depth once and each bucket is sorted once, so the
// whole pass is O(n log n). The obvious version — rescan and re-sort every
// module to pick the next single victim — is quadratic, and a repository with a
// couple of thousand directories spent over half a minute of blocking CPU in
// here before this was bucketed.
//
// Terminates because merging only ever moves a module to a strictly shallower
// depth, and the walk goes deepest-first and never revisits a depth.
function collapseToFit(
  accumulators: Map<string, Accumulator>,
  maxNodes: number,
): void {
  if (accumulators.size <= maxNodes) return

  const byDepth = new Map<number, string[]>()
  let deepest = 0

  for (const id of accumulators.keys()) {
    const depth = depthOf(id)
    deepest = Math.max(deepest, depth)
    const bucket = byDepth.get(depth) ?? []
    bucket.push(id)
    byDepth.set(depth, bucket)
  }

  // Depth 1 is the floor: a top-level module has no parent to fold into.
  for (let depth = deepest; depth > 1; depth -= 1) {
    if (accumulators.size <= maxNodes) return

    // Least interesting first: fewest findings, then fewest files, then path
    // order so the choice is never arbitrary.
    const bucket = (byDepth.get(depth) ?? [])
      .filter((id) => accumulators.has(id))
      .sort((a, b) => {
        const left = accumulators.get(a)!
        const right = accumulators.get(b)!
        return (
          totalFindings(left.counts) - totalFindings(right.counts) ||
          left.files - right.files ||
          a.localeCompare(b)
        )
      })

    for (const id of bucket) {
      if (accumulators.size <= maxNodes) return

      const parent = parentOf(id)
      if (!parent) continue

      const existing = accumulators.get(parent)
      const target = existing ?? blank()
      absorb(target, accumulators.get(id)!)
      accumulators.set(parent, target)
      accumulators.delete(id)

      if (!existing) {
        // A parent that did not exist as a module of its own joins its own
        // bucket, so a later, shallower pass can fold it further if needed.
        const parentDepth = depthOf(parent)
        const parentBucket = byDepth.get(parentDepth) ?? []
        parentBucket.push(parent)
        byDepth.set(parentDepth, parentBucket)
      }
    }
  }
}

// Map an original module id onto whichever surviving module now contains it, by
// walking up until a kept ancestor is found.
function survivorOf(moduleId: string, kept: Set<string>): string | null {
  let current: string | null = moduleId
  while (current) {
    if (kept.has(current)) return current
    current = parentOf(current)
  }
  return null
}

export function buildModuleGraph({
  paths,
  edges,
  findings,
  maxNodes = MAX_MODULES,
}: {
  // Every code path in the repository, so file counts and structure are
  // complete even though edges only cover the files that were read.
  paths: string[]
  edges: ImportEdge[]
  findings: Array<{ filePath: string; severity: Severity }>
  maxNodes?: number
}): ModuleGraph {
  const fileSet = new Set(paths)
  const accumulators = new Map<string, Accumulator>()

  for (const path of paths) {
    const id = moduleOf(path)
    const entry = accumulators.get(id) ?? blank()
    entry.files += 1
    accumulators.set(id, entry)
  }

  let unattributedFindings = 0
  for (const finding of findings) {
    const entry = accumulators.get(moduleOf(finding.filePath))
    if (!entry) {
      // The path came back from the model, so it can drift from the tree.
      unattributedFindings += 1
      continue
    }
    entry.counts[finding.severity] += 1
  }

  collapseToFit(accumulators, maxNodes)

  // Only reachable when the repository has more top-level directories than the
  // map can show, since collapsing cannot merge depth-1 modules any further.
  let omittedModules = 0
  if (accumulators.size > maxNodes) {
    const ordered = [...accumulators.entries()].sort(
      ([aId, a], [bId, b]) =>
        totalFindings(b.counts) - totalFindings(a.counts) ||
        b.files - a.files ||
        aId.localeCompare(bId),
    )
    omittedModules = ordered.length - maxNodes
    for (const [id] of ordered.slice(maxNodes)) accumulators.delete(id)
  }

  const kept = new Set(accumulators.keys())

  // A resolved target is either a file whose directory is the module, or — for
  // import systems that name packages rather than files — already a directory.
  const moduleForTarget = (target: string) =>
    fileSet.has(target) ? moduleOf(target) : target

  // Nested rather than a joined string key: a repository path may contain any
  // character, so there is no separator that is safe to split back on.
  const weights = new Map<string, Map<string, number>>()
  for (const edge of edges) {
    const from = survivorOf(moduleOf(edge.from), kept)
    const to = survivorOf(moduleForTarget(edge.to), kept)
    if (!from || !to || from === to) continue
    const targets = weights.get(from) ?? new Map<string, number>()
    targets.set(to, (targets.get(to) ?? 0) + 1)
    weights.set(from, targets)
  }

  const modules: ModuleNode[] = [...accumulators.entries()]
    .map(([id, entry]) => ({
      id,
      files: entry.files,
      findings: totalFindings(entry.counts),
      counts: entry.counts,
      topSeverity: mostSevere(entry.counts),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  const moduleEdges: ModuleEdge[] = [...weights.entries()]
    .flatMap(([from, targets]) =>
      [...targets.entries()].map(([to, weight]) => ({ from, to, weight })),
    )
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

  return {
    modules,
    edges: moduleEdges,
    omittedModules,
    unattributedFindings,
  }
}
