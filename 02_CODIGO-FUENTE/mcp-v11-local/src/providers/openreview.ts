/**
 * OpenReview Provider
 *
 * Strategy (BL-06 fix, 2026-07-25):
 *   1) PRIMARY: v1 search endpoint `api.openreview.net/notes/search?term=...` (no Cloudflare)
 *   2) LEGACY: v2 invitations `api2.openreview.net/notes?invitation=...` (Cloudflare blocks → degraded)
 *
 * Pool v4 diagnosis (2026-07-15):
 *   - `api2.openreview.net/notes` → 403 ChallengeRequiredError (Cloudflare blocks all v2 endpoints)
 *   - `api.openreview.net/notes?id=...`  → 400 Bad Request (v1 legacy retired)
 *   - `api.openreview.net/notes?invitation=...` → 403 (Cloudflare)
 *   - `api.openreview.net/notes/search?term=...&content=all&source=forum` → 200 OK (workaround!)
 *
 * Schema v1 notes (from search endpoint):
 *   content.title      : string (direct, not {value:"..."})
 *   content.abstract   : string
 *   content.authors    : string[]
 *   content.pdf        : string (URL or path)
 *   content.venue      : string
 *   content.venueid    : string
 *   content.keywords   : string[] (sometimes absent)
 *   content.html       : string (forum URL)
 *
 * Optional auth via OPENREVIEW_USERNAME/PASSWORD for v2 elevated access (still blocked by Cloudflare).
 */

import { fetchWithTimeout, sanitizeQueryForSearch } from './base';
import { PaperResult, SearchOptions } from '../types/search';

const OPENREVIEW_API_V1 = process.env.OPENREVIEW_API_V1 || 'https://api.openreview.net';
const OPENREVIEW_API_V2 = process.env.OPENREVIEW_API_V2 || 'https://api2.openreview.net';

interface OpenReviewNoteV1 {
    id?: string;
    forum?: string;
    invitation?: string;
    cdate?: number;
    pdate?: number;
    tcdate?: number;
    content?: {
        title?: string;
        abstract?: string;
        authors?: string[];
        authorids?: string[];
        keywords?: string[];
        venue?: string;
        venueid?: string;
        pdf?: string;
        html?: string;
        paperhash?: string;
        _bibtex?: string;
    };
}

interface OpenReviewNoteV2 {
    id?: string;
    forum?: string;
    content?: {
        title?: { value?: string };
        abstract?: { value?: string };
        authors?: { value?: string[] };
        keywords?: { value?: string[] };
        venue?: { value?: string };
        venueid?: { value?: string };
        pdf?: { value?: string };
        _bibtex?: { value?: string };
    };
    cdate?: number;
    tcdate?: number;
    pdate?: number;
}

interface OpenReviewSearchResponse {
    notes?: OpenReviewNoteV1[];
    count?: number;
}

interface OpenReviewV2Response {
    notes?: OpenReviewNoteV2[];
    count?: number;
}

function extractYearFromTimestamp(note: { cdate?: number; pdate?: number; tcdate?: number; content?: { venue?: string; venueid?: string } }): number | null {
    const timestamp = note.pdate || note.cdate || note.tcdate;
    if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) return date.getFullYear();
    }
    const venue = (note.content?.venue as string) || (note.content?.venueid as string) || '';
    const match = venue.match(/(\d{4})/);
    if (match) return parseInt(match[1], 10);
    return null;
}

/**
 * PRIMARY path: v1 /notes/search endpoint (no Cloudflare).
 * Returns v1-schema notes (content.title is string direct, not {value}).
 */
