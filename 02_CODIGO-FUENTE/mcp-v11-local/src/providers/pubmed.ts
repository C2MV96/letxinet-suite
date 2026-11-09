/**
 * PubMed Search Provider
 */

import { fetchWithTimeout, safeJson, sanitizeQueryForSearch, SearchResult, SearchOptions } from './base';
import { SEARCH_LIMITS } from '../utils/search-limits';

function extractArticleId(doc: any, idType: string): string | null {
    const ids = doc.articleids;
    if (!Array.isArray(ids)) return null;
    return ids.find((a: any) => a.idtype === idType)?.value || null;
}

function buildPdfUrl(pubmedId: string, pmcId: string | null): string {
    if (pmcId) {
        const normalized = pmcId.startsWith('PMC') ? pmcId : `PMC${pmcId}`;
        return `https://pmc.ncbi.nlm.nih.gov/articles/${normalized}/pdf/`;
    }
    return `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/`;
}

function extractDoi(doc: any): string | null {
    const fromIds = extractArticleId(doc, 'doi');
    if (fromIds) return fromIds;
    if (doc.elocationid) {
        const doiMatch = doc.elocationid.match(/doi:\s*(10\.\d{4,}\/\S+)/i);
        if (doiMatch) return doiMatch[1];
    }
    return null;
}

export async function searchPubMed(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        // Parche 9 (2026-08-15): override retmax desde maxPagesBySource["pubmed"] o env PUBMED_MAXPAGES.
        const perSource = options?.maxPagesBySource?.['pubmed'];
        const envPubmed = parseInt(process.env.PUBMED_MAXPAGES || '', 10);
        const override = (typeof perSource === 'number' && Number.isInteger(perSource))
            ? Math.max(1, Math.min(200, perSource))
            : (!isNaN(envPubmed) ? Math.max(1, Math.min(200, envPubmed)) : null);
        const limit = override ?? SEARCH_LIMITS.PUBMED;
        const sanitizedQuery = sanitizeQueryForSearch(query);
        let term = encodeURIComponent(sanitizedQuery);
        console.log(`[PUBMED] Searching: "${sanitizedQuery.substring(0, 50)}..."`);
        if (options?.yearStart || options?.yearEnd) {
            term += `+AND+${options.yearStart || '1950'}:${options.yearEnd || new Date().getFullYear().toString()}[pdat]`;
        }
        const sRes = await fetchWithTimeout(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retmax=${limit}`);
        const sData = await safeJson(sRes, 'PUBMED (ESearch)');
        const ids = sData.esearchresult?.idlist || [];
        if (ids.length === 0) return { results: [] };

        const sumRes = await fetchWithTimeout(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
        const sumData = await safeJson(sumRes, 'PUBMED (ESummary)');

        const results = ids.map((id: string) => {
            const doc = sumData.result[id];
            if (!doc) return null;
            const pmcId = extractArticleId(doc, 'pmc');
            const doi = extractDoi(doc);
            return {
                id: pmcId || id, title: doc.title || 'Sin título',
                authors: doc.authors ? doc.authors.map((a: any) => a.name) : ['PubMed Author'],
                abstract: '', pdfUrl: buildPdfUrl(id, pmcId),
                year: parseInt(doc.pubdate.split(' ')[0]),
                source: pmcId ? 'PubMed (PMC)' : 'PubMed',
                citationCount: null, doi, university: undefined, type: 'Article'
            } as SearchResult;
        }).filter((x: SearchResult | null): x is SearchResult => x !== null);
        console.log(`[PUBMED] Found=${results.length}`);
        return { results };
    } catch { return { results: [] }; }
}
