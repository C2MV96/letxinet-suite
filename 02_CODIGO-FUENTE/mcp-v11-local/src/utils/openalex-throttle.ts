/**
 * OpenAlex Free Budget Throttle (BL-07 fix, 2026-07-25)
 *
 * Problem: OpenAlex free API has daily USD budget ($5/day per IP). When exhausted,
 * API returns HTTP 429 with `X-RateLimit-Remaining: 0` and `Retry-After: N` header
 * (N seconds until reset, usually ~6h-24h).
 *
 * Without internal throttle: V11.1 fires request → 429 every time during cooldown,
 * wasting ~5-10s per request with timeouts and polluting logs.
 *
 * With internal throttle: On first 429, persist `reset_epoch` and `retry_after` to
 * disk. Subsequent requests within cooldown period return immediately with
 * `rateLimited: true` metadata, skipping the network call entirely.
 *
 * State file: `openalex-state.json` lives in the V11 project root.
 *
 * Schema:
 * {
 *   "lastUpdated": "2026-07-25T15:30:00.000Z",
 *   "resetEpochMs": 1785123456000,        // ms since epoch when API will be available
 *   "retryAfterSec": 21929,               // original Retry-After header value
 *   "lastHttpStatus": 429,                // for telemetry
 *   "dailyRequestCount": 47,              // counts queries attempted today
 *   "dailyDateUtc": "2026-07-25",         // YYYY-MM-DD UTC, resets daily
 *   "last429At": "2026-07-25T17:54:31.000Z",
 *   "lastSuccessfulAt": "2026-07-25T10:00:00.000Z"
 * }
 */

import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.join(process.cwd(), 'openalex-state.json');

/** Max requests to attempt per day before proactively throttling.
 * Conservative to avoid burning budget: OpenAlex free allows ~100,000 polite-pool
 * requests/day but the daily USD budget ($5) caps at ~5,000 typical queries.
 * Setting 1000 keeps us safely away from the cliff while still useful.
 */
const DAILY_REQUEST_CAP = parseInt(process.env.OPENALEX_DAILY_CAP || '1000', 10);

interface OpenAlexState {
    lastUpdated: string;
    resetEpochMs: number | null;
    retryAfterSec: number | null;
    lastHttpStatus: number | null;
    dailyRequestCount: number;
    dailyDateUtc: string;
    last429At: string | null;
    lastSuccessfulAt: string | null;
}

const defaultState: OpenAlexState = {
    lastUpdated: new Date().toISOString(),
    resetEpochMs: null,
    retryAfterSec: null,
    lastHttpStatus: null,
    dailyRequestCount: 0,
    dailyDateUtc: todayUtc(),
    last429At: null,
    lastSuccessfulAt: null,
};

function todayUtc(): string {
    return new Date().toISOString().substring(0, 10); // YYYY-MM-DD
}

function loadState(): OpenAlexState {
    try {
        if (!fs.existsSync(STATE_FILE)) return { ...defaultState };
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<OpenAlexState>;
        const merged: OpenAlexState = { ...defaultState, ...parsed };
        // Reset daily counter if date rollover
        if (merged.dailyDateUtc !== todayUtc()) {
            merged.dailyDateUtc = todayUtc();
            merged.dailyRequestCount = 0;
        }
        return merged;
    } catch {
        return { ...defaultState };
    }
}

function saveState(state: OpenAlexState): void {
    try {
        state.lastUpdated = new Date().toISOString();
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e: any) {
        console.warn(`[OpenAlex-Throttle] Failed to save state: ${e.message}`);
    }
}

/**
 * Check if we're currently in cooldown (rate-limited). Returns:
 *  - `inCooldown: true` if we should skip the network call
 *  - `retryAfterSec: N` seconds remaining until reset
 *  - `state` snapshot for telemetry
 */
