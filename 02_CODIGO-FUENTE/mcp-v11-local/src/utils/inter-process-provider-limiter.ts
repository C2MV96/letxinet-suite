/**
 * Inter-process provider gate — persistent rate-limit + circuit-breaker
 * for critical academic upstreams (ALICIA, RENATI, La Referencia, OpenAlex,
 * Semantic Scholar, HuggingFace, Scopus, CORE, Zenodo).
 *
 * PROBLEM:
 *   - resilient-fetch.ts has rate-limit and circuit-breaker in an in-process
 *     Map<> — lost on every restart and NOT shared across the 4 local ports.
 *   - On HF Space restart, all state resets to "open" while the same IPs get
 *     hammered again → upstream cuts with 429 → loops another storm.
 *
 * SOLUTION:
 *   - Single shared JSON file at `.cache/provider-gate.json` coordinates slots
 *     across processes (same pattern as inter-process-rate-limiter.ts for
 *     Nominatim). Atomic write via write-temp-then-rename.
 *   - Write-ahead: timestamp is claimed BEFORE the fetch, not after, so
 *     concurrent acquireSlot() callers see the slot taken immediately.
 *   - Per-domain in-process semaphore enforces `maxConcurrent` within a single
 *     process (in addition to the cross-process rate limit).
 *
 * API:
 *   - acquireSlot(domain): waits for the rate-limit window, checks the
 *     circuit, claims the next slot, returns true. Throws if the circuit is
 *     open — caller should fail fast with a clear message.
 *   - recordSuccess(domain): clears the failure counter for that domain.
 *   - recordFailure(domain): increments failure counter; may open the circuit
 *     if breakerThreshold is exceeded.
 *   - getGateSnapshot(): reads the shared file for health/observability.
 */

import fs from 'fs';
import path from 'path';
import { PeticionCancelada } from './geo-context';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const GATE_FILE = path.join(CACHE_DIR, 'provider-gate.json');
const GATE_TMP = GATE_FILE + '.tmp';

interface DomainConfig {
    minIntervalMs: number;        // Minimum gap between consecutive requests to the same domain
    maxConcurrent: number;        // Max concurrent in-flight requests to the same domain per process
    breakerThreshold: number;     // Number of consecutive failures before the circuit opens
    breakerCooldownMs: number;    // How long the circuit stays open before allowing a probe request
}

/**
 * Critical domain configuration.
 *
 * Thresholds are conservative on purpose — opening the circuit means we lose
 * all results from that source until the cooldown elapses, which is worse
 * than a few failed requests. The goal is to break self-reinforcing storms
 * (429 → all instances retry → 429 again), not to micro-manage every
 * transient hiccup.
 *
 * Values calibrated from observed production logs (Jul 2026):
 *   - ALICIA: 2 fails → 5 min cooldown. Aggressive because it's the most
 *     saturated Peruvian source and most queries touch it.
 *   - OpenAlex/SemanticScholar/etc.: thresholds higher because their APIs
 *     have server-side rate-limit via API key and tolerate brief bursts.
 */
const CRITICAL_DOMAINS: Record<string, DomainConfig> = {
    // ── LATAM critical (most saturation-prone) ──
    'alicia.concytec.gob.pe':   { minIntervalMs: 1500, maxConcurrent: 4, breakerThreshold: 2, breakerCooldownMs: 5 * 60 * 1000 },
    'renati.sunedu.gob.pe':     { minIntervalMs: 2000, maxConcurrent: 3, breakerThreshold: 2, breakerCooldownMs: 5 * 60 * 1000 },
    'www.lareferencia.org':     { minIntervalMs: 1500, maxConcurrent: 4, breakerThreshold: 2, breakerCooldownMs: 5 * 60 * 1000 },
    'api.openalex.org':         { minIntervalMs: 350,  maxConcurrent: 6, breakerThreshold: 5, breakerCooldownMs: 60 * 1000 },
    'api.semanticscholar.org':  { minIntervalMs: 1100, maxConcurrent: 3, breakerThreshold: 4, breakerCooldownMs: 2 * 60 * 1000 },
    'huggingface.co':           { minIntervalMs: 1500, maxConcurrent: 2, breakerThreshold: 2, breakerCooldownMs: 5 * 60 * 1000 },
    // ── Additional 3 (per user request: 9 fuentes) ──
    'api.elsevier.com':         { minIntervalMs: 1000, maxConcurrent: 3, breakerThreshold: 4, breakerCooldownMs: 2 * 60 * 1000 }, // Scopus
    'core.ac.uk':               { minIntervalMs: 500,  maxConcurrent: 4, breakerThreshold: 5, breakerCooldownMs: 60 * 1000 },   // CORE
    'zenodo.org':               { minIntervalMs: 500,  maxConcurrent: 4, breakerThreshold: 5, breakerCooldownMs: 60 * 1000 },
};

