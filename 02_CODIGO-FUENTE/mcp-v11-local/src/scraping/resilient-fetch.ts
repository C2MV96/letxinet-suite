/**
 * Resilient HTTP Fetching Utilities v2
 * SSL bypass, retry logic, bot detection handling, modern anti-detection
 */

import https from 'node:https';
import http from 'node:http';

// ─── User-Agent Pool (Chrome 126-128, Firefox 127-128, Safari 17, Edge 126) ────
const USER_AGENTS = [
    // Chrome Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    // Chrome Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    // Chrome Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    // Firefox Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
    // Firefox Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
    // Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    // Brave (Chrome-based)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Brave/128',
    // Chrome Android (for mobile fallback)
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    // Opera
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OPR/113.0.0.0',
    // Vivaldi
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Vivaldi/6.8',
    // Chrome ChromeOS
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
];

const ACCEPT_LANGUAGES = [
    'es-PE,es;q=0.9,en;q=0.8',
    'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'en-US,en;q=0.9',
    'pt-BR,pt;q=0.9,en;q=0.8',
    'es-419,es;q=0.9,en;q=0.8',
];

export interface FetchResult {
    html: string;
    status: number;
    headers: Record<string, string>;
    finalUrl?: string;  // URL after redirects (for hdl.handle.net → repo resolution)
}

let _uaIndex = 0;
/**
 * Get rotating user agent (sequential, no repeats)
 */
export function getRandomUserAgent(): string {
    _uaIndex = (_uaIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[_uaIndex];
}

/**
 * Insecure fetch that bypasses SSL certificate validation
 */
export function insecureFetch(url: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const agent = url.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;

        const req = protocol.get(url, { headers, agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(new Error('ETIMEDOUT')); });
    });
}

// ─── Circuit Breaker with TTL auto-reset ────────────────────────

const _failedDomains = new Map<string, { count: number; lastFail: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // Auto-reset after 5 minutes

function getDomain(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
}

export function isDomainBlocked(url: string): boolean {
    const domain = getDomain(url);
    const entry = _failedDomains.get(domain);
    if (!entry) return false;
    // Auto-reset after TTL
    if (Date.now() - entry.lastFail > CIRCUIT_BREAKER_RESET_MS) {
        _failedDomains.delete(domain);
        return false;
    }
    return entry.count >= CIRCUIT_BREAKER_THRESHOLD;
}

function recordDomainFailure(url: string) {
    const domain = getDomain(url);
    const entry = _failedDomains.get(domain) || { count: 0, lastFail: 0 };
    entry.count++;
    entry.lastFail = Date.now();
    _failedDomains.set(domain, entry);
}

function clearDomainFailure(url: string) {
    _failedDomains.delete(getDomain(url));
}

// ─── Per-domain rate limiting ───────────────────────────────────

const _lastRequest = new Map<string, number>();
const DOMAIN_RATE_LIMITS: Record<string, number> = {
    'scholar.google.com': 20000,  // Max 1 req per 20s
    'www.google.com': 10000,
    'api.semanticscholar.org': 1000,
    'api.unpaywall.org': 500,
};

async function waitForRateLimit(url: string) {
    const domain = getDomain(url);
    const minDelay = DOMAIN_RATE_LIMITS[domain] || 300; // Default 300ms
    const lastReq = _lastRequest.get(domain) || 0;
    const elapsed = Date.now() - lastReq;
    if (elapsed < minDelay) {
        const wait = minDelay - elapsed + Math.floor(Math.random() * 500); // Add jitter
        await new Promise(r => setTimeout(r, wait));
    }
    _lastRequest.set(domain, Date.now());
}

/**
 * Build browser-realistic headers for a given URL
 */
function buildHeaders(url: string, ua: string): Record<string, string> {
    const isChrome = ua.includes('Chrome') && !ua.includes('Firefox');
    const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];

    const headers: Record<string, string> = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': lang,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    };

    // Chrome-like browsers send Sec-Fetch-* headers
    if (isChrome) {
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'cross-site';
        headers['Sec-Fetch-User'] = '?1';
        // Sec-Ch-Ua headers
        const chromeVer = ua.match(/Chrome\/(\d+)/)?.[1] || '128';
        headers['Sec-Ch-Ua'] = `"Chromium";v="${chromeVer}", "Google Chrome";v="${chromeVer}", "Not=A?Brand";v="8"`;
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = ua.includes('Windows') ? '"Windows"' : ua.includes('Mac') ? '"macOS"' : '"Linux"';
    }

    // Domain-specific referers
    const domain = getDomain(url);
    if (domain.includes('scholar.google')) {
        headers['Referer'] = 'https://www.google.com/';
    } else if (domain.includes('sci-hub')) {
        // No referer for Sci-Hub
    } else if (domain.endsWith('.edu.pe') || domain.endsWith('.gob.pe')) {
        // Fase 3.3: Peruvian academic/government repos require ALICIA as Referer (confirmed for ULIMA)
        headers['Referer'] = 'https://alicia.concytec.gob.pe/';
    } else {
        headers['Referer'] = 'https://www.google.com/';
    }

    return headers;
}

