/**
 * POST /api/pdf/download — Resolve and download PDF from any source
 */

import { Router, Request, Response } from 'express';
import { resilientFetch } from '../scraping/resilient-fetch';
import { resolveHandleUrl } from '../scraping/handle-map';
import { extractMetadataFromHtml } from '../scraping/metadata-extractor';
import { isPmcUrl, resolvePmcPdf, buildPmcPdfUrl, extractPmcId } from '../scraping/pmc-solver';
import { fetchWithTimeout } from '../providers/base';
import { resolvePdfBuffer, extractDoiFromSource } from '../providers/pdf-resolver';

const router = Router();

// LetXinet Suite 1.1.3: Sci-Hub queda desactivado (riesgo legal). Ya no hay espejos por
// defecto: download_pdf solo usa Unpaywall y las fuentes abiertas, salvo que quien opera la
// Suite escriba una lista explicita en SCIHUB_MIRRORS.
function loadScihubMirrors(): string[] {
    const raw = process.env.SCIHUB_MIRRORS || '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}
const SCIHUB_MIRRORS = loadScihubMirrors();

// LetXinet Suite: Unpaywall and DOI resolver are also externalizable. The
// UNPAYWALL_EMAIL is required by Unpaywall's usage policy (must be a real
// contact); defaults to the legacy address so the build remains functional
// without configuration.
const UNPAYWALL_BASE_URL =
    process.env.UNPAYWALL_BASE_URL || 'https://api.unpaywall.org/v2';
const UNPAYWALL_EMAIL =
    process.env.UNPAYWALL_EMAIL || 'letxipu@search.mcp';
const DOI_RESOLVER_URL =
    process.env.DOI_RESOLVER_URL || 'https://doi.org';

async function tryScihubUrl(doi: string): Promise<string | null> {
    for (const mirror of SCIHUB_MIRRORS) {
        try {
            const url = `${mirror}/${doi}`;
            const res = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,*/*',
                },
                redirect: 'follow',
            }, 10000);

            if (!res.ok) continue;

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/pdf')) {
                return res.url; // Direct PDF URL
            }

            const html = await res.text();
            const pdfMatch =
                html.match(/<iframe[^>]+src=["']([^"']+\.pdf[^"']*)/i) ||
                html.match(/<embed[^>]+src=["']([^"']+\.pdf[^"']*)/i) ||
                html.match(/<iframe[^>]+src=["']([^"']+)/i);

            if (pdfMatch) {
                let pdfUrl = pdfMatch[1];
                if (pdfUrl.startsWith('//')) pdfUrl = 'https:' + pdfUrl;
                else if (pdfUrl.startsWith('/')) pdfUrl = mirror + pdfUrl;
                return pdfUrl;
            }
        } catch { }
    }
    return null;
}

async function resolvePdfUrl(input: string): Promise<string | null> {
    // Direct PDF URL
    if (input.toLowerCase().endsWith('.pdf')) return input;

    // DOI
    if (input.match(/^10\.\d{4,}\//)) {
        // Try Unpaywall
        try {
            const unpRes = await fetchWithTimeout(`${UNPAYWALL_BASE_URL}/${encodeURIComponent(input)}?email=${encodeURIComponent(UNPAYWALL_EMAIL)}`, {}, 8000);
            if (unpRes.ok) {
                const data = await unpRes.json() as any;
                if (data.best_oa_location?.url_for_pdf) return data.best_oa_location.url_for_pdf;
                if (data.best_oa_location?.url) return data.best_oa_location.url;
            }
        } catch { }

        // Try Sci-Hub
        try {
            const scihubUrl = await tryScihubUrl(input);
            if (scihubUrl) return scihubUrl;
        } catch { }

        return `${DOI_RESOLVER_URL}/${input}`;
    }

    // PMC URL
    if (isPmcUrl(input)) {
        const pmcId = extractPmcId(input);
        if (pmcId) return buildPmcPdfUrl(pmcId);
        return input;
    }

    // Handle URL
    if (input.includes('handle') || input.includes('hdl.handle.net')) {
        const { url: resolvedUrl } = resolveHandleUrl(input);
        try {
            const { html } = await resilientFetch(resolvedUrl, 2, 10000);
            const meta = extractMetadataFromHtml(html);
            if (meta.pdfUrl) return meta.pdfUrl;
        } catch { }
        return resolvedUrl;
    }

    // Generic URL — try to find PDF link
    try {
        const { html } = await resilientFetch(input, 2, 10000);
        const meta = extractMetadataFromHtml(html);
        if (meta.pdfUrl) return meta.pdfUrl;
    } catch { }

    return input;
}

router.post('/', async (req: Request, res: Response) => {
    try {
        const { url, doi, returnUrl = false } = req.body;
        const input = url || (doi ? (doi.startsWith('10.') ? doi : `10.${doi}`) : null);
        if (!input) return res.status(400).json({ success: false, error: 'Provide "url" or "doi"' });

        console.log(`[PDF] Resolving: ${input}`);

        // PMC special handling with PoW solver
        if (isPmcUrl(input)) {
            const result = await resolvePmcPdf(input);
            if (result) {
                if (returnUrl) return res.json({ success: true, data: { pdfUrl: result.finalUrl, size: result.buffer.byteLength } });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="paper.pdf"`);
                return res.send(Buffer.from(result.buffer));
            }
        }

        // Resolve PDF URL
        const pdfUrl = await resolvePdfUrl(input);
        if (!pdfUrl) return res.status(404).json({ success: false, error: 'Could not resolve PDF URL' });

        if (returnUrl) return res.json({ success: true, data: { pdfUrl } });

        // Download and proxy
        console.log(`[PDF] Downloading: ${pdfUrl}`);
        const pdfRes = await fetch(pdfUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/pdf,*/*'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(30000)
        });

        if (!pdfRes.ok) return res.status(pdfRes.status).json({ success: false, error: `Download failed: HTTP ${pdfRes.status}` });

        const buffer = Buffer.from(await pdfRes.arrayBuffer());
        const isPdf = buffer.slice(0, 5).toString().startsWith('%PDF-');

        if (isPdf) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length.toString());
            res.setHeader('Content-Disposition', 'attachment; filename="paper.pdf"');
            return res.send(buffer);
        }

        // Not a PDF — return URL instead
        res.json({ success: true, data: { pdfUrl, note: 'URL resolved but content is not PDF. Visit the URL directly.' } });
    } catch (e: any) {
        console.error('[PDF] Error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
