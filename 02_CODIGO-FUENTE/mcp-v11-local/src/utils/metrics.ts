/**
 * Prometheus metrics registry + HTTP endpoint — Phase 2 (2026-07-23).
 *
 * Exposes a single /metrics endpoint on the v10 Express app returning
 * OpenMetrics-format text suitable for scraping by Prometheus/Grafana.
 *
 * Metric families:
 *   - letxipu_tool_calls_total{tool,status}     counter
 *   - letxipu_tool_latency_ms_bucket{tool,le}   histogram (50/100/500/1k/5k/30k/60k/120k)
 *   - letxipu_tool_cache_hits_total{tool}       counter
 *   - letxipu_provider_calls_total{provider}     counter
 *   - letxipu_provider_errors_total{provider}    counter
 *   - letxipu_sources_online                     gauge (number reported by health_check)
 *
 * Usage in mcp.ts dispatcher:
 *
 *   const t0 = Date.now();
 *   const status = 'ok';
 *   try { ... } catch { status = 'error'; }
 *   metrics.toolCalls.inc({ tool: toolName, status });
 *   metrics.toolLatency
 *       .labels(toolName)
 *       .observe(Date.now() - t0);
 *
 * Express:
 *   app.get('/metrics', async (c) => c.type('text/plain; version=0.0.4').send(await metrics.register.metrics()));
 *
 * Enable/disable via env `LETXIPU_METRICS=1` (default 1 when NODE_ENV=production).
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

const METRICS_ENABLED = (process.env.LETXIPU_METRICS ?? '1') !== '0';

const register = new Registry();

// Default Node.js metrics (gc, eventloop, etc.) — opt-in cost is tiny
if (METRICS_ENABLED) {
    collectDefaultMetrics({ register });
}

// ─── Counters ──────────────────────────────────────────────────────────────
export const toolCalls = new Counter({
    name: 'letxipu_tool_calls_total',
    help: 'Total MCP tool invocations by tool name, calling client, and outcome status',
    labelNames: ['tool', 'client', 'status'] as const,
    registers: [register],
});

export const toolCacheHits = new Counter({
    name: 'letxipu_tool_cache_hits_total',
    help: 'Cache hits for cacheable tools (search, batch_search, list_sources, etc.)',
    labelNames: ['tool'] as const,
    registers: [register],
});

export const providerCalls = new Counter({
    name: 'letxipu_provider_calls_total',
    help: 'Per-provider HTTP fetch calls (OpenAlex, Crossref, Semantic, Scielo, etc.)',
    labelNames: ['provider'] as const,
    registers: [register],
});

export const providerErrors = new Counter({
    name: 'letxipu_provider_errors_total',
    help: 'Per-provider HTTP fetches that ended in error (5xx, timeout, network)',
    labelNames: ['provider'] as const,
    registers: [register],
});

// ─── Histograms ────────────────────────────────────────────────────────────
const LATENCY_BUCKETS: number[] = [50, 100, 250, 500, 1000, 5000, 30000, 60000, 120000];

export const toolLatency = new Histogram({
    name: 'letxipu_tool_latency_ms',
    help: 'MCP tool execution latency in milliseconds (outer dispatcher wall time)',
    labelNames: ['tool'] as const,
    buckets: LATENCY_BUCKETS,
    registers: [register],
});

export const providerLatency = new Histogram({
    name: 'letxipu_provider_latency_ms',
    help: 'Per-provider HTTP fetch latency in milliseconds (single fetch, no retries)',
    labelNames: ['provider'] as const,
    buckets: LATENCY_BUCKETS,
    registers: [register],
});

// ─── Gauges ────────────────────────────────────────────────────────────────
export const sourcesOnline = new Gauge({
    name: 'letxipu_sources_online',
    help: 'Number of academic sources reporting online in last health_check pass',
    registers: [register],
});

export const sourcesTotal = new Gauge({
    name: 'letxipu_sources_total',
    help: 'Total number of academic sources configured (denominator for online ratio)',
    registers: [register],
});

// ─── Public surface ───────────────────────────────────────────────────────
export const metrics = {
    enabled: METRICS_ENABLED,
    register,
    toolCalls,
    toolCacheHits,
    toolLatency,
    providerCalls,
    providerErrors,
    providerLatency,
    sourcesOnline,
    sourcesTotal,

    /** Prom-registry.metrics() returns the OpenMetrics text. */
    async renderMetrics(): Promise<string> {
        if (!METRICS_ENABLED) {
            return '# letxipu metrics disabled (LETXIPU_METRICS=0)\n';
        }
        return register.metrics();
    },

    /** Returns the Content-Type Prometheus expects. */
    contentType(): string {
        return register.contentType;
    },
};

export default metrics;
export { register };
