// Pure helpers for turning a stored codebase-scan summary (opaque JSON read back
// from the DB) into per-severity counts for display. No I/O — unit-tested in
// summary.test.ts.

import type { SeverityCounts } from '../../lib/severity'

export type ScanFindingCounts = SeverityCounts

// The opaque JSON shape a scan stores in `summary`. Both count and finding
// readers coerce from it defensively.
export type ScanSummary = {
  counts?: Partial<ScanFindingCounts>
  findings?: Array<unknown>
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
