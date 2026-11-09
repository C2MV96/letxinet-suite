/**
 * Centralized per-tool timeouts with AbortController.
 *
 * Phase 1 fix (2026-07-23): replaces scattered hardcoded timeouts
 * found in mcp.ts (60s, 45s, 150s, 120s, 10s) with a single dispatcher
 * keyed by tool name. Default 30s.
 *
 * Rationale: skills `letxipu-complete` and `letxipu-academic-search`
 * documented "TIMEOUT >4min always" for smart_search, pdf_sections,
 * search_dblp, fetch_metadata, recover_metadata. A single map + a
 * single wrapper centralises deadline enforcement, prevents hung
 * providers from blocking the whole server, and offers consistent
 * ~30-300s budgets per tool class.
 *
 * Usage from src/routes/mcp.ts dispatcher (~ line 1932):
 *
 *     const result = await withToolTimeout(toolName, (signal) =>
 *         callInternalApi(toolName, args, baseUrl)
 *     );
 *
 * Note: callInternalApi internally uses its own AbortSignal.timeout(120000)
 * for HTTP fetch to /api. That inner timeout is *shorter* than the outer
 * tool-level deadline for batch/long tools, so it's the inner one that
 * aborts first. For tools whose inner timeout is higher than the outer
 * (e.g. health_check → 10s inner vs 30s default outer), the outer wins.
 * The outer wrapper is a *safety net*, not a replacement for inner
 * fetchWithTimeout/AbortSignal.timeout. Providing `signal` lets future
 * custom providers propagate the abort to their downstream fetches.
 */

export const TOOL_TIMEOUTS: Readonly<Record<string, number>> = Object.freeze({
    // Search-class tools: short budgets
    // search raised 30s → 120s: ALICIA (Peru) internal provider timeout is 45s;
    // with multi-source fan-out + fetchWithRetry backoff (500ms-8s, 3 attempts)
    // a single search touching ALICIA can take up to ~60-70s before returning.
    // 120s is capped to 114s for OpenCode, leaving 108s for the internal
    // /api/search call and its JSON-RPC response envelope. That covers the
    // observed ~91s Peru path without exceeding OpenCode's ~120s ceiling.
    search: 120_000,
    search_paperswithcode: 60_000,
    search_conferences: 60_000,
    trending_papers: 60_000,
    list_sources: 10_000,

    // Batch + smart: long-running but bounded.
    // batch_search raised 120s → 240s: 6 queries × 16 sources × ~10s/source under
    // slow providers (ALICIA 8-14s latency, DME enhancement 5-15s) needs ~240s.
    // Under opencode (120s ceiling), deriveTimeouts caps outer to 114s and
    // batch_search auto-caps to 8 sources × 3 queries = 24 sources (vs 96).
    // Under claude/CLI (300s+/600s+ ceilings), the full 240s budget is used.
    batch_search: 360_000,         // Patch B1: 240s → 360s; raceMs interno 320s + 40s margen outer
    smart_search: 300_000,           // Patch C6 (2026-07-30): 180s → 300s; es_core_news_lg variant gen + 6× search + rerank takes ~245s

    // Metadata extraction / enrichment
    fetch_metadata: 120_000,
    recover_metadata: 240_000,
    enrich_metadata: 120_000,
    pdf_metadata: 60_000,
    pdf_citations: 60_000,
    pdf_sections: 120_000,
    pdf_smart_summary: 90_000,
    analyze_academic: 180_000,

    // Document conversion / extraction (MinerU Cloud)
    read_pdf: 180_000,
    read_pdf_markdown: 180_000,
    extract_section: 120_000,
    extract_tables: 120_000,
    extract_formulas: 120_000,
    convert_document: 300_000,
    batch_convert: 600_000,

    // PDF URL resolution (multi-fallback chain)
    download_pdf: 60_000,
    resolve_pdf: 60_000,

    // Source health / coverage
    health_check: 30_000,
    coverage_report: 60_000,
    help: 10_000,

    // Default for any tool not listed above
});

export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

export function getToolTimeoutMs(toolName: string): number {
    return TOOL_TIMEOUTS[toolName] ?? DEFAULT_TOOL_TIMEOUT_MS;
}

/**
 * Wraps a tool invocation with an AbortController + setTimeout so the
 * promise rejects with an AbortError after `getToolTimeoutMs(tool)` ms.
 *
 * The signal is passed into `fn(signal)` so the caller may forward it
 * to fetch()/AbortSignal-aware functions. The outer timer is cleared
 * on resolution/rejection.
 *
 * Implementation note: we use Promise.race against an abort listener
 * promise so the abort error propagates with name='AbortError' (matching
 * the Web Fetch spec shape) while the underlying fn may continue as a
 * zombie until it GC's. The fn receives the signal and SHOULD honor it
 * (forward to fetch() etc.) for prompt cancellation.
 *
 * @param toolName     Tool name (used to look up TOOL_TIMEOUTS map)
 * @param fn           Async function that receives an AbortSignal
 * @param overrideMs    OPTIONAL test-only override to bypass the map
 *                      and force a specific deadline. Production callers
 *                      MUST omit this parameter. Tests use it to verify
 *                      the abort path without waiting the full 30s.
 */
export async function withToolTimeout<T>(
    toolName: string,
    fn: (signal: AbortSignal) => Promise<T>,
    overrideMs?: number
): Promise<T> {
    const ms = overrideMs ?? getToolTimeoutMs(toolName);
    const controller = new AbortController();
    const tid: NodeJS.Timeout = setTimeout(
        () => controller.abort(new Error(`Tool "${toolName}" exceeded deadline of ${ms}ms`)),
        ms
    );

    // Allow .unref() so the timer doesn't hold the event loop on graceful shutdown
    if (typeof (tid as any).unref === 'function') (tid as any).unref();

    // Race the fn against the abort controller. If the abort fires first,
    // reject with an AbortError-shaped Error so callers' catch handlers can
    // match on err.name === 'AbortError' (Web spec) or message regex.
    const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
            const err: any = new Error(`Tool "${toolName}" exceeded deadline of ${ms}ms`);
            err.name = 'AbortError';
            reject(err);
        });
    });

    try {
        return await Promise.race([fn(controller.signal), abortPromise]);
    } finally {
        clearTimeout(tid);
    }
}
