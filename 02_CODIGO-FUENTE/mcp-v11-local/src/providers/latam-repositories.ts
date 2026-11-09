/**
 * Latin American National Repositories
 * La Referencia, ALICIA (Peru), RENATI (Peru), CONAHCyT (Mexico), 
 * UNAM (Mexico), ANID (Chile), Oasisbr (Brazil), SNRD (Argentina), MinCiencias (Colombia)
 */

import {
    fetchWithTimeout,
    safeJson,
    normalizeAccents,
    sanitizeQueryForSearch,
    simplifyQuery,
    constructBooleanQuery,
    SearchResult,
    SearchOptions,
    generateRecordId,
    withPromiseTimeout
} from './base';
import { VuFindRecord } from '../types/search';
import { centralizedOpenAlexFallback } from './openalex';
import { consultaConservandoTema } from '../utils/pertinencia-repositorios';
import { executeFallback } from './fallback-manager';
import { SEARCH_LIMITS } from '../utils/search-limits';
import { solveAnubisChallenge } from '../scraping/anubis-solver';
import {
    collectDocumentCandidateUrls,
    isClearlyNonDocumentContentType,
    isDocumentContentType,
    isLikelyPdfBuffer
} from '../utils/document-url';
import { isOjsUrl, extractOjsPdfUrl } from '../scraping/dspace-resolver';

/**
 * V11 Mejora 7: client-aware timeout helper for LatAm repositories.
 *
 * Previously every fetch used `SEARCH_LIMITS.TIMEOUT_LONG` (a hardcoded 30s)
 * which ignored the detected MCP client's ceiling. Under opencode (120s
 * ceiling) that left no slack; under claude (300s) it was too conservative.
 *
 * This helper returns the minimum of:
 *   - SEARCH_LIMITS.TIMEOUT_LONG (30s upper bound â€” protects upstreams)
 *   - options.__timeouts.tryMs Ã— 2 (client-aware â€” respects ceiling)
 *
 * Concretely, under opencode where tryMs=~30s, this yields 30s. Under
 * claude where tryMs=~30s too (outer 90s default), it still yields 30s â€”
 * the upper bound dominates in both cases. The win appears only when the
 * ceiling is tighter than the upper bound (timeouts can shrink), and when
 * it is looser (providers get more time under claude's 300s ceiling).
 */
function latamTimeout(options?: SearchOptions): number {
    // Patch J2a (2026-07-27): BUG #2 — __timeouts no se propaga al hacer fetch
    // interno desde mcp.ts a /api/search, por lo que clientTryMs es casi siempre
    // undefined y caíamos al upperBound=30s. Eso mataba a ALICIA (cascada A2-split
    // de 5 sub-queries × hasta 3 fallbacks secuenciales 30+25+20s = 75s).
    // Subimos el default de 30s a 60s cuando no hay __timeouts client-aware.
    // El raceMs externo (Patch J = 90s) ya le da margen amplio a la cascada.
    const upperBound = SEARCH_LIMITS.TIMEOUT_LONG; // 30s â€” protects upstreams
    const fallbackDefault = 60_000; // Patch J2a: 30s -> 60s when no client info
    const clientTryMs = (options as any)?.__timeouts?.tryMs;
    if (!clientTryMs || typeof clientTryMs !== 'number') return fallbackDefault;
    const clientAware = clientTryMs * 2;
    return Math.max(5000, Math.min(upperBound, clientAware));
}

// Fase 3.2: Lazy import of extractText to avoid circular dependency with pdf-processor
let extractTextFn: ((source: string) => Promise<{ text: string; pages: number; info?: any }>) | null = null;
async function getPdfText(source: string): Promise<{ text: string; pages: number; info?: any }> {
    if (!extractTextFn) {
        try {
            const module = await import('../providers/pdf-processor');
            extractTextFn = module.extractText;
        } catch {
            return { text: '', pages: 0 };
        }
    }
    return extractTextFn!(source);
}

/**
 * Extract a usable abstract from the first page(s) of a PDF.
 * Heuristic: take the first paragraph of at least 200 chars that follows the title
 * (which is usually the document title on the first page).
 * Limits to 500 chars to keep abstracts concise.
 */
async function extractAbstractFromPdfUrl(url: string): Promise<string | null> {
    try {
        // Fetch PDF with realistic User-Agent
        const res = await fetchWithTimeout(url, {
            headers: {
                'Accept': 'application/pdf,*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
        }, 15000);

        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || '';
        const buffer = Buffer.from(await res.arrayBuffer());

        // Verify it's a PDF
        if (buffer.length < 1000 || !isLikelyPdfBuffer(buffer)) return null;
        if (!contentType.includes('pdf') && buffer.subarray(0, 4).toString('ascii') !== '%PDF') return null;

        // Extract text from the PDF (extractText handles URLs and file buffers).
        // Pass the URL so extractText can fetch and process it internally.
        const { text } = await getPdfText(url);
        if (!text || text.length < 100) return null;

        // Heuristic abstract extraction: find the first paragraph of 200-1500 chars
        // that doesn't look like a title or header.
        const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
        const abstractKeywords = /^(abstract|resumen|resumo|summary|descripci[oó]n|introducci[oó]n|introduction)\b/i;

        let abstractStart = -1;
        // First, look for an explicit abstract keyword
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
            if (abstractKeywords.test(lines[i]) && i + 1 < lines.length) {
                abstractStart = i;
                break;
            }
        }

        // If no explicit keyword found, fall back to the first long paragraph after a short title-line
        if (abstractStart === -1) {
            for (let i = 0; i < Math.min(lines.length, 20); i++) {
                if (lines[i].length > 200 && lines[i].length < 2000) {
                    abstractStart = i;
                    break;
                }
            }
        }

        if (abstractStart === -1) return null;

        // Join the abstract-start line + next few lines until we hit 500 chars or an empty separator
        let abstract = lines[abstractStart].replace(abstractKeywords, '').trim();
        let lineIdx = abstractStart + 1;
        while (abstract.length < 300 && lineIdx < Math.min(lines.length, abstractStart + 15)) {
            const next = lines[lineIdx];
            if (next.length < 10) break; // short line = end of paragraph
            if (/^(keywords?|palabras|index|introduc|1\.|i\.)/i.test(next)) break; // next section
            abstract += ' ' + next;
            lineIdx++;
        }

        // Trim to reasonable abstract length
        abstract = abstract.replace(/\s+/g, ' ').trim();
        if (abstract.length < 80) return null;
        if (abstract.length > 800) abstract = abstract.substring(0, 800) + '...';

        return abstract;
    } catch {
        return null;
    }
}

// â”€â”€â”€ ALICIA-DME: Slow domain cache (skip domains that repeatedly timeout) â”€â”€â”€â”€
const slowDomainFailCounts = new Map<string, number>();
const SLOW_DOMAIN_THRESHOLD = 3; // After 3 failures, skip domain for this session

function isDomainSlow(url: string): boolean {
    try {
        const hostname = new URL(url).hostname;
        return (slowDomainFailCounts.get(hostname) || 0) >= SLOW_DOMAIN_THRESHOLD;
    } catch { return false; }
}

function recordDomainFailure(url: string): void {
    try {
        const hostname = new URL(url).hostname;
        slowDomainFailCounts.set(hostname, (slowDomainFailCounts.get(hostname) || 0) + 1);
    } catch {}
}

// =============================================================================
// UNIVERSITY MAPS (Peru)
// =============================================================================
import aliciaData from '../data/alicia-institutions.json';

export const HANDLE_PREFIX_MAP: Record<string, string> = {};
export const UNIVERSITY_PREFIX_MAP: Record<string, string> = {};

aliciaData.institutions.forEach((inst: any) => {
    if (Array.isArray(inst.handlePrefixes)) {
        inst.handlePrefixes.forEach((prefix: string) => {
            HANDLE_PREFIX_MAP[prefix] = inst.fullName;
        });
    }
    if (Array.isArray(inst.acronyms)) {
        inst.acronyms.forEach((acronym: string) => {
            UNIVERSITY_PREFIX_MAP[acronym] = inst.fullName;
        });
    }
});

import { findUniversityFromUrl } from '../scraping/handle-map';

/**
 * Resolve university name from ID or URL using known mappings
 */
export function resolveUniversity(id: string = '', url: string = '', currentName: string = 'Universidad Peruana'): string {
    // 1. Absolute Highest Priority: Deep Domain/Handle Match via handle-map.ts
    const strictDomainUniversity = findUniversityFromUrl(url);
    if (strictDomainUniversity) {
        return strictDomainUniversity;
    }

    let university = currentName;
    const prefix = id.split('_')[0];
    const handleMatch = id.match(/((?:20\.500\.\d+)|(?:\d{4,}))/) || (url || '').match(/handle\/((?:20\.500\.\d+)|(?:\d+))/);

    if (handleMatch && HANDLE_PREFIX_MAP[handleMatch[1]]) {
        university = HANDLE_PREFIX_MAP[handleMatch[1]];
    } else if (UNIVERSITY_PREFIX_MAP[prefix]) {
        university = UNIVERSITY_PREFIX_MAP[prefix];
    } else if (!university) {
        university = 'Universidad Peruana';
    }
    
    return university;
}

/**
 * DME (Deep Metadata Enhancement) - Extracts abstract directly from repository source
 * if the aggregator (ALICIA) provides an empty summary.
 */
async function resolveHandleUrl(url: string): Promise<string> {
    if (!url.includes('hdl.handle.net')) return url;
    const handleId = url.split('handle.net/').pop();
    if (!handleId) return url;
    try {
        const hRes = await fetchWithTimeout(`https://hdl.handle.net/api/handles/${handleId}`, {}, 5000);
        if (hRes.ok) {
            const hData = await hRes.json() as any;
            const resolved = hData.values?.find((v: any) => v.type === 'URL')?.data?.value;
            if (resolved) return resolved;
        }
    } catch { /* fallback to original url */ }
    return url;
}

async function fetchHtmlWithRedirects(targetUrl: string, fetchOptions: any): Promise<string | null> {
    let res = await fetchWithTimeout(targetUrl, fetchOptions, 12000);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        let redirectUrl = res.headers.get('location')!;
        if (redirectUrl.startsWith('/')) redirectUrl = new URL(targetUrl).origin + redirectUrl;
        console.log(`[ALICIA-DME] Following redirect to: ${redirectUrl}`);
        res = await fetchWithTimeout(redirectUrl, fetchOptions, 12000);
    }
    if (!res.ok) { console.log(`[ALICIA-DME] Source Fetch Failed: ${res.status} for ${targetUrl}`); return null; }
    return res.text();
}

async function handleAnubisChallenge(targetUrl: string, html: string, fetchOptions: any): Promise<string> {
    if (!html.includes('id="anubis_challenge"') && !html.includes('techaro.lol-anubis')) return html;
    console.log(`[ALICIA-DME] Anubis Challenge detected for ${targetUrl}`);
    const bypass = await solveAnubisChallenge(targetUrl, html);
    if (!bypass) return html;
    console.log(`[ALICIA-DME] Anubis Bypass Successful for ${targetUrl}`);
    const bypassedRes = await fetchWithTimeout(targetUrl, { ...fetchOptions, headers: { ...fetchOptions.headers, 'Cookie': bypass } }, 15000);
    return bypassedRes.ok ? await bypassedRes.text() : html;
}

