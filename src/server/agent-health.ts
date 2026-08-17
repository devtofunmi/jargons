import { createServerFn } from '@tanstack/react-start'

import { getCurrentUserFromCookie } from './github-auth'

// Agent Health: run counts, failure rate, latency, and hourly throughput for
// the signed-in workspace over the last 24h. Everything is read straight from
// Postgres, so the numbers are exact and need no external telemetry backend.

export type ThroughputPoint = {
  timestamp: number
  reviews: number
  scans: number
}

export type AgentHealth = {
  available: boolean
  windowHours: number
  reviews: number
  scans: number
  findings: number
  failures: number
  successRatePct: number | null
  avgReviewLatencySeconds: number | null
  avgScanLatencySeconds: number | null
  throughput: ThroughputPoint[]
}

const WINDOW_HOURS = 24
const HOUR_MS = 60 * 60 * 1000

const unavailable: AgentHealth = {
  available: false,
  windowHours: WINDOW_HOURS,
  reviews: 0,
  scans: 0,
  findings: 0,
  failures: 0,
  successRatePct: null,
  avgReviewLatencySeconds: null,
  avgScanLatencySeconds: null,
  throughput: [],
}

// --- Database (counts, latency, throughput) ---

type AggRow = { total: number; failed: number; avg_latency: number }

export const getAgentHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AgentHealth> => {
    const currentUser = await getCurrentUserFromCookie()
    if (!currentUser?.workspace) {
      return unavailable
    }

    const workspaceId = currentUser.workspace.id
    // ISO string, not a Date: postgres-js's Date-parameter serialization throws
    // in the bundled SSR runtime. Postgres casts the text to timestamptz.
    const since = new Date(Date.now() - WINDOW_HOURS * HOUR_MS).toISOString()

    try {
      const { sqlClient: db } = await import('../db/client')

      const [reviewRows, reviewFindingRows, scanRows, throughputRows] =
        await Promise.all([
          db<AggRow[]>`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE rr.status = 'failed')::int AS failed,
            coalesce(avg(extract(epoch from (rr.completed_at - rr.started_at)))
              FILTER (WHERE rr.status = 'complete' AND rr.completed_at IS NOT NULL AND rr.started_at IS NOT NULL), 0)::float AS avg_latency
          FROM review_runs rr
          JOIN pull_requests pr ON pr.id = rr.pull_request_id
          JOIN repositories r ON r.id = pr.repository_id
          WHERE r.workspace_id = ${workspaceId} AND rr.created_at >= ${since}
        `,
          db<Array<{ n: number }>>`
          SELECT count(*)::int AS n
          FROM findings f
          JOIN review_runs rr ON rr.id = f.review_run_id
          JOIN pull_requests pr ON pr.id = rr.pull_request_id
          JOIN repositories r ON r.id = pr.repository_id
          WHERE r.workspace_id = ${workspaceId} AND f.created_at >= ${since}
        `,
          db<Array<AggRow & { findings: number }>>`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE cs.status = 'failed')::int AS failed,
            coalesce(avg(extract(epoch from (cs.completed_at - cs.started_at)))
              FILTER (WHERE cs.status = 'complete' AND cs.completed_at IS NOT NULL AND cs.started_at IS NOT NULL), 0)::float AS avg_latency,
            coalesce(sum(jsonb_array_length(cs.summary->'findings'))
              FILTER (WHERE jsonb_typeof(cs.summary->'findings') = 'array'), 0)::int AS findings
          FROM codebase_scans cs
          JOIN repositories r ON r.id = cs.repository_id
          WHERE r.workspace_id = ${workspaceId} AND cs.created_at >= ${since}
        `,
          db<Array<{ ts: string; kind: string; n: number }>>`
          SELECT (extract(epoch from date_trunc('hour', created_at)) * 1000)::bigint AS ts, kind, count(*)::int AS n
          FROM (
            SELECT rr.created_at, 'review' AS kind
            FROM review_runs rr
            JOIN pull_requests pr ON pr.id = rr.pull_request_id
            JOIN repositories r ON r.id = pr.repository_id
            WHERE r.workspace_id = ${workspaceId} AND rr.created_at >= ${since}
            UNION ALL
            SELECT cs.created_at, 'scan' AS kind
            FROM codebase_scans cs
            JOIN repositories r ON r.id = cs.repository_id
            WHERE r.workspace_id = ${workspaceId} AND cs.created_at >= ${since}
          ) runs
          GROUP BY ts, kind
          ORDER BY ts
        `,
        ])

      // Aggregate queries (no GROUP BY) always return exactly one row.
      const review = reviewRows[0]
      const scan = scanRows[0]
      const reviewFindings = Number(reviewFindingRows[0].n) || 0

      const reviews = Number(review.total) || 0
      const scans = Number(scan.total) || 0
      const failures = (Number(review.failed) || 0) + (Number(scan.failed) || 0)
      const runs = reviews + scans
      const findings = reviewFindings + (Number(scan.findings) || 0)

      // Index activity by hour bucket...
      const byHour = new Map<number, { reviews: number; scans: number }>()
      for (const raw of throughputRows) {
        const ts = Number(raw.ts)
        const b = byHour.get(ts) ?? { reviews: 0, scans: 0 }
        if (raw.kind === 'review') b.reviews += Number(raw.n) || 0
        else b.scans += Number(raw.n) || 0
        byHour.set(ts, b)
      }
      // ...then emit a continuous hourly series (0-filled) so the area chart has
      // an unbroken timeline instead of jumping between sparse active hours.
      const startHour =
        Math.floor((Date.now() - WINDOW_HOURS * HOUR_MS) / HOUR_MS) * HOUR_MS
      const throughput: ThroughputPoint[] = []
      for (let i = 0; i <= WINDOW_HOURS; i++) {
        const timestamp = startHour + i * HOUR_MS
        const v = byHour.get(timestamp) ?? { reviews: 0, scans: 0 }
        throughput.push({ timestamp, reviews: v.reviews, scans: v.scans })
      }

      return {
        available: true,
        windowHours: WINDOW_HOURS,
        reviews,
        scans,
        findings,
        failures,
        successRatePct:
          runs > 0 ? Math.round(((runs - failures) / runs) * 100) : null,
        avgReviewLatencySeconds:
          Number(review.avg_latency) > 0 ? Number(review.avg_latency) : null,
        avgScanLatencySeconds:
          Number(scan.avg_latency) > 0 ? Number(scan.avg_latency) : null,
        throughput,
      }
    } catch (error) {
      console.error('[agent-health] failed:', error)
      return { ...unavailable, available: true }
    }
  },
)
