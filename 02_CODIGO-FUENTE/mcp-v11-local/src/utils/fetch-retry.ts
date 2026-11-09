/**
 * fetchWithRetry — wrapper around fetchWithTimeout adding exponential backoff
 * with jitter + circuit-breaker awareness. Phase 3 (2026-07-23).
 *
 * Use case: providers/network sources where a transient 5xx/DNS hiccup should
 * not propagate as a hard failure if a second/third attempt (with a short
 * randomized delay) would likely succeed. Critical-domain rate limiting and
 * circuit breaking remain in inter-process-provider-limiter; this module
 * ONLY adds retries on top of an already-gated fetch.
 *
 * Behavior:
 *   - First error that is NOT CircuitOpenError: wait backoff_ms(attempt) + jitter,
 *     then retry. Up to `maxAttempts` total attempts.
 *   - First CircuitOpenError: rethrow immediately (no point retrying while the
 *     circuit is open — the gate will reject anyway).
 *   - HTTP 429 / 503 / 504: retryable (rate-limit-style).
 *   - HTTP 4xx other than 429: NOT retryable (client error, retry won't help).
 *   - HTTP 5xx other than 503/504: NOT retryable (likely persistent).
 *
 * Backoff formula (exponential + full jitter):
 *   delay_ms = random_in[0, base * 2^attempt]
 *
 * Default config tuned for academic upstreams:
 *   - maxAttempts = 3 (initial + 2 retries)
 *   - baseBackoffMs = 500
 *   - maxBackoffMs = 8000 (cap to avoid runaway waiting)
 *
 * Usage:
 *   import { fetchWithRetry } from '../utils/fetch-retry';
 *   const res = await fetchWithRetry('https://api.openalex.org/...', {}, { timeout: 10000 });
 */

import { fetchWithTimeout } from '../providers/base';
import { CircuitOpenError } from './inter-process-provider-limiter';

export interface RetryConfig {
    maxAttempts: number;     // total attempts (initial + retries). Default 3.
    baseBackoffMs: number;   // initial backoff base. Default 500.
    maxBackoffMs: number;   // absolute cap. Default 8000.
    timeoutMs: number;      // passed-through per-attempt fetch timeout. Default 25000 (DEFAULT_TIMEOUT).
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseBackoffMs: 500,
    maxBackoffMs: 8000,
    timeoutMs: 25000,
};

/** Sleep helper that aborts early if the surrounding signal fires. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('Aborted during backoff sleep'));
            return;
        }
        const t = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(new Error('Aborted during backoff sleep'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/** Compute backoff = min(maxBackoffMs, random_in[0, base * 2^attempt]). Full jitter. */
export function computeBackoff(attempt: number, cfg: RetryConfig): number {
    const expo = cfg.baseBackoffMs * Math.pow(2, attempt);
    const capped = Math.min(expo, cfg.maxBackoffMs);
    return Math.floor(Math.random() * capped);
}

/**
 * Classify a Response/throwable as retryable.
 *  - 429 / 503 / 504 → retryable (rate limit / transient).
 *  - other 4xx → NOT retryable (caller error).
 *  - other 5xx → NOT retryable unless flagged.
 *  - Network/DNS/timeout throws → retryable.
 *  - CircuitOpenError → NOT retryable (propagate immediately).
 */
export function isRetryableError(e: any): boolean {
    if (e instanceof CircuitOpenError) return false;
    // TypeError: network failure / DNS (fetch throws TypeError on connection refused).
    if (e instanceof TypeError) return true;
    // AbortError = timeout, generally retryable (transient).
    if (e?.name === 'AbortError') return true;
    // HTTP status-based retries: callers can throw { status: number } shape
    // by calling res.json()/text() but our wrapper inspects the Response object
    // separately. So here we only classify based on thrown errors.
    return false;
}

export function isRetryableStatus(status: number): boolean {
    return status === 429 || status === 503 || status === 504;
}

/**
 * fetchWithRetry: exponential backoff + jitter + circuit-aware retries.
 *
 * @param url target URL
 * @param options fetch options (headers, method, body) — passed through unchanged each attempt
 * @param cfg retry config (optional, defaults DEFAULT_RETRY_CONFIG)
 * @param signal optional AbortSignal for cancelling all attempts
 * @returns the final Response (may be from any attempt, including a non-2xx)
 */
export async function fetchWithRetry(
    url: string,
    options: any = {},
    cfg: Partial<RetryConfig> = {},
    signal?: AbortSignal,
): Promise<Response> {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...cfg };
    let lastError: any = undefined;
    let lastResponse: Response | undefined = undefined;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        if (signal?.aborted) throw new Error('Aborted before attempt ' + attempt);
        try {
            const res = await fetchWithTimeout(url, options, config.timeoutMs);
            // If retryable HTTP status → backoff and retry. Otherwise return.
            if (isRetryableStatus(res.status) && attempt < config.maxAttempts - 1) {
                lastResponse = res;
                lastError = new Error(`HTTP ${res.status} from ${url}`);
                const backoff = computeBackoff(attempt, config);
                await sleep(backoff, signal);
                continue;
            }
            return res;
        } catch (e: any) {
            lastError = e;
            // Circuit open → propagate immediately, no retry.
            if (e instanceof CircuitOpenError) throw e;
            // Aborted by caller → propagate immediately.
            if (e?.name === 'AbortError' && signal?.aborted) throw e;
            if (signal?.aborted) throw new Error('Aborted');
            // Retryable (network / DNS / transient)?
            if (isRetryableError(e) && attempt < config.maxAttempts - 1) {
                const backoff = computeBackoff(attempt, config);
                await sleep(backoff, signal);
                continue;
            }
            // Last attempt or non-retryable → rethrow.
            throw e;
        }
    }

    // Exhausted retries: return last Response if we have one (unlikely path).
    if (lastResponse) return lastResponse;
    // Otherwise throw the last error captured.
    throw lastError ?? new Error(`fetchWithRetry exhausted retries for ${url}`);
}
