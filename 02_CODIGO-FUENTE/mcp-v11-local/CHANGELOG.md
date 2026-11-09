# Changelog

All notable changes to **letxipu-search-mcp-v10** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.0.0] — 2026-07-23

Major演进 de v9.x a v10.0.0. Lista de cambios incorporados en la auditoría
completa del repositorio `MCP_CLIENTE_LATEX_V3`.

### Added — Fase 1 (per-tool timeouts + DEPRECATED markers)
- **`src/utils/tool-timeouts.ts`**: `TOOL_TIMEOUTS` map para las 25 tools (rangos
  5–120s por tipo) + `withToolTimeout(name, fn, overrideMs?)` que envuelve la
  ejecución con `AbortController` + `Promise.race`. Abort lanzado como
  `AbortError` si excede timeout. Parámetro `overrideMs` para tests sin esperar
  30s reales.
- **`src/routes/mcp.ts`**:
  - `tools/list` ahora marca 5 tools con `x_deprecated: true` + `x_deprecated_reason`
    + `x_alternative` (campos aditivos según MCP spec). Descripción prefixada con
    `[DEPRECATED]` para clients que no parseen extensiones. Tools marcadas:
    `smart_search`, `fetch_metadata`, `recover_metadata`, `search_dblp`,
    `pdf_sections`.
  - Dispatcher envuelve cada `tools/call` con `withToolTimeout(toolName, ...)`.
    Timeout produce JSON-RPC error code `-32001` con `data.cooldown_ms`.

### Added — Fase 2 (structured logging + Prometheus metrics)
- **`src/utils/logger.ts`**: pino 10.3.1 con `LOG_LEVEL`/`LETXIPU_LOG_LEVEL` env.
  JSON pretty solo en desarrollo + TTY; JSON compacto a stderr en producción.
- **`src/utils/metrics.ts`**: prom-client 15.1.3 con Registry custom:
  - `letxipu_tool_calls_total{tool,status}` counter (status: ok, error,
    timeout, cache_hit, validation_error, exception)
  - `letxipu_tool_cache_hits_total{tool}` counter
  - `letxipu_tool_latency_ms_bucket{tool,le}` histogram (buckets 50ms–120s)
  - `letxipu_provider_calls_total{provider}` counter
  - `letxipu_provider_errors_total{provider}` counter
  - `letxipu_provider_latency_ms_bucket{provider,le}` histogram
  - `letxipu_sources_online` / `letxipu_sources_total` gauges
  - `collectDefaultMetrics` activo por defecto (GC, eventloop)
  - Env `LETXIPU_METRICS=0` deshabilita
- **`src/server.ts`**: endpoint `GET /metrics` retorna `text/plain; version=0.0.4`
  Prometheus format. Listo para scraping por Grafana.
- **`src/routes/mcp.ts`**: dispatcher instrumentado con `metrics.toolCalls.inc`
  + `metrics.toolLatency.observe` en 6 paths (ok/timeout/error/cache_hit/
  validation_error/exception). Cache hit → `metrics.toolCacheHits.inc`.
  Console-redirect shim al inicio del archivo redirige los 24 `console.*`
  restantes (recovery batch_search / smart_search / query-vars) a
  `log.info/warn/error` preservando metadata.

### Added — Fase 3 (retry with backoff + jitter)
- **`src/utils/fetch-retry.ts`**: `fetchWithRetry(url, options, cfg?, signal?)`
  wrapper sobre `fetchWithTimeout` con:
  - Backoff exponencial + full jitter: `delay = rand[0, base * 2^attempt]`
  - Cap `maxBackoffMs` (default 8000) para evitar esperas infinitas
  - Retries en HTTP 429/503/504 + TypeError (network) + AbortError (timeout)
  - NO retry en CircuitOpenError (circuit breaker ya abierto → propagar)
  - NO retry en 4xx other than 429 (client error, retry no ayuda)
  - NO retry en AbortSignal abortado por caller
  - Hasta `maxAttempts` = 3 (initial + 2 retries)
