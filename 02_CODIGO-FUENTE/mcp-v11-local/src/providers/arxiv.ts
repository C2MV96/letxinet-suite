/**
 * arXiv Search Provider
 */

import { fetchWithTimeout, sanitizeQueryForSearch, SearchResult, SearchOptions, generateRecordId } from './base';

export async function searchArxiv(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const decodeEntities = (html: string) => html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
        const sanitizedQuery = sanitizeQueryForSearch(query);
        console.log(`[ARXIV] Searching: "${sanitizedQuery.substring(0, 50)}..."`);
        // Parche 9 (2026-08-15): override max_results desde maxPagesBySource["arxiv"] o env ARXIV_MAXPAGES.
        const perSource = options?.maxPagesBySource?.['arxiv'];
        const envArxiv = parseInt(process.env.ARXIV_MAXPAGES || '', 10);
        const override = (typeof perSource === 'number' && Number.isInteger(perSource))
            ? Math.max(1, Math.min(200, perSource))
            : (!isNaN(envArxiv) ? Math.max(1, Math.min(200, envArxiv)) : null);
        const maxResults = override ?? 40;
        const apiUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(sanitizedQuery)}&start=0&max_results=${maxResults}`;
        const res = await fetchWithTimeout(apiUrl);
        if (!res.ok) return { results: [] };
        const text = await res.text();

        const entries = text.split('<entry>'); entries.shift();
        const results = entries.map(entry => {
            const extract = (tag: string) => {
                const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
                return match ? decodeEntities(match[1]) : null;
            };
            const title = extract('title') || 'Sin título';
            const id = generateRecordId(extract('id') || '', title);
            const summary = extract('summary');
            const published = extract('published');
            const pdfMatch = entry.match(/<link title="pdf" href="(.*?)"/);
            const doi = extract('arxiv:doi');
            return {
                id, title, authors: ['arXiv Author'],
                year: published ? new Date(published).getFullYear() : null,
                abstract: summary || '', pdfUrl: pdfMatch ? pdfMatch[1] : null,
                source: 'arXiv', type: 'Preprint', university: 'arXiv Cornell',
                citationCount: null, doi: doi || null
            } as SearchResult;
        });

        const startYear = options?.yearStart ? parseInt(options.yearStart, 10) : NaN;
        const endYear = options?.yearEnd ? parseInt(options.yearEnd, 10) : NaN;
        const filteredResults = results.filter(result => {
            const y = typeof result.year === 'number' ? result.year : null;
            if (Number.isFinite(startYear) && y !== null && y < startYear) return false;
            if (Number.isFinite(endYear) && y !== null && y > endYear) return false;
            return true;
        });
        console.log(`[ARXIV] Found=${filteredResults.length}`);
        return { results: filteredResults };
    } catch { return { results: [] }; }
}
