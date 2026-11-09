/**
 * Multi-Source PDF Resolver v1.2
 * Resolves PDFs from DOI, URL, or title using 8 fallback sources:
 *   1. Unpaywall (legal OA)
 *   2. CORE (legal OA)
 *   3. Semantic Scholar (legal OA)
 *   4. PMC (PubMed Central)
 *   5. DOI.org Content Negotiation
 *   6. OA.mg (open access search engine)
 *   7. WeLib (43M books, 98M papers)
 *   8. Google Scholar (last resort)
 *
 * DSpace repositories are resolved directly via resolveDSpacePdf().
 * Sci-Hub removed in v1.2 (legal/compliance risk).
 *
 * Used by pdf-processor.ts loadPdf() as fallback when direct access fails.
 */

import { fetchWithTimeout } from './base';
import { resolvePmcPdf } from '../scraping/pmc-solver';
import { resilientFetch } from '../scraping/resilient-fetch';
import { resolveDSpacePdf, isDSpaceUrl } from '../scraping/dspace-resolver';
import { validarUrlPublica } from '../utils/url-segura';

// ─── Configuration ──────────────────────────────────────────────


const PDF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,*/*',
};

const RESOLVER_TIMEOUT = 15000; // Per-source timeout

// ─── DOI Extraction ─────────────────────────────────────────────

/**
 * Extract DOI from various input formats:
 * - Direct DOI: "10.1016/j.jclepro.2019.03.031"
 * - DOI URL: "https://doi.org/10.1016/..."
 * - Sci-Hub URL: "https://sci-hub.se/10.1016/..."
 * - dx.doi.org: "https://dx.doi.org/10.1016/..."
 */
export function extractDoiFromSource(source: string): string | null {
    if (!source) return null;

    // Direct DOI pattern
    const doiMatch = source.match(/(10\.\d{4,9}\/[^\s,;'"}\]>]+)/i);
    if (doiMatch) {
        // Clean trailing punctuation
        return doiMatch[1].replace(/[.)]+$/, '');
    }

    return null;
}

/**
 * Try to extract author+year from a filename like "moharramnejad2019.pdf"
 * Returns { author, year } or null
 */
export function extractAuthorYearFromFilename(source: string): { author: string; year: string } | null {
    // Get just the filename
    const filename = source.split('/').pop()?.split('\\').pop() || source;
    const base = filename.replace(/\.pdf$/i, '');

    // Pattern: authorYEAR or author_YEAR or author-YEAR
    const match = base.match(/^([a-z]+)[\s_-]?((?:19|20)\d{2})/i);
    if (match) {
        return { author: match[1].toLowerCase(), year: match[2] };
    }

    return null;
}

/**
 * Detect if a source path is a sandbox/unreachable path
 */
export function isSandboxPath(source: string): boolean {
    if (source.startsWith('http://') || source.startsWith('https://')) return false;

    const sandboxPatterns = [
        '/mnt/user-data/',
        '/mnt/user/',
        '/tmp/',
        '/uploads/',
        '/home/user/uploads/',
        '/var/data/',
        'C:\\Users\\',   // Windows local paths from Claude Desktop
    ];

    return sandboxPatterns.some(p => source.includes(p));
}


// ─── Source 2: Unpaywall ────────────────────────────────────────

async function tryUnpaywall(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying Unpaywall for DOI: ${doi}`);
        const apiUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=letxipu@search.mcp`;
        const res = await fetchWithTimeout(apiUrl, {}, 10000);
        if (!res.ok) return null;

        const data = await res.json() as any;
        const pdfUrl = data.best_oa_location?.url_for_pdf
            || data.best_oa_location?.url
            || data.first_oa_location?.url_for_pdf
            || data.first_oa_location?.url;

        if (!pdfUrl) {
            console.log(`[PDF-RESOLVER] Unpaywall: no OA PDF found`);
            return null;
        }

        console.log(`[PDF-RESOLVER] Unpaywall found URL: ${pdfUrl.substring(0, 80)}...`);
        return await downloadPdfBuffer(pdfUrl);
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Unpaywall failed: ${e.message}`);
        return null;
    }
}

// ─── Source 3: CORE ─────────────────────────────────────────────

async function tryCore(doi: string, title?: string): Promise<Buffer | null> {
    const apiKey = process.env.CORE_API_KEY;
    if (!apiKey) {
        console.log(`[PDF-RESOLVER] CORE: no API key, skipping`);
        return null;
    }

    try {
        // Try by DOI first, then by title
        const query = doi ? `doi:"${doi}"` : title || '';
        if (!query) return null;

        console.log(`[PDF-RESOLVER] Trying CORE: ${query.substring(0, 60)}...`);
        const apiUrl = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=3`;
        const res = await fetchWithTimeout(apiUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        }, 12000);

        if (!res.ok) return null;

        const data = await res.json() as any;
        const results = data.results || [];

        for (const r of results) {
            const downloadUrl = r.downloadUrl || r.sourceFulltextUrls?.[0];
            if (downloadUrl) {
                console.log(`[PDF-RESOLVER] CORE found URL: ${downloadUrl.substring(0, 80)}...`);
                const buf = await downloadPdfBuffer(downloadUrl);
                if (buf) return buf;
            }
        }

        console.log(`[PDF-RESOLVER] CORE: no downloadable PDF in ${results.length} results`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] CORE failed: ${e.message}`);
        return null;
    }
}

// ─── Source 4: Semantic Scholar ──────────────────────────────────

async function trySemanticScholar(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying Semantic Scholar for DOI: ${doi}`);
        const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf,externalIds`;

        const headers: Record<string, string> = {};
        if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
            headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
        }

        const res = await fetchWithTimeout(apiUrl, { headers }, 10000);
        if (!res.ok) return null;

        const data = await res.json() as any;
        const pdfUrl = data.openAccessPdf?.url;

        if (!pdfUrl) {
            console.log(`[PDF-RESOLVER] Semantic Scholar: no OA PDF`);
            return null;
        }

        console.log(`[PDF-RESOLVER] Semantic Scholar found: ${pdfUrl.substring(0, 80)}...`);
        return await downloadPdfBuffer(pdfUrl);
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Semantic Scholar failed: ${e.message}`);
        return null;
    }
}

