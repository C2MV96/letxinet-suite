/**
 * DBLP Computer Science Bibliography Provider
 * API: https://dblp.org/search/publ/api
 * No API key required.
 */

import { fetchWithTimeout, sanitizeQueryForSearch } from './base';
import { PaperResult, SearchOptions } from '../types/search';

const DBLP_SEARCH_URL = 'https://dblp.org/search/publ/api';

interface DblpHit {
    info: {
        title?: string;
        authors?: { author: { text?: string } | { text?: string }[] };
        year?: string;
        venue?: string;
        doi?: string;
        ee?: string;
        url?: string;
        type?: string;
        key?: string;
    };
}

interface DblpResponse {
    result?: {
        hits?: {
            '@total'?: string;
            hit?: DblpHit[];
        };
    };
}

function extractAuthors(authors: DblpHit['info']['authors']): string[] {
    if (!authors?.author) return [];
    const authorData = authors.author;
    if (Array.isArray(authorData)) {
        return authorData.map(a => a.text || '').filter(Boolean);
    }
    return authorData.text ? [authorData.text] : [];
}

export async function searchDblp(
    query: string,
    options?: SearchOptions
): Promise<{ results: PaperResult[] }> {
    const cleanQuery = sanitizeQueryForSearch(query);
    const limit = options?.limit || 25;

    const params = new URLSearchParams({
        q: cleanQuery,
        format: 'json',
        h: String(limit),
        f: '0',
    });

    try {
        console.log(`[DBLP] Searching: "${cleanQuery.substring(0, 60)}..."`);
        const res = await fetchWithTimeout(
            `${DBLP_SEARCH_URL}?${params.toString()}`,
            {
                headers: {
                    'User-Agent': 'LetXipu/9.0 (https://github.com/letxipu; mail@example.com)',
                    'Accept': 'application/json'
                }
            },
            15000
        );

        if (!res.ok) {
            console.error(`[DBLP] HTTP ${res.status}`);
            return { results: [] };
        }

        const data = await res.json() as DblpResponse;
        const hits = data?.result?.hits?.hit || [];

        const results: PaperResult[] = hits.map((hit, idx) => {
            const info = hit.info;
            const authors = extractAuthors(info.authors);
            const year = info.year ? parseInt(info.year, 10) : null;
            const doi = info.doi || null;

            // Year filtering
            if (options?.yearStart && year && year < parseInt(options.yearStart)) return null;
            if (options?.yearEnd && year && year > parseInt(options.yearEnd)) return null;

            return {
                id: `dblp_${info.key || idx}`,
                title: info.title || 'Untitled',
                authors,
                year,
                abstract: '', // DBLP does not provide abstracts
                pdfUrl: info.ee || null,
                source: 'dblp',
                doi,
                citationCount: null,
                url: info.url ? `https://dblp.org/${info.url}` : (info.ee || undefined),
                type: info.type || undefined,
                snippet: info.venue ? `Venue: ${info.venue}` : undefined,
            } as PaperResult;
        }).filter(Boolean) as PaperResult[];

        console.log(`[DBLP] Found ${results.length} results`);
        return { results };
    } catch (e: any) {
        console.error(`[DBLP] Error: ${e.message}`);
        return { results: [] };
    }
}

/**
 * Get BibTeX for a DBLP record by key
 */
export async function getDblpBibtex(dblpKey: string): Promise<string | null> {
    try {
        const url = `https://dblp.org/rec/${dblpKey}.bib`;
        const res = await fetchWithTimeout(url, {}, 10000);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}
