/**
 * Scopus (Elsevier) Search Provider
 */

import { SEARCH_LIMITS } from '../utils/search-limits';
import { fetchWithTimeout, safeJson, sanitizeQueryForSearch, simplifyQuery, SearchResult, SearchOptions, generateRecordId, decodeInvertedIndex } from './base';
import { ScopusResponse } from '../types/search';

export async function searchScopus(query: string, options?: SearchOptions & { scopusKey?: string }): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    const scopusKey = options?.scopusKey || process.env.SCOPUS_API_KEY;
    if (!scopusKey) return { results: [] };

    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        let cleanQuery = sanitizedQuery.replace(/^"(.*)"$/, '$1').trim();
        console.log(`[SCOPUS] Searching: "${cleanQuery.substring(0, 50)}..."`);

        let scopusQuery = cleanQuery;
        if (options?.university) scopusQuery = `(${cleanQuery}) AND AFFIL("${options.university}")`;
        if (options?.yearStart || options?.yearEnd) {
            scopusQuery = `(${scopusQuery}) AND PUBYEAR > ${parseInt(options?.yearStart || '1950') - 1} AND PUBYEAR < ${parseInt(options?.yearEnd || new Date().getFullYear().toString()) + 1}`;
        }

        const defaultLimit = Math.min(options?.limit || 25, SEARCH_LIMITS.SCOPUS);
        // Parche 9 (2026-08-15): override count desde maxPagesBySource["scopus"] o env SCOPUS_MAXPAGES.
        const perSource = options?.maxPagesBySource?.['scopus'];
        const envScopus = parseInt(process.env.SCOPUS_MAXPAGES || '', 10);
        const override = (typeof perSource === 'number' && Number.isInteger(perSource))
            ? Math.max(1, Math.min(200, perSource))
            : (!isNaN(envScopus) ? Math.max(1, Math.min(200, envScopus)) : null);
        const limit = override ?? defaultLimit;

        const fetchScopus = async (q: string) => {
            const stripped = q.replace(/^"(.*)"$/, '$1').replace(/\b(analyze|effect|determine|influence|investigacion|investigación|investigate|investigation|research|study|studies)\b/gi, '').replace(/\s+/g, ' ').trim();
            return fetchWithTimeout(`https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(stripped)}&count=${limit}&httpAccept=application/json&apiKey=${scopusKey}`, {
                headers: { 'X-ELS-APIKey': scopusKey, 'User-Agent': 'LetXipu-Search-MCP/1.0' }
            });
        };

        let res = await fetchScopus(scopusQuery);
        if (!res.ok) return { results: [] };

        let data = await safeJson(res, 'SCOPUS') as ScopusResponse;
        let results = data['search-results'];

        if (results?.['opensearch:totalResults'] === '0' && scopusQuery !== cleanQuery) {
            res = await fetchScopus(cleanQuery);
            if (res.ok) { data = await safeJson(res, 'SCOPUS (Naked)') as ScopusResponse; results = data['search-results']; }
        }
        if (results?.['opensearch:totalResults'] === '0') {
            res = await fetchScopus(`ALL("${cleanQuery}")`);
            if (res.ok) { data = await safeJson(res, 'SCOPUS (ALL)'); results = data['search-results']; }
        }

        const entries = results?.entry || [];
        if (!entries.length) return { results: [] };
        console.log(`[SCOPUS] Found=${entries.length}`);

        return {
            results: entries.map((e: any) => ({
                id: e['dc:identifier'] ? `scopus:${e['dc:identifier']}` : generateRecordId('', e['dc:title'] || ''),
                title: e['dc:title'] || 'Sin título',
                authors: [e['dc:creator'] || 'Scopus Author'],
                year: e['prism:coverDate'] ? new Date(e['prism:coverDate']).getFullYear() : null,
                abstract: e['dc:description'] || '',
                pdfUrl: e['prism:doi'] ? `https://doi.org/${e['prism:doi']}` : null,
                handleUrl: e.link?.find((l: any) => l['@ref'] === 'scopus')?.['@href'] || undefined,
                source: 'Scopus (Elsevier)', type: 'Article',
                university: e['affilname'] || undefined,
                citationCount: e['citedby-count'] ? parseInt(e['citedby-count']) : null,
                doi: e['prism:doi'] || null
            }))
        };
    } catch (e: any) {
        console.error('[SCOPUS] Exception:', e.message);
        return { results: [] };
    }
}

export async function enrichMetadata(doc: SearchResult): Promise<SearchResult> {
    if (doc.doi && doc.university && doc.abstract && doc.abstract.length > 200) return doc;
    try {
        const res = await fetchWithTimeout(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(doc.title)}`, {
            headers: { 'User-Agent': 'LetXipu-Search-MCP/1.0', 'Accept': 'application/json' }
        }, 12000);
        if (!res.ok) return doc;
        const data = await safeJson(res, 'ERA (OpenAlex)');
        const bestMatch = data.results?.[0];
        if (bestMatch?.title?.toLowerCase().includes(doc.title.toLowerCase().substring(0, 20))) {
            const enriched = { ...doc };
            if (!enriched.doi && bestMatch.doi) enriched.doi = bestMatch.doi.replace('https://doi.org/', '');
            const inst = bestMatch.authorships?.[0]?.institutions?.[0]?.display_name;
            if ((!enriched.university || enriched.university === 'Latinoamérica') && inst) {
                enriched.university = inst;
            }
            if (!enriched.year && bestMatch.publication_year) enriched.year = bestMatch.publication_year;
            if ((!enriched.abstract || enriched.abstract.length < 150) && bestMatch.abstract_inverted_index) {
                const decoded = decodeInvertedIndex(bestMatch.abstract_inverted_index);
                if (decoded.length > (enriched.abstract?.length || 0)) enriched.abstract = decoded;
            }
            return enriched;
        }
        return doc;
    } catch { return doc; }
}

export async function checkSearchSourcesHealth(activeFilters: any, options: SearchOptions): Promise<Record<string, { status: 'ONLINE' | 'OFFLINE', latency: number, error?: string }>> {
    const results: Record<string, { status: 'ONLINE' | 'OFFLINE', latency: number, error?: string }> = {};
    const check = async (name: string, fn: () => Promise<any>) => {
        const start = Date.now();
        try { await fn(); results[name] = { status: 'ONLINE', latency: Date.now() - start }; }
        catch (e: any) { results[name] = { status: 'OFFLINE', latency: Date.now() - start, error: e.message }; }
    };
    const checks: Promise<void>[] = [];
    if (activeFilters?.semanticScholar) checks.push(check('Semantic Scholar', () => fetchWithTimeout('https://api.semanticscholar.org/graph/v1/paper/search?query=test&limit=1', {}, 5000)));
    if (activeFilters?.openAlex) checks.push(check('OpenAlex', () => fetchWithTimeout('https://api.openalex.org/works?filter=title.search:test&per-page=1', {}, 5000)));
    if (activeFilters?.alicia) checks.push(check('ALICIA', () => fetchWithTimeout('https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=test&limit=1', {}, 8000)));
    await Promise.all(checks);
    return results;
}