// ─── Source 5: PMC ──────────────────────────────────────────────

async function tryPmc(doi: string): Promise<Buffer | null> {
    try {
        // First, check if this DOI has a PMC version via NCBI ID converter
        console.log(`[PDF-RESOLVER] Trying PMC for DOI: ${doi}`);
        const converterUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${encodeURIComponent(doi)}&format=json`;
        const convRes = await fetchWithTimeout(converterUrl, {}, 8000);

        if (!convRes.ok) return null;
        const convData = await convRes.json() as any;
        const pmcId = convData.records?.[0]?.pmcid;

        if (!pmcId) {
            console.log(`[PDF-RESOLVER] PMC: no PMC ID for this DOI`);
            return null;
        }

        console.log(`[PDF-RESOLVER] PMC ID found: ${pmcId}`);
        const pmcUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/`;
        const result = await resolvePmcPdf(pmcUrl);

        if (result) {
            const buf = Buffer.from(result.buffer);
            if (buf.length > 1000 && buf.toString('ascii', 0, 5) === '%PDF-') {
                console.log(`[PDF-RESOLVER] ✅ PMC PDF downloaded (${(buf.length / 1024).toFixed(0)} KB)`);
                return buf;
            }
        }

        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] PMC failed: ${e.message}`);
        return null;
    }
}

// ─── Source 6: DOI.org Content Negotiation ──────────────────────

async function tryDoiContentNegotiation(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying DOI.org content negotiation: ${doi}`);
        const doiUrl = `https://doi.org/${doi}`;
        const res = await fetchWithTimeout(doiUrl, {
            headers: {
                'Accept': 'application/pdf',
                'User-Agent': PDF_HEADERS['User-Agent'],
            },
            redirect: 'follow',
        }, 15000);

        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/pdf')) {
            console.log(`[PDF-RESOLVER] DOI.org: response is ${contentType}, not PDF`);
            return null;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000 && buf.toString('ascii', 0, 5) === '%PDF-') {
            console.log(`[PDF-RESOLVER] ✅ DOI.org direct PDF (${(buf.length / 1024).toFixed(0)} KB)`);
            return buf;
        }

        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] DOI.org content negotiation failed: ${e.message}`);
        return null;
    }
}

// ─── Source 7: OA.mg ────────────────────────────────────────────

async function tryOaMg(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying OA.mg for DOI: ${doi}`);
        const searchUrl = `https://oa.mg/search?q=${encodeURIComponent(doi)}`;

        const { html } = await resilientFetch(searchUrl, 2, 12000);

        // OA.mg shows PDF download links on search results
        const pdfMatch =
            html.match(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/i) ||
            html.match(/href="(https?:\/\/[^"]*\/pdf\/[^"]+)"/i) ||
            html.match(/data-pdf-url="([^"]+)"/i);

        if (pdfMatch) {
            console.log(`[PDF-RESOLVER] OA.mg found: ${pdfMatch[1].substring(0, 80)}...`);
            const buf = await downloadPdfBuffer(pdfMatch[1]);
            if (buf) {
                console.log(`[PDF-RESOLVER] ✅ OA.mg PDF (${(buf.length / 1024).toFixed(0)} KB)`);
                return buf;
            }
        }

        console.log(`[PDF-RESOLVER] OA.mg: no PDF found`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] OA.mg failed: ${e.message}`);
        return null;
    }
}

// ─── Source 8: WeLib ────────────────────────────────────────────

async function tryWeLib(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying WeLib for DOI: ${doi}`);
        const searchUrl = `https://welib.org/search?q=${encodeURIComponent(doi)}`;

        const { html } = await resilientFetch(searchUrl, 2, 12000);

        // WeLib provides direct download links
        const pdfMatch =
            html.match(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/i) ||
            html.match(/href="([^"]*\/download[^"]*)"/i) ||
            html.match(/href="([^"]*\/get[^"]*)"/i);

        if (pdfMatch) {
            let downloadUrl = pdfMatch[1];
            if (downloadUrl.startsWith('/')) downloadUrl = 'https://welib.org' + downloadUrl;

            console.log(`[PDF-RESOLVER] WeLib found: ${downloadUrl.substring(0, 80)}...`);
            const buf = await downloadPdfBuffer(downloadUrl);
            if (buf) {
                console.log(`[PDF-RESOLVER] ✅ WeLib PDF (${(buf.length / 1024).toFixed(0)} KB)`);
                return buf;
            }
        }

        console.log(`[PDF-RESOLVER] WeLib: no PDF found`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] WeLib failed: ${e.message}`);
        return null;
    }
}

// ─── Source 9: Google Scholar (last resort) ─────────────────────

async function tryGoogleScholar(query: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying Google Scholar: "${query.substring(0, 60)}..."`);
        const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&num=5`;

        const { html } = await resilientFetch(searchUrl, 2, 10000);

        // Find [PDF] links
        const pdfLinks = [...html.matchAll(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/gi)];
        // Also check data-clk links that point to PDFs
        const directLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"[^>]*>\[PDF\]/gi)];

        const allPdfUrls = [
            ...pdfLinks.map(m => m[1]),
            ...directLinks.map(m => m[1]),
        ].filter(url => !url.includes('scholar.google') && !url.includes('google.com/scholar'));

        for (const pdfUrl of allPdfUrls.slice(0, 3)) {
            console.log(`[PDF-RESOLVER] Google Scholar candidate: ${pdfUrl.substring(0, 80)}...`);
            const buf = await downloadPdfBuffer(pdfUrl);
            if (buf) return buf;
        }

        console.log(`[PDF-RESOLVER] Google Scholar: no valid PDFs found in ${allPdfUrls.length} candidates`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Google Scholar failed: ${e.message}`);
        return null;
    }
}

