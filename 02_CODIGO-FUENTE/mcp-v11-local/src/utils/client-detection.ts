/**
 * Client-aware adaptive timeouts for the MCP server.
 *
 * Phase 6 (2026-07-23): Replaces env-var-only timeout tuning with automatic
 * detection of the calling MCP client via the User-Agent header. The server
 * derives 4 nested timeout layers from a single client ceiling, so that
 * opencode (120s), Claude Desktop (300s), Cursor (180s), CLI (600s), and
 * unknown clients (conservative 120s) all get a calibrated budget without
 * any environment variable tuning.
 *
 * Design constraint: env vars (PROVIDER_TIMEOUT_MS, INTERNAL_API_TIMEOUT_MS,
 * RENATI_ATTEMPT_TIMEOUT_MS) are STILL honored if explicitly set, but they
 * now act as an UPPER BOUND for edge cases. The auto-derived value is always
 * min(auto, env) so a misconfigured env var can never exceed the client's
 * actual ceiling.
 *
 * ── 4 timeout layers (all derived from the client ceiling) ─────────────
 *
 *   L1 outer   = TOOL_TIMEOUTS[tool] capped at ceiling × 0.95
 *   L2 inner   = outer × 0.95  (in-process fetch to /api/*)
 *   L3 race    = outer × 0.50  (per-provider race in routes/search.ts)
 *   L4 try     = race × 0.67  (per-attempt in searchRenati/ALICIA)
 *
 * Example for `search` (TOOL_TIMEOUTS.search = 90_000) under each client:
 *
 *   opencode (120s)  → outer 90s, inner 85s, race 45s, try 30s
 *   claude   (300s)  → outer 90s, inner 85s, race 45s, try 30s
 *   cursor   (180s)  → outer 90s, inner 85s, race 45s, try 30s
 *   cli      (600s)  → outer 90s, inner 85s, race 45s, try 30s
 *   unknown  (120s)  → outer 90s, inner 85s, race 45s, try 30s
 *
 * Note: since TOOL_TIMEOUTS.search (90s) < all ceilings, the floor wins
 * uniformly. The ceiling only bites for tools whose base exceeds it
 * (e.g. batch_search=120s under opencode 120s → outer=114s).
 *
 * ── Tuning knobs ──────────────────────────────────────────────────────
 *
 * To raise a tool's budget for a specific long-running case, edit
 * TOOL_TIMEOUTS in tool-timeouts.ts. To raise the ceiling for a known
 * client, edit CLIENT_CEILINGS_MS below. Environment variable overrides
 * are NOT recommended for production — the auto-detection covers all
 * known clients correctly.
 */

export type McpClient = 'opencode' | 'claude' | 'claude-code' | 'cursor' | 'cli' | 'unknown';

/** Derived 4-layer timeout budget (ms) for a tool invocation. */
export interface DerivedTimeouts {
    outerMs: number;  // L1: withToolTimeout envelope (capped at client ceiling Ã- 0.95)
    innerMs: number;  // L2: in-process fetch to /api/*  (outer Ã- 0.95)
    raceMs: number;   // L3: per-provider race in routes/search.ts (outer Ã- 0.50)
    tryMs: number;    // L4: per-attempt in searchRenati/ALICIAProviders (race Ã- 0.67)
    // Patch J10 (2026-07-27): carry the client ceiling so batch_search MAX_CONCURRENT
    // derivation in mcp.ts:1517 can read it without falling back to 120s default.
    ceilingMs: number; // L0: the raw client ceiling (e.g. 120000 opencode, 240000 unknown post-J7)
}

/**
 * Hard ceilings per MCP client (ms). Sourced from public documentation
 * and empirical testing on 2026-07-23. These represent the MAX time a
 * client will wait for a single tool call before killing the request.
 *
 * - opencode:        ~120s (HTTP transport default, observed)
 * - Claude Desktop:  ~300s (5 min, Electron app default)
 * - Claude Code CLI: ~300s (Anthropic CLI default)
 * - Cursor:          ~180s (3 min editor default)
 * - CLI (curl/etc):  ~600s (10 min generous, no real ceiling)
 * - unknown:         ~120s (conservative default)
 */
export const CLIENT_CEILINGS_MS: Readonly<Record<McpClient, number>> = Object.freeze({
    'opencode':       120_000,
    'claude':         300_000,
    'claude-code':    300_000,
    'cursor':         180_000,
    'cli':            600_000,
    // Patch J7 (2026-07-27): bump unknown 120s -> 240s.
    // Local LetXipu V11 invoked via PowerShell/MCP-bridge/curl is detected as
    // 'unknown' (no MCP user-agent header). 120s was too tight for batch_search
    // with ALICIA (A2-split ~66s + DME ~80s). 240s aligns with cursor and lets
    // raceMs floor=150s breathe. Real opencode (with UA sent by gateway) keeps
    // its 120s ceiling. Does NOT affect real opencode clients.
    'unknown':        240_000,
});

/**
 * Per-client soft caps for batch_search. Avoids overwhelming slow sources
 * when the client's ceiling is tight (opencode). Each query is limited to
 * this many sources; total sources = cap × queries.
 *
 * - opencode:  8 sources × max 3 queries = 24 sources per call
 * - claude:    16 sources × max 6 queries = 96 sources per call (full)
 * - cursor:    12 sources × max 4 queries = 48 sources per call
 * - cli:       16 sources × max 6 queries = 96 sources per call (full)
 * - unknown:   8 sources × max 3 queries = 24 (conservative)
 */
