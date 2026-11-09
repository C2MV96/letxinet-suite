/**
 * Semantic Scholar Search Provider
 */

import { fetchWithTimeout, safeJson, sanitizeQueryForSearch, SearchResult, SearchOptions } from './base';
import { SEARCH_LIMITS } from '../utils/search-limits';

let lastSemanticScholarCall = 0;
const SEMANTIC_MIN_GAP = 2000;
let semanticScholarQueue: Promise<any> = Promise.resolve();

interface SemanticPaper {
    paperId: string;
    title: string;
    authors?: { name: string }[];
    year?: number;
    abstract?: string;
    openAccessPdf?: { url: string };
    url?: string;
    venue?: string;
    externalIds?: { DOI?: string };
    citationCount?: number;
}

export async function searchSemanticScholar(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    return semanticScholarQueue = semanticScholarQueue.then(async () => {
        const maxRetries = 3;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const now = Date.now();
                const timeSinceLast = now - lastSemanticScholarCall;
                if (timeSinceLast < SEMANTIC_MIN_GAP) {
                    await new Promise(resolve => setTimeout(resolve, SEMANTIC_MIN_GAP - timeSinceLast));
                }
                lastSemanticScholarCall = Date.now();

                const defaultLimit = Math.min(options?.limit || 25, SEARCH_LIMITS.SEMANTIC_SCHOLAR);
                // Parche 9 (2026-08-15): override limit Semantic Scholar.
                const perSource = options?.maxPagesBySource?.['semantic'] ?? options?.maxPagesBySource?.['semanticscholar'];
                const envSem = parseInt(process.env.SEMANTIC_MAXPAGES || process.env.SEMANTIC_SCHOLAR_MAXPAGES || '', 10);
                const override = (typeof perSource === 'number' && Number.isInteger(perSource))
                    ? Math.max(1, Math.min(200, perSource))
                    : (!isNaN(envSem) ? Math.max(1, Math.min(200, envSem)) : null);
                const limit = override ?? defaultLimit;
                const sanitizedQuery = sanitizeQueryForSearch(query);
                console.log(`[SEMANTIC SCHOLAR] Searching: "${sanitizedQuery.substring(0, 50)}..."`);
                let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(sanitizedQuery)}&limit=${limit}&fields=title,authors,year,abstract,openAccessPdf,url,venue,externalIds`;

                if (options?.yearStart || options?.yearEnd) {
                    url += `&year=${options.yearStart || '1900'}-${options.yearEnd || new Date().getFullYear().toString()}`;
                }

                const headers: Record<string, string> = {
                    'Accept': 'application/json',
                    'User-Agent': 'LetXipu-Search-MCP/1.0'
                };
                const semanticKey = options?.semanticKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
                if (semanticKey) headers['x-api-key'] = semanticKey;

                const res = await fetchWithTimeout(url, { headers });

                if (!res.ok) {
                    if (res.status === 429 && attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
                        continue;
                    }
                    return { results: [] };
                }

                const data = await safeJson(res, 'SEMANTIC SCHOLAR');
                const papers = (data.data || []) as SemanticPaper[];
                const results = papers.map((p): SearchResult => ({
                    id: p.paperId,
                    title: p.title || 'Sin título',
                    authors: p.authors?.map(a => a.name) || [],
                    year: p.year || null,
                    abstract: p.abstract || '',
                    pdfUrl: p.openAccessPdf?.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null),
                    handleUrl: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
                    source: 'Semantic Scholar',
                    type: 'Paper',
                    university: p.venue || undefined,
                    citationCount: p.citationCount || null,
                    doi: p.externalIds?.DOI || null
                }));

                if (results.length === 0) {
                    const simpleQuery = sanitizeQueryForSearch(query).replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/\s+/g, ' ').trim();
                    if (simpleQuery && simpleQuery.length > 3 && simpleQuery !== sanitizedQuery) {
                        const simpleRes = await fetchWithTimeout(
                            `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(simpleQuery)}&limit=${limit}&fields=title,authors,year,abstract,openAccessPdf,url,venue,externalIds`,
                            { headers }
                        );
                        if (simpleRes.ok) {
                            const simpleData = await safeJson(simpleRes, 'SEMANTIC SCHOLAR (Simplified)');
                            return {
                                results: (simpleData.data || []).map((p: SemanticPaper): SearchResult => ({
                                    id: p.paperId, title: p.title || 'Sin título',
                                    authors: p.authors?.map(a => a.name) || [], year: p.year || null,
                                    abstract: p.abstract || '',
                                    pdfUrl: p.openAccessPdf?.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null),
                                    handleUrl: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
                                    source: 'Semantic Scholar', type: 'Paper',
                                    university: p.venue || undefined,
                                    citationCount: p.citationCount || null,
                                    doi: p.externalIds?.DOI || null
                                })),
                                metadata: { isFallback: true }
                            };
                        }
                    }
                }
                return { results };
            } catch (_e: any) {
                if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000)); continue; }
                console.error("Semantic Scholar Exception", _e);
                return { results: [] };
            }
        }
        return { results: [] };
    }).catch(e => { console.error("Critical Semantic Scholar Queue Error", e); return { results: [] }; });
}