// ─── Crossref: Lookup DOI by Author+Year ────────────────────────

/**
 * Try to find DOI from Crossref using author name and year
 * Useful when only a filename like "moharramnejad2019.pdf" is available
 */
export async function lookupDoiFromCrossref(author: string, year: string): Promise<string | null> {
    try {
        console.log(`[PDF-RESOLVER] Crossref lookup: author="${author}" year="${year}"`);
        const query = `${author} ${year}`;
        const url = `https://api.crossref.org/works?query.author=${encodeURIComponent(author)}&filter=from-pub-date:${year},until-pub-date:${year}&rows=5&select=DOI,title,author&mailto=letxipu@search.mcp`;

        const res = await fetchWithTimeout(url, {}, 10000);
        if (!res.ok) return null;

        const data = await res.json() as any;
        const items = data.message?.items || [];

        if (items.length > 0) {
            const authorLower = author.toLowerCase();
            for (const item of items) {
                const authors = item.author || [];
                const authorMatch = authors.some((a: any) =>
                    (a.family || '').toLowerCase().includes(authorLower) ||
                    (a.given || '').toLowerCase().includes(authorLower)
                );
                if (authorMatch && item.DOI) {
                    console.log(`[PDF-RESOLVER] Crossref found DOI: ${item.DOI} (title: "${(item.title?.[0] || '').substring(0, 60)}...")`);
                    return item.DOI;
                }
            }

            // Fallback: return first result's DOI if no author match
            if (items[0].DOI) {
                console.log(`[PDF-RESOLVER] Crossref fallback DOI: ${items[0].DOI}`);
                return items[0].DOI;
            }
        }

        console.log(`[PDF-RESOLVER] Crossref: no results for ${author} ${year}`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Crossref lookup failed: ${e.message}`);
        return null;
    }
}

// ─── Helper: Download PDF Buffer ────────────────────────────────

async function downloadPdfBuffer(url: string): Promise<Buffer | null> {
    try {
        const res = await fetchWithTimeout(url, {
            headers: PDF_HEADERS,
            redirect: 'follow',
        }, 30000);

        if (!res.ok) return null;

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500 && buf.toString('ascii', 0, 5) === '%PDF-') {
            return buf;
        }

        console.log(`[PDF-RESOLVER] Downloaded ${(buf.length / 1024).toFixed(0)} KB but not a valid PDF`);
        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Download failed for ${url.substring(0, 60)}: ${e.message}`);
        return null;
    }
}

