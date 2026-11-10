/**
 * OpenAlex Search Provider
 * Free academic metadata API
 *
 * BL-07 fix (2026-07-25): internal throttle to avoid time-wasting 429 calls during
 * OpenAlex free-tier daily budget cooldown (~6-24h after exhaustion).
 *
 * Throttle logic:
 *   1. Before request: check `isRateLimited()` → if in cooldown, return [] with
 *      `rateLimited: true` metadata (skip network call).
 *   2. Before request: check `isDailyCapExceeded()` → if exceeded, return [] with
 *      `dailyCapped: true` (proactive cap, avoid burning budget).
 *   3. Otherwise: `recordRequestStart()` to increment daily counter.
 *   4. Fetch with timeout 15s (lower than global default, fails fast on 429).
 *   5. On 429 response: read `Retry-After` header (seconds), `recordRateLimited()`,
 *      return [] with `rateLimited: true`.
 *   6. On 200 OK: `recordSuccess()` and parse results normally.
 */

import { fetchWithTimeout, safeJson, sanitizeQueryForSearch, SearchResult, SearchOptions, decodeInvertedIndex } from './base';
import { OpenAlexWork, OpenAlexResponse } from '../types/search';
import { SEARCH_LIMITS } from '../utils/search-limits';
import {
    isRateLimited,
    isDailyCapExceeded,
    recordRequestStart,
    recordRateLimited,
    recordSuccess,
} from '../utils/openalex-throttle';

function getFirstAuthor(work: OpenAlexWork): string | undefined {
    return work.authorships?.[0]?.author?.display_name;
}

function getFirstInstitution(work: OpenAlexWork): string | undefined {
    return work.authorships?.[0]?.institutions?.[0]?.display_name;
}

function getAllAuthors(work: OpenAlexWork): string[] {
    return work.authorships?.map(a => a.author.display_name) || [];
}

/** Common pre-flight check used by both searchOpenAlex and centralizedOpenAlexFallback. */
function preFlightGate(): { allowed: boolean; reason?: string; metadata?: any } {
    // 1) Active cooldown (from prior 429)?
    const rl = isRateLimited();
    if (rl.inCooldown) {
        console.warn(`[OPENALEX] In cooldown (${rl.retryAfterSec}s remaining). Skipping network call.`);
        return {
            allowed: false,
            reason: 'rate-limited',
            metadata: { rateLimited: true, retryAfterSec: rl.retryAfterSec, isFallback: false },
        };
    }
    // 2) Daily proactive cap exceeded?
    const cap = isDailyCapExceeded();
    if (cap.exceeded) {
        console.warn(`[OPENALEX] Daily cap ${cap.remainingToday}/${cap.dailyCap || 'cap'} exceeded. Skipping.`);
        return {
            allowed: false,
            reason: 'daily-capped',
            metadata: { dailyCapped: true, remainingToday: 0, isFallback: false },
        };
    }
    return { allowed: true };
}

