/**
 * Global Academic Repositories
 * Zenodo, OpenAIRE, DOAJ, Crossref, CORE, SciELO, Redalyc, SerpApi
 */

import { SEARCH_LIMITS } from '../utils/search-limits';
import { fetchWithTimeout, safeJson, sanitizeQueryForSearch, simplifyQuery, SearchResult, SearchOptions, generateRecordId } from './base';
import { executeFallback, registerSciELOFallback } from './fallback-manager';

/** Standalone abstract cleaner (replaces AI-agent dependency) */
function cleanAndTruncateAbstract(text: string | null | undefined, maxLen: number = Infinity): string {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

export async function searchZenodo(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/[\"()]/g, ' ').trim();
        const finalQuery = cleanQuery.length > 120 ? simplifyQuery(cleanQuery, 5, options?.location) : cleanQuery;
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.ZENODO);
        console.log(`[ZENODO] Searching: "${finalQuery.substring(0, 50)}..."`);
        const queryParts = [finalQuery];
        if (options?.yearStart && options?.yearEnd) queryParts.push(`publication_date:[${options.yearStart}-01-01 TO ${options.yearEnd}-12-31]`);
        const url = `https://zenodo.org/api/records?q=${encodeURIComponent(queryParts.join(' AND '))}&size=${limit}&type=publication`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) return { results: [] };
        const data = await safeJson(res, 'ZENODO');
        const records = data.hits?.hits || [];
        return { results: records.map((record: any) => {
            const m = record.metadata || {};
            const creators = m.creators;
            return { id: `zenodo_${record.id}`, title: m.title || 'Sin título', authors: creators?.map((c: any) => c.name) || ['Autor Desconocido'], year: m.publication_date ? parseInt(m.publication_date.substring(0, 4)) : null, abstract: m.description || null, pdfUrl: record.links?.self_html || record.files?.[0]?.links?.self || null, handleUrl: record.links?.self_html || undefined, source: 'Zenodo', type: m.resource_type?.type || 'publication', university: creators?.[0]?.affiliation || 'CERN Open Repository', doi: m.doi || null, citationCount: null };
        }) };
    } catch (e: any) { console.error('[ZENODO] Exception:', e.message); return { results: [] }; }
}

export async function searchOpenAIRE(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/[\"()]/g, ' ').trim();
        const finalQuery = cleanQuery.length > 120 ? simplifyQuery(cleanQuery, 6, options?.location) : cleanQuery;
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.OPENAIRE);
        console.log(`[OPENAIRE] Searching: "${finalQuery.substring(0, 50)}..."`);
        let url = `http://api.openaire.eu/search/publications?keywords=${encodeURIComponent(finalQuery)}&format=json&size=${limit}`;
        if (options?.yearStart) url += `&fromDateAccepted=${options.yearStart}-01-01`;
        if (options?.yearEnd) url += `&toDateAccepted=${options.yearEnd}-12-31`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 25000);
        if (!res.ok) return { results: [] };
        const data = await safeJson(res, 'OPENAIRE');
        const resultsData = data.response?.results?.result || [];
        return { results: resultsData.map((result: any) => {
            const m = result.metadata?.['oaf:entity']?.['oaf:result'] || {};
            const titleRaw = m.title;
            const title = titleRaw ? (Array.isArray(titleRaw) ? (titleRaw[0]?.$ || titleRaw[0] || 'Sin título') : (titleRaw.$ || titleRaw || 'Sin título')) : 'Sin título';
            const creators = m.creator;
            const authors = creators ? (Array.isArray(creators) ? creators : [creators]).map((c: any) => c.$ || c || 'Unknown').filter(Boolean) : ['Autor Desconocido'];
            const pids = m.pid;
            let doi = null;
            if (pids) { const pidArr = Array.isArray(pids) ? pids : [pids]; const d = pidArr.find((p: any) => p['@classid'] === 'doi'); if (d) doi = d.$; }
            return { id: `openaire_${result.header?.['dri:objIdentifier']?.$?.replace(/[^a-zA-Z0-9]/g, '_') || generateRecordId('', title)}`, title, authors, year: m.dateofacceptance?.$ ? parseInt(m.dateofacceptance.$.substring(0, 4)) : null, abstract: cleanAndTruncateAbstract(m.description?.$), pdfUrl: m.webresource?.url || null, source: 'OpenAIRE', type: m.resulttype?.['@classname'] || 'publication', university: m.collectedfrom?.['@name'] || 'OpenAIRE', doi, citationCount: null };
        }) };
    } catch (e: any) { console.error('[OPENAIRE] Exception:', e.message); return { results: [] }; }
}