// ─── Main Resolver ──────────────────────────────────────────────

export interface ResolveResult {
    buffer: Buffer;
    resolvedFrom: string;
    doi?: string;
}

/**
 * Main entry point: resolve a PDF from DOI, URL, or title.
 * Tries up to 9 sources in sequence until a valid PDF buffer is obtained.
 *
 * @param identifier - DOI, DOI URL, paper title, or filename
 * @returns Buffer + source label, or null if all sources fail
 */
const resolverCache = new Map<string, { promise: Promise<ResolveResult | null>, timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function resolvePdfBuffer(identifier: string): Promise<ResolveResult | null> {
    console.log(`\n[PDF-RESOLVER] ════════════════════════════════════════`);
    console.log(`[PDF-RESOLVER] Resolving: "${identifier.substring(0, 100)}"`);

    const cached = resolverCache.get(identifier);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[PDF-RESOLVER] Cache hit for: ${identifier.substring(0, 50)}`);
        return cached.promise;
    }

    // Wrap the internal logic to cache the Promise (prevents thundering herd)
    const promise = _resolvePdfBufferInternal(identifier);
    resolverCache.set(identifier, { promise, timestamp: Date.now() });
    
    try {
        return await promise;
    } catch (e) {
        resolverCache.delete(identifier);
        throw e;
    }
}

async function _resolvePdfBufferInternal(identifier: string): Promise<ResolveResult | null> {
    // Step 1: Extract DOI
    let doi = extractDoiFromSource(identifier);

    // Step 2: If no DOI found, try author+year from filename → Crossref
    if (!doi) {
        const authorYear = extractAuthorYearFromFilename(identifier);
        if (authorYear) {
            doi = await lookupDoiFromCrossref(authorYear.author, authorYear.year);
        }
    }

    const sourcesAttempted: string[] = [];
    let buffer: Buffer | null = null;

    // DOI-based sources (need a DOI)
    if (doi) {
        console.log(`[PDF-RESOLVER] DOI: ${doi}`);

        // Source 1: Unpaywall (legal OA)
        sourcesAttempted.push('Unpaywall');
        buffer = await tryUnpaywall(doi);
        if (buffer) return { buffer, resolvedFrom: 'Unpaywall', doi };

        // Source 2: CORE (legal OA)
        sourcesAttempted.push('CORE');
        buffer = await tryCore(doi);
        if (buffer) return { buffer, resolvedFrom: 'CORE', doi };

        // Source 3: Semantic Scholar (legal OA)
        sourcesAttempted.push('Semantic Scholar');
        buffer = await trySemanticScholar(doi);
        if (buffer) return { buffer, resolvedFrom: 'Semantic Scholar', doi };

        // Source 4: PMC
        sourcesAttempted.push('PMC');
        buffer = await tryPmc(doi);
        if (buffer) return { buffer, resolvedFrom: 'PMC', doi };

        // Source 5: DOI.org Content Negotiation
        sourcesAttempted.push('DOI.org');
        buffer = await tryDoiContentNegotiation(doi);
        if (buffer) return { buffer, resolvedFrom: 'DOI.org Content Negotiation', doi };

        // Source 6: OA.mg
        sourcesAttempted.push('OA.mg');
        buffer = await tryOaMg(doi);
        if (buffer) return { buffer, resolvedFrom: 'OA.mg', doi };

        // Source 7: WeLib. LetXinet 1.1.3: desactivado por defecto, porque replica bibliotecas
        // no autorizadas (el mismo riesgo legal que Sci-Hub). Solo con WELIB_ENABLED=true.
        if (process.env.WELIB_ENABLED === 'true') {
            sourcesAttempted.push('WeLib');
            buffer = await tryWeLib(doi);
            if (buffer) return { buffer, resolvedFrom: 'WeLib', doi };
        }

        // Source 8: Europe PMC
        sourcesAttempted.push('Europe PMC');
        buffer = await tryEuropePmc(doi);
        if (buffer) return { buffer, resolvedFrom: 'Europe PMC', doi };
    }

    // Source 10: DSpace repositories (Peruvian universities)
    if (isDSpaceUrl(identifier)) {
        sourcesAttempted.push('DSpace');
        const dspaceResult = await resolveDSpacePdf(identifier);
        if (dspaceResult) return { buffer: dspaceResult.buffer, resolvedFrom: `DSpace (${dspaceResult.repo})`, doi: doi || undefined };
    }

    // Source 11: Google Scholar (works with title or any text query)
    const scholarQuery = doi || identifier.replace(/\.pdf$/i, '').replace(/[/_\\-]/g, ' ').trim();
    if (scholarQuery.length > 5) {
        sourcesAttempted.push('Google Scholar');
        buffer = await tryGoogleScholar(scholarQuery);
        if (buffer) return { buffer, resolvedFrom: 'Google Scholar', doi: doi || undefined };
    }

    // All sources exhausted
    console.log(`[PDF-RESOLVER] ❌ All ${sourcesAttempted.length} sources failed: ${sourcesAttempted.join(', ')}`);
    console.log(`[PDF-RESOLVER] ════════════════════════════════════════\n`);
    return null;
}

/**
 * Returns a human-readable error with all sources that were tried.
 */
export function buildResolutionError(source: string, doi: string | null): string {
    const suggestions: string[] = [];

    if (!doi) {
        suggestions.push('• No DOI detected. Provide a DOI directly (e.g. "10.1016/j.jclepro.2019.03.031")');
    }

    if (isSandboxPath(source)) {
        suggestions.push('• The provided path is from a sandbox (Claude/system) that this server cannot access');
        suggestions.push('• Instead, provide: a DOI, a direct URL to the PDF, or a repository link');
    }

    suggestions.push('• Sources tried: Unpaywall, CORE, Semantic Scholar, PMC, Europe PMC, DOI.org, OA.mg, Google Scholar');
    suggestions.push('• If the paper is very recent or behind a strict paywall, try with a direct PDF URL');

    return `Could not obtain the PDF.\n${suggestions.join('\n')}`;
}

// ─── V4: URL-only Resolver (no download) ────────────────────────

export interface ResolvedPdfUrl {
    pdfUrl: string | null;
    resolvedFrom: string | null;
    doi: string | null;
    steps: string[];
}

/**
 * V4: Resolve the final PDF URL without downloading the buffer.
 * Uses Unpaywall, Semantic Scholar, CORE, DOI.org, and DSpace7 to find the PDF URL.
 * Does NOT try Sci-Hub or download the file.
 */
async function tryUnpaywallUrl(doi: string, steps: string[]): Promise<ResolvedPdfUrl | null> {
    try {
        steps.push('Trying Unpaywall...');
        const res = await fetchWithTimeout(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=letxipu@search.mcp`, {}, 10000);
        if (res.ok) {
            const data = await res.json() as any;
            const pdfUrl = data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || data.first_oa_location?.url_for_pdf;
            if (pdfUrl) { steps.push(`Unpaywall resolved: ${pdfUrl.substring(0, 80)}`); return { pdfUrl, resolvedFrom: 'Unpaywall', doi, steps }; }
        }
        steps.push('Unpaywall: no OA PDF');
    } catch { steps.push('Unpaywall: failed'); }
    return null;
}