export async function searchOpenAlex(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean; rateLimited?: boolean; dailyCapped?: boolean; retryAfterSec?: number } }> {
    // Pre-flight gate
    const gate = preFlightGate();
    if (!gate.allowed) {
        return { results: [], metadata: gate.metadata as any };
    }

    try {
        let filterStr = 'has_abstract:true';
        if (options?.yearStart) filterStr += `,publication_year:>${parseInt(options.yearStart) - 1}`;
        if (options?.yearEnd) filterStr += `,publication_year:<${parseInt(options.yearEnd) + 1}`;
        // 1.1.6: `university` ya no restringe la busqueda (reducia los resultados); el orden final
        // pone primero los de esa institucion (priorizarLocales).

        const defaultLimit = Math.min(options?.limit || 25, SEARCH_LIMITS.OPENALEX);
        // Parche 9 (2026-08-15): override per-page desde maxPagesBySource["openalex"] o env OPENALEX_MAXPAGES.
        const perSource = options?.maxPagesBySource?.['openalex'];
        const envOpenAlex = parseInt(process.env.OPENALEX_MAXPAGES || '', 10);
        const override = (typeof perSource === 'number' && Number.isInteger(perSource))
            ? Math.max(1, Math.min(200, perSource))
            : (!isNaN(envOpenAlex) ? Math.max(1, Math.min(200, envOpenAlex)) : null);
        const limit = override ?? defaultLimit;
        const sanitizedQuery = sanitizeQueryForSearch(query);
        if (options?.onProgress) options.onProgress({ message: 'Consultando OPENALEX...' });
        console.log(`[OPENALEX] Searching: "${sanitizedQuery.substring(0, 50)}..."`);

        // Record request start (counts against daily budget)
        recordRequestStart();

        const url = `https://api.openalex.org/works?search=${encodeURIComponent(sanitizedQuery)}&filter=${filterStr}&per-page=${limit}&mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO || 'letxipu-v11@example.com')}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 15000);

        // Handle 429: record cooldown, return empty
        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('retry-after') || '3600', 10);
            recordRateLimited(retryAfter, 429);
            console.warn(`[OPENALEX] HTTP 429. Cooldown ${retryAfter}s.`);
            return {
                results: [],
                metadata: { isFallback: false, rateLimited: true, retryAfterSec: retryAfter },
            };
        }

        if (!res.ok) {
            console.warn(`[OPENALEX] HTTP ${res.status}.`);
            return { results: [], metadata: { isFallback: false } };
        }

        const data = (await safeJson(res, 'OPENALEX')) as OpenAlexResponse;
        recordSuccess(200);

        const results = (data.results || []).map((w: OpenAlexWork): SearchResult => ({
            id: w.id,
            title: w.title || 'Sin título',
            abstract: decodeInvertedIndex(w.abstract_inverted_index),
            pdfUrl: w.ids?.doi ? `https://doi.org/${w.ids.doi.replace(/^https?:\/\/doi\.org\//i, '')}` : (w.primary_location?.landing_page_url || null),
            year: w.publication_year || null,
            authors: getAllAuthors(w),
            source: 'OpenAlex',
            type: w.type || 'Work',
            university: getFirstInstitution(w),
            citationCount: w.cited_by_count || null,
            doi: w.doi ? w.doi.replace('https://doi.org/', '') : null
        }));

        console.log(`[OPENALEX] Found=${results.length} | Query="${sanitizedQuery.substring(0, 50)}..."`);
        return { results, metadata: { isFallback: false } };
    } catch (e: any) {
        console.warn(`[OPENALEX] Error: ${e.message}`);
        return { results: [], metadata: { isFallback: false } };
    }
}

/**
 * Robust fallback for regional sources when they are down.
 * Uses OpenAlex with country-specific filtering.
 *
 * Same throttle gating as searchOpenAlex (pre-flight + 429 cooldown).
 */
export async function centralizedOpenAlexFallback(
    query: string,
    options?: SearchOptions,
    sourceLabel: string = 'La Referencia'
): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean; rateLimited?: boolean; dailyCapped?: boolean; retryAfterSec?: number } }> {
    // Pre-flight gate
    const gate = preFlightGate();
    if (!gate.allowed) {
        return { results: [], metadata: gate.metadata as any };
    }

    console.log(`[${sourceLabel}] Source appears down. Falling back to OpenAlex...`);
    try {
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.FALLBACK_DEFAULT);
        const sanitizedQuery = sanitizeQueryForSearch(query);

        recordRequestStart();

        const url = `https://api.openalex.org/works?search=${encodeURIComponent(sanitizedQuery)}&filter=has_abstract:true&per-page=${limit}&mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO || 'letxipu-v11@example.com')}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 15000);

        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('retry-after') || '3600', 10);
            recordRateLimited(retryAfter, 429);
            console.warn(`[OPENALEX-Fallback] HTTP 429. Cooldown ${retryAfter}s.`);
            return {
                results: [],
                metadata: { isFallback: true, rateLimited: true, retryAfterSec: retryAfter },
            };
        }

        if (!res.ok) return { results: [], metadata: { isFallback: true } };

        const data = (await safeJson(res, `OPENALEX (Fallback for ${sourceLabel})`)) as OpenAlexResponse;
        recordSuccess(200);

        const results = (data.results || []).map((w: OpenAlexWork): SearchResult => ({
            id: w.id,
            title: w.title || 'Sin título',
            abstract: decodeInvertedIndex(w.abstract_inverted_index),
            pdfUrl: w.ids?.doi ? `https://doi.org/${w.ids.doi.replace(/^https?:\/\/doi\.org\//i, '')}` : null,
            year: w.publication_year || null,
            authors: getAllAuthors(w),
            source: `${sourceLabel} (via OpenAlex)`,
            type: w.type || 'Work',
            university: getFirstInstitution(w),
            citationCount: w.cited_by_count || null,
            doi: w.doi ? w.doi.replace('https://doi.org/', '') : null
        }));

        return {
            results,
            metadata: { isFallback: true }
        };
    } catch (e: any) {
        console.warn(`[OPENALEX-Fallback] Error: ${e.message}`);
        return { results: [], metadata: { isFallback: true } };
    }
}