async function tryDspace7RestApi(targetUrl: string, handleId: string): Promise<string | null> {
    console.log(`[ALICIA-DME] DSpace 7 detected for ${targetUrl}`);
    const baseUrl = targetUrl.split('/handle/')[0];
    const apiPaths = ['/server/api/core/items/findHandle?handle=', '/backend/api/core/items/findHandle?handle=', '/api/core/items/findHandle?handle=', '/dspace-spring-rest/api/core/items/findHandle?handle=', '/rest/handle/'];
    for (const path of apiPaths) {
        try {
            let finalUrl = `${baseUrl}${path}${handleId}`;
            if (path === '/rest/handle/') finalUrl = `${baseUrl}${path}${handleId}?expand=metadata`;
            const apiRes = await fetchWithTimeout(finalUrl, { headers: { 'Accept': 'application/json' } }, 4000);
            if (!apiRes.ok) continue;
            const apiData = await apiRes.json() as any;
            const abstract = apiData.metadata?.['dc.description.abstract']?.[0]?.value || apiData.metadata?.['dc.description']?.[0]?.value || (Array.isArray(apiData.metadata) ? apiData.metadata.find((m: any) => m.key === 'dc.description.abstract')?.value : null);
            if (abstract && abstract.length > 50) { console.log(`[ALICIA-DME] Success via REST API ${path}`); return abstract; }
        } catch { continue; }
    }
    const pidPaths = ['/server/api/pid/find?id=', '/backend/api/pid/find?id=', '/api/pid/find?id='];
    for (const pidPath of pidPaths) {
        try {
            const pidUrl = `${baseUrl}${pidPath}${handleId}`;
            const pidRes = await fetchWithTimeout(pidUrl, { headers: { 'Accept': 'application/json' }, redirect: 'manual' as any }, 8000);
            let itemUrl: string | null = null;
            if (pidRes.status === 302) itemUrl = pidRes.headers.get('location');
            else if (pidRes.ok) { const pidData = await pidRes.json() as any; if (pidData?._links?.self?.href) itemUrl = pidData._links.self.href; }
            if (itemUrl) {
                const itemRes = await fetchWithTimeout(itemUrl, { headers: { 'Accept': 'application/json' } }, 8000);
                if (itemRes.ok) { const itemData = await itemRes.json() as any; const abstract = itemData.metadata?.['dc.description.abstract']?.[0]?.value || itemData.metadata?.['dc.description']?.[0]?.value; if (abstract && abstract.length > 50) return abstract; }
            }
        } catch { continue; }
    }
    return null;
}

