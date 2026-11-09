/**
 * HuggingFace Daily Papers Provider
 * API: https://huggingface.co/api/daily_papers
 * No API key required.
 */

import { fetchWithTimeout, sanitizeQueryForSearch } from './base';
import { PaperResult, SearchOptions } from '../types/search';

const HF_DAILY_PAPERS_URL = 'https://huggingface.co/api/daily_papers';

interface HfDailyPaper {
    title?: string;
    summary?: string;
    paper?: {
        id?: string;
        title?: string;
        authors?: { name?: string; user?: string }[];
        summary?: string;
        publishedAt?: string;
        upvotes?: number;
    };
    publishedAt?: string;
    mediaUrl?: string;
}

export async function searchHuggingFacePapers(
    query: string,
    options?: SearchOptions
): Promise<{ results: PaperResult[] }> {
    const cleanQuery = sanitizeQueryForSearch(query).toLowerCase();

    try {
        console.log(`[HuggingFace] Fetching daily papers, filtering by: "${cleanQuery.substring(0, 60)}..."`);
        const res = await fetchWithTimeout(
            HF_DAILY_PAPERS_URL,
            {
                headers: { 'Accept': 'application/json' }
            },
            15000
        );

        if (!res.ok) {
            console.error(`[HuggingFace] HTTP ${res.status}`);
            return { results: [] };
        }

        const papers = await res.json() as HfDailyPaper[];

        if (!Array.isArray(papers)) {
            console.error('[HuggingFace] Unexpected response format');
            return { results: [] };
        }

        // Filter papers matching the query in title or summary
        const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length >= 3);

        const filtered = papers.filter(p => {
            const paper = p.paper || p;
            const title = (paper.title || p.title || '').toLowerCase();
            const summary = (paper.summary || '').toLowerCase();
            const haystack = `${title} ${summary}`;

            // If no query terms, return all (trending papers)
            if (queryTerms.length === 0) return true;

            // Match if any query term is found in title or summary
            return queryTerms.some(term => haystack.includes(term));
        });

        const limit = options?.limit || 25;

        const results: PaperResult[] = filtered.slice(0, limit).map((p, idx) => {
            const paper = p.paper || {} as any;
            const title = paper.title || p.title || 'Untitled';
            const authors = (paper.authors || []).map((a: any) => a.name || a.user || '').filter(Boolean);
            const abstract = paper.summary || '';
            const arxivId = paper.id || '';

            // Extract year from publishedAt
            let year: number | null = null;
            const dateStr = paper.publishedAt || p.publishedAt;
            if (dateStr) {
                const match = String(dateStr).match(/(\d{4})/);
                if (match) year = parseInt(match[1], 10);
            }

            // Year filtering
            if (options?.yearStart && year && year < parseInt(options.yearStart)) return null;
            if (options?.yearEnd && year && year > parseInt(options.yearEnd)) return null;

            return {
                id: `hf_${arxivId || idx}`,
                title,
                authors,
                year,
                abstract,
                pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : null,
                source: 'huggingface',
                doi: null,
                citationCount: null,
                url: arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined,
                snippet: paper.upvotes ? `🔥 ${paper.upvotes} upvotes on HuggingFace` : undefined,
            } as PaperResult;
        }).filter(Boolean) as PaperResult[];

        console.log(`[HuggingFace] Found ${results.length} matching papers (from ${papers.length} daily)`);
        return { results };
    } catch (e: any) {
        console.error(`[HuggingFace] Error: ${e.message}`);
        return { results: [] };
    }
}