async function searchV1SearchEndpoint(
    cleanQuery: string,
    limit: number,
    options?: SearchOptions
): Promise<{ results: PaperResult[]; degraded?: boolean }> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // v1 search uses "+" for spaces; encode query
    const term = encodeURIComponent(cleanQuery).replace(/%20/g, '+');
    const params = new URLSearchParams({
        term,
        content: 'all',
        source: 'forum',
        limit: String(limit),
    });

    console.log(`[OpenReview] v1 search: "${cleanQuery.substring(0, 60)}" (limit=${limit})`);

    const res = await fetchWithTimeout(
        `${OPENREVIEW_API_V1}/notes/search?${params.toString()}`,
        { headers },
        15000
    );

    if (!res.ok) {
        throw new Error(`v1 search HTTP ${res.status}`);
    }

    const data = await res.json() as OpenReviewSearchResponse;
    const notes = data?.notes || [];
    console.log(`[OpenReview] v1 search returned ${notes.length} notes`);

    const results: PaperResult[] = notes.map((note, idx) => {
        const content = note.content || {};
        const title = content.title || 'Untitled';
        const abstract = content.abstract || '';
        const authors = content.authors || [];
        const year = extractYearFromTimestamp(note);
        const venue = content.venue || content.venueid || '';
        const keywords = content.keywords || [];

        if (options?.yearStart && year && year < parseInt(options.yearStart)) return null;
        if (options?.yearEnd && year && year > parseInt(options.yearEnd)) return null;

        let pdfUrl: string | null = null;
        if (content.pdf) {
            pdfUrl = content.pdf.startsWith('http')
                ? content.pdf
                : `${OPENREVIEW_API_V1}${content.pdf}`;
        }

        const forumUrl = note.forum
            ? `https://openreview.net/forum?id=${note.forum}`
            : content.html || undefined;

        return {
            id: `openreview_${note.id || idx}`,
            title,
            authors,
            year,
            abstract,
            pdfUrl,
            source: 'openreview',
            doi: null,
            citationCount: null,
            url: forumUrl,
            snippet: [
                venue ? `Venue: ${venue}` : null,
                keywords.length > 0 ? `Keywords: ${keywords.slice(0, 5).join(', ')}` : null,
            ].filter(Boolean).join(' | ') || undefined,
        } as PaperResult;
    }).filter(Boolean) as PaperResult[];

    return { results, degraded: false };
}

/**
 * LEGACY fallback: v2 /notes?invitation=... (Cloudflare blocks → 403 → degraded path).
 * Kept for posterity; if v1 search endpoint is retired upstream, this may be reactivated
 * once Cloudflare is bypassed (see BACKLOG_PROGRESO.md BL-06).
 */