async function trySemanticScholarUrl(doi: string, steps: string[]): Promise<ResolvedPdfUrl | null> {
    try {
        steps.push('Trying Semantic Scholar...');
        const headers: Record<string, string> = {};
        if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
        const res = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf`, { headers }, 10000);
        if (res.ok) {
            const data = await res.json() as any;
            if (data.openAccessPdf?.url) { steps.push(`Semantic Scholar resolved: ${data.openAccessPdf.url.substring(0, 80)}`); return { pdfUrl: data.openAccessPdf.url, resolvedFrom: 'Semantic Scholar', doi, steps }; }
        }
        steps.push('Semantic Scholar: no OA PDF');
    } catch { steps.push('Semantic Scholar: failed'); }
    return null;
}

async function tryCoreUrl(doi: string, steps: string[]): Promise<ResolvedPdfUrl | null> {
    if (!process.env.CORE_API_KEY) return null;
    try {
        steps.push('Trying CORE...');
        const res = await fetchWithTimeout(`https://api.core.ac.uk/v3/search/works?q=doi:"${doi}"&limit=1`, { headers: { 'Authorization': `Bearer ${process.env.CORE_API_KEY}` } }, 10000);
        if (res.ok) {
            const data = await res.json() as any;
            const downloadUrl = data.results?.[0]?.downloadUrl;
            if (downloadUrl) { steps.push(`CORE resolved: ${downloadUrl.substring(0, 80)}`); return { pdfUrl: downloadUrl, resolvedFrom: 'CORE', doi, steps }; }
        }
        steps.push('CORE: no downloadable PDF');
    } catch { steps.push('CORE: failed'); }
    return null;
}