interface DomainState {
    lastRequestTs: number;        // Timestamp of the last slot acquired (write-ahead)
    consecutiveFails: number;     // Consecutive failures (cleared on success)
    lastFailTs: number;           // When the circuit opened, or 0 if closed
    openUntil: number;            // If > now, the circuit is open (no requests allowed)
}

type GateFile = Record<string, DomainState>;

// ─── In-process concurrency semaphore per domain ─────────────────────────────
// LetXinet 1.1.3: semaforo real por dominio. La version anterior hacia que cada peticion
// esperara a TODAS las anteriores de la cadena (Promise.all), asi que una sola peticion lenta
// frenaba al dominio entero y las esperas se encadenaban.
const inFlight: Map<string, { activos: number; espera: (() => void)[] }> = new Map();

function acquireInProcessSlot(domain: string, maxConcurrent: number, cancelar?: AbortSignal): Promise<() => void> {
    let estado = inFlight.get(domain);
    if (!estado) { estado = { activos: 0, espera: [] }; inFlight.set(domain, estado); }
    const e = estado;
    const release = () => {
        e.activos--;
        const siguiente = e.espera.shift();
        if (siguiente) { e.activos++; siguiente(); }
    };
    if (e.activos < maxConcurrent) { e.activos++; return Promise.resolve(release); }
    // 1.1.6: una peticion cancelada sale de la fila. Antes seguia en ella, recibia su turno y lo
    // retenia 1,5 s (el intervalo minimo) aunque ya nadie esperaba el resultado: tras cancelar un
    // batch, la busqueda siguiente esperaba unos 20 s detras de esas descargas fantasma.
    return new Promise((resolve, reject) => {
        const entrar = () => { cancelar?.removeEventListener('abort', salir); resolve(release); };
        const salir = () => {
            const i = e.espera.indexOf(entrar);
            if (i < 0) return;
            e.espera.splice(i, 1);
            reject(new PeticionCancelada());
        };
        cancelar?.addEventListener('abort', salir, { once: true });
        e.espera.push(entrar);
    });
}

// ─── Disk I/O (atomic) ────────────────────────────────────────────────────────

// V11 Mejora 4: in-memory cache of readGate() with a short TTL. Previously
// each call to acquireSlot() did fs.readFileSync + JSON.parse on the shared
// gate file; under batch_search with MAX_CONCURRENT=5 and 48 tasks, that
// became 48 sync disk reads per second — a measurable contributor to latency.
// We cache the parsed result for max 500 ms (configurable via
// PROVIDER_GATE_TTL_MS), reusing the in-memory copy for burst calls and
// doing a fresh read only when the cache is stale. Writes still go to disk
// atomically; the cache only affects reads.
let _gateCache: { data: GateFile; ts: number } | null = null;
const GATE_CACHE_TTL_MS = parseInt(process.env.PROVIDER_GATE_TTL_MS || '', 10) || 500;

function ensureCacheDir(): void {
    try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch { /* best-effort */ }
}

/** V11 Mejora 4: Bust the in-memory cache so a subsequent readGate() pulls
 * from disk. Called whenever we write the gate file (avoids serving the
 * pre-write state to a subsequent acquireSlot). */
function bustGateCache(): void {
    _gateCache = null;
}