const TIMEOUT_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'AbortError'];
const SSL_ERRORS = ['fetch failed', 'SSL', 'CERT', 'ECONNRESET'];

function classifyError(msg: string, name: string): 'timeout' | 'ssl' | 'other' {
    if (TIMEOUT_ERRORS.some(e => msg.includes(e)) || name === 'AbortError') return 'timeout';
    if (SSL_ERRORS.some(e => msg.includes(e))) return 'ssl';
    return 'other';
}

/**
 * Resilient fetch with retries, rate limiting, modern anti-detection
 */
export async function resilientFetch(url: string, maxRetries = 3, timeoutMs = 15000): Promise<FetchResult> {
    if (isDomainBlocked(url)) {
        throw new Error(`Domain ${getDomain(url)} blocked by circuit breaker (auto-resets in 5min)`);
    }

    await waitForRateLimit(url);

    let lastError: any = null;
    const randomUA = getRandomUserAgent();
    const headers = buildHeaders(url, randomUA);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[SCRAPE] Attempt ${attempt + 1} for: ${url.substring(0, 80)}...`);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(url, {
                redirect: 'follow',
                headers,
                signal: controller.signal,
                next: { revalidate: 0 }
            } as RequestInit);
            clearTimeout(timer);

            // Rate limiting - exponential backoff with jitter
            if (response.status === 429 || response.status === 503) {
                const jitter = Math.floor(Math.random() * 2000);
                const delay = Math.pow(3, attempt + 1) * 1000 + jitter;
                console.warn(`[SCRAPE] Status ${response.status}. Waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            // Forbidden - try header rotation + different UA
            if (response.status === 403) {
                console.warn(`[SCRAPE] 403 on ${getDomain(url)}. Rotating UA (attempt ${attempt + 1})...`);
                Object.assign(headers, buildHeaders(url, getRandomUserAgent()));

                if (attempt === maxRetries - 1) {
                    console.warn(`[SCRAPE] Final attempt: insecure fallback.`);
                    const html = await insecureFetch(url, headers);
                    clearDomainFailure(url);
                    return { html, status: 200, headers };
                }
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
                continue;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            clearDomainFailure(url);
            return { html: await response.text(), status: response.status, headers, finalUrl: response.url || url };
        } catch (e: any) {
            lastError = e;
            const msg = e.message || '';
            const errType = classifyError(msg, e.name);
            console.warn(`[SCRAPE] ${msg.substring(0, 80)} on ${getDomain(url)}`);

            if (errType === 'timeout') {
                recordDomainFailure(url);
                if (isDomainBlocked(url)) {
                    console.warn(`[SCRAPE] Circuit breaker OPEN for ${getDomain(url)} (resets in 5min)`);
                    throw new Error(`Domain ${getDomain(url)} unreachable (circuit breaker, auto-resets)`);
                }
            } else if (errType === 'ssl') {
                console.warn(`[SSL/Fetch Error] Retrying insecure on ${getDomain(url)}...`);
                try {
                    const html = await insecureFetch(url, headers);
                    clearDomainFailure(url);
                    return { html, status: 200, headers };
                } catch (inner: any) {
                    console.error(`[SCRAPE] Insecure fallback also failed: ${inner.message}`);
                    lastError = inner;
                }
            }
            await new Promise(r => setTimeout(r, Math.min(Math.pow(2, attempt) * 1000, 5000)));
        }
    }
    recordDomainFailure(url);
    throw lastError;
}

/**
 * Bot/security challenge detection keywords
 */
const BOT_KEYWORDS = [
    "Making sure you're not a bot",
    'Cloudflare',
    'security challenge',
    'automated access',
    'blocked for security',
    'Just a moment',
    'cf-browser-verification',
    'anubis_challenge',
    'captcha',
    'recaptcha',
];

/**
 * Check if HTML contains bot detection challenge
 */
export function detectBotChallenge(html: string): boolean {
    return BOT_KEYWORDS.some(key => html.toLowerCase().includes(key.toLowerCase()));
}