- Helper exports: `computeBackoff`, `isRetryableError`, `isRetryableStatus`,
  `DEFAULT_RETRY_CONFIG`.

### Added — Tests
- `tests/tool-timeouts.test.ts` — 19 tests (timer, deadline exceeded, signal
  forwarding, concurrency isolation).
- `tests/fetch-retry.test.ts` — 34 tests (computeBackoff bounds, jitter,
  exponential growth, isRetryableError dispatch, isRetryableStatus, default
  config).
- Regression: `tests/validators.test.ts` sigue en 81/81 PASS.

### Changed
- **package.json**: añadidas dependencias `pino ^10.3.1` y `prom-client ^15.1.3`.
- **`src/routes/mcp.ts`**: imports de `withToolTimeout`, `metrics`, `log` al
  dispatcher. `console.log`/`console.error` reemplazados en paths críticos
  (validation fail, handler exception) por `log.warn`/`log.error`.

### Dependencies (net add)
- `pino` 10.3.1 — ~80KB minified. Logger structured JSON.
- `prom-client` 15.1.3 — ~50KB minified. Prometheus metrics export.

### Fixed / Hardening
- Dispatcher ya no puede colgarse indefinidamente en un tool lento: timeout
  outer garantiza respuesta en ≤120s (cada tool tiene su timeout propio).
- `CircuitOpenError` propagado a callers (Promise.allSettled) para que
  `batch_search` pueda continuar con los providers restantes.
- Hot-path logging ahora estructurado (JSON) con correlation IDs.

### Migration guide
- **Clients MCP**: los campos `x_deprecated` en `tools/list` son aditivos y
  no rompen clients viejos. Si tu cliente los parsea, puede mostrar el
  `x_alternative` sugerido al usuario en lugar de la tool obsoleta.
- **Operators**: el endpoint `/metrics` expuesto en el mismo puerto que el
  server MCP. Añádelo a tu Prometheus scrape config:
  ```yaml
  - job_name: 'letxipu-v10'
    static_configs:
      - targets: ['localhost:4002']
  ```
  Liberty de filtrar con `metric_relabel_configs` si solo quieres `letxipu_*`.
- **Env vars nuevas** (todas opcionales, con defaults sensibles):
  - `LETXIPU_LOG_LEVEL` / `LOG_LEVEL`: nivel de log pino. Default `info`.
  - `LETXIPU_METRICS`: `0` deshabilita metrics. Default `1`.

### Added — Phase 5 (configurable env-var timeouts)
- **`TOOL_TIMEOUTS.search` raised 30s → 90s**: ALICIA internal provider timeout
  is 45s; with multi-source fan-out + fetchWithRetry (500ms-8s backoff, 3 attempts)
  a single search touching ALICIA can take up to ~70-80s before returning. 90s
  keeps margin under the opencode client ~120s ceiling.
- **`RENATI_ATTEMPT_TIMEOUT` (env `RENATI_ATTEMPT_TIMEOUT_MS`)**: was 15s
  hardcoded in `latam-repositories.ts:804` → 30s default. ALICIA live-latency is
  8-14s (search API only), +5-15s during DME enhancement. 15s aborted
  prematurely. Configurable via env as upper-bound.
- **`PROVIDER_TIMEOUT_MS` (env)**: was hardcoded `setTimeout(45000)` in
  `routes/search.ts:187` → `parseInt(process.env.PROVIDER_TIMEOUT_MS) || 45000`.
  Per-provider race timeout, honored as upper-bound.
- **`INTERNAL_API_TIMEOUT_MS` (env)**: was hardcoded
  `AbortSignal.timeout(120000)` in `mcp.ts callInternalApi` → configurable via
  env var. Default 120s gives ALICIA/MinerU/etc ample time.
- **Tests updated**: `tool-timeouts.test.ts` assertion `search === 90_000`
  (was `30_000`).