function readGate(): GateFile {
    const now = Date.now();
    if (_gateCache && (now - _gateCache.ts) < GATE_CACHE_TTL_MS) {
        return _gateCache.data;
    }
    try {
        if (!fs.existsSync(GATE_FILE)) {
            _gateCache = { data: {}, ts: now };
            return {};
        }
        const raw = fs.readFileSync(GATE_FILE, 'utf8');
        if (!raw || raw.length < 2) {
            _gateCache = { data: {}, ts: now };
            return {};
        }
        const data = JSON.parse(raw) as GateFile;
        _gateCache = { data, ts: now };
        return data;
    } catch (e: any) {
        console.warn(`[GATE] Failed to read gate file (${e.message}). Reinitializing.`);
        _gateCache = { data: {}, ts: now };
        return {};
    }
}

/**
 * Atomic write: write to `.tmp` then rename. On Windows (NTFS) and POSIX
 * (HF Linux), `fs.renameSync` is atomic — concurrent readers never see a
 * half-written file. If two processes race the rename, the last writer wins
 * (no corruption, just one update потерян — acceptable since the next
 * acquireSlot re-syncs within minIntervalMs).
 */
function writeGate(gate: GateFile): void {
    try {
        ensureCacheDir();
        fs.writeFileSync(GATE_TMP, JSON.stringify(gate), 'utf8');
        fs.renameSync(GATE_TMP, GATE_FILE);
        // V11 Mejora 4: update the in-memory cache to the freshly written
        // state so the very next readGate() within the TTL returns the new
        // data instead of the pre-write snapshot. Without this, two
        // concurrent acquireSlot() calls in the same process could both
        // claim the same slot because the second one read the stale cached
        // state (written <TTL ms ago) and saw the old lastRequestTs.
        _gateCache = { data: gate, ts: Date.now() };
    } catch (e: any) {
        console.warn(`[GATE] Failed to write gate file (${e.message}). In-process limiter still works.`);
    }
}

function getConfig(domain: string): DomainConfig | null {
    return CRITICAL_DOMAINS[domain] || null;
}

/**
 * Extract hostname from a URL for domain-matching against CRITICAL_DOMAINS.
 */
export function domainOf(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Acquire a slot to call `domain`.
 *
 * Behavior:
 *   1. If the domain is not in CRITICAL_DOMAINS → returns immediately (no
 *      overhead for providers with their own rate-limit via API key, etc.).
 *   2. If the circuit is open (openUntil > now) → throws `CircuitOpenError`
 *      with the cooldown remaining. The caller should fail fast WITHOUT
 *      hammering the upstream.
 *   3. Otherwise waits until minIntervalMs has elapsed since the last slot,
 *      claims the slot (write-ahead timestamp), enforces maxConcurrent
 *      in-process, and returns a `release` callback.
 *
 * IMPORTANT: the caller MUST call `release()` when done (success or failure),
 * same way you'd release a lock. `recordSuccess/recordFailure` are separate.
 */
export async function acquireSlot(url: string, cancelar?: AbortSignal): Promise<{ release: () => void; domain: string }> {
    const domain = domainOf(url);
    const config = getConfig(domain);
    if (!config) {
        // Non-critical domain: no coordination, return a noop release.
        return { release: () => {}, domain };
    }

    const gate = readGate();
    const state = gate[domain] || { lastRequestTs: 0, consecutiveFails: 0, lastFailTs: 0, openUntil: 0 };

    // Circuit check
    const now = Date.now();
    if (state.openUntil > now) {
        const remaining = Math.ceil((state.openUntil - now) / 1000);
        throw new CircuitOpenError(domain, remaining);
    }

    // In-process concurrency cap (must be acquired BEFORE the disk wait,
    // otherwise we'd wait on the cross-process rate and still exceed
    // maxConcurrent within our own process.)
    const releaseInProcess = await acquireInProcessSlot(domain, config.maxConcurrent, cancelar);

    try {
        if (cancelar?.aborted) throw new PeticionCancelada();
        // Cross-process rate-limit: wait if we're inside minIntervalMs
        const elapsed = now - state.lastRequestTs;
        if (elapsed < config.minIntervalMs) {
            const wait = config.minIntervalMs - elapsed + Math.floor(Math.random() * 200); // jitter
            // 1.1.6: la espera se corta si la peticion se cancela (libera el turno enseguida)
            await new Promise<void>((resolve, reject) => {
                const alCancelar = () => { clearTimeout(t); reject(new PeticionCancelada()); };
                const t = setTimeout(() => { cancelar?.removeEventListener('abort', alCancelar); resolve(); }, wait);
                cancelar?.addEventListener('abort', alCancelar, { once: true });
            });
        }

        // Write-ahead: claim the slot NOW (before the fetch) so concurrent
        // callers see the new timestamp immediately.
        state.lastRequestTs = Date.now();
        state.openUntil = 0; // ensure a closed circuit on fresh activity
        gate[domain] = state;
        writeGate(gate);

        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            releaseInProcess();
        };
        return { release, domain };
    } catch (e) {
        releaseInProcess();
        throw e;
    }
}