export async function searchDOAJ(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/[\"()]/g, ' ').trim();
        const finalQuery = cleanQuery.length > 100 ? simplifyQuery(cleanQuery, 5, options?.location) : cleanQuery;
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.DOAJ);
        console.log(`[DOAJ] Searching: "${finalQuery.substring(0, 50)}..."`);
        const url = `https://doaj.org/api/search/articles/${encodeURIComponent(finalQuery)}?pageSize=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) return { results: [] };
        const data = await safeJson(res, 'DOAJ');
        return { results: (data.results || []).map((record: any) => {
            const b = record.bibjson || {};
            const identifiers = b.identifier;
            const doiEntry = identifiers?.find((id: any) => id.type === 'doi');
            const links = b.link;
            const pdfLink = links?.find((l: any) => l.content_type === 'text/html' || l.type === 'fulltext');
            return { id: `doaj_${record.id || generateRecordId('', b.title || '')}`, title: b.title || 'Sin título', authors: b.author?.map((a: any) => a.name) || ['Autor Desconocido'], year: b.year ? parseInt(b.year) : null, abstract: cleanAndTruncateAbstract(b.abstract) || null, pdfUrl: pdfLink?.url || null, source: 'DOAJ', type: 'article', university: b.journal?.publisher || 'Open Access Journal', doi: doiEntry?.id || null, citationCount: null };
        }) };
    } catch (e: any) { console.error('[DOAJ] Exception:', e.message); return { results: [] }; }
}

export async function searchCrossref(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/[\"()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.CROSSREF);
        console.log(`[CROSSREF] Searching: "${cleanQuery.substring(0, 50)}..."`);
        let url = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=${limit}`;
        if (options?.yearStart) url += `&filter=from-pub-date:${options.yearStart}`;
        if (options?.yearEnd) url += `,until-pub-date:${options.yearEnd}`;
        const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LetXipu-Search-MCP/1.0 (mailto:support@letxipu.com)' } }, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) return { results: [] };
        const data = await safeJson(res, 'CROSSREF');
        return { results: (data.message?.items || []).map((item: any) => {
            const dateParts = item.published?.['date-parts']?.[0];
            return {
                id: `crossref_${item.DOI?.replace(/[^a-zA-Z0-9]/g, '_') || generateRecordId('', item.title?.[0] || '')}`,
                title: item.title?.[0] || 'Sin título',
                authors: item.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || ['Autor Desconocido'],
                year: dateParts?.[0] || null,
                abstract: cleanAndTruncateAbstract(item.abstract),
                pdfUrl: item.link?.[0]?.URL || (item.DOI ? `https://doi.org/${item.DOI}` : null),
                handleUrl: item.DOI ? `https://doi.org/${item.DOI}` : undefined,
                source: 'Crossref', type: item.type || 'work',
                university: item.publisher || 'Crossref Registry',
                doi: item.DOI || null, citationCount: item['is-referenced-by-count'] || null
            };
        }) };
    } catch (e: any) { console.error('[CROSSREF] Exception:', e.message); return { results: [] }; }
}

