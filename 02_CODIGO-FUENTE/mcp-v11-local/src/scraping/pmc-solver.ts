import { createHash } from 'crypto';

export function isPmcPowChallenge(html: string): boolean {
    return (html.includes('POW_CHALLENGE') && html.includes('ncbi.pmc.pow')) ||
        html.includes('cloudpmc-viewer-pow') ||
        (html.includes('Preparing to download') && html.includes('POW_DIFFICULTY'));
}

interface PmcPowParams {
    challenge: string;
    difficulty: number;
    cookieName: string;
    cookiePath: string;
}

function extractPmcPowParams(html: string): PmcPowParams | null {
    const challengeMatch = html.match(/POW_CHALLENGE\s*=\s*"([^"]+)"/);
    if (!challengeMatch) return null;

    const difficultyMatch = html.match(/POW_DIFFICULTY\s*=\s*"(\d+)"/);
    const cookieNameMatch = html.match(/POW_COOKIE_NAME\s*=\s*"([^"]+)"/);
    const cookiePathMatch = html.match(/POW_COOKIE_PATH\s*=\s*"([^"]+)"/);

    return {
        challenge: challengeMatch[1],
        difficulty: parseInt(difficultyMatch?.[1] || '4', 10),
        cookieName: cookieNameMatch?.[1] || 'cloudpmc-viewer-pow',
        cookiePath: cookiePathMatch?.[1] || '/'
    };
}

function solvePow(challenge: string, difficulty: number): { nonce: number; hash: string } {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    const maxIterations = 5_000_000;

    while (nonce < maxIterations) {
        const input = challenge + nonce.toString();
        const hash = createHash('sha256').update(input).digest('hex');
        if (hash.startsWith(prefix)) {
            return { nonce, hash };
        }
        nonce++;
    }

    throw new Error(`PMC PoW: exceeded ${maxIterations} iterations`);
}

export function extractPmcId(url: string): string | null {
    const match = url.match(/\/(?:articles|pmc\/articles)\/(PMC\d+)/i);
    return match ? match[1] : null;
}

export function buildPmcPdfUrl(pmcId: string): string {
    return `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/pdf/`;
}

const PMC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

export async function fetchPmcPdfWithPow(pdfUrl: string): Promise<{ buffer: ArrayBuffer; finalUrl: string } | null> {
    try {
        console.log(`[PMC-PoW] Fetching: ${pdfUrl}`);
        const res = await fetch(pdfUrl, {
            headers: PMC_HEADERS,
            redirect: 'follow',
            signal: AbortSignal.timeout(15000)
        });

        if (!res.ok) {
            console.log(`[PMC-PoW] HTTP ${res.status} for ${pdfUrl}`);
            return null;
        }

        const buf = await res.arrayBuffer();
        const header = new Uint8Array(buf.slice(0, 5));
        if (String.fromCharCode(...header).startsWith('%PDF-')) {
            console.log(`[PMC-PoW] Direct PDF (no PoW) - ${buf.byteLength} bytes`);
            return { buffer: buf, finalUrl: res.url };
        }

        const html = Buffer.from(buf).toString('utf-8');
        if (!isPmcPowChallenge(html)) {
            console.log(`[PMC-PoW] Not a PoW challenge page`);
            return null;
        }

        const params = extractPmcPowParams(html);
        if (!params) {
            console.log(`[PMC-PoW] Could not extract PoW parameters`);
            return null;
        }

        console.log(`[PMC-PoW] Challenge: ${params.challenge.substring(0, 30)}... difficulty=${params.difficulty}`);
        const startTime = Date.now();
        const { nonce, hash } = solvePow(params.challenge, params.difficulty);
        const elapsed = Date.now() - startTime;
        console.log(`[PMC-PoW] Solved nonce=${nonce} hash=${hash.substring(0, 16)}... time=${elapsed}ms`);

        const cookieValue = `${params.challenge},${nonce}`;
        const cookie = `${params.cookieName}=${cookieValue}`;

        const pdfRes = await fetch(pdfUrl, {
            headers: { ...PMC_HEADERS, 'Cookie': cookie },
            redirect: 'follow',
            signal: AbortSignal.timeout(20000)
        });

        if (!pdfRes.ok) {
            console.log(`[PMC-PoW] Re-fetch failed: HTTP ${pdfRes.status}`);
            return null;
        }

        const pdfBuf = await pdfRes.arrayBuffer();
        const pdfHeader = new Uint8Array(pdfBuf.slice(0, 5));
        if (String.fromCharCode(...pdfHeader).startsWith('%PDF-')) {
            console.log(`[PMC-PoW] PDF retrieved successfully (${pdfBuf.byteLength} bytes)`);
            return { buffer: pdfBuf, finalUrl: pdfRes.url };
        }

        const retryHtml = Buffer.from(pdfBuf).toString('utf-8');
        if (isPmcPowChallenge(retryHtml)) {
            console.log(`[PMC-PoW] Got another PoW challenge after solving, retrying...`);
            const retryParams = extractPmcPowParams(retryHtml);
            if (retryParams) {
                const retry = solvePow(retryParams.challenge, retryParams.difficulty);
                const retryCookie = `${retryParams.cookieName}=${retryParams.challenge},${retry.nonce}`;
                console.log(`[PMC-PoW] Retry solved nonce=${retry.nonce}`);

                const finalRes = await fetch(pdfUrl, {
                    headers: { ...PMC_HEADERS, 'Cookie': retryCookie },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(20000)
                });

                if (finalRes.ok) {
                    const finalBuf = await finalRes.arrayBuffer();
                    const finalHeader = new Uint8Array(finalBuf.slice(0, 5));
                    if (String.fromCharCode(...finalHeader).startsWith('%PDF-')) {
                        console.log(`[PMC-PoW] Retry PDF OK (${finalBuf.byteLength} bytes)`);
                        return { buffer: finalBuf, finalUrl: finalRes.url };
                    }
                }
            }
        }

        console.log(`[PMC-PoW] Re-fetch did not return PDF`);
        return null;
    } catch (e: any) {
        console.error(`[PMC-PoW] Error: ${e.message}`);
        return null;
    }
}

