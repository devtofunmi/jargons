// OpenTelemetry bootstrap. MUST be preloaded before app code so the auto
// instrumentations patch http/fetch/pg first:
//   node --import ./instrumentation.mjs .output/server/index.mjs
// Backend is chosen entirely by OTEL_* env vars (SigNoz local/K8s/Cloud).

// dotenv here because vite.config.ts's dotenv is build-time only — the built
// Nitro server needs it loaded at runtime.
import 'dotenv/config'

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { logs } from '@opentelemetry/api-logs'

const serviceName = process.env.OTEL_SERVICE_NAME || 'jargons-review-agent'
const resource = resourceFromAttributes({ 'service.name': serviceName })

// Traces + metrics via NodeSDK (endpoint read from OTEL_* env vars).
const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 10_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Filesystem spans are extremely noisy and drown out the review traces.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
})

sdk.start()

// Structured logs over OTLP. Wired explicitly (NodeSDK's logRecordProcessors
// option does not bind the exporter correctly in this OTel version). Records
// emitted inside an active span carry that span's trace_id/span_id, so SigNoz
// links each log line back to its review trace.
const loggerProvider = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
})
logs.setGlobalLoggerProvider(loggerProvider)

const shutdown = () => {
  Promise.allSettled([sdk.shutdown(), loggerProvider.shutdown()])
    .catch((error) => console.error('OpenTelemetry shutdown failed', error))
    .finally(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