export async function searchSciELO(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const defaultLimit = Math.min(options?.limit || 20, SEARCH_LIMITS.SCIELO);
        // Parche 9 (2026-08-15): override limit desde maxPagesBySource["scielo"] o env SCIELO_MAXPAGES.
        const perSource = options?.maxPagesBySource?.['scielo'];
        const envScielo = parseInt(process.env.SCIELO_MAXPAGES || '', 10);
        const override = (typeof perSource === 'number' && Number.isInteger(perSource))
            ? Math.max(1, Math.min(200, perSource))
            : (!isNaN(envScielo) ? Math.max(1, Math.min(200, envScielo)) : null);
        const limit = override ?? defaultLimit;
        console.log(`[SCIELO] Searching: "${sanitizedQuery.substring(0, 50)}..."`);

        // Level 1: SciELO Search API (covers all SciELO nodes including Peru, Brazil, etc.)
        const scieloResults = await searchSciELOApi(sanitizedQuery, limit, options);
        if (scieloResults.length > 0) {
            console.log(`[SCIELO] API returned ${scieloResults.length} results`);
            return { results: scieloResults };
        }

        // Level 2: Crossref fallback with prefix 10.1590 (SciELO DOI prefix)
        // Now WITH abstract extraction (was hardcoded to '' before)
        console.log(`[SCIELO] API failed/empty, falling back to Crossref prefix 10.1590`);
        const url = `https://api.crossref.org/works?query=${encodeURIComponent(sanitizedQuery)}&filter=prefix:10.1590&rows=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LetXipu-Search-MCP/1.0' } }, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) return { results: [], metadata: { isFallback: true } };
        const data = await safeJson(res, 'SCIELO');
        return {
            results: (data.message?.items || []).map((item: any) => {
                const dateParts = item.published?.['date-parts']?.[0];
                return {
                    id: `scielo_${item.DOI?.replace(/[^a-zA-Z0-9]/g, '_') || generateRecordId('', item.title?.[0] || '')}`,
                    title: item.title?.[0] || 'Sin título',
                    authors: item.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || ['Autor Desconocido'],
                    year: dateParts?.[0] || null, abstract: cleanAndTruncateAbstract(item.abstract),
                    pdfUrl: item.DOI ? `https://doi.org/${item.DOI}` : null,
                    source: 'SciELO', type: item.type || 'article',
                    university: item.publisher || 'SciELO',
                    doi: item.DOI || null, citationCount: item['is-referenced-by-count'] || null
                };
            }),
            metadata: { isFallback: true }
        };
    } catch (e: any) { console.error('[SCIELO] Exception:', e.message); return { results: [] }; }
}

/**
 * Query the SciELO Search API directly.
 * Endpoint: https://search.scielo.org/api/v1/articles
 * Covers all SciELO nodes (Peru, Brazil, Argentina, Mexico, Chile, Colombia, etc.)
 */