function extractPdfUrlFromHtml(html: string): string | null {
    const pdfMeta = html.match(/<meta[^>]+name="citation_pdf_url"[^>]+content="([^"]+)"/i) ||
        html.match(/<meta[^>]+content="([^"]+)"[^>]+name="citation_pdf_url"/i);
    if (pdfMeta?.[1]) return pdfMeta[1];
    const pdfLinkMatch = html.match(/href="([^"]*\/pdf\/[^"]+\.pdf)"/i);
    if (pdfLinkMatch?.[1]) {
        return pdfLinkMatch[1].startsWith('/') ? `https://pmc.ncbi.nlm.nih.gov${pdfLinkMatch[1]}` : pdfLinkMatch[1];
    }
    return null;
}

async function solvePmcChallengeAndFetch(url: string, html: string): Promise<{ buffer: ArrayBuffer; finalUrl: string } | null> {
    const params = extractPmcPowParams(html);
    if (!params) return null;
    const { nonce } = solvePow(params.challenge, params.difficulty);
    const cookie = `${params.cookieName}=${params.challenge},${nonce}`;
    const res = await fetch(url, { headers: { ...PMC_HEADERS, 'Cookie': cookie }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const retryHtml = await res.text();
    const pdfUrl = extractPdfUrlFromHtml(retryHtml);
    return pdfUrl ? fetchPmcPdfWithPow(pdfUrl) : null;
}

export async function resolvePmcPdf(url: string): Promise<{ buffer: ArrayBuffer; finalUrl: string } | null> {
    const pmcId = extractPmcId(url);

    if (url.includes('/pdf/')) {
        const result = await fetchPmcPdfWithPow(url);
        if (result) return result;
    }

    if (pmcId) {
        const pdfDirUrl = buildPmcPdfUrl(pmcId);
        if (pdfDirUrl !== url) {
            const result = await fetchPmcPdfWithPow(pdfDirUrl);
            if (result) return result;
        }

        const articleUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/`;
        try {
            console.log(`[PMC-PoW] Fetching article page for PDF link: ${articleUrl}`);
            const artRes = await fetch(articleUrl, { headers: PMC_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) });
            if (artRes.ok) {
                const artHtml = await artRes.text();
                if (isPmcPowChallenge(artHtml)) {
                    const result = await solvePmcChallengeAndFetch(articleUrl, artHtml);
                    if (result) return result;
                } else {
                    const pdfUrl = extractPdfUrlFromHtml(artHtml);
                    if (pdfUrl) {
                        console.log(`[PMC-PoW] Found PDF URL: ${pdfUrl}`);
                        const pdfResult = await fetchPmcPdfWithPow(pdfUrl);
                        if (pdfResult) return pdfResult;
                    }
                }
            }
        } catch (e: any) { console.log(`[PMC-PoW] Article page fetch failed: ${e.message}`); }
    }
    return null;
}

export function isPmcUrl(url: string): boolean {
    return /pmc\.ncbi\.nlm\.nih\.gov\/articles\//i.test(url) ||
        /ncbi\.nlm\.nih\.gov\/pmc\/articles\//i.test(url) ||
        /pubmed\.ncbi\.nlm\.nih\.gov\//i.test(url);
}