export async function resolvePdfUrl(identifier: string): Promise<ResolvedPdfUrl> {
    const steps: string[] = [];
    let doi = extractDoiFromSource(identifier);

    if (!doi) {
        const authorYear = extractAuthorYearFromFilename(identifier);
        if (authorYear) {
            steps.push(`Extracted author="${authorYear.author}" year=${authorYear.year} from filename`);
            doi = await lookupDoiFromCrossref(authorYear.author, authorYear.year);
            if (doi) steps.push(`Crossref found DOI: ${doi}`);
        }
    } else { steps.push(`DOI detected: ${doi}`); }

    const resolvers = [tryUnpaywallUrl, trySemanticScholarUrl, tryCoreUrl];
    for (const resolver of resolvers) {
        if (!doi) continue;
        const result = await resolver(doi, steps);
        if (result) return result;
    }

    if (doi) steps.push(`DOI landing page: https://doi.org/${doi}`);
    if (identifier.includes('handle') || identifier.includes('.edu.') || identifier.includes('.gob.'))
        steps.push(`Repository URL detected: ${identifier.substring(0, 80)}`);
    // LetXinet 1.1.3: los enlaces de repositorio (handle, DSpace) antes no se abrian nunca
    if (!doi && /^https?:\/\//i.test(identifier)) {
        const pdf = await pdfDesdeRepositorio(identifier, steps);
        if (pdf) return { pdfUrl: pdf, resolvedFrom: 'Repositorio institucional', doi: null, steps };
    }
    steps.push('All URL resolution sources exhausted');
    return { pdfUrl: doi ? `https://doi.org/${doi}` : null, resolvedFrom: doi ? 'DOI.org (landing page)' : null, doi, steps };
}