### Added — Phase 6 (client-aware adaptive timeouts)

**Major**: replaces env-var-only timeout tuning with automatic detection of the
calling MCP client via the `User-Agent` header. The server derives **4 nested
timeout layers from a single client ceiling**, so every client
(opencode/Claude/Cursor/CLI) gets a calibrated budget automatically.

#### Detection (`src/utils/client-detection.ts`)
- `detectMcpClient(userAgent)` → `'opencode' | 'claude' | 'claude-code' | 'cursor' | 'cli' | 'unknown'`.
  Signatures matched (case-insensitive): `opencode/`, `claude`/`anthropic`,
  `claude-code`/`anthropic-cli` (takes precedence over `claude`), `cursor`,
  `curl`/`python-requests`/`node-fetch`/`axios`/`got/`/`okhttp`/`java/`/`go-resty`.
  Unknown/empty UA → `'unknown'`.
- `CLIENT_CEILINGS_MS`: opencode=120s, claude=300s, claude-code=300s,
  cursor=180s, cli=600s, unknown=120s (conservative).
- `CLIENT_BATCH_CAPS`: opencode=8 srcs × 3 queries (24 total),
  claude/claude-code=16 × 6 (96), cursor=12 × 4 (48), cli=16 × 6 (96),
  unknown=8 × 3 (24).

#### 4 derived timeout layers (`deriveTimeouts`)
```
L1 outer  = min(TOOL_TIMEOUTS[tool], ceiling × 0.95)   // withToolTimeout envelope
L2 inner  = outer × 0.95                               // callInternalApi fetch
L3 race   = outer × 0.50                               // per-provider race
L4 try    = race  × 0.67                               // per-attempt (ALICIA)
```

#### Env-var upper-bound semantics
- `PROVIDER_TIMEOUT_MS`, `INTERNAL_API_TIMEOUT_MS`, `RENATI_ATTEMPT_TIMEOUT_MS`
  are STILL honored if set, but they now act as an **upper bound**: the
  auto-derived value is `min(auto, env)`. A misconfigured env var can never
  exceed the client's actual ceiling.

#### batch_search auto-cap
- `handleBatchSearch` now reads `body.__batchCaps` (stashed by the dispatcher
  based on `detectMcpClient`).
- `expandSources(sources, maxSources?)` accepts an optional cap; truncates
  group expansion to `maxSources`.
- Queries beyond `maxQueries` are silently truncated (log warning).
- Zod validator raised `.max(6)` → `.max(10)` (absolute max, dispatcher
  applies per-client cap).

#### `TOOL_TIMEOUTS.batch_search` raised 120s → 240s
- 6 queries × 16 sources × ~10s/source under slow providers needs ~240s.
- Under opencode (120s ceiling): `deriveTimeouts` caps outer to 114s + batch
  cap to 8×3=24 sources (vs 96) → fits in ~60s.
- Under claude/CLI (300s+/600s+ ceilings): full 240s budget honored.

#### Metrics
- `metrics.toolCalls` Counter labels extended from `['tool','status']` to
  `['tool','client','status']`. All `inc({...})` call sites updated.
- New label `client` lets Prometheus queries filter by client (e.g.,
  `sum by (client) (letxipu_tool_calls_total)`).

#### Tests (`tests/client-detection.test.ts`)
- 52 assertions covering: UA detection for each client type, empty/unknown,
  CLIENT_CEILINGS_MS entries + values, deriveTimeouts ratios (outer<ceiling,
  inner<outer, race=outer×0.50, try=race×0.67), batch_search cap under tight
  vs generous clients, applyEnvUpperBound (env<auto / env>auto / unset /
  invalid / 0 / negative).
- Total tests: **186/186 PASS** (52 client-detection + 19 tool-timeouts +
  34 fetch-retry + 81 validators).

#### End-to-end verification
- opencode UA `opencode/0.5.0` + batch_search 8 queries × latam+global →
  capped to 3 queries × 8 sources = 24 sources, completed in **59.8s** (OK 41KB).
