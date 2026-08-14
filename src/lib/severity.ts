// The single source of truth for finding severities and their order (most
// severe first). Every finding shape across the review engine, scan engine, and
// UI keys to this, along with the LLM response enum and finding sorting. The DB
// column has its own `finding_severity` pgEnum (the migration anchor in
// db/schema.ts) — keep the two lists in step.
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'note'] as const

export type Severity = (typeof SEVERITIES)[number]

// Sort key: lower rank = more severe (critical → 0, note → 4). Callers only
// pass validated severities, so the -1 an unknown value would return never
// arises.
export function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity)
}

// Findings tallied per severity.
export type SeverityCounts = Record<Severity, number>