/**
 * LetXinet 1.1.3: abre la pagina del repositorio (siguiendo y validando redirecciones) y toma
 * citation_pdf_url o el primer enlace a un bitstream .pdf. Si el repositorio responde con una
 * verificacion anti-robots, lo explica en los pasos; no se intenta saltarla.
 */
async function pdfDesdeRepositorio(url: string, steps: string[]): Promise<string | null> {
    try {
        let actual = await validarUrlPublica(url);
        let res: Response | null = null;
        for (let salto = 0; salto < 6; salto++) {
            res = await fetchWithTimeout(actual, { headers: { ...PDF_HEADERS, Accept: 'text/html,application/pdf,*/*' }, redirect: 'manual' }, RESOLVER_TIMEOUT);
            const destino = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
            if (!destino) break;
            actual = await validarUrlPublica(new URL(destino, actual).toString());
        }
        if (!res || !res.ok) { steps.push(`El repositorio respondio HTTP ${res ? res.status : 'sin respuesta'}`); return null; }
        if ((res.headers.get('content-type') || '').includes('pdf')) return actual;
        const html = await res.text();
        if (/not a bot|anubis|cf-challenge|captcha|just a moment/i.test(html)) {
            steps.push(`El repositorio (${new URL(actual).hostname}) pide una verificacion anti-robots: abre el enlace en un navegador`);
            return null;
        }
        const meta = html.match(/<meta[^>]+name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']citation_pdf_url["']/i);
        const enlace = meta?.[1] || (html.match(/href=["']([^"']*\/bitstream\/[^"']+\.pdf[^"']*)["']/i) || [])[1];
        if (!enlace) { steps.push('La pagina del repositorio no enlaza ningun PDF'); return null; }
        const pdf = await validarUrlPublica(new URL(enlace.replace(/&amp;/g, '&'), actual).toString());
        steps.push(`PDF encontrado en el repositorio: ${pdf.substring(0, 90)}`);
        return pdf;
    } catch (e: any) {
        steps.push(`Repositorio: ${e.message}`);
        return null;
    }
}

// ─── Source 9: Europe PMC ───────────────────────────────────────

async function tryEuropePmc(doi: string): Promise<Buffer | null> {
    try {
        console.log(`[PDF-RESOLVER] Trying Europe PMC: ${doi}`);
        const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json&resultType=core`;
        const searchResp = await fetchWithTimeout(searchUrl, {
            headers: { 'Accept': 'application/json' },
        }, RESOLVER_TIMEOUT);

        if (!searchResp.ok) return null;
        const data: any = await searchResp.json();

        if (!data.resultList?.result?.length) return null;

        const paper = data.resultList.result[0];

        // Check for full text PDF URLs
        const pdfUrls: string[] = [];

        // PMC full text
        if (paper.pmcid) {
            pdfUrls.push(`https://europepmc.org/backend/ptpmcrender.fcgi?accid=${paper.pmcid}&blobtype=pdf`);
        }

        // Full text URL list
        if (paper.fullTextUrlList?.fullTextUrl) {
            for (const ft of paper.fullTextUrlList.fullTextUrl) {
                if (ft.documentStyle === 'pdf' && ft.url) {
                    pdfUrls.push(ft.url);
                }
            }
        }

        for (const pdfUrl of pdfUrls.slice(0, 3)) {
            try {
                console.log(`[PDF-RESOLVER] Europe PMC PDF: ${pdfUrl.substring(0, 80)}`);
                const pdfResp = await fetchWithTimeout(pdfUrl, {
                    headers: PDF_HEADERS,
                    redirect: 'follow',
                }, RESOLVER_TIMEOUT);

                if (!pdfResp.ok) continue;
                const buf = Buffer.from(await pdfResp.arrayBuffer());
                if (buf.length > 1000 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
                    console.log(`[PDF-RESOLVER] ✅ Europe PMC PDF: ${(buf.length / 1024).toFixed(0)}KB`);
                    return buf;
                }
            } catch { /* try next URL */ }
        }

        return null;
    } catch (e: any) {
        console.warn(`[PDF-RESOLVER] Europe PMC failed: ${e.message}`);
        return null;
    }
}