- claude UA `claude/1.0.0` + same request → capped to 6 queries × 16 sources =
  96 sources, completed in **206s** (OK 42KB), under 240s outer budget.
- search UA `curl/8.4.0` + 3 single-mode UAs verified accept + processing
  preserved for all client variants.

### Added — Phase 6 E2E suite (`scripts/run_e2e_adaptive.ps1`)
- **33 test cases** spanning 6 client UAs (opencode, claude, claude-code, cursor,
  curl/cli, empty/unknown) × 8 tools (list_sources, tools/list, search,
  batch_search, health_check, coverage_report, help, smart_search).
- **5 categories**: baseline smoke, single-source search, slow ALICIA/latam
  sources, batch_search adaptive caps, cache behavior, JSON-RPC error codes.
- Outputs: `e2e_results.json`, `e2e_results.csv`, `e2e_report.md`,
  `e2e_console.log`, `e2e_run.log` (Tee).
- Adaptive client-side timeout in the PowerShell HTTP client (115s for opencode,
  290s for claude/claude-code, 175s for cursor, 290s for curl/CLI) so the test
  harness waits long enough to capture slow real responses (the v10 server
  itself caps inner work via derivedTimeouts).
- Flags `-OnlyTests 1,8,15` and `-Quick` for partial reruns.

### Fixed — Phase 6 E2E findings (bug fixes surfaced by the suite)
- **`src/utils/cache.ts` — cacheKey fragmented by `__timeouts`/`__batchCaps`**:
  the dispatcher injects these hidden keys into `args` *after* the cache-read
  check but *before* the cache-write, so write-key ≠ read-key → cache never
  hit. Fix: `cacheKey()` now strips any `__`-prefixed key before serializing
  (verified by tests #23→#24 cache hit going from false to true, ~700ms saved
  per repeat query, cross-client #25 also hits).
- **`src/routes/mcp.ts:2152` — unknown tool returned `-32603` instead of `-32601`**:
  `callInternalApi` threw `Error("Unknown tool: X")` which the catch block
  re-emitted as `-32603 Internal error`. Per JSON-RPC 2.0 spec, an unknown
  method name must be `-32601 Method not found`. Fix: catch block now detects
  `/^Unknown tool:/` and maps to `-32601`. Verified by test #28.
- **`tests/client-detection.test.ts` unchanged**: 52/52 still PASS post-fix.
- **Total tests v10**: 186 unit (52 client-detection + 81 validators + 19 tool-timeouts + 34 fetch-retry) + 33 E2E = **219/219 PASS**.

### Pre-existing infrastructure (carried over from v9.x)
- Inter-process provider gate (`src/utils/inter-process-provider-limiter.ts`):
  rate-limit + circuit-breaker por dominio persistido en `.cache/provider-gate.json`.
- Inter-process Nominatim rate-limiter (`src/utils/inter-process-rate-limiter.ts`).
- Dual-layer cache (`src/utils/cache.ts`): memory + disco 24h TTL.
- zod-based `validators.ts` con 81 tests cubriendo las 28 tools.

---

## [9.x] — Antes de auditoría (pre-2026-07-23)
El historial completo de v9.x no está reproducido en este CHANGELOG (no existía
CHANGELOG.md previo). Para auditoría del estado anterior a v10.0.0, verificado
vía git log del repo original.

---

## Versioning policy

- **MAJOR**: cambios en API contract (response schema, nuevo endpoint required,
  breaking MCP method). v9→v10 fue major.
- **MINOR**: nueva tool, nuevo endpoint opcional, backward-compatible.
- **PATCH**: bug fixes, documentación.

## Release process

1. Bump `package.json` version.
2. Actualizar este CHANGELOG.md (ver formato Keep a Changelog).
3. `npm run build && npm test`.
4. Smoke test real (levantar server, invocar `/api/mcp` `tools/list` +
   `/metrics`).
5. Tag git `vX.Y.Z` + push.
