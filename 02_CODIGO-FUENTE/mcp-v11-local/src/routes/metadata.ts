/**
 * POST /api/metadata/enrich — Batch metadata enrichment (V4)
 * POST /api/metadata/fetch  — Fetch single paper metadata (V4)
 */

import { Router, Request, Response } from 'express';
import { PaperResult, SearchOptions } from '../types/search';
import { fetchWithTimeout, safeJson, decodeInvertedIndex } from '../providers/base';
import { resilientFetch } from '../scraping/resilient-fetch';
import { extractMetadataFromHtml, fetchDSpace7Metadata, extractAliciaMetadata, detectAndFetchDSpace7, isDSpace7Spa } from '../scraping/metadata-extractor';
import { resolveHandleUrl, findUniversityFromUrl } from '../scraping/handle-map';

const router = Router();

function oaAuthor(work: any): string | undefined { return work.authorships?.[0]?.author?.display_name; }
function oaInstitution(work: any): string | undefined { return work.authorships?.[0]?.institutions?.[0]?.display_name; }
function oaAuthors(work: any): string[] { return work.authorships?.map((a: any) => a.author.display_name) || []; }

// ─── ENRICH ──────────────────────────────────────────────────────

function completenessScore(paper: PaperResult): number {
    let score = 0;
    if (paper.title && paper.title.length > 10) score += 15;
    if (paper.abstract && paper.abstract.length > 100) score += 25;
    if (paper.year) score += 10;
    if (paper.doi) score += 15;
    if (paper.pdfUrl) score += 15;
    if (paper.authors?.length > 0 && paper.authors[0] !== 'Autor Desconocido') score += 10;
    if (paper.university && paper.university !== 'Universidad Peruana') score += 10;
    return score;
}

async function enrichFromOpenAlex(enriched: PaperResult, fieldsRecovered: string[]): Promise<void> {
    if (!enriched.abstract || enriched.abstract.length < 100 || !enriched.doi || !enriched.year) {
        try {
            const oaRes = await fetchWithTimeout(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(enriched.title)}&per-page=1`, {}, 10000);
            if (oaRes.ok) {
                const oaData = await oaRes.json() as any;
                const work = oaData.results?.[0];
                if (work && work.title?.toLowerCase().includes(enriched.title.toLowerCase().substring(0, 20))) {
                    if (!enriched.doi && work.doi) { enriched.doi = work.doi.replace('https://doi.org/', ''); fieldsRecovered.push('doi'); }
                    if (!enriched.year && work.publication_year) { enriched.year = work.publication_year; fieldsRecovered.push('year'); }
                    if ((!enriched.abstract || enriched.abstract.length < 100) && work.abstract_inverted_index) {
                        const decoded = decodeInvertedIndex(work.abstract_inverted_index);
                        if (decoded.length > (enriched.abstract?.length || 0)) { enriched.abstract = decoded; fieldsRecovered.push('abstract'); }
                    }
                    if ((!enriched.university || enriched.university === 'Universidad Peruana') && oaInstitution(work)) {
                        enriched.university = oaInstitution(work)!; fieldsRecovered.push('university');
                    }
                    if (enriched.authors?.[0] === 'Autor Desconocido' && work.authorships?.length > 0) {
                        enriched.authors = oaAuthors(work); fieldsRecovered.push('authors');
                    }
                }
            }
        } catch (e: any) { console.warn('[Metadata] OpenAlex error:', e.message); }
    }
}

async function enrichFromCrossref(enriched: PaperResult, fieldsRecovered: string[]): Promise<void> {
    if (enriched.doi && (!enriched.abstract || enriched.abstract.length < 100)) {
        try {
            const crRes = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(enriched.doi)}`, {}, 8000);
            if (crRes.ok) {
                const crData = await crRes.json() as any;
                const item = crData.message;
                if (item) {
                    if ((!enriched.abstract || enriched.abstract.length < 100) && item.abstract) {
                        enriched.abstract = item.abstract.replace(/<[^>]+>/g, '').trim();
                        fieldsRecovered.push('abstract');
                    }
                    if (!enriched.year && item.published?.['date-parts']?.[0]?.[0]) {
                        enriched.year = item.published['date-parts'][0][0]; fieldsRecovered.push('year');
                    }
                }
            }
        } catch (e: any) { console.warn('[Metadata] Crossref error:', e.message); }
    }
}

