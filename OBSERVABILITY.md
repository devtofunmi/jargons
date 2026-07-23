# Observability (SigNoz + OpenTelemetry)

Jargons ships an AI code-review **agent** — GitHub PR webhook → LLM analysis → findings → GitHub feedback. The whole agent is instrumented with **vendor-neutral OpenTelemetry** and exports OTLP to **SigNoz**.

Because instrumentation is pure OTLP, the backend is swappable by env var only:

- **local dev / demo** → self-hosted SigNoz via Docker
- **production** → SigNoz on your own Kubernetes, or SigNoz Cloud

The app never depends on SigNoz being up: telemetry is a side channel, so if the
collector is unreachable, reviews still run for users.

## 1. Run SigNoz locally (self-host)

SigNoz self-host is a multi-container stack (ClickHouse, OTel Collector, query
service, UI). Clone the official deploy **once** — do not hand-roll it:

```bash
git clone -b main https://github.com/SigNoz/signoz.git
```

### Day-to-day: start / stop

**Docker Desktop must be running first** (whale icon → "Engine running") — the
#1 gotcha; otherwise `up` fails with a daemon/pipe error.

```bash
cd signoz/deploy/docker

docker compose up -d     # start (idempotent — safe to run anytime)
docker compose down      # stop, keeping all data (never use -v; that wipes it)
```

Or run from anywhere without cd-ing:

```bash
docker compose -f ~/Desktop/signoz/deploy/docker/docker-compose.yaml up -d
```

First start after a machine reboot takes ~30–60s for the query service to go
healthy. Check with:

```bash
docker ps --format "{{.Names}}\t{{.Status}}"   # wait for `signoz` = (healthy)
```

- SigNoz UI: http://localhost:8080
- OTLP ingest (what the app targets): `http://localhost:4318` (HTTP) / `:4317` (gRPC)

`.env` already points the app at the HTTP endpoint:

```
OTEL_SERVICE_NAME="jargons-review-agent"
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
SIGNOZ_API_KEY="..."   # for the in-app Agent Health tab (Settings → API Keys)
```

For **SigNoz Cloud** instead, set `OTEL_EXPORTER_OTLP_ENDPOINT` to your ingest URL
and add the `signoz-access-token` header via `OTEL_EXPORTER_OTLP_HEADERS`.

## 2. Launch the app with instrumentation

`instrumentation.mjs` must be preloaded before app code so `http`/`fetch`/`pg`
get patched. Preload it with Node's `--import`:

```bash
# development (recommended locally — server functions work, HMR, live traces)
NODE_OPTIONS="--import ./instrumentation.mjs" npm run dev

# production (built Nitro server)
npm run build
node --import ./instrumentation.mjs .output/server/index.mjs
```

## 3. What you'll see in SigNoz

- **Traces** — a span tree per run, every span tagged with `workspace`:
  - reviews: `review.run → github.fetch_diff → llm.review → db.write_findings → github.post_review`
  - scans: `scan.run → github.fetch_tree → github.fetch_files → llm.scan → db.write_summary`

  The `llm.*` span carries GenAI attributes (model, input/output tokens, cost).
  Auto-instrumented client spans to GitHub, the LLM API, and Postgres populate
  the **service map**.
- **Metrics** — `reviews_total`, `scans_total`, `review_duration_seconds`,
  `scan_duration_seconds`, `llm_tokens_total`, `llm_cost_usd_total`,
  `findings_total{severity}`, `review_failures_total{stage}`, and more — all
  tagged by `workspace`.
- **Logs** — structured, trace-correlated (click a trace → its logs).
- **Dashboard** — import `signoz/dashboard-review-agent.json` (Review Agent Health).
- **Alerts** — failure-rate, LLM latency, and daily cost-budget.
- **In-app** — the Agent Health tab (`/app/health`) queries SigNoz live for
  per-workspace token & cost telemetry.