/**
 * Record a successful response from `domain`. Clears the consecutive-failure
 * counter so a transient run of errors doesn't cumulate into a false trip.
 */
export function recordSuccess(url: string): void {
    const domain = domainOf(url);
    if (!getConfig(domain)) return;
    try {
        const gate = readGate();
        const state = gate[domain];
        if (!state) return;
        state.consecutiveFails = 0;
        state.openUntil = 0;
        state.lastFailTs = 0;
        gate[domain] = state;
        writeGate(gate);
    } catch { /* best-effort */ }
}

/**
 * Record a failure from `domain`. If the consecutive count reaches
 * `breakerThreshold`, opens the circuit for `breakerCooldownMs`. Subsequent
 * acquireSlot calls in ANY process will fail fast via CircuitOpenError.
 */
export function recordFailure(url: string): void {
    const domain = domainOf(url);
    const config = getConfig(domain);
    if (!config) return;
    try {
        const gate = readGate();
        const state = gate[domain] || { lastRequestTs: 0, consecutiveFails: 0, lastFailTs: 0, openUntil: 0 };
        state.consecutiveFails++;
        state.lastFailTs = Date.now();
        if (state.consecutiveFails >= config.breakerThreshold) {
            state.openUntil = Date.now() + config.breakerCooldownMs;
            console.warn(`[GATE] Circuit OPEN for ${domain} (fails=${state.consecutiveFails}, cooldown=${Math.ceil(config.breakerCooldownMs / 1000)}s)`);
        }
        gate[domain] = state;
        writeGate(gate);
    } catch { /* best-effort */ }
}

/**
 * Custom error so callers can distinguish "circuit open" (expected, fail fast)
 * from other errors (e.g., disk I/O issues).
 */
export class CircuitOpenError extends Error {
    public readonly domain: string;
    public readonly cooldownRemainingSeconds: number;
    constructor(domain: string, cooldownRemainingSeconds: number) {
        super(`Circuit open for ${domain} (resets in ${cooldownRemainingSeconds}s)`);
        this.name = 'CircuitOpenError';
        this.domain = domain;
        this.cooldownRemainingSeconds = cooldownRemainingSeconds;
    }
}

/**
 * Snapshot of all configured domains for the /health/gate endpoint.
 * Safe to expose — contains only public timing data, no secrets.
 */
export function getGateSnapshot(): Array<{
    domain: string;
    consecutiveFails: number;
    circuitOpen: boolean;
    cooldownRemainingSeconds: number;
    config: { minIntervalMs: number; maxConcurrent: number; breakerThreshold: number; breakerCooldownMs: number };
}> {
    const gate = readGate();
    const now = Date.now();
    return Object.keys(CRITICAL_DOMAINS).map(domain => {
        const state = gate[domain] || { lastRequestTs: 0, consecutiveFails: 0, lastFailTs: 0, openUntil: 0 };
        const circuitOpen = state.openUntil > now;
        return {
            domain,
            consecutiveFails: state.consecutiveFails || 0,
            circuitOpen,
            cooldownRemainingSeconds: circuitOpen ? Math.ceil((state.openUntil - now) / 1000) : 0,
            config: CRITICAL_DOMAINS[domain],
        };
    });
}

/**
 * Test helper: reset the gate file. Used in Deno/Jest tests.
 */
export function _resetGateForTests(): void {
    try { if (fs.existsSync(GATE_FILE)) fs.unlinkSync(GATE_FILE); } catch {}
    try { if (fs.existsSync(GATE_TMP)) fs.unlinkSync(GATE_TMP); } catch {}
    inFlight.clear();
}
