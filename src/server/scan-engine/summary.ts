// Pure helpers for turning a stored codebase-scan summary (opaque JSON read back
// from the DB) into per-severity counts for display. No I/O — unit-tested in
// summary.test.ts.

import { SEVERITIES } from '../../lib/severity'
import type { Severity, SeverityCounts } from '../../lib/severity'

export type ScanFindingCounts = SeverityCounts

// The opaque JSON shape a scan stores in `summary`. Both count and finding
// readers coerce from it defensively.
export type ScanSummary = {
  counts?: Partial<ScanFindingCounts>
  findings?: Array<unknown>
  architecture?: unknown
}

export const emptyCounts: ScanFindingCounts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  note: 0,
}

// Prefer an explicit findings array length when present; otherwise fall back to
// summing the per-severity counts. Missing/!object summaries read as all-zero.
export function summaryToCounts(summary: unknown): {
  counts: ScanFindingCounts
  findingsCount: number
} {
  const parsed = (summary ?? {}) as ScanSummary
  const counts: ScanFindingCounts = { ...emptyCounts, ...(parsed.counts ?? {}) }
  const findingsCount = Array.isArray(parsed.findings)
    ? parsed.findings.length
    : counts.critical + counts.high + counts.medium + counts.low + counts.note
  return { counts, findingsCount }
}

// The architecture map as stored on a scan summary: modules are directories,
// edges are resolved imports between them, and the label is the only part a
// model wrote.
export type ScanArchitectureModule = {
  id: string
  label: string | null
  files: number
  findings: number
  counts: ScanFindingCounts
  topSeverity: Severity | null
}

export type ScanArchitectureEdge = {
  from: string
  to: string
  weight: number
}

export type ScanArchitecture = {
  modules: ScanArchitectureModule[]
  edges: ScanArchitectureEdge[]
  // Modules the map could not show, so the UI can say so rather than implying
  // it drew the whole repository.
  omittedModules: number
  // How many files the arrows were derived from, against the repository total.
  graphedFiles: number
  totalFiles: number
}

function readInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0
}

function readModule(value: unknown): ScanArchitectureModule[] {
  if (!value || typeof value !== 'object') return []
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) return []

  const counts: ScanFindingCounts = { ...emptyCounts }
  const storedCounts =
    raw.counts && typeof raw.counts === 'object'
      ? (raw.counts as Record<string, unknown>)
      : {}
  for (const severity of SEVERITIES) {
    counts[severity] = readInt(storedCounts[severity])
  }

  return [
    {
      id: raw.id,
      label: typeof raw.label === 'string' && raw.label ? raw.label : null,
      files: readInt(raw.files),
      findings: readInt(raw.findings),
      counts,
      topSeverity: SEVERITIES.includes(raw.topSeverity as Severity)
        ? (raw.topSeverity as Severity)
        : null,
    },
  ]
}

// Scans that ran before the map existed simply have no `architecture` key, and
// read back as null rather than as an empty diagram.
export function summaryToArchitecture(
  summary: unknown,
): ScanArchitecture | null {
  const parsed = (summary ?? {}) as ScanSummary
  const raw = parsed.architecture
  if (!raw || typeof raw !== 'object') return null

  const source = raw as Record<string, unknown>
  const modules = Array.isArray(source.modules)
    ? source.modules.flatMap(readModule)
    : []

  if (modules.length === 0) return null

  // An edge pointing at a module that is not on the map would render as an arrow
  // into empty space, so both ends have to exist.
  const ids = new Set(modules.map((module) => module.id))
  const edges = (Array.isArray(source.edges) ? source.edges : []).flatMap(
    (value): ScanArchitectureEdge[] => {
      if (!value || typeof value !== 'object') return []
      const edge = value as Record<string, unknown>
      if (typeof edge.from !== 'string' || typeof edge.to !== 'string')
        return []
      if (!ids.has(edge.from) || !ids.has(edge.to)) return []
      if (edge.from === edge.to) return []
      return [
        {
          from: edge.from,
          to: edge.to,
          weight: Math.max(1, readInt(edge.weight)),
        },
      ]
    },
  )

  return {
    modules,
    edges,
    omittedModules: readInt(source.omittedModules),
    graphedFiles: readInt(source.graphedFiles),
    totalFiles: readInt(source.totalFiles),
  }
}