export function isRateLimited(): { inCooldown: boolean; retryAfterSec: number; state: OpenAlexState } {
    const state = loadState();
    const now = Date.now();
    if (state.resetEpochMs && state.resetEpochMs > now) {
        const remaining = Math.ceil((state.resetEpochMs - now) / 1000);
        return { inCooldown: true, retryAfterSec: remaining, state };
    }
    // Cooldown expired — clear it
    if (state.resetEpochMs && state.resetEpochMs <= now) {
        const cleared = { ...state, resetEpochMs: null, retryAfterSec: null, lastHttpStatus: null };
        saveState(cleared);
        return { inCooldown: false, retryAfterSec: 0, state: cleared };
    }
    return { inCooldown: false, retryAfterSec: 0, state };
}

/**
 * Check if we've exceeded daily proactive cap (avoid burning budget).
 */
export function isDailyCapExceeded(): { exceeded: boolean; remainingToday: number; dailyCap: number; state: OpenAlexState } {
    const state = loadState();
    const remaining = Math.max(0, DAILY_REQUEST_CAP - state.dailyRequestCount);
    return {
        exceeded: state.dailyRequestCount >= DAILY_REQUEST_CAP,
        remainingToday: remaining,
        dailyCap: DAILY_REQUEST_CAP,
        state,
    };
}

/**
 * Increment daily counter BEFORE sending request (so even a failed request counts
 * against budget, mirroring OpenAlex's own counting).
 */
export function recordRequestStart(): OpenAlexState {
    const state = loadState();
    state.dailyRequestCount += 1;
    // Also ensure dailyDateUtc is current
    if (state.dailyDateUtc !== todayUtc()) {
        state.dailyDateUtc = todayUtc();
        state.dailyRequestCount = 1;
    }
    saveState(state);
    return state;
}

/**
 * Record that API responded with 429. Persists `resetEpochMs` calculated from
 * `Retry-After` header (seconds), so subsequent requests skip until reset.
 */
export function recordRateLimited(retryAfterSec: number, httpStatus: number = 429): OpenAlexState {
    const state = loadState();
    const now = Date.now();
    state.resetEpochMs = now + (retryAfterSec * 1000);
    state.retryAfterSec = retryAfterSec;
    state.lastHttpStatus = httpStatus;
    state.last429At = new Date().toISOString();
    saveState(state);
    console.warn(`[OpenAlex-Throttle] 429 recorded. Cooldown ${retryAfterSec}s until ${new Date(state.resetEpochMs).toISOString()}`);
    return state;
}

/**
 * Record successful response. Clears any stale cooldown, updates lastSuccessfulAt.
 */
export function recordSuccess(httpStatus: number = 200): OpenAlexState {
    const state = loadState();
    state.lastHttpStatus = httpStatus;
    state.lastSuccessfulAt = new Date().toISOString();
    // If resetEpochMs was in the past but not cleared yet, clear it now
    if (state.resetEpochMs && state.resetEpochMs <= Date.now()) {
        state.resetEpochMs = null;
        state.retryAfterSec = null;
    }
    saveState(state);
    return state;
}

/**
 * Get full state snapshot (for `/health/openalex` endpoint).
 */
export function getHealthSnapshot(): OpenAlexState & {
    inCooldown: boolean;
    retryAfterSec: number;
    dailyCap: number;
    remainingToday: number;
} {
    const state = loadState();
    const now = Date.now();
    const inCooldown = !!(state.resetEpochMs && state.resetEpochMs > now);
    const retryAfterSec = inCooldown ? Math.ceil(((state.resetEpochMs as number) - now) / 1000) : 0;
    const remainingToday = Math.max(0, DAILY_REQUEST_CAP - state.dailyRequestCount);
    return {
        ...state,
        inCooldown,
        retryAfterSec,
        dailyCap: DAILY_REQUEST_CAP,
        remainingToday,
    };
}

/**
 * Reset state file (manual / tests).
 */
export function resetState(): void {
    try { if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE); } catch {}
    saveState({ ...defaultState });
}