export const CLIENT_BATCH_CAPS: Readonly<Record<McpClient, { sourcesPerQuery: number; maxQueries: number }>> = Object.freeze({
    // Patch L (2026-07-27): bump opencode+unknown sourcesPerQuery 8 → 12.
    // ALICIA now completes in ~30-65s (Patch J8+J9), so 12 sources × 3 queries
    // = 36 sources per call fits comfortably under outerMs=114s for opencode.
    // Adds Crossref, DOAJ, Zenodo, Semantic Scholar to the typical opencode
    // batch_search expansion (which previously saturated the 8-slot cap with
    // only LatAm sources from the latam group).
    'opencode':    { sourcesPerQuery: 12, maxQueries: 3 },
    'claude':      { sourcesPerQuery: 16, maxQueries: 6 },
    'claude-code': { sourcesPerQuery: 16, maxQueries: 6 },
    'cursor':      { sourcesPerQuery: 12, maxQueries: 4 },
    'cli':         { sourcesPerQuery: 16, maxQueries: 6 },
    'unknown':     { sourcesPerQuery: 12, maxQueries: 3 },
});

/**
 * Detects the calling MCP client from the HTTP User-Agent header.
 *
 * Known signatures (case-insensitive substring):
 *   - opencode        → "opencode/0.x", "opencode/1.x"
 *   - claude          → "claude", "claude-desktop", "anthropic"
 *   - claude-code     → "claude-code", "anthropic-cli"
 *   - cursor          → "cursor"
 *   - cli             → "curl", "python-requests", "node-fetch", "axios", "got"
 *   - unknown         → anything else (incl. empty UA)
 *
 * @param userAgent The raw User-Agent header value (may be undefined)
 * @returns The detected client key, or 'unknown' if no match
 */
export function detectMcpClient(userAgent: string | undefined | null): McpClient {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();

    // Order matters: most-specific first (claude-code before claude)
    if (ua.includes('claude-code') || ua.includes('anthropic-cli')) return 'claude-code';
    if (ua.includes('claude') || ua.includes('anthropic')) return 'claude';
    // 1.1.5: las tareas en segundo plano del puente letxinet-jobs no tienen el corte de 120 s de OpenCode
    if (ua.includes('letxinet-jobs')) return 'cli';
    if (ua.includes('opencode')) return 'opencode';
    if (ua.includes('cursor')) return 'cursor';
    if (
        ua.includes('curl') ||
        ua.includes('python-requests') ||
        ua.includes('python-httpx') ||
        ua.includes('node-fetch') ||
        ua.includes('axios') ||
        ua.includes('got/') ||
        ua.includes('okhttp') ||
        ua.includes('java/') ||
        ua.includes('go-resty')
    ) return 'cli';

    return 'unknown';
}

/**
 * Derives the 4 nested timeouts for a tool invocation, given the detected
 * client and the tool's base timeout from TOOL_TIMEOUTS.
 *
 * @param client        The detected MCP client
 * @param baseToolMs    The tool's base timeout from TOOL_TIMEOUTS map
 * @returns { outerMs, innerMs, raceMs, tryMs } all in milliseconds
 */
export function deriveTimeouts(
    client: McpClient,
    baseToolMs: number,
): DerivedTimeouts {
    const ceiling = CLIENT_CEILINGS_MS[client] ?? CLIENT_CEILINGS_MS.unknown;

    // L1 outer: baseToolMs capped at ceiling × 0.95 (leave 5% for JSON-RPC envelope)
    const outerMs = Math.min(baseToolMs, Math.floor(ceiling * 0.95));
    // L2 inner: in-process fetch to /api/*, just below outer
    const innerMs = Math.floor(outerMs * 0.95);
    // L3 race: per-provider race, half of outer (allows 2 sequential retries within outer)
    const raceMs = Math.floor(outerMs * 0.50);
    // L4 try: per-attempt in searchRenati/ALICIA, 2/3 of race (allows 1.5 attempts per race)
    const tryMs = Math.floor(raceMs * 0.67);

    // Patch J10 (2026-07-27): include ceilingMs so downstream (batch_search
    // MAX_CONCURRENT derivation in mcp.ts:1517) can read it without falling back to 120s.
    return { outerMs, innerMs, raceMs, tryMs, ceilingMs: ceiling };
}

/**
 * Derives the batch_search caps for the detected client.
 *
 * @param client The detected MCP client
 * @returns { sourcesPerQuery, maxQueries } to cap batch_search expansion
 */
export function deriveBatchCaps(client: McpClient): { sourcesPerQuery: number; maxQueries: number } {
    return CLIENT_BATCH_CAPS[client] ?? CLIENT_BATCH_CAPS.unknown;
}

/**
 * Apply env-var upper bound to a derived timeout. If the env var is set
 * and is SMALLER than the auto-derived value, the env var wins. If unset
 * or larger, the auto-derived value wins. This lets operators tighten
 * budgets for edge cases without disabling auto-detection.
 *
 * @param autoMs      The auto-derived timeout
 * @param envVarName  The environment variable name to check
 * @returns min(autoMs, envValue) if env is set and < autoMs, else autoMs
 */
export function applyEnvUpperBound(autoMs: number, envVarName: string): number {
    const envVal = parseInt(process.env[envVarName] || '', 10);
    if (isNaN(envVal) || envVal <= 0) return autoMs;
    return Math.min(autoMs, envVal);
}