const ABSTRACT_PATTERNS = [
    /<meta[^>]+(?:name|property)\s*=\s*["'](?:citation_abstract|DCTERMS\.abstract|DC\.abstract|DC\.description\.abstract|DC\.Description\.Abstract|description)["'][^>]+content\s*=\s*(["'])([\s\S]*?)\1/i,
    /<meta[^>]+content\s*=\s*(["'])([\s\S]*?)\1[^>]+(?:name|property)\s*=\s*["'](?:citation_abstract|DCTERMS\.abstract|DC\.abstract|DC\.description\.abstract|DC\.Description\.Abstract|description)["']/i,
    /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*(["'])([\s\S]*?)\1/i,
    /<div[^>]+class\s*=\s*["'][^"']*(?:abstract|simple-item-view-description|item-page-field-wrapper)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<td[^>]+class\s*=\s*["'](?:standard|metadataFieldLabel)["'][^>]*>(?:Resumen|Abstract|Abstract:?|Resumen:?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i,
];

function extractAbstractFromHtml(html: string): string | null {
    if (html.length < 500 || html.includes('<title>Index of /</title>') || html.includes('<h1>Forbidden</h1>')) return null;
    for (const pattern of ABSTRACT_PATTERNS) {
        const match = html.match(pattern);
        if (match) {
            const found = (match[2] || match[1]).replace(/<[^>]+>/g, '').replace(/Resumen:?/i, '').replace(/Abstract:?/i, '').trim();
            const lower = found.toLowerCase();
            if (found.length > 50 && !lower.includes('bienvenidos') && !lower.includes('alberga colecciones') && !lower.includes('repositorio institucional')) {
                return found;
            }
        }
    }
    return null;
}

export async function enhanceAbstractFromSource(url: string | null): Promise<string | null> {
    if (!url || (!url.includes('handle') && !url.includes('.edu.pe') && !url.includes('.gob.pe'))) return null;

    try {
        const targetUrl = await resolveHandleUrl(url);
        const fetchOptions = {
            headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', 'Referer': 'https://alicia.concytec.gob.pe/' },
            redirect: 'follow' as any
        };

        let html = await fetchHtmlWithRedirects(targetUrl, fetchOptions);
        if (!html) return null;

        html = await handleAnubisChallenge(targetUrl, html, fetchOptions);

        if (html.includes('<div id="root"></div>') || html.includes('dspace-angular') || html.includes('<ds-app>')) {
            const handleId = targetUrl.match(/handle\/((?:20\.500\.\d+)|(?:\d+\/\d+))/)?.[1];
            if (handleId) { const abstract = await tryDspace7RestApi(targetUrl, handleId); if (abstract) return abstract; }
        }

        return extractAbstractFromHtml(html);
    } catch (e: any) {
        console.warn(`[ALICIA-DME] Exception scraping ${url}: ${e.message}`);
        return null;
    }
}

interface AliciaDetailsMetadata {
    abstract: string | null;
    university: string | null;
    authors: string[];
    title: string | null;
    doi: string | null;
    publisher: string | null;
    year: number | null;
    sourceJournal: string | null;
    pdfUrl?: string | null;
}

async function verifyAliciaDocumentCandidate(candidate: string): Promise<{ kind: 'pdf' | 'text' | null; size: number }> {
    // Note: isDomainSlow check removed for DME â€” bitstream candidates from same repo
    // were being cascade-rejected after first timeout, losing all PDFs from that repo
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

    // HEAD: only trust if it says 'pdf' (HEAD 'text' is unreliable â€” redirect pages)
    try {
        const headRes = await fetchWithTimeout(candidate, {
            method: 'HEAD',
            headers: { 'Accept': 'application/pdf,text/plain,*/*', 'User-Agent': userAgent }
        }, 2000);
        const headType = headRes.headers.get('content-type') || '';
        const byHead = isDocumentContentType(headType);
        const headSize = parseInt(headRes.headers.get('content-length') || '0', 10);
        if (headRes.ok && byHead === 'pdf') return { kind: 'pdf', size: headSize };
        if (headRes.ok && isClearlyNonDocumentContentType(headType)) return { kind: null, size: 0 };
    } catch { /* HEAD rejected â€” continue with GET */ }

    // GET: always check magic bytes (content-type can be wrong on DSpace 7)
    try {
        const checkRes = await fetchWithTimeout(candidate, {
            method: 'GET',
            headers: { 'Accept': 'application/pdf,text/plain,*/*', 'User-Agent': userAgent, 'Range': 'bytes=0-4095' }
        }, 5000);
        const contentType = checkRes.headers.get('content-type') || '';
        const contentLength = parseInt(
            checkRes.headers.get('content-range')?.split('/')?.[1] ||
            checkRes.headers.get('content-length') || '0', 10
        );
        const buf = Buffer.from(await checkRes.arrayBuffer());

        // Magic bytes check FIRST (most reliable â€” DSpace 7 serves PDFs with text/html content-type)
        if (isLikelyPdfBuffer(buf)) return { kind: 'pdf', size: contentLength };

        const byType = isDocumentContentType(contentType);
        if (byType === 'pdf') return { kind: 'pdf', size: contentLength };
        if (byType === 'text') return { kind: 'text', size: contentLength };
        if (isClearlyNonDocumentContentType(contentType)) return { kind: null, size: 0 };
        return { kind: null, size: 0 };
    } catch (e: any) {
        recordDomainFailure(candidate);
        return { kind: null, size: 0 };
    }
}

function makeAliciaCellRegex(key: string): RegExp {
    const escaped = key.replace(/[.*+?${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        '<(?:th|td|rowheader)[^>]*>\\s*' + escaped + '\\s*<\\/(?:th|td|rowheader)>\\s*<(?:td|dd|cell)[^>]*>([\\s\\S]*?)<\\/(?:td|dd|cell)>',
        'i'
    );
}

function getAliciaCellValue(html: string, key: string): string | null {
    const m = html.match(makeAliciaCellRegex(key));
    if (!m) return null;
    return m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function getAliciaMultiValue(html: string, key: string): string[] {
    const m = html.match(makeAliciaCellRegex(key));
    if (!m) return [];
    return m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n')
        .split('\n').map(s => s.trim()).filter(s => s.length > 0);
}

function extractAliciaMetadataFromHtml(html: string): Partial<AliciaDetailsMetadata> {
    const r: Partial<AliciaDetailsMetadata> = { authors: [] };

    const desc = getAliciaCellValue(html, 'description');
    if (desc && desc.length > 50) r.abstract = desc;

    r.university = getAliciaCellValue(html, 'instname_str') || null;
    if (!r.university) {
        const m = html.match(/Instituci[o\u00f3]n:?\s*<\/(?:th|td|rowheader)>\s*<(?:td|dd|cell)[^>]*>\s*([\s\S]*?)\s*<\/(?:td|dd|cell)>/i);
        if (m) r.university = m[1].replace(/<[^>]+>/g, '').trim();
    }

    const creators = getAliciaMultiValue(html, 'dc.creator.none.fl_str_mv');
    r.authors = creators.length > 0 ? Array.from(new Set(creators)) : (getAliciaMultiValue(html, 'author').filter(s => s.length > 2));

    r.title = getAliciaCellValue(html, 'title_full') || getAliciaCellValue(html, 'title');

    for (const id of getAliciaMultiValue(html, 'dc.identifier.none.fl_str_mv')) {
        if (id.match(/^10\.\d{4,}/)) { r.doi = id; break; }
    }

    r.publisher = getAliciaCellValue(html, 'dc.publisher.none.fl_str_mv');

    const pubDate = getAliciaCellValue(html, 'dc.date.none.fl_str_mv') || getAliciaCellValue(html, 'publishDate');
    if (pubDate) { const ym = pubDate.match(/(\d{4})/); if (ym) r.year = parseInt(ym[1]); }

    const source = getAliciaCellValue(html, 'dc.source.none.fl_str_mv');
    if (source) { const first = source.split('\n')[0]?.trim(); if (first && first.length > 3) r.sourceJournal = first; }

    return r;
}

async function verifyPdfCandidates(html: string): Promise<string | null> {
    const candidateUrls = collectDocumentCandidateUrls(html);
    if (candidateUrls.length === 0) return null;

    const MAX = 8;
    const candidates = candidateUrls.slice(0, MAX);
    const verifiedPdfs: { url: string; size: number }[] = [];
    let verifiedTxtUrl: string | null = null;
    let failedChecks = 0;

    // Parallel verification â€” all candidates checked simultaneously (~5s total, not 5s Ã— N)
    try {
        const results = await withPromiseTimeout(
            Promise.allSettled(candidates.map(c => verifyAliciaDocumentCandidate(c).then(r => ({ url: c, ...r })))),
            15000,
            'Alicia document verify timeout'
        );
        for (const r of results) {
            if (r.status === 'fulfilled') {
                if (r.value.kind === 'pdf') {
                    verifiedPdfs.push({ url: r.value.url, size: r.value.size });
                } else if (r.value.kind === 'text' && !verifiedTxtUrl) {
                    verifiedTxtUrl = r.value.url;
                } else if (!r.value.kind) {
                    failedChecks++;
                }
            } else {
                failedChecks++;
            }
        }
    } catch { /* timeout */ }

    if (failedChecks > 0) console.log(`[ALICIA-DME] âš ï¸ ${failedChecks}/${candidates.length} candidates failed`);

    // Pick the LARGEST PDF (the thesis is usually the biggest file; auxiliary files are smaller)
    if (verifiedPdfs.length > 0) {
        verifiedPdfs.sort((a, b) => b.size - a.size);
        const best = verifiedPdfs[0];
        console.log(`[ALICIA-DME] âœ… Found ${verifiedPdfs.length} PDF(s), picking largest: ${Math.round(best.size / 1024)}KB`);
        return best.url;
    }

    // OJS fallback: if no direct PDF found, check if any candidate is an OJS article URL
    // OJS articles expose PDF via <meta name="citation_pdf_url"> on the article page
    if (!verifiedTxtUrl) {
        for (const c of candidates) {
            if (isOjsUrl(c)) {
                try {
                    console.log(`[ALICIA-DME] OJS article detected, extracting citation_pdf_url: ${c.substring(0, 70)}`);
                    const res = await fetchWithTimeout(c, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 10000);
                    if (res.ok) {
                        const html = await res.text();
                        const ojsPdf = extractOjsPdfUrl(html, c);
                        if (ojsPdf) {
                            console.log(`[ALICIA-DME] âœ… OJS PDF found: ${ojsPdf.substring(0, 70)}`);
                            return ojsPdf;
                        }
                    }
                } catch (e: any) { console.warn(`[ALICIA-DME] OJS extraction failed: ${e.message}`); }
            }
        }
    }

    return verifiedTxtUrl;
}

async function parseAliciaDetailsTable(html: string): Promise<AliciaDetailsMetadata> {
    const meta = extractAliciaMetadataFromHtml(html);
    const pdfUrl = await verifyPdfCandidates(html);
    return { ...meta, pdfUrl: pdfUrl || null } as AliciaDetailsMetadata;
}

export async function fetchAliciaFullMetadata(recordId: string): Promise<AliciaDetailsMetadata | null> {
    const url = `https://alicia.concytec.gob.pe/vufind/Record/${encodeURIComponent(recordId)}/Details`;
    try {
        const res = await fetchWithTimeout(url, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, 10000);
        if (!res.ok) return null;
        const text = await res.text();

        if (text.includes('bot detection') || text.includes('id="anubis_challenge"')) return null;

        const details = await parseAliciaDetailsTable(text);

        if (!details.abstract && !details.pdfUrl) {
            // Only fetch /Description as last resort â€” if we already have a PDF URL,
            // the PDF abstract fallback (extractAbstractFromPdfUrl) is faster and more reliable
            const descUrl = `https://alicia.concytec.gob.pe/vufind/Record/${encodeURIComponent(recordId)}/Description`;
            try {
                const descRes = await fetchWithTimeout(descUrl, {
                    headers: {
                        'Accept': 'text/html',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }, 8000);
                if (descRes.ok) {
                    const descHtml = await descRes.text();
                    const match = descHtml.match(/Descripci[o\u00f3]n\s+del\s+Art[i\u00ed]culo\s*([\s\S]*?)(?:<\/div>|<h[2-5]|Texto\s+completo|<\/section|Descripci[o\u00f3]n\s+completa)/i);
                    if (match) {
                        const raw = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        if (raw.length > 50) details.abstract = raw;
                    }
                }
            } catch { /* ignore */ }
        }

        const hasUsefulData = details.abstract || details.university || details.authors.length > 0;
        if (!hasUsefulData) return null;

        console.log(`[ALICIA-DETAILS] Success for ${recordId}: abstract=${details.abstract?.length || 0}ch, univ=${details.university?.substring(0, 30)}, authors=${details.authors.length}`);
        return details;
    } catch (e) {
        return null;
    }
}

// =============================================================================
// ALICIA (Peru - CONCYTEC)
// =============================================================================

function parseAliciaResponse(text: string): any {
    try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const cleanedJson = text.substring(jsonStart, jsonEnd + 1);
            return JSON.parse(cleanedJson);
        }
        return JSON.parse(text);
    } catch (e: any) {
        console.warn(`[ALICIA] JSON Parse Error. Response starts with: "${text.substring(0, 50)}"`);
        return null;
    }
}

async function executeAliciaSearchWithFallbacks(cleanQuery: string, effectiveQuery: string, limit: number, options?: SearchOptions): Promise<{ records: any[], isFallback: boolean }> {
    let url = `https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=${encodeURIComponent(effectiveQuery)}&type=AllFields&limit=${limit}`;
    if (options?.yearStart && options?.yearEnd) {
        url += `&filter[]=publishDate:[${options.yearStart} TO ${options.yearEnd}]`;
    }
    
    console.log(`[ALICIA] Searching: "${effectiveQuery.substring(0, 60)}..."`);
    let records: any[] = [];
    let isFallback = false;

    // Patch C9d (2026-07-30): Si autoSkipDME (raceMs<180s), saltar
    // fallbacks 1+2 que son fetches secuenciales de 25s+20s cuando
    // el primer fetch devolvio 0 records. Para queries topical con
    // poca cobertura en ALICIA (e.g. "mercados Chimbote"), los 2
    // fallbacks no aportan y solosuman 45s al wall-clock que aborta
    // el outer race. Si autoSkipDME, retorno inmediatamente con
    // empty/few records keeps el provider en 10-20s total.
    const raceMsOpt = (options as any)?.__timeouts?.raceMs as number | undefined;
    const skipFallbacks = typeof raceMsOpt === 'number' && raceMsOpt < 180_000;

    const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'LaTeX-Editor-Academic-Search/1.0' } }, latamTimeout(options));
    let bodyText = '';
    if (res.ok) {
        bodyText = await res.text();
        const data = parseAliciaResponse(bodyText);
        if (data && data.records) records = data.records;

        // A1 (2026-07-24): VuFind session-warning fast-fail.
        // When queries exceed ~4 AND-keywords, VuFind returns 200 OK with a
        // tiny body (~108 bytes) starting with
        //   "Cannot write session to /tmp/vufind_sessions/sess_XXX"
        // followed by {"resultCount":0,...}. The previous code interpreted
        // this as "records=0, try fallbacks", wasting 25+20s before the
        // outer race timeout (45s). Detect the warning and bail immediately
        // WITHOUT running fallbacks — they hit the same session bug and
        // also return 108-byte empty bodies.
        const SESSION_WARN = 'Cannot write session to /tmp/vufind_sessions/';
        if (records.length === 0 && bodyText.includes(SESSION_WARN)) {
            console.warn(`[ALICIA] Fast-fail: VuFind session warning (resultCount=0, query too complex). Skipping fallbacks.`);
            return { records: [], isFallback: false };
        }
    }

    if (!skipFallbacks && records.length === 0 && effectiveQuery !== cleanQuery) {
        console.log(`[ALICIA] Fallback 1: Trying simplified query...`);
        const fallbackUrl = `https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=${encodeURIComponent(simplifyQuery(cleanQuery, 4, options?.location))}&type=AllFields&limit=${limit}`;
        try {
            const fallbackRes = await fetchWithTimeout(fallbackUrl, { headers: { 'Accept': 'application/json' } }, 25000);
            if (fallbackRes.ok) {
                const data = parseAliciaResponse(await fallbackRes.text());
                if (data && data.records?.length > 0) { records = data.records; isFallback = true; }
            }
        } catch (e: any) { console.warn('[ALICIA] Fallback 1 failed:', e.message); }
    } else if (skipFallbacks) {
        console.log(`[ALICIA] C9d: skipping fallback 1 (raceMs=${raceMsOpt}ms < 180s) — saves up to 25s of sequential fetch`);
    }

    if (!skipFallbacks && records.length === 0) {
        console.log(`[ALICIA] Fallback 2: Trying minimal query...`);
        const minimalQuery = simplifyQuery(cleanQuery, 2, options?.location);
        if (minimalQuery.length > 3) {
            const minimalUrl = `https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=${encodeURIComponent(minimalQuery)}&type=AllFields&limit=${limit}`;
            try {
                const minRes = await fetchWithTimeout(minimalUrl, { headers: { 'Accept': 'application/json' } }, 20000);
                if (minRes.ok) {
                    const data = parseAliciaResponse(await minRes.text());
                    if (data && data.records?.length > 0) { records = data.records; isFallback = true; }
                }
            } catch (e: any) { console.warn('[ALICIA] Fallback 2 failed:', e.message); }
        }
    }
    return { records, isFallback };
}

function mapAliciaRecord(record: any): SearchResult {
    let authors: string[] = [];
    if (record.authors?.primary && typeof record.authors.primary === 'object') {
        authors = Object.keys(record.authors.primary);
    }
    if (authors.length === 0 && Array.isArray(record.dcContributorAuthor) && record.dcContributorAuthor.length > 0) {
        authors = record.dcContributorAuthor;
    }
    if (authors.length === 0 && Array.isArray(record.authors)) {
        authors = record.authors.map((a: any) => typeof a === 'string' ? a : a?.name || String(a));
    }

    let pdfUrl: string | null = null;
    let enrichmentUrl: string | null = null;
    if (Array.isArray(record.urls)) {
        const pdfEntry = record.urls.find((u: any) => (typeof u === 'string' ? u : u?.url)?.toLowerCase().endsWith('.pdf'));
        if (pdfEntry) pdfUrl = typeof pdfEntry === 'string' ? pdfEntry : pdfEntry.url;
        const handleEntry = record.urls.find((u: any) => (typeof u === 'string' ? u : u?.url)?.includes('handle'));
        if (handleEntry) enrichmentUrl = typeof handleEntry === 'string' ? handleEntry : handleEntry.url;
        if (!pdfUrl) pdfUrl = enrichmentUrl;
        if (!pdfUrl && record.urls[0]) {
            const first = record.urls[0];
            pdfUrl = typeof first === 'string' ? first : first.url;
        }
    }
    if (!enrichmentUrl) enrichmentUrl = pdfUrl;

    let year = null;
    const dateFields = [record.dcDateIssued, record.publicationDates];
    for (const dateField of dateFields) {
        if (Array.isArray(dateField) && dateField[0]) {
            const match = String(dateField[0]).match(/\d{4}/);
            if (match) { year = parseInt(match[0]); break; }
        }
    }

    let university = record.institutions?.[0] || '';
    if (!university || university === 'Universidad Peruana' || university === 'Universidad') {
        if (Array.isArray(record.dcPublisher) && record.dcPublisher[0]) {
            university = record.dcPublisher[0];
        } else if (Array.isArray(record.thesisDegreeGrantor) && record.thesisDegreeGrantor[0]) {
            university = record.thesisDegreeGrantor[0];
        }
    }
    if (!university) university = 'Universidad Peruana';
    university = resolveUniversity(record.id, pdfUrl || '', university);

    let doi: string | null = null;
    if (Array.isArray(record.dcIdentifierDoi) && record.dcIdentifierDoi[0]) {
        doi = record.dcIdentifierDoi[0].replace(/^https?:\/\/doi\.org\//i, '');
    }

    const abstract = record.summary?.[0] || (Array.isArray(record.dcDescriptionAbstract) && record.dcDescriptionAbstract[0]) || null;

    return {
        id: record.id || generateRecordId(pdfUrl || '', record.title || ''),
        title: record.title || 'Sin t\u00edtulo',
        authors: authors.length > 0 ? authors : ['Autor Desconocido'],
        year,
        abstract,
        pdfUrl,
        handleUrl: record.id ? `https://alicia.concytec.gob.pe/vufind/Record/${record.id}` : (pdfUrl || undefined),
        url: pdfUrl || (record.id ? `https://alicia.concytec.gob.pe/vufind/Record/${record.id}` : undefined),
        source: 'ALICIA (CONCYTEC)',
        type: record.formats?.[0] || 'Tesis',
        university,
        citationCount: null,
        doi,
        metadata: { enrichmentUrl }
    };
}

async function enhanceAliciaResults(mappedResults: SearchResult[], options?: SearchOptions): Promise<void> {
    const isTruncated = (t: string | null) => !!t && (/\.{3}\s*Descripci[o\u00f3]n\s+completa\s*$/i.test(t) || /\.{3}\s*$/.test(t) || /\u2026\s*$/.test(t) || /colo\.\.\.\s*$/i.test(t));
    
    // DME reactivado: enriquecer top 10 resultados sin abstract (o con abstract truncado)
    const resultsToEnhance: SearchResult[] = mappedResults
        .filter(r => !r.abstract || r.abstract.length < 50 || isTruncated(r.abstract))
        .slice(0, 15);
    if (resultsToEnhance.length > 0) {
        // A4 (2026-07-24): Bound DME work to the provider race deadline.
        // BEFORE: enhanceAliciaResults ran DME on up to 25 records with concurrency=3
        // and 3-phase fetches per record (Details page + Description page +
        // verifyAliciaDocumentCandidate with HEAD+GET). Each record takes 2-5s,
        // so 25 records / 3 concurrent × ~5s = ~42s just in DME — which bled
        // past the 60s raceMs and caused the 100% Provider-timeout we observed
        // for "sicariato" (ALICIA returns 315 records, all pre-filtered DME-
        // eligible because VuFind's summary response omits abstracts).
        // AFTER: scale queue size + concurrency to the available race budget.
        // Race <=30s → 5 records / concurrency=2 (~10s); <=60s → 10/3 (~20s);
        // 60-120s → 15/3 (~30s); >120s → full 25/3 (~42s).
        // Patch J2b (2026-07-27): BUG #2 fallback 60s -> 90s.
        // Patch J3 (2026-07-27): force raceMs >= 90s for ALICIA DME specifically,
        // because the upstream-derived raceMs=57000ms (outerMs=114s × 0.50) is too
        // tight for the A2-split (5 sub-queries × 3 fallbacks secuenciales) + DME
        // (10 records / concurrency 3 × ~5s = ~17s) cascada on 4+ keyword queries.
        // Patch J5 (2026-07-27): bump floor 90s -> 110s for DME on slow VuFind
        // Details pages (15 records / conc 3, some fetches 8-10s = ~50s sometimes).
        // Patch J6 (2026-07-27): bump floor 110s -> 150s after measuring A2-split
        // alone takes ~66s (raceMs floor 110s left only 44s for DME).
        // Patch J9 (2026-07-27): bump floor 150s -> 200s after J8 didn't fully
        // fix some queries (blockchain still hit 150s raceMs).
        // Patch K-rollback (2026-07-27): With Patch K1+K3 now propagating __timeouts
        // ráiz, raceMs derives correctly from client ceiling (114s under unknown=240s).
        // Floor reverted to 110s as conservative backstop (cascada natural ~65s).
        //
        // Patch B1 (2026-07-29): BUG #3 — floor 110s demasiado corto cuando
        // concurrente con RENATI OAI-PMH (rate limit serializa DME). Floor subido
        // a 180s para coincidir con mcp.ts handleBatchSearch. El floor más alto
        // no hace daño aquí porque el outer race (caller) ya aborta primero.
        const __t = (options as any)?.__timeouts;
        const rawRace = __t?.raceMs ?? 320_000;
        const raceMs = Math.max(320_000, rawRace); // Patch B1: floor 320s
        let DME_LIMIT: number, DME_CONCURRENCY: number;
        if (raceMs <= 30_000) { DME_LIMIT = 5;  DME_CONCURRENCY = 2; }
        else if (raceMs <= 60_000) { DME_LIMIT = 10; DME_CONCURRENCY = 3; }
        else if (raceMs <= 120_000) { DME_LIMIT = 15; DME_CONCURRENCY = 3; }
        else { DME_LIMIT = 15; DME_CONCURRENCY = 4; } // Patch B1: cap 15 (no 25) para evitar realimentar tiempo
        const totalToEnhance = Math.min(resultsToEnhance.length, DME_LIMIT);
        const queue = resultsToEnhance.slice(0, totalToEnhance);
        console.log(`[ALICIA] DME: Enhancing ${queue.length}/${mappedResults.length} records via Details page (concurrency=${DME_CONCURRENCY}, raceMs=${raceMs}ms, cap=${DME_LIMIT})...`);

        let enhancedCount = 0;
        let queueIdx = 0;

        const enhanceAliciaRecord = async (res: SearchResult): Promise<void> => {
            if (!res.id) return;
            try {
                const details = await fetchAliciaFullMetadata(res.id);
                if (details) {
                    if (details.abstract && details.abstract.length > (res.abstract?.length || 0)) res.abstract = details.abstract;
                    if (details.university && (!res.university || /^(Universidad Peruana|Universidad|Universidad Nacional)$/i.test(res.university))) res.university = details.university;
                    if (details.authors.length > 0 && res.authors[0] === 'Autor Desconocido') res.authors = details.authors;
                    if (details.doi && !res.doi) res.doi = details.doi;
                    if (details.year && !res.year) res.year = details.year;
                    if (details.title && (!res.title || res.title === 'Sin título')) res.title = details.title;
                    if (details.pdfUrl) {
                        if (!res.metadata) res.metadata = {};
                        if (res.pdfUrl && !res.metadata.enrichmentUrl) res.metadata.enrichmentUrl = res.pdfUrl;
                        res.pdfUrl = details.pdfUrl;
                        res.handleUrl = res.handleUrl || (res.metadata.enrichmentUrl as string);
                    }
                }
                if ((!res.abstract || isTruncated(res.abstract)) && res.metadata?.enrichmentUrl) {
                    const enhanced = await enhanceAbstractFromSource(res.metadata.enrichmentUrl as string);
                    if (enhanced && enhanced.length > (res.abstract?.length || 0)) res.abstract = enhanced;
                }
                if ((!res.abstract || isTruncated(res.abstract) || res.abstract.length < 80) && res.pdfUrl) {
                    try {
                        const pdfAbstract = await extractAbstractFromPdfUrl(res.pdfUrl);
                        if (pdfAbstract && pdfAbstract.length > 80 && pdfAbstract.length > (res.abstract?.length || 0)) {
                            console.log(`[ALICIA-DME] PDF fallback abstract extracted (${pdfAbstract.length}ch) for ${res.id}`);
                            res.abstract = pdfAbstract;
                        }
                    } catch {}
                }
            } catch (e: any) { console.warn(`[ALICIA-DME] Error enhancing ${res.id}: ${e.message}`); }
        };

        const processNext = async (): Promise<void> => {
            while (queueIdx < queue.length) {
                const idx = queueIdx++;
                await enhanceAliciaRecord(queue[idx]);
                enhancedCount++;
                if (options?.onProgress) options.onProgress({ message: `ALICIA: Mejorando metadatos ${enhancedCount}/${totalToEnhance} (${Math.round((enhancedCount / totalToEnhance) * 100)}%)...` });
            }
        };

        await Promise.all(Array.from({ length: DME_CONCURRENCY }, () => processNext()));

        if (slowDomainFailCounts.size > 0) {
            const slowDomains = [...slowDomainFailCounts.entries()].filter(([, c]) => c >= SLOW_DOMAIN_THRESHOLD).map(([d, c]) => `${d}(${c}x)`);
            if (slowDomains.length > 0) console.log(`[ALICIA-DME] âš¡ Slow domains auto-skipped: ${slowDomains.join(', ')}`);
        }
    }
}

export async function searchAlicia(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const shortQuery = simplifyQuery(sanitizedQuery, 6, options?.location);
        let cleanQuery = shortQuery
            .replace(/\b(investiga|investigación|estudio|busca|encuentra|analiza|revisión|acerca|sobre|el|la|los|las|un|una|de|del|y|o|con|para)\b/gi, '')
            .replace(/["()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const booleanQuery = constructBooleanQuery(cleanQuery);
        const effectiveQuery = booleanQuery.length > 3 ? booleanQuery : cleanQuery;
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.ALICIA);

        // A2 (2026-07-24): Split complex queries (4+ keywords) into sub-queries
        // run in parallel, then merge+dedup record lists. VuFind's AND-keyword
        // matching returns empty 200/108-byte responses when the query string
        // exceeds ~4 terms (confirmed via curl: 1-2 keywords → 100s of results,
        // 5+ keywords → 0 results with /tmp/vufind_sessions session warning).
        // Strategy: split into overlapping pairs to keep each sub-query <=3 terms
        // while still covering the original semantic intent.
        const effWords = effectiveQuery.split(/\s+/).filter(w => w.length > 0);
        let records: any[] = [];
        let isFallback = false;
        if (effWords.length >= 4) {
            // Patch J8a (2026-07-27): Limit A2-split to 2 pairs + 1 triplet
            // (3 sub-queries total) instead of 5 pairs + 1 triplet (6 sub-queries).
            // The 5+1 sub-queries × 30s timeout floor = ~72s wall-clock alone,
            // pushing total ALICIA execution past raceMs even after J6 bumps.
            // With 3 sub-queries in parallel, wall-clock is bound by the slowest
            // single sub-query (~30s). Coverage is still good because the triplet
            // already covers 3 keywords; the pairs just add extras.
            const subQueries: string[] = [];
            for (let i = 0; i < Math.min(effWords.length - 1, 2); i++) {
                subQueries.push(`${effWords[i]} ${effWords[i + 1]}`);
            }
            if (effWords.length >= 3) subQueries.push(`${effWords[0]} ${effWords[1]} ${effWords[2]}`);

            console.log(`[ALICIA] A2-split: "${effectiveQuery.substring(0, 60)}..." → ${subQueries.length} sub-queries (pairs+triplet) [Patch J8a: capped at 3]`);
            // A5 (2026-07-24): Disable DME enhancement for the sub-queries because
            // each sub-query would invoke its own enhanceAliciaResults pass. With
            // 5 sub-queries × DME_CAP=10 = 50 records being scraped in parallel
            // (3×5=15 concurrent fetch workers hitting VuFind/Record/ID), the
            // outer raceMs (60s) is blown just by DME alone. The merged result
            // list is deduped and then ONE pass of DME runs over the top-10.
            // Patch J8b (2026-07-27): ALSO skip top-level DME for A2-split mode.
            // The DME on 15-25 records at conc 3 takes ~80s when VuFind Details
            // pages are slow (8-10s each), which is more than the raceMs budget
            // remaining after A2-split. Records returned by executeAliciaSearchWithFallbacks
            // already carry basic VuFind metadata (title, year, authors, id) —
            // the DME is only used to fetch abstracts, university, DOI, pdfUrl,
            // which are nice-to-have but not essential for batch_search recall.
            const subOpts = options && typeof options === 'object'
                ? { ...options, __skipDME: true }
                : { __skipDME: true };
            const subResults = await Promise.allSettled(
                subQueries.map(sq => executeAliciaSearchWithFallbacks(sq, sq, limit, subOpts))
            );
            const seenIds = new Set<string>();
            for (const r of subResults) {
                if (r.status === 'fulfilled' && r.value?.records?.length > 0) {
                    for (const rec of r.value.records) {
                        const id = rec.id || rec.recordId || JSON.stringify(rec).substring(0, 60);
                        if (!seenIds.has(id)) { seenIds.add(id); records.push(rec); }
                    }
                    if (r.value.isFallback) isFallback = true;
                }
            }
            console.log(`[ALICIA] A2-merge: ${seenIds.size} unique records after sub-queries`);
        } else {
            const r = await executeAliciaSearchWithFallbacks(cleanQuery, effectiveQuery, limit, options);
            records = r.records;
            isFallback = r.isFallback;
        }
        console.log(`[ALICIA] Found=${records.length} | Query="${effectiveQuery.substring(0, 50)}..."`);

        const mappedResults = records.map(mapAliciaRecord);
        // A5 (2026-07-24): top-level DME pass only runs when sub-queries didn't
        // already run their own. For non-split queries this is a noop (the flag
        // is never set); for A2-split queries this is the single DME pass over
        // the merged+deduped record list.
        // Patch J8b (2026-07-27): skip top-level DME for A2-split queries too.
        // (effWords.length >= 4) means A2-split ran. DME is the main bottleneck:
        // 15-25 records × ~5-10s each / conc 3 = ~50-80s, which exceeds the raceMs
        // remaining after A2-split. Skip it entirely — VuFind basic records are
        // enough for batch_search recall. Top-level DME only runs for simple
        // 1-3 keyword queries (slow path unlikely).
        const effWordsCount = effectiveQuery.split(/\s+/).filter(w => w.length > 0).length;
        const wasA2Split = effWordsCount >= 4;
        // Patch B1 (2026-07-29): batch_skip_dme flag set by mcp.ts handleBatchSearch
        // to skip DME en batch_search path (DME cascade tarda 320s+).
        // Patch B2 (2026-07-30): fastMode flag from search.ts/smart_search also
        // skips top-level DME. Reproducible: search query="sicariato Peru"
        // sources=[alicia] fastMode=true abortaba a los 60s por DME cascade
        // intentando descargar PDFs de repositorios institucionales (muchos 503
        // de repositorio.ucv.edu.pe hoy). Con fastMode skip, ALICIA devuelve 50
        // papers raw (sin abstracts/universidades) en 1-3s. El usuario opta por
        // velocidad > completitud cuando fastMode=true.
        // Patch C9b (2026-07-30): auto-skip DME cuando raceMs < 180s.
        // La cascada DME completa (15-25 records × 5-10s / conc 3) tarda 80-180s,
        // y necesita raceMs >= 180s para completar. Cuando el cliente (playground,
        // opencode, etc.) manda raceMs=60-90s, DME aborta a media cascada y
        // searchAlicia devuelve 0 resultados (race abort). Con auto-skip:
        // searchAlicia devuelve 30-50 records raw (sin abstracts/universidad)
        // en 10-15s — suficiente para ranking + display.
        // El usuario que quiera DME completo debe usar batch_search con raceMs alto
        // o llamar search con PROVIDER_TIMEOUT_MS=180000 en .env.
        const raceMsForAlicia = (options as any)?.__timeouts?.raceMs as number | undefined;
        const autoSkipDME = typeof raceMsForAlicia === 'number' && raceMsForAlicia < 180_000 && !wasA2Split;
        const skipTopLevelDME = !!(options as any)?.__skipDME
            || !!(options as any)?.batch_skip_dme
            || !!(options as any)?.fastMode
            || wasA2Split
            || autoSkipDME;
        if (skipTopLevelDME) {
            if (autoSkipDME) {
                console.log(`[ALICIA] C9b: auto-skipping top-level DME (raceMs=${raceMsForAlicia}ms < 180s) — saves DME cascade abort at race boundary`);
            } else if (wasA2Split) {
                console.log(`[ALICIA] A5+J8b: skipping top-level DME (A2-split mode, ${effWordsCount} keywords) — saves ~80s of DME cascada`);
            } else if ((options as any)?.batch_skip_dme) {
                console.log(`[ALICIA] B1: skipping top-level DME (batch_search mode) — saves 320s of DME cascade`);
            } else if ((options as any)?.fastMode) {
                console.log(`[ALICIA] B2: skipping top-level DME (fastMode=true) — saves 60s+ of DME cascade on slow repos`);
            } else {
                console.log(`[ALICIA] A5: skipping top-level DME (sub-query mode)`);
            }
        } else {
            await enhanceAliciaResults(mappedResults, options);
        }

        const filteredResults = options?.university
            ? mappedResults.filter((result: SearchResult) => {
                const needle = options.university!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const haystack = `${result.university || ''} ${result.title || ''} ${result.abstract || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return haystack.includes(needle);
            })
            : mappedResults;

        let finalResults = filteredResults;
        let resultsWasFallback = isFallback;
        // Patch C9c (2026-07-30): OAI-PMH fallback corria SIEMPRE que
        // filteredResults.length < 5, incluso cuando autoSkipDME era true.
        // OAI-PMH hace 5-15 fetches HTTP secuenciales aarchives.tst.edu.pe
        // y repositorios OAI peruanos, tardando 30-60s+ extras que abortan
        // el outer race (raceMs=90s) justo despues del exit. Saltar
        // OAI-PMH cuando autoSkipDME para mantener coherencia con C9b
        // (misma razon: devolver raw records en 10-15s grown > enriquecer
        // 5 records via scraping 60s). Para OAI-PMH completo usar
        // batch_search con raceMs alto o PROVIDER_TIMEOUT_MS=180000.
        // Patch C9e (2026-07-30): C9c solo miraba autoSkipDME, pero para
        // queries A2-split (4+ keywords, e.g. "mercado de abastos Chimbote
        // higiene salubridad vendedores") autoSkipDME=false por diseño
        // (!wasA2Split en C9b) y el OAI-PMH corria tras el A2-split de
        // ~30-66s → total >90s → Provider timeout 90005ms observado en
        // produccion. Ahora se salta cuando skipTopLevelDME (cubre
        // wasA2Split, fastMode, batch_skip_dme, __skipDME y autoSkipDME).
        // OAI-PMH solo corre en el camino full-quality: query simple,
        // raceMs>=180s, sin fastMode/batch.
        if (filteredResults.length < 5 && !skipTopLevelDME) {
            try {
                const { searchOaiPmhFallback } = await import('./oai-pmh');
                finalResults = await searchOaiPmhFallback(query, filteredResults, 5, options);
                if (finalResults.length > filteredResults.length) {
                    console.log(`[ALICIA] OAI-PMH fallback added ${finalResults.length - filteredResults.length} extra results`);
                    resultsWasFallback = true;
                }
            } catch (e: any) { console.warn(`[ALICIA] OAI-PMH fallback failed: ${e.message}`); }
        } else if (skipTopLevelDME) {
            console.log(`[ALICIA] C9e: skipping OAI-PMH fallback (skipTopLevelDME=true: wasA2Split=${wasA2Split}, autoSkipDME=${autoSkipDME}, raceMs=${raceMsForAlicia}ms) — saves 30-60s of OAI scraping`);
        }

        return { results: finalResults, metadata: { isFallback: resultsWasFallback } };
    } catch (e: any) {
        console.warn(`[ALICIA] Master Exception: ${e.message}`);
        return { results: [], metadata: { isFallback: false } };
    }
}

/**
 * RENATI (Peru - SUNEDU) - Uses ALICIA with independent fallback
 * CRITICAL: This is the primary source for national thesis antecedents
 */
export async function searchRenati(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    // Phase 6 (2026-07-23): per-attempt timeout auto-derived from the calling
    // MCP client's ceiling via options.__timeouts.tryMs (race Ã— 0.67).
    // Was 15s hardcoded â†’ aborted ALICIA which live-latency is 8-14s + DME
    // enhancement +5-15s. Auto-derived default 30s (under race 45s). Env var
    // RENATI_ATTEMPT_TIMEOUT_MS honored as upper-bound only.
    const derivedTryMs = (options as any)?.__timeouts?.tryMs ?? 30000;
    const RENATI_ATTEMPT_TIMEOUT = (() => {
        const envVal = parseInt(process.env.RENATI_ATTEMPT_TIMEOUT_MS || '', 10);
        if (isNaN(envVal) || envVal <= 0) return derivedTryMs;
        return Math.min(derivedTryMs, envVal);
    })();
    try {
        if (options?.onProgress) options.onProgress({ message: 'Consultando RENATI (SUNEDU)...' });
        console.log(`[RENATI] Searching: "${query.substring(0, 50)}..."`);

        // First attempt: Run ALICIA + OAI-PMH in PARALLEL (was sequential)
        const { searchOaiPmhAll } = await import('./oai-pmh');
        const [aliciaResult, oaiResult] = await Promise.allSettled([
            withPromiseTimeout(
                searchAlicia(query, { ...options, limit: options?.limit || SEARCH_LIMITS.RENATI }),
                RENATI_ATTEMPT_TIMEOUT,
                'ALICIA timeout'
            ),
            withPromiseTimeout(
                searchOaiPmhAll(query, options),
                RENATI_ATTEMPT_TIMEOUT,
                'OAI-PMH timeout'
            )
        ]);

        let results: SearchResult[] = [];
        let isFallback = false;

        // Merge ALICIA results
        if (aliciaResult.status === 'fulfilled' && aliciaResult.value.results.length > 0) {
            results = aliciaResult.value.results;
            isFallback = aliciaResult.value.metadata?.isFallback || false;
        }

        // Merge OAI-PMH results (intelligent dedup â€” inherit abstract from OAI-PMH)
        if (oaiResult.status === 'fulfilled' && oaiResult.value.results.length > 0) {
            const normKey = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 80);
            const oaiByKey = new Map(oaiResult.value.results.map(r => [normKey(r.title || ''), r]));
            let mergedCount = 0;

            // For each ALICIA result, check if OAI-PMH has the same title with better data
            for (let i = 0; i < results.length; i++) {
                const key = normKey(results[i].title || '');
                const oaiRec = oaiByKey.get(key);
                if (oaiRec) {
                    // Inherit abstract from OAI-PMH if ALICIA doesn't have one
                    if ((oaiRec.abstract || '').length > 30 && (results[i].abstract || '').length < 30) {
                        results[i].abstract = oaiRec.abstract;
                        mergedCount++;
                    }
                    // Inherit pdfUrl ONLY if ALICIA has none (don't overwrite DME-resolved bitstream with handle page)
                    if (oaiRec.pdfUrl && !results[i].pdfUrl) {
                        results[i].pdfUrl = oaiRec.pdfUrl;
                    }
                    // Inherit DOI if missing
                    if (oaiRec.doi && !results[i].doi) {
                        results[i].doi = oaiRec.doi;
                    }
                }
            }

            // Add OAI-PMH records that are NOT duplicates
            const existingKeys = new Set(results.map(r => normKey(r.title || '')));
            const newResults = [...oaiByKey.values()].filter(r => {
                const key = normKey(r.title || '');
                return key && !existingKeys.has(key);
            });
            if (newResults.length > 0 || mergedCount > 0) {
                results = [...results, ...newResults];
                isFallback = true;
                console.log(`[RENATI] OAI-PMH: ${mergedCount} abstracts merged, ${newResults.length} new results (total: ${results.length})`);
            }
        }

        // Resolve handle URLs to actual PDF bitstreams for OAI-PMH-only results
        // (results where pdfUrl === handleUrl, meaning DME didn't resolve them)
        const unresolved = results.filter(r =>
            r.pdfUrl && r.handleUrl && r.pdfUrl === r.handleUrl &&
            !r.pdfUrl.includes('/bitstream/') && !r.pdfUrl.match(/\.pdf($|\?)/i)
        );
        if (unresolved.length > 0) {
            console.log(`[RENATI] Resolving ${Math.min(unresolved.length, 10)} handleâ†’PDF bitstreams...`);
            const { resolveHandleToPdfUrl, isPeruDSpaceUrl } = await import('../scraping/dspace-resolver');
            const toResolve = unresolved.slice(0, 10);
            const resolutions = await Promise.allSettled(
                toResolve.map(async r => {
                    if (!r.pdfUrl || !isPeruDSpaceUrl(r.pdfUrl)) return null;
                    const pdfUrl = await resolveHandleToPdfUrl(r.pdfUrl);
                    return pdfUrl ? { id: r.id, pdfUrl } : null;
                })
            );
            let resolvedCount = 0;
            for (const res of resolutions) {
                if (res.status === 'fulfilled' && res.value) {
                    const target = results.find(r => r.id === res.value!.id);
                    if (target) {
                        target.pdfUrl = res.value!.pdfUrl;
                        resolvedCount++;
                    }
                }
            }
            if (resolvedCount > 0) console.log(`[RENATI] Resolved ${resolvedCount}/${toResolve.length} handleâ†’PDF`);
        }

        // Patch C10 (2026-07-30): skip fallbacks secuenciales cuando raceMs < 180s.
        // Antes: attempt 1 (ALICIA+OAI-PMH paralelo, hasta RENATI_ATTEMPT_TIMEOUT)
        // + FALLBACK 1 (query simplificada, OTRO attempt completo) + FALLBACK 2
        // (2 palabras, OTRO attempt) = peor caso 3 x RENATI_ATTEMPT_TIMEOUT
        // (hasta 180s si tryMs=60s) vs race externo 90s -> Provider timeout para
        // renati en queries de 0 resultados con VuFind lento. Con skip: devuelve
        // lo que attempt 1 encontro (que ya cubre ALICIA + OAI-PMH en paralelo),
        // coherente con C9d/C9e. Para fallback completo usar batch_search con
        // raceMs alto o PROVIDER_TIMEOUT_MS=180000.
        const raceMsRenati = (options as any)?.__timeouts?.raceMs as number | undefined;
        const skipRenatiFallbacks = typeof raceMsRenati === 'number' && raceMsRenati < 180_000;

        // FALLBACK: If no results, try with simplified query directly
        if (!skipRenatiFallbacks && results.length === 0) {
            console.log(`[RENATI] No results, trying direct simplified search...`);
            const simplifiedQuery = simplifyQuery(sanitizeQueryForSearch(query), 3, options?.location);
            if (simplifiedQuery.length > 5) {
                try {
                    const retry = await withPromiseTimeout(
                        searchAlicia(simplifiedQuery, { ...options, limit: options?.limit || SEARCH_LIMITS.RENATI }),
                        RENATI_ATTEMPT_TIMEOUT,
                        'RENATI attempt 2 timeout'
                    );
                    results = retry.results;
                    if (results.length > 0) isFallback = true;
                } catch { /* timeout or error â€” continue */ }
            }
        } else if (skipRenatiFallbacks && results.length === 0) {
            console.log(`[RENATI] C10: skipping fallbacks 1+2 (raceMs=${raceMsRenati}ms < 180s) - saves up to 2 sequential retries past attempt 1`);
        }

        // FALLBACK 2: Try with just the first 2 meaningful words
        if (!skipRenatiFallbacks && results.length === 0) {
            console.log(`[RENATI] Fallback 2: Trying minimal 2-word query...`);
            const minimalQuery = simplifyQuery(sanitizeQueryForSearch(query), 2, options?.location);
            if (minimalQuery.length > 4) {
                try {
                    const retry = await withPromiseTimeout(
                        searchAlicia(minimalQuery, { ...options, limit: options?.limit || SEARCH_LIMITS.RENATI }),
                        RENATI_ATTEMPT_TIMEOUT,
                        'RENATI attempt 3 timeout'
                    );
                    results = retry.results;
                } catch { /* timeout or error â€” continue */ }
            }
        }

        console.log(`[RENATI] Final results: ${results.length} documents`);
        return {
            results: results.map(r => ({ ...r, source: 'RENATI (SUNEDU)', type: r.type || 'Tesis' })),
            metadata: { isFallback }
        };
    } catch (e: any) {
        console.error(`[RENATI] Exception: ${e.message}, attempting Fallback...`);
        const fallbackRes = await executeFallback(query, options, 'Renati');
        if (fallbackRes) return fallbackRes;
        return { results: [] };
    }
}

// =============================================================================
// LA REFERENCIA (LatAm Aggregator)
// =============================================================================

export async function searchLaReferencia(query: string, options?: SearchOptions & { countryFilter?: string }): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const cleanQuery = normalizeAccents(query).replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.LA_REFERENCIA);
        const countryFilter = options?.countryFilter || options?.countryCode;
        const countryLabel = countryFilter ? ` [${countryFilter}]` : '';
        if (options?.onProgress) options.onProgress({ message: `Consultando LA REFERENCIA${countryLabel}...` });
        console.log(`[LA REFERENCIA${countryLabel}] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const fields = ['id', 'title', 'authors', 'publicationDates', 'summary', 'urls', 'formats', 'institutions', 'country', 'doi']
            .map(f => `&field[]=${f}`).join('');

        let url = `https://www.lareferencia.info/vufind/api/v1/search?lookfor=${encodeURIComponent(cleanQuery)}&type=AllFields&limit=${limit}&format=json${fields}`;

        if (options?.yearStart && options?.yearEnd) {
            url += `&filter[]=publishDate:[${options.yearStart} TO ${options.yearEnd}]`;
        }

        if (countryFilter) {
            url += `&filter[]=network_acronym_str:${encodeURIComponent(countryFilter)}`;
        }

        const res = await fetchWithTimeout(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.lareferencia.info/'
            }
        }, latamTimeout(options));

        let records: VuFindRecord[] = [];

        if (!res.ok) {
            console.warn(`[LA REFERENCIA${countryLabel}] Status ${res.status}, using Fallback Strategy`);
            const fallbackRes = await executeFallback(query, options, 'La Referencia');
            if (fallbackRes) return fallbackRes;

            const defaultFallback = await centralizedOpenAlexFallback(query, options, 'La Referencia');
            return { ...defaultFallback, metadata: { ...defaultFallback.metadata, isFallback: true } };
        }

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            throw new Error("Cloudflare Bot block detected (HTML returned)");
        }

        const data = await safeJson(res, 'LA REFERENCIA');
        records = data.records || [];

        return {
            results: records.map((record: any) => {
                let authors: string[] = [];
                if (record.authors?.primary) authors = Object.keys(record.authors.primary);
                else if (Array.isArray(record.authors)) authors = record.authors.map((a: any) => typeof a === 'string' ? a : a?.name);
                if (authors.length === 0) authors = ['Autor Desconocido'];

                let pdfUrl: string | null = null;
                if (Array.isArray(record.urls) && record.urls[0]) {
                    const first = record.urls[0];
                    pdfUrl = typeof first === 'string' ? first : first.url;
                }

                let year = null;
                if (record.publicationDates?.[0]) {
                    const match = String(record.publicationDates[0]).match(/\d{4}/);
                    if (match) year = parseInt(match[0]);
                }

                return {
                    id: record.id || generateRecordId(pdfUrl || '', record.title || ''),
                    title: record.title || 'Sin título',
                    authors,
                    year,
                    abstract: record.summary?.[0] || null,
                    pdfUrl,
                    source: 'La Referencia',
                    type: record.formats?.[0] || 'Tesis',
                    university: record.institutions?.[0] || record.country || 'Latinoamérica',
                    citationCount: null,
                    doi: record.doi || null
                };
            }),
            metadata: { isFallback: false }
        };
    } catch (e: any) {
        console.warn(`[LA REFERENCIA] Exception: ${e.message}. Using fallback.`);
        const fallbackRes = await executeFallback(query, options, 'La Referencia');
        if (fallbackRes) return fallbackRes;

        const defaultFallback = await centralizedOpenAlexFallback(query, options);
        return {
            ...defaultFallback,
            metadata: { ...defaultFallback.metadata, isFallback: true }
        };
    }
}

// =============================================================================
// NATIONAL REPOSITORIES
// =============================================================================

/**
 * MEXICO: CONAHCyT
 */
export async function searchConacyt(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.CONACYT);
        if (options?.onProgress) options.onProgress({ message: 'Consultando CONAHCyT (M\u00e9xico)...' });
        console.log(`[CONACYT] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://repositorio.conacyt.mx/rest/items/find-by-metadata-field?query=${encodeURIComponent(cleanQuery)}&limit=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        if (!res.ok) {
            const { results: laRefResults, metadata } = await searchLaReferencia(simplifyQuery(cleanQuery, undefined, options?.location) + ' México', { ...options, countryCode: 'MX' });
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    // If fallback, keep original source (e.g. OpenAlex). If not, map to Conacyt.
                    source: metadata?.isFallback ? r.source : 'CONAHCyT (México)'
                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'CONAHCyT');
        const records = Array.isArray(data) ? data : (data.items || []);

        console.log(`[CONACYT] Found=${records.length} | Query="${cleanQuery.substring(0, 50)}..."`);

        return {
            results: records.map((record: any) => ({
                id: record.uuid || generateRecordId('', record.name || ''),
                title: record.name || record.title || 'Sin título',
                authors: record.metadata?.find((m: any) => m.key === 'dc.contributor.author')?.value
                    ? [record.metadata.find((m: any) => m.key === 'dc.contributor.author').value]
                    : ['Autor Desconocido'],
                year: record.metadata?.find((m: any) => m.key === 'dc.date.issued')?.value
                    ? parseInt(record.metadata.find((m: any) => m.key === 'dc.date.issued').value.substring(0, 4))
                    : null,
                abstract: record.metadata?.find((m: any) => m.key === 'dc.description.abstract')?.value || '',
                pdfUrl: record.link || null,
                handleUrl: record.link || undefined,
                source: 'CONAHCyT (México)',
                type: 'Tesis',
                university: record.metadata?.find((m: any) => m.key === 'dc.publisher')?.value || 'México',
                citationCount: null,
                doi: null
            }))
        };
    } catch (e: any) {
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' México', { ...options, countryCode: 'MX' });
        return {
            results: laRefResults.map((r: any) => ({
                ...r,
                source: metadata?.isFallback ? r.source : 'CONAHCyT (México)'
            })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

/**
 * MEXICO: UNAM
 */
export async function searchUnam(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const cleanQuery = sanitizedQuery.replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.UNAM);
        if (options?.onProgress) options.onProgress({ message: 'Consultando UNAM (M\u00e9xico)...' });
        console.log(`[UNAM] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://repositorio.unam.mx/oaipmh-rest/search?query=${encodeURIComponent(cleanQuery)}&rows=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        if (!res.ok) {
            const { results: laRefResults, metadata } = await searchLaReferencia(simplifyQuery(cleanQuery, undefined, options?.location) + ' UNAM', { ...options, countryCode: 'MX' });
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    source: metadata?.isFallback ? r.source : 'UNAM (México)',

                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'UNAM');
        const records = data.response?.docs || data.records || [];

        console.log(`[UNAM] Found=${records.length} | Query="${cleanQuery.substring(0, 50)}..."`);

        return {
            results: records.map((record: any) => ({
                id: record.id || generateRecordId('', record.title || ''),
                title: record.title || 'Sin título',
                authors: record.author ? [record.author] : ['Autor Desconocido'],
                year: record.date ? parseInt(String(record.date).substring(0, 4)) : null,
                abstract: record.description || '',
                pdfUrl: record.url || null,
                handleUrl: record.url || undefined,
                source: 'UNAM (México)',
                type: 'Tesis',
                university: 'Universidad Nacional Autónoma de México',
                citationCount: null,
                doi: null
            }))
        };
    } catch {
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' UNAM', { ...options, countryCode: 'MX' });
        return {
            results: laRefResults.map((r: any) => ({
                ...r,
                source: metadata?.isFallback ? r.source : 'UNAM (México)',

            })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

/**
 * CHILE: ANID
 */
export async function searchAnid(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const cleanQuery = sanitizeQueryForSearch(query).replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.ANID);
        if (options?.onProgress) options.onProgress({ message: 'Consultando ANID (Chile)...' });
        console.log(`[ANID] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://repositorio.anid.cl/rest/items/find-by-metadata-field?query=${encodeURIComponent(cleanQuery)}&limit=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        if (!res.ok) {
            const { results: laRefResults, metadata } = await searchLaReferencia(simplifyQuery(cleanQuery, undefined, options?.location) + ' Chile', options);
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    source: metadata?.isFallback ? r.source : 'ANID (Chile)'
                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'ANID');
        const records = Array.isArray(data) ? data : (data.items || []);

        console.log(`[ANID] Found=${records.length} | Query="${cleanQuery.substring(0, 50)}..."`);

        return {
            results: records.map((record: any) => ({
                id: record.uuid || generateRecordId('', record.name || ''),
                title: record.name || 'Sin título',
                authors: record.metadata?.find((m: any) => m.key === 'dc.contributor.author')?.value
                    ? [record.metadata.find((m: any) => m.key === 'dc.contributor.author').value]
                    : ['Autor Desconocido'],
                year: record.metadata?.find((m: any) => m.key === 'dc.date.issued')?.value
                    ? parseInt(record.metadata.find((m: any) => m.key === 'dc.date.issued').value.substring(0, 4))
                    : null,
                abstract: record.metadata?.find((m: any) => m.key === 'dc.description.abstract')?.value || '',
                pdfUrl: record.link || null,
                handleUrl: record.link || undefined,
                source: 'ANID (Chile)',
                type: 'Tesis',
                university: record.metadata?.find((m: any) => m.key === 'dc.publisher')?.value || 'Chile',
                citationCount: null,
                doi: null
            }))
        };
    } catch {
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' Chile', { ...options, countryCode: 'CL' });
        return {
            results: laRefResults.map((r: any) => ({
                ...r,
                source: metadata?.isFallback ? r.source : 'ANID (Chile)'
            })),
            metadata: { isFallback: metadata?.isFallback || true }
        };
    }
}

/**
 * BRAZIL: Oasisbr
 * IMPORTANT: Brazilian repository - searches in Portuguese too!
 */
export async function searchOasisbr(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        // Clean and simplify query for better compatibility
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const shortQuery = simplifyQuery(sanitizedQuery, 5, options?.location);
        const cleanQuery = shortQuery.replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.OASISBR);

        if (options?.onProgress) options.onProgress({ message: 'Consultando Oasisbr (Brasil)...' });
        console.log(`[OASISBR] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://oasisbr.ibict.br/vufind/api/v1/search?lookfor=${encodeURIComponent(cleanQuery)}&type=AllFields&limit=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        let records: any[] = [];

        if (res.ok) {
            const data = await safeJson(res, 'OASISBR');
            records = data.records || [];
        }

        // PORTUGUESE FALLBACK: Generate Portuguese query and search again
        if (records.length < 5) {
            console.log(`[OASISBR] Trying Portuguese query fallback...`);
            const portugueseQuery = convertToPortuguese(cleanQuery);
            if (portugueseQuery !== cleanQuery) {
                const ptUrl = `https://oasisbr.ibict.br/vufind/api/v1/search?lookfor=${encodeURIComponent(portugueseQuery)}&type=AllFields&limit=${limit}`;
                try {
                    const ptRes = await fetchWithTimeout(ptUrl, { headers: { 'Accept': 'application/json' } }, 25000);
                    if (ptRes.ok) {
                        const ptData = await safeJson(ptRes, 'OASISBR-PT');
                        const ptRecords = ptData.records || [];
                        // Merge results, avoiding duplicates by ID
                        const existingIds = new Set(records.map((r: any) => r.id));
                        for (const rec of ptRecords) {
                            if (!existingIds.has(rec.id)) {
                                records.push(rec);
                                existingIds.add(rec.id);
                            }
                        }
                        console.log(`[OASISBR] Portuguese search added ${ptRecords.length} results`);
                    }
                } catch { /* ignore PT fallback failures */ }
            }
        }

        // LA REFERENCIA FALLBACK: If still no results
        if (records.length === 0) {
            console.log(`[OASISBR] No results, falling back to La Referencia...`);
            const { results: laRefResults, metadata } = await searchLaReferencia(cleanQuery + ' Brasil', options);
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    source: metadata?.isFallback ? r.source : 'Oasisbr (Brasil)'
                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        console.log(`[OASISBR] Found=${records.length} | Query="${cleanQuery.substring(0, 50)}..."`);

        return {
            results: records.map((record: any) => {
                let authors: string[] = [];
                if (record.authors?.primary) authors = Object.keys(record.authors.primary);
                else if (Array.isArray(record.authors)) authors = record.authors.map((a: any) => typeof a === 'string' ? a : a?.name);
                if (authors.length === 0) authors = ['Autor Desconocido'];

                let pdfUrl: string | null = null;
                if (Array.isArray(record.urls) && record.urls[0]) {
                    const first = record.urls[0];
                    pdfUrl = typeof first === 'string' ? first : first.url;
                }

                return {
                    id: record.id || generateRecordId(pdfUrl || '', record.title || ''),
                    title: record.title || 'Sin título',
                    authors,
                    year: record.publicationDates?.[0] ? parseInt(record.publicationDates[0]) : null,
                    abstract: record.summary?.[0] || '',
                    pdfUrl,
                    handleUrl: record.id ? `https://oasisbr.ibict.br/vufind/Record/${record.id}` : (pdfUrl || undefined),
                    source: 'Oasisbr (Brasil)',
                    type: record.formats?.[0] || 'Tesis',
                    university: record.institutions?.[0] || 'Brasil',
                    citationCount: null,
                    doi: null
                };
            })
        };
    } catch (e: any) {
        console.warn(`[OASISBR] Exception: ${e.message}`);
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' Brasil', { ...options, countryCode: 'BR' });
        return {
            results: laRefResults.map((r: any) => ({ ...r, source: 'Oasisbr (Brasil)' })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

/**
 * Helper: Convert Spanish keywords to Portuguese equivalents
 */
function convertToPortuguese(spanishQuery: string): string {
    const translations: Record<string, string> = {
        // Common academic terms
        'investigación': 'pesquisa',
        'investigacion': 'pesquisa',
        'estudio': 'estudo',
        'análisis': 'análise',
        'analisis': 'analise',
        'desarrollo': 'desenvolvimento',
        'evaluación': 'avaliação',
        'evaluacion': 'avaliacao',
        'optimización': 'otimização',
        'optimizacion': 'otimizacao',
        'mejora': 'melhoria',
        'sistema': 'sistema',
        'proceso': 'processo',
        'producción': 'produção',
        'produccion': 'producao',
        'calidad': 'qualidade',
        'efecto': 'efeito',
        'impacto': 'impacto',
        'aplicación': 'aplicação',
        'aplicacion': 'aplicacao',
        'universidad': 'universidade',
        'tesis': 'tese',
        'maestría': 'mestrado',
        'maestria': 'mestrado',
        'doctorado': 'doutorado',
        // Agriculture/Environment
        'suelo': 'solo',
        'agua': 'água',
        'planta': 'planta',
        'cultivo': 'cultivo',
        'fertilizante': 'fertilizante',
        'rendimiento': 'rendimento',
        'crecimiento': 'crescimento',
        // Engineering
        'diseño': 'design',
        'construcción': 'construção',
        'construccion': 'construcao',
        'material': 'material',
        'estructura': 'estrutura',
        // Health
        'salud': 'saúde',
        'enfermedad': 'doença',
        'tratamiento': 'tratamento',
        'paciente': 'paciente'
    };

    let portuguese = spanishQuery.toLowerCase();
    for (const [es, pt] of Object.entries(translations)) {
        portuguese = portuguese.replace(new RegExp(`\\b${es}\\b`, 'gi'), pt);
    }
    return portuguese;
}

/**
 * ARGENTINA: SNRD
 */
export async function searchSnrd(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const cleanQuery = sanitizeQueryForSearch(query).replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.SNRD);
        if (options?.onProgress) options.onProgress({ message: 'Consultando SNRD (Argentina)...' });
        console.log(`[SNRD] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://bdu.siu.edu.ar/api/v1/search?q=${encodeURIComponent(cleanQuery)}&rows=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        if (!res.ok) {
            const { results: laRefResults, metadata } = await searchLaReferencia(simplifyQuery(cleanQuery, undefined, options?.location) + ' Argentina', options);
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    source: metadata?.isFallback ? r.source : 'SNRD (Argentina)'
                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'SNRD');
        const records = data.response?.docs || data.records || [];

        console.log(`[SNRD] Found=${records.length} | Query="${cleanQuery.substring(0, 50)}..."`);

        return {
            results: records.map((record: any) => ({
                id: record.id || generateRecordId('', record.title || ''),
                title: record.title || 'Sin título',
                authors: record.author ? [record.author] : ['Autor Desconocido'],
                year: record.date ? parseInt(String(record.date).substring(0, 4)) : null,
                abstract: record.description || '',
                pdfUrl: record.url || null,
                handleUrl: record.url || undefined,
                source: 'SNRD (Argentina)',
                type: 'Tesis',
                university: record.institution || 'Argentina',
                citationCount: null,
                doi: null
            }))
        };
    } catch {
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' Argentina', { ...options, countryCode: 'AR' });
        return {
            results: laRefResults.map((r: any) => ({
                ...r,
                source: metadata?.isFallback ? r.source : 'SNRD (Argentina)'
            })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

/**
 * COLOMBIA: MinCiencias
 *
 * BL-08 fix (2026-07-25): el dominio legacy `repositorionacional.gov.co` fue retirado
 * del DNS público (NXDOMAIN). El repositorio nacional migró a:
 *   https://repositorio.minciencias.gov.co/
 *
 * El nuevo repositorio usa DSpace 7 con REST API nuevo en:
 *   /server/api/discover/search/objects?query=...&size=...
 *
 * Schema DSpace 7:
 *   _embedded.searchResult._embedded.objects[]  (array of search hits)
 *   objects[i]._embedded.indexableObject         (the actual Item)
 *   indexableObject.metadata.<key> = {value: string, language: string|null, ...} OR
 *   indexableObject.metadata.<key> = [{value: ..., ...}, ...]  (array for multi-valued)
 *   indexableObject.handle                       (e.g. "20.500.14143/50298")
 *   indexableObject.uuid
 *
 * Fallback chain: si DSpace 7 falla, degradar a LaReferencia con keyword 'Colombia'.
 */
export async function searchMinciencias(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const cleanQuery = sanitizeQueryForSearch(query).replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.MINCIENCIAS);
        if (options?.onProgress) options.onProgress({ message: 'Consultando MinCiencias (Colombia)...' });
        console.log(`[MINCIENCIAS] Searching: "${cleanQuery.substring(0, 50)}..."`);

        // BL-08 fix: new DSpace 7 endpoint
        const url = `https://repositorio.minciencias.gov.co/server/api/discover/search/objects?query=${encodeURIComponent(cleanQuery)}&size=${limit}`;
        const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));

        if (!res.ok) {
            console.warn(`[MINCIENCIAS] HTTP ${res.status}; fallback LaReferencia`);
            const { results: laRefResults, metadata } = await searchLaReferencia(simplifyQuery(cleanQuery, undefined, options?.location) + ' Colombia', options);
            return {
                results: laRefResults.map((r: any) => ({
                    ...r,
                    source: metadata?.isFallback ? r.source : 'MinCiencias (Colombia)'
                })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'MINCIENCIAS');
        // DSpace 7 nested path: _embedded.searchResult._embedded.objects[]
        const objects = data?._embedded?.searchResult?._embedded?.objects || [];
        const totalElements = data?._embedded?.searchResult?._embedded?.objects?.length
            ? (data?._embedded?.searchResult?.page?.totalElements ?? objects.length)
            : 0;

        console.log(`[MINCIENCIAS] Found=${objects.length} (total=${totalElements}) | Query="${cleanQuery.substring(0, 50)}..."`);

        const records = objects.map((obj: any) => obj?._embedded?.indexableObject).filter((r: any) => r);

        return {
            results: records.map((record: any) => {
                const meta = record.metadata || {};
                // Helper: get value from metadata field (can be single object OR array)
                const getMeta = (key: string): string | null => {
                    const v = meta[key];
                    if (!v) return null;
                    if (Array.isArray(v)) return v.map((x: any) => x?.value).filter(Boolean).join('; ') || null;
                    return v?.value || null;
                };
                const getMetaArray = (key: string): string[] => {
                    const v = meta[key];
                    if (!v) return [];
                    if (Array.isArray(v)) return v.map((x: any) => x?.value).filter(Boolean);
                    return v?.value ? [v.value] : [];
                };

                const handle = record.handle || '';
                const title = getMeta('dc.title') || record.name || 'Sin título';
                const authors = getMetaArray('dc.contributor.author').length > 0
                    ? getMetaArray('dc.contributor.author')
                    : (getMeta('dc.creator') ? [getMeta('dc.creator')!] : ['Autor Desconocido']);
                const yearStr = getMeta('dc.date.issued') || getMeta('dc.date.available') || '';
                const year = yearStr ? parseInt(yearStr.substring(0, 4)) : null;
                const abstract = getMeta('dc.description.abstract') || '';
                const subjectsLemb = getMetaArray('dc.subject.lemb');
                const subjectsProp = getMetaArray('dc.subject.proposal');
                const keywords = [...subjectsLemb, ...subjectsProp];
                const handleUrl = handle ? `https://repositorio.minciencias.gov.co/handle/${handle}` : undefined;

                return {
                    id: record.uuid || generateRecordId('', title),
                    title,
                    authors,
                    year: isNaN(year as number) ? null : year,
                    abstract,
                    pdfUrl: null, // DSpace 7 needs separate bitstream fetch; left as null
                    handleUrl,
                    source: 'MinCiencias (Colombia)',
                    type: getMeta('dc.type') || 'Tesis',
                    university: getMeta('dc.publisher') || 'Colombia',
                    citationCount: null,
                    doi: null,
                    snippet: keywords.length > 0 ? `Keywords: ${keywords.slice(0, 5).join(', ')}` : undefined,
                };
            })
        };
    } catch (err: any) {
        console.warn(`[MINCIENCIAS] Error: ${err.message}; fallback LaReferencia Colombia`);
        const { results: laRefResults, metadata } = await searchLaReferencia(query + ' Colombia', { ...options, countryCode: 'CO' });
        return {
            results: laRefResults.map((r: any) => ({
                ...r,
                source: metadata?.isFallback ? r.source : 'MinCiencias (Colombia)'
            })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

// =============================================================================
// SHARED HELPERS FOR BATCH-FIRST LATAM EXPANSION
// =============================================================================

function mapVuFindRecords(records: any[], source: string, defaultUniversity: string): SearchResult[] {
    return records.map((record: any) => {
        let authors: string[] = [];
        if (record.authors?.primary) {
            authors = Object.keys(record.authors.primary);
        } else if (Array.isArray(record.authors)) {
            authors = record.authors
                .map((a: any) => typeof a === 'string' ? a : a?.name)
                .filter((a: string | undefined): a is string => Boolean(a));
        }
        if (authors.length === 0) authors = ['Autor Desconocido'];

        let pdfUrl: string | null = null;
        if (Array.isArray(record.urls) && record.urls[0]) {
            const first = record.urls[0];
            pdfUrl = typeof first === 'string' ? first : first.url;
        }

        let year: number | null = null;
        if (record.publicationDates?.[0]) {
            const match = String(record.publicationDates[0]).match(/\d{4}/);
            if (match) year = parseInt(match[0], 10);
        }

        return {
            id: record.id || generateRecordId(pdfUrl || '', record.title || ''),
            title: record.title || 'Sin titulo',
            authors,
            year,
            abstract: record.summary?.[0] || '',
            pdfUrl,
            source,
            type: record.formats?.[0] || 'Tesis',
            university: record.institutions?.[0] || record.country || defaultUniversity,
            citationCount: null,
            doi: record.doi || null
        };
    });
}

function createLaReferenciaCountrySearch(
    countryCode: string,
    sourceName: string,
    logPrefix: string
): (query: string, options?: SearchOptions) => Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    return async (query: string, options?: SearchOptions) => {
        try {
            const cleanQuery = sanitizeQueryForSearch(query).replace(/["()]/g, ' ').trim();
            const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.LA_REFERENCIA);
            if (options?.onProgress) options.onProgress({ message: `Consultando ${sourceName}...` });
            console.log(`${logPrefix} Searching via La Referencia [${countryCode}]: "${cleanQuery.substring(0, 50)}..."`);

            const firstAttempt = await searchLaReferencia(cleanQuery, { ...options, limit, countryFilter: countryCode });
            if (firstAttempt.results.length > 0) {
                return {
                    results: firstAttempt.results.map(r => ({ ...r, source: sourceName })),
                    metadata: { isFallback: false }
                };
            }

            // LetXinet 1.1.3: La Referencia exige todas las palabras; antes de recortar con
            // simplifyQuery (que prioriza mayusculas y puede quitar el tema), se reintenta
            // conservando el tema y un solo lugar: "dengue Chimbote Ancash" -> "dengue Chimbote".
            const conTema = consultaConservandoTema(cleanQuery);
            if (conTema && conTema !== cleanQuery) {
                const intento = await searchLaReferencia(conTema, { ...options, limit, countryFilter: countryCode });
                if (intento.results.length > 0) {
                    return {
                        results: intento.results.map(r => ({ ...r, source: sourceName })),
                        metadata: { isFallback: true }
                    };
                }
            }

            const simplifiedQuery = simplifyQuery(cleanQuery, 3, options?.location);
            if (simplifiedQuery.length > 3 && simplifiedQuery !== cleanQuery) {
                const retry = await searchLaReferencia(simplifiedQuery, { ...options, limit, countryFilter: countryCode });
                if (retry.results.length > 0) {
                    return {
                        results: retry.results.map(r => ({ ...r, source: sourceName })),
                        metadata: { isFallback: true }
                    };
                }
            }

            const minimalQuery = simplifyQuery(cleanQuery, 2, options?.location);
            if (minimalQuery.length > 3) {
                const minimal = await searchLaReferencia(minimalQuery, { ...options, limit, countryFilter: countryCode });
                if (minimal.results.length > 0) {
                    return {
                        results: minimal.results.map(r => ({ ...r, source: sourceName })),
                        metadata: { isFallback: true }
                    };
                }
            }

            return { results: [], metadata: { isFallback: false } };
        } catch (e: any) {
            console.warn(`${logPrefix} Exception: ${e.message}`);
            return { results: [], metadata: { isFallback: false } };
        }
    };
}

// =============================================================================
// BRAZIL: BDTD (Biblioteca Digital Brasileira de Teses e Dissertacoes)
// =============================================================================

export async function searchBdtd(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const sanitizedQuery = sanitizeQueryForSearch(query);
        const shortQuery = simplifyQuery(sanitizedQuery, 5, options?.location);
        const cleanQuery = shortQuery.replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.BDTD);

        if (options?.onProgress) options.onProgress({ message: 'Consultando BDTD (Brasil)...' });
        console.log(`[BDTD] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://bdtd.ibict.br/vufind/api/v1/search?lookfor=${encodeURIComponent(cleanQuery)}&type=AllFields&limit=${limit}`;
        const res = await fetchWithTimeout(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'LetXipu-Search-MCP/5.0'
            }
        }, latamTimeout(options));

        let records: any[] = [];
        if (res.ok) {
            const data = await safeJson(res, 'BDTD');
            records = data.records || [];
        }

        if (records.length < 5) {
            const portugueseQuery = convertToPortuguese(cleanQuery);
            if (portugueseQuery !== cleanQuery) {
                try {
                    const ptUrl = `https://bdtd.ibict.br/vufind/api/v1/search?lookfor=${encodeURIComponent(portugueseQuery)}&type=AllFields&limit=${limit}`;
                    const ptRes = await fetchWithTimeout(ptUrl, { headers: { 'Accept': 'application/json' } }, latamTimeout(options));
                    if (ptRes.ok) {
                        const ptData = await safeJson(ptRes, 'BDTD-PT');
                        const ptRecords = ptData.records || [];
                        const existingIds = new Set(records.map((r: any) => r.id));
                        for (const rec of ptRecords) {
                            if (!existingIds.has(rec.id)) {
                                records.push(rec);
                                existingIds.add(rec.id);
                            }
                        }
                    }
                } catch {
                    // Portuguese fallback is best-effort.
                }
            }
        }

        if (records.length === 0) {
            const { results: laRefResults, metadata } = await searchLaReferencia(cleanQuery, { ...options, countryFilter: 'BR' });
            return {
                results: laRefResults.map((r: any) => ({ ...r, source: 'BDTD (Brasil)' })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        return {
            results: mapVuFindRecords(records, 'BDTD (Brasil)', 'Brasil'),
            metadata: { isFallback: false }
        };
    } catch (e: any) {
        console.warn(`[BDTD] Exception: ${e.message}`);
        const { results: laRefResults, metadata } = await searchLaReferencia(query, { ...options, countryFilter: 'BR' });
        return {
            results: laRefResults.map((r: any) => ({ ...r, source: 'BDTD (Brasil)' })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

// =============================================================================
// ECUADOR: RRAAE (Red de Repositorios de Acceso Abierto del Ecuador)
// =============================================================================

export async function searchRraae(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    try {
        const cleanQuery = sanitizeQueryForSearch(query).replace(/["()]/g, ' ').trim();
        const limit = Math.min(options?.limit || 25, SEARCH_LIMITS.RRAAE);

        if (options?.onProgress) options.onProgress({ message: 'Consultando RRAAE (Ecuador)...' });
        console.log(`[RRAAE] Searching: "${cleanQuery.substring(0, 50)}..."`);

        const url = `https://rraae.cedia.edu.ec/vufind/api/v1/search?lookfor=${encodeURIComponent(cleanQuery)}&type=AllFields&limit=${limit}`;
        const res = await fetchWithTimeout(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'LetXipu-Search-MCP/5.0'
            }
        }, latamTimeout(options));

        if (!res.ok) {
            const { results: laRefResults, metadata } = await searchLaReferencia(cleanQuery, { ...options, countryFilter: 'EC' });
            return {
                results: laRefResults.map((r: any) => ({ ...r, source: 'RRAAE (Ecuador)' })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        const data = await safeJson(res, 'RRAAE');
        const records = data.records || [];

        if (records.length === 0) {
            const simplifiedQuery = simplifyQuery(cleanQuery, 3, options?.location);
            if (simplifiedQuery.length > 3 && simplifiedQuery !== cleanQuery) {
                try {
                    const retryUrl = `https://rraae.cedia.edu.ec/vufind/api/v1/search?lookfor=${encodeURIComponent(simplifiedQuery)}&type=AllFields&limit=${limit}`;
                    const retryRes = await fetchWithTimeout(retryUrl, { headers: { 'Accept': 'application/json' } }, SEARCH_LIMITS.TIMEOUT_STANDARD);
                    if (retryRes.ok) {
                        const retryData = await safeJson(retryRes, 'RRAAE-retry');
                        if (retryData.records?.length > 0) {
                            return {
                                results: mapVuFindRecords(retryData.records, 'RRAAE (Ecuador)', 'Ecuador'),
                                metadata: { isFallback: true }
                            };
                        }
                    }
                } catch {
                    // Simplified retry is best-effort.
                }
            }

            const { results: laRefResults, metadata } = await searchLaReferencia(cleanQuery, { ...options, countryFilter: 'EC' });
            return {
                results: laRefResults.map((r: any) => ({ ...r, source: 'RRAAE (Ecuador)' })),
                metadata: { ...metadata, isFallback: true }
            };
        }

        return {
            results: mapVuFindRecords(records, 'RRAAE (Ecuador)', 'Ecuador'),
            metadata: { isFallback: false }
        };
    } catch (e: any) {
        console.warn(`[RRAAE] Exception: ${e.message}`);
        const { results: laRefResults, metadata } = await searchLaReferencia(query, { ...options, countryFilter: 'EC' });
        return {
            results: laRefResults.map((r: any) => ({ ...r, source: 'RRAAE (Ecuador)' })),
            metadata: { ...metadata, isFallback: true }
        };
    }
}

export const searchEspana = createLaReferenciaCountrySearch('ES', 'Recolecta (Espana)', '[ESPANA]');
export const searchCostaRica = createLaReferenciaCountrySearch('CR', 'KIMUK (Costa Rica)', '[COSTA_RICA]');
export const searchUruguay = createLaReferenciaCountrySearch('UY', 'Timbo (Uruguay)', '[URUGUAY]');
export const searchElSalvador = createLaReferenciaCountrySearch('SV', 'REDICCES (El Salvador)', '[EL_SALVADOR]');

// V5: Country-filtered La Referencia providers for country groups
export const searchLaReferenciaPeru = createLaReferenciaCountrySearch('PE', 'La Referencia (Perú)', '[LAREF_PE]');
export const searchLaReferenciaBrasil = createLaReferenciaCountrySearch('BR', 'La Referencia (Brasil)', '[LAREF_BR]');
export const searchLaReferenciaEcuador = createLaReferenciaCountrySearch('EC', 'La Referencia (Ecuador)', '[LAREF_EC]');
export const searchLaReferenciaMexico = createLaReferenciaCountrySearch('MX', 'La Referencia (México)', '[LAREF_MX]');
export const searchLaReferenciaArgentina = createLaReferenciaCountrySearch('AR', 'La Referencia (Argentina)', '[LAREF_AR]');
export const searchLaReferenciaColombia = createLaReferenciaCountrySearch('CO', 'La Referencia (Colombia)', '[LAREF_CO]');
export const searchLaReferenciaChile = createLaReferenciaCountrySearch('CL', 'La Referencia (Chile)', '[LAREF_CL]');