async function searchV2Invitations(
    cleanQuery: string,
    limit: number,
    options?: SearchOptions
): Promise<{ results: PaperResult[]; degraded?: boolean }> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const username = process.env.OPENREVIEW_USERNAME;
    const password = process.env.OPENREVIEW_PASSWORD;
    if (username && password) {
        try {
            const loginRes = await fetchWithTimeout(`${OPENREVIEW_API_V2}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: username, password }),
            }, 10000);
            if (loginRes.ok) {
                const loginData = await loginRes.json() as { token?: string };
                if (loginData.token) {
                    headers['Authorization'] = `Bearer ${loginData.token}`;
                    console.log('[OpenReview] v2 authenticated successfully');
                }
            }
        } catch (e: any) {
            console.warn(`[OpenReview] v2 auth failed: ${e.message}`);
        }
    }

    const currentYear = new Date().getFullYear();
    const venues = [
        `ICLR.cc/${currentYear}/Conference/-/Submission`,
        `ICLR.cc/${currentYear - 1}/Conference/-/Submission`,
        `NeurIPS.cc/${currentYear}/Conference/-/Submission`,
        `NeurIPS.cc/${currentYear - 1}/Conference/-/Submission`,
    ];

    let allNotes: OpenReviewNoteV2[] = [];
    const perVenueLimit = Math.ceil(limit / venues.length);

    for (const invitation of venues) {
        try {
            const params = new URLSearchParams({
                invitation,
                limit: String(perVenueLimit),
                details: 'replyCount',
            });

            const res = await fetchWithTimeout(
                `${OPENREVIEW_API_V2}/notes?${params.toString()}`,
                { headers },
                15000
            );

            if (res.ok) {
                const data = await res.json() as OpenReviewV2Response;
                const notes = data?.notes || [];
                const queryTerms = cleanQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
                const matched = notes.filter(note => {
                    const title = (note.content?.title?.value || '').toLowerCase();
                    const abstract = (note.content?.abstract?.value || '').toLowerCase();
                    const haystack = `${title} ${abstract}`;
                    return queryTerms.some(term => haystack.includes(term));
                });
                allNotes.push(...matched);
                console.log(`[OpenReview] v2 ${invitation.split('/')[0]}: ${matched.length}/${notes.length} matched`);
            } else {
                console.warn(`[OpenReview] v2 ${invitation.split('/')[0]}: HTTP ${res.status}`);
            }
        } catch (e: any) {
            console.warn(`[OpenReview] v2 ${invitation.split('/')[0]}: ${e.message}`);
        }

        if (allNotes.length >= limit) break;
    }

    const seen = new Set<string>();
    const notes = allNotes.filter(n => {
        const id = n.id || '';
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).slice(0, limit);

    const results: PaperResult[] = notes.map((note, idx) => {
        const content = note.content || {};
        const title = content.title?.value || 'Untitled';
        const abstract = content.abstract?.value || '';
        const authors = content.authors?.value || [];
        const year = extractYearFromTimestamp({
            cdate: note.cdate,
            pdate: note.pdate,
            tcdate: note.tcdate,
            content: {
                venue: content.venue?.value,
                venueid: content.venueid?.value,
            },
        });
        const venue = content.venue?.value || content.venueid?.value || '';
        const keywords = content.keywords?.value || [];

        if (options?.yearStart && year && year < parseInt(options.yearStart)) return null;
        if (options?.yearEnd && year && year > parseInt(options.yearEnd)) return null;

        let pdfUrl: string | null = null;
        if (content.pdf?.value) {
            pdfUrl = content.pdf.value.startsWith('http')
                ? content.pdf.value
                : `${OPENREVIEW_API_V2}${content.pdf.value}`;
        }

        const forumUrl = note.forum
            ? `https://openreview.net/forum?id=${note.forum}`
            : undefined;

        return {
            id: `openreview_${note.id || idx}`,
            title,
            authors,
            year,
            abstract,
            pdfUrl,
            source: 'openreview',
            doi: null,
            citationCount: null,
            url: forumUrl,
            snippet: [
                venue ? `Venue: ${venue}` : null,
                keywords.length > 0 ? `Keywords: ${keywords.slice(0, 5).join(', ')}` : null,
            ].filter(Boolean).join(' | ') || undefined,
        } as PaperResult;
    }).filter(Boolean) as PaperResult[];

    return { results, degraded: true };
}

export async function searchOpenReview(
    query: string,
    options?: SearchOptions
): Promise<{ results: PaperResult[]; degraded?: boolean }> {
    const cleanQuery = sanitizeQueryForSearch(query);
    const limit = options?.limit || 25;

    try {
        // PRIMARY: v1 search endpoint (no Cloudflare)
        const v1Result = await searchV1SearchEndpoint(cleanQuery, limit, options);
        if (v1Result.results.length > 0) {
            console.log(`[OpenReview] v1 search returned ${v1Result.results.length} results (primary path)`);
            return v1Result;
        }

        console.warn('[OpenReview] v1 search returned 0 results; trying v2 legacy as fallback (will likely fail with Cloudflare 403)');

        // LEGACY FALLBACK: v2 invitations (Cloudflare blocks → degraded)
        const v2Result = await searchV2Invitations(cleanQuery, limit, options);
        if (v2Result.results.length > 0) {
            console.warn(`[OpenReview] v2 legacy returned ${v2Result.results.length} results (degraded)`);
            return v2Result;
        }

        console.warn('[OpenReview] Both v1 and v2 paths returned 0 results');
        return { results: [], degraded: true };
    } catch (e: any) {
        console.error(`[OpenReview] Primary v1 path failed: ${e.message}. Trying v2 legacy...`);
        try {
            return await searchV2Invitations(cleanQuery, limit, options);
        } catch (e2: any) {
            console.error(`[OpenReview] v2 legacy also failed: ${e2.message}`);
            return { results: [], degraded: true };
        }
    }
}