async function searchSciELOApi(query: string, limit: number, options?: SearchOptions): Promise<SearchResult[]> {
    const apiUrl = `https://search.scielo.org/api/v1/articles?q=${encodeURIComponent(query)}&lang=es&limit=${limit}&output=site`;
    try {
        const res = await fetchWithTimeout(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LetXipu-Search-MCP/1.0'
            }
        }, SEARCH_LIMITS.TIMEOUT_STANDARD);

        if (!res.ok) {
            console.warn(`[SCIELO-API] HTTP ${res.status}, falling back`);
            return [];
        }

        const data = await safeJson(res, 'SCIELO-API');
        const articles = data.articles || data.response?.docs || data || [];
        if (!Array.isArray(articles)) return [];

        return articles.slice(0, limit).map((article: any) => {
            const doi = article.doi || null;
            const pdfUrl = article.pdf_url || (article.url ? `${article.url.replace(/scielo\.php\?script=sci_arttext/, 'scielo.php?script=sci_pdf')}` : null);
            const handleUrl = article.url || (doi ? `https://doi.org/${doi}` : null);
            const abstract = cleanAndTruncateAbstract(article.abstract || article.abSTRACT || null);
            const authors = Array.isArray(article.authors)
                ? article.authors.map((a: any) => typeof a === 'string' ? a : `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean)
                : ['Autor Desconocido'];
            const year = article.year || article.publication_year || null;
            const journal = article.journal_title || article.journal || 'SciELO';

            return {
                id: `scielo_${doi?.replace(/[^a-zA-Z0-9]/g, '_') || article.id || generateRecordId('', article.title || '')}`,
                title: article.title || 'Sin título',
                authors: authors.length > 0 ? authors : ['Autor Desconocido'],
                year: year ? parseInt(String(year)) : null,
                abstract: abstract || null,
                pdfUrl,
                handleUrl,
                source: 'SciELO',
                type: 'article',
                university: journal,
                doi,
                citationCount: null
            } as SearchResult;
        });
    } catch (e: any) {
        console.warn(`[SCIELO-API] Exception: ${e.message}`);
        return [];
    }
}

// Register SciELO with fallback manager to resolve circular dependency
registerSciELOFallback(searchSciELO);

export async function searchCORE(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean, monoTokenExpanded?: boolean } }> {
    const coreApiKey = process.env.CORE_API_KEY;
    if (!coreApiKey) {
        console.warn('[CORE] CORE_API_KEY missing in .env. Start V11.1 via start_v11.bat to load .env with API keys (CORE_API_KEY, SCOPUS_API_KEY, SERPAPI_KEY).');
        return { results: [], metadata: { isFallback: false } as any };
    }
    try {
        const cleanQuery = sanitizeQueryForSearch(query).replace(/[\"()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.CORE);

        // BL-09 fix (2026-07-25): detect mono-token queries (CORE v3 tokenization strict).
        // CORE v3 returns 0 results for single-word queries like "cancer" / "dengue".
        // Strategy: first try original; if 0 results AND mono-token, retry with expanded "<q> research".
        const isMonoToken = !cleanQuery.includes(' ') && cleanQuery.length > 0;

        // Helper to actually run the CORE v3 fetch with the given query
        const fetchCore = async (q: string): Promise<{ results: SearchResult[]; status: number }> => {
            const url = `https://api.core.ac.uk/v3/search/works/?q=${encodeURIComponent(q)}&limit=${limit}`;
            const t0 = Date.now();
            const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${coreApiKey}`, 'Accept': 'application/json' } }, SEARCH_LIMITS.TIMEOUT_CORE);
            console.log(`[CORE] fetch(q="${q.substring(0, 40)}") done in ${Date.now() - t0}ms status=${res.status} ok=${res.ok}`);
            if (!res.ok) {
                console.warn(`[CORE] HTTP ${res.status} for query "${q.substring(0, 30)}..."`);
                return { results: [], status: res.status };
            }
            const tJson = Date.now();
            const data = await safeJson(res, 'CORE');
            const items = data.results || [];
            console.log(`[CORE] safeJson done in ${Date.now() - tJson}ms results=${items.length}`);
            const results = items.map((item: any) => ({
                id: `core_${item.id || generateRecordId('', item.title || '')}`,
                title: item.title || 'Sin título',
                authors: item.authors?.map((a: any) => a.name || a) || ['Autor Desconocido'],
                year: item.yearPublished || null,
                abstract: cleanAndTruncateAbstract(item.abstract) || null,
                pdfUrl: item.downloadUrl || item.sourceFulltextUrls?.[0] || null,
                source: 'CORE', type: 'work',
                university: item.publisher || item.dataProvider?.name || 'CORE Aggregator',
                doi: item.doi || null, citationCount: null
            } as SearchResult));
            return { results, status: res.status };
        };

        console.log(`[CORE] Searching: "${cleanQuery.substring(0, 50)}..."${isMonoToken ? ' (mono-token detected)' : ''}`);
        let { results, status } = await fetchCore(cleanQuery);

        // BL-09: auto-expand mono-token queries if first attempt returned 0
        if (isMonoToken && results.length === 0 && status === 200) {
            const expandedQuery = `${cleanQuery} research`;
            console.warn(`[CORE] Mono-token "${cleanQuery}" returned 0 results. Auto-expanding to "${expandedQuery}" (BL-09 fix).`);
            const { results: expandedResults } = await fetchCore(expandedQuery);
            if (expandedResults.length > 0) {
                console.log(`[CORE] Auto-expanded query returned ${expandedResults.length} results.`);
                return {
                    results: expandedResults,
                    metadata: { isFallback: false, monoTokenExpanded: true },
                };
            }
            // Both attempts returned 0 — return empty with metadata
            return {
                results: [],
                metadata: { isFallback: false, monoTokenExpanded: false },
            };
        }

        return { results, metadata: { isFallback: false, monoTokenExpanded: false } };
    } catch (e: any) { console.error('[CORE] Exception:', e.message); return { results: [] }; }
}

export async function searchRedalyc(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const shortQuery = simplifyQuery(sanitizeQueryForSearch(query), 5, options?.location);
        const cleanQuery = shortQuery.replace(/[\"()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 20, SEARCH_LIMITS.REDALYC);
        console.log(`[REDALYC] Searching: "${cleanQuery.substring(0, 50)}..."`);
        const url = `https://www.redalyc.org/busquedaArticuloFiltros.oa?q=${encodeURIComponent(cleanQuery)}&t=&rcPais498=&tipoRegistro=articulo&pagina=1&tamanioPagina=${limit}`;
        const res = await fetchWithTimeout(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.redalyc.org/busqueda.oa', 'X-Requested-With': 'XMLHttpRequest' }
        }, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) { const fb = await executeFallback(query, options, 'Redalyc'); return fb || { results: [] }; }
        const text = await res.text();
        if (text.trim().startsWith('<')) { const fb = await executeFallback(query, options, 'Redalyc'); return fb || { results: [] }; }
        let data;
        try { data = JSON.parse(text); } catch { const fb = await executeFallback(query, options, 'Redalyc'); return fb || { results: [] }; }
        const records = data.documentos || data.results || [];
        if (records.length === 0) { const fb = await executeFallback(query, options, 'Redalyc'); return fb || { results: [] }; }
        return { results: records.map((r: any) => ({
            id: `redalyc_${r.id || generateRecordId('', r.titulo || '')}`,
            title: r.titulo || r.title || 'Sin título',
            authors: r.autores?.split(';').map((a: string) => a.trim()) || ['Autor Desconocido'],
            year: r.anio ? parseInt(r.anio) : null,
            abstract: cleanAndTruncateAbstract(r.resumen) || null,
            pdfUrl: r.urlPdf || r.url || null, source: 'Redalyc', type: 'article',
            university: r.revista || r.institucion || 'Redalyc',
            doi: r.doi || null, citationCount: null
        })) };
    } catch { const fb = await executeFallback(query, options, 'Redalyc'); return fb || { results: [] }; }
}

