// Shared tracer, logger, and metric instruments. The SDK is started in
// instrumentation.mjs (preloaded before the app); this module just grabs the
// globals so every call site uses the same names.

import { metrics, trace } from '@opentelemetry/api'
import { SeverityNumber, logs } from '@opentelemetry/api-logs'

export const tracer = trace.getTracer('jargons.review-agent')

const logger = logs.getLogger('jargons.review-agent')

type LogAttributes = Record<string, string | number | boolean>

// Emitted inside an active span, the OTel logs SDK stamps the record with that
// span's trace_id/span_id, so SigNoz links each log line to its trace.
export function logInfo(message: string, attributes?: LogAttributes) {
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: message,
    attributes,
  })
  console.log(message, attributes ?? '')
}

export function logError(message: string, attributes?: LogAttributes) {
  logger.emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: 'ERROR',
    body: message,
    attributes,
  })
  console.error(message, attributes ?? '')
}

const meter = metrics.getMeter('jargons.review-agent')

export const reviewsTotal = meter.createCounter('reviews_total', {
  description: 'Review runs processed by the agent',
})

export const reviewDuration = meter.createHistogram('review_duration_seconds', {
  description: 'End-to-end duration of a review run',
  unit: 's',
})

export const llmTokensTotal = meter.createCounter('llm_tokens_total', {
  description: 'LLM tokens consumed by the review engine',
})

export const llmCostUsdTotal = meter.createCounter('llm_cost_usd_total', {
  description: 'Estimated USD cost of LLM usage',
  unit: 'USD',
})

export const findingsTotal = meter.createCounter('findings_total', {
  description: 'Findings produced by the review engine',
})

export const reviewFailuresTotal = meter.createCounter(
  'review_failures_total',
  {
    description: 'Review runs that failed, by pipeline stage',
  },
)

export const scansTotal = meter.createCounter('scans_total', {
  description: 'Codebase scan runs processed by the agent',
})

export const scanDuration = meter.createHistogram('scan_duration_seconds', {
  description: 'End-to-end duration of a codebase scan run',
  unit: 's',
})

export const scanFilesTotal = meter.createCounter('scan_files_total', {
  description: 'Files analysed by codebase scans',
})

export const scanFindingsTotal = meter.createCounter('scan_findings_total', {
  description: 'Findings produced by codebase scans',
})

export const scanFailuresTotal = meter.createCounter('scan_failures_total', {
  description: 'Scan runs that failed, by pipeline stage',
})