async function enrichFromSemanticScholar(enriched: PaperResult, fieldsRecovered: string[]): Promise<void> {
    if (enriched.doi && (enriched.authors?.[0] === 'Autor Desconocido' || !enriched.pdfUrl)) {
        try {
            const ssRes = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(enriched.doi)}?fields=title,authors,year,abstract,citationCount,openAccessPdf`, {}, 8000);
            if (ssRes.ok) {
                const ss = await ssRes.json() as any;
                if (ss.authors?.length > 0 && enriched.authors?.[0] === 'Autor Desconocido') { enriched.authors = ss.authors.map((a: any) => a.name); fieldsRecovered.push('authors'); }
                if (ss.abstract && (!enriched.abstract || enriched.abstract.length < 50)) { enriched.abstract = ss.abstract; fieldsRecovered.push('abstract'); }
                if (ss.openAccessPdf?.url && !enriched.pdfUrl) { enriched.pdfUrl = ss.openAccessPdf.url; fieldsRecovered.push('pdfUrl'); }
            }
        } catch (e: any) { console.warn('[Metadata] Semantic Scholar error:', e.message); }
    }
}

function applyEnrichment(enriched: PaperResult, fieldsRecovered: string[], data: { abstract?: string | null; university?: string | null; authors?: string[]; pdfUrl?: string | null }) {
    if (data.abstract && data.abstract.length > (enriched.abstract?.length || 0)) { enriched.abstract = data.abstract; fieldsRecovered.push('abstract'); }
    if (data.university && (!enriched.university || enriched.university === 'Universidad Peruana')) { enriched.university = data.university; fieldsRecovered.push('university'); }
    if (data.authors && data.authors.length > 0 && enriched.authors?.[0] === 'Autor Desconocido') { enriched.authors = data.authors; fieldsRecovered.push('authors'); }
    if (data.pdfUrl && !enriched.pdfUrl) { enriched.pdfUrl = data.pdfUrl; fieldsRecovered.push('pdfUrl'); }
}

async function enrichFromRepositoryScraping(enriched: PaperResult, fieldsRecovered: string[]): Promise<void> {
    if ((!enriched.abstract || enriched.abstract.length < 80) && (enriched.pdfUrl || enriched.handleUrl)) {
        const url = enriched.handleUrl || enriched.pdfUrl;
        if (url && (url.includes('handle') || url.includes('.edu.') || url.includes('.gob.'))) {
            const { url: resolvedUrl, config } = resolveHandleUrl(url);
            try {
                if (config?.isDSpace7 && config.apiBase) {
                    const handleSuffix = resolvedUrl.match(/handle\/(.+)/)?.[1];
                    if (handleSuffix) {
                        const dspace = await fetchDSpace7Metadata(config.apiBase, handleSuffix, config.name);
                        if (dspace) applyEnrichment(enriched, fieldsRecovered, dspace);
                    }
                } else {
                    const { html } = await resilientFetch(resolvedUrl, 2, 10000);
                    if (isDSpace7Spa(html)) {
                        const dspace7 = await detectAndFetchDSpace7(resolvedUrl, html, config?.name);
                        if (dspace7) applyEnrichment(enriched, fieldsRecovered, dspace7);
                    } else {
                        const meta = extractMetadataFromHtml(html);
                        applyEnrichment(enriched, fieldsRecovered, meta);
                    }
                }
            } catch (e: any) { console.warn('[Metadata] Repository scraping error:', e.message); }
        }
    }
}

async function enrichOnePaper(paper: PaperResult): Promise<PaperResult> {
    const enriched = { ...paper };
    const fieldsRecovered: string[] = [];

    await enrichFromOpenAlex(enriched, fieldsRecovered);
    await enrichFromCrossref(enriched, fieldsRecovered);
    await enrichFromSemanticScholar(enriched, fieldsRecovered);
    await enrichFromRepositoryScraping(enriched, fieldsRecovered);

    if (fieldsRecovered.length > 0) {
        enriched.isEnriched = true;
        enriched.enrichedFields = [...new Set(fieldsRecovered)];
    }
    enriched.completenessScore = completenessScore(enriched);
    return enriched;
}

router.post('/enrich', async (req: Request, res: Response) => {
    try {
        const { papers } = req.body;
        if (!Array.isArray(papers) || papers.length === 0) return res.status(400).json({ success: false, error: 'Missing "papers" array' });

        console.log(`[ENRICH] Processing ${papers.length} papers for enrichment`);

        const finalPapers = await Promise.all(papers.map(async (p: PaperResult) => {
            const score = completenessScore(p);
            if (score < 70) {
                return enrichOnePaper({ ...p, completenessScore: score });
            }
            return { ...p, completenessScore: score };
        }));
        
        const enriched = finalPapers.filter(p => p.isEnriched);

        const stats = {
            totalAttempted: finalPapers.filter(p => (p.completenessScore || 0) < 70 || p.isEnriched).length,
            recovered: enriched.length,
            fields: enriched.reduce((acc: Record<string, number>, p) => {
                (p.enrichedFields || []).forEach(f => { acc[f] = (acc[f] || 0) + 1; });
                return acc;
            }, {}),
        };

        res.json({ success: true, data: { papers: finalPapers, stats } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─── FETCH SINGLE ────────────────────────────────────────────────

router.post('/fetch', async (req: Request, res: Response) => {
    try {
        const { doi, url, title } = req.body;
        if (!doi && !url && !title) return res.status(400).json({ success: false, error: 'Provide doi, url, or title' });

        const paper: PaperResult = {
            id: doi || url || title, title: title || '', authors: [],
            year: null, abstract: '', pdfUrl: url || null,
            source: 'fetch', doi: doi || null, citationCount: null
        };

        // Try OpenAlex
        if (doi) {
            try {
                const oaRes = await fetchWithTimeout(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, {}, 10000);
                if (oaRes.ok) {
                    const work = (await oaRes.json()) as any;
                    paper.title = work.title || paper.title;
                    paper.abstract = decodeInvertedIndex(work.abstract_inverted_index);
                    paper.year = work.publication_year || null;
                    paper.doi = work.doi?.replace('https://doi.org/', '') || doi;
                    paper.authors = oaAuthors(work);
                    paper.university = oaInstitution(work);
                    paper.pdfUrl = work.open_access?.oa_url || paper.pdfUrl;
                    paper.citationCount = work.cited_by_count || null;
                    paper.source = 'OpenAlex';
                }
            } catch { }
        } else if (title) {
            try {
                const oaRes = await fetchWithTimeout(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per-page=1`, {}, 10000);
                if (oaRes.ok) {
                    const data = await oaRes.json() as any;
                    const work = data.results?.[0];
                    if (work) {
                        paper.title = work.title || paper.title;
                        paper.abstract = decodeInvertedIndex(work.abstract_inverted_index);
                        paper.year = work.publication_year || null;
                        paper.doi = work.doi?.replace('https://doi.org/', '') || null;
                        paper.authors = oaAuthors(work);
                        paper.university = oaInstitution(work);
                        paper.citationCount = work.cited_by_count || null;
                        paper.source = 'OpenAlex';
                    }
                }
            } catch { }
        }

        // Crossref enrichment
        if (paper.doi && (!paper.abstract || paper.abstract.length < 50)) {
            try {
                const crRes = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(paper.doi)}`, {}, 8000);
                if (crRes.ok) {
                    const item = (await crRes.json() as any).message;
                    if (item?.abstract) paper.abstract = item.abstract.replace(/<[^>]+>/g, '').trim();
                }
            } catch { }
        }

        // Semantic Scholar
        if (paper.doi && paper.authors.length === 0) {
            try {
                const ssRes = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(paper.doi)}?fields=title,authors,year,abstract,citationCount,openAccessPdf`, {}, 8000);
                if (ssRes.ok) {
                    const ss = await ssRes.json() as any;
                    if (ss.authors?.length > 0 && paper.authors.length === 0) paper.authors = ss.authors.map((a: any) => a.name);
                    if (ss.abstract && (!paper.abstract || paper.abstract.length < 50)) paper.abstract = ss.abstract;
                    if (ss.openAccessPdf?.url && !paper.pdfUrl) paper.pdfUrl = ss.openAccessPdf.url;
                }
            } catch { }
        }

        // V4: Return repoHandleUrl if applicable
        if (url && url.includes('handle')) {
            const { config } = resolveHandleUrl(url);
            if (config) {
                (paper as any).repoHandleUrl = url;
            }
        }

        // LetXinet 1.1.3: si nadie dio el titulo, Crossref decide. Antes un DOI inexistente
        // devolvia success=true con titulo vacio y se confundia con un dato valido.
        if (doi && !paper.title) {
            let estado: 'ok' | 'inexistente' | 'sin_datos' = 'sin_datos';
            try {
                const doiUrl = String(doi).split('/').map(encodeURIComponent).join('/');
                const cr = await fetchWithTimeout(`https://api.crossref.org/works/${doiUrl}`, {}, 10000);
                if (cr.status === 404) estado = 'inexistente';
                else if (cr.ok) {
                    const item = (await cr.json() as any).message;
                    if (item?.title?.[0]) {
                        paper.title = item.title[0];
                        paper.year = paper.year || item.issued?.['date-parts']?.[0]?.[0] || null;
                        if (paper.authors.length === 0) paper.authors = (item.author || []).map((a: any) => [a.given, a.family].filter(Boolean).join(' '));
                        paper.source = 'Crossref';
                        estado = 'ok';
                    }
                }
            } catch { /* sin respuesta de Crossref */ }
            if (estado === 'inexistente') return res.json({ success: false, error: `El DOI ${doi} no existe (Crossref no lo tiene registrado)` });
            if (estado === 'sin_datos') return res.json({ success: false, error: `No se obtuvieron datos del DOI ${doi}: OpenAlex y Crossref no respondieron o no lo tienen` });
        }

        paper.completenessScore = completenessScore(paper);
        paper.enrichedFields = [];
        res.json({ success: true, data: paper });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