export async function searchSerpApi(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    const serpApiKey = options?.serpApiKey || process.env.SERPAPI_KEY;
    if (!serpApiKey) return { results: [] };
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const limit = Math.min(options?.limit || 10, SEARCH_LIMITS.SERPAPI);
        console.log(`[SERPAPI] Searching: "${sanitizedQuery.substring(0, 50)}..."`);
        let url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(sanitizedQuery)}&num=${limit}&api_key=${serpApiKey}`;
        if (options?.yearStart) url += `&as_ylo=${options.yearStart}`;
        if (options?.yearEnd) url += `&as_yhi=${options.yearEnd}`;
        const res = await fetchWithTimeout(url, {}, SEARCH_LIMITS.TIMEOUT_STANDARD);
        if (!res.ok) {
            if (res.status === 401) console.warn('[SERPAPI] HTTP 401 — API key rejected/expired. Refresh at https://serpapi.com/manage-api-key');
            else console.warn(`[SERPAPI] HTTP ${res.status} for query "${sanitizedQuery.substring(0, 30)}..."`);
            return { results: [] };
        }
        const data = await safeJson(res, 'SERPAPI');
        return { results: (data.organic_results || []).map((r: any) => {
            const pubInfo = r.publication_info;
            const summaryMatch = pubInfo?.summary?.match(/(\d{4})/);
            return {
                id: `serpapi_${generateRecordId(r.link || '', r.title || '')}`,
                title: r.title || 'Sin título',
                authors: pubInfo?.authors?.map((a: any) => a.name) || ['Google Scholar'],
                year: summaryMatch ? parseInt(summaryMatch[1]) : null,
                abstract: r.snippet || null,
                pdfUrl: r.resources?.[0]?.link || r.link || null,
                source: 'Google Scholar (SerpApi)', type: 'Paper',
                university: pubInfo?.summary?.split(' - ')?.[1] || undefined,
                doi: null, citationCount: r.inline_links?.cited_by?.total || null
            };
        }) };
    } catch (e: any) { console.error('[SERPAPI] Exception:', e.message); return { results: [] }; }
}
