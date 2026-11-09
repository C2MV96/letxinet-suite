const DOCUMENT_QUERY = String.raw`[A-Za-z0-9._~!$&'()*+,;=:@/?%-]*`;

const BAD_DOCUMENT_HINTS = [
    /thumbnail/i,
    /preview/i,
    /\/license(?:[_.-]|$)/i,
    /license_rdf/i,
    /cc-license/i,
    /creativecommons/i,
    /application\/rdf\+xml/i,
    /\.(?:jpg|jpeg|png|gif|svg|webp|bmp|xml|rdf)(?:$|[?#])/i,
    /\.pdf\.(?:jpg|jpeg|png|gif|webp)(?:$|[?#]?)/i,
];

const DOCUMENT_URL_PATTERNS = [
    new RegExp(String.raw`^(https?:\/\/.*?\/bitstreams\/[0-9a-f]{8,}(?:-[0-9a-f]{4,}){3}-[0-9a-f]{12}\/download)(?:[?#]${DOCUMENT_QUERY})?`, 'i'),
    new RegExp(String.raw`^(https?:\/\/.*?\/(?:server\/|backend\/|dspace-spring-rest\/)?api\/core\/bitstreams\/[0-9a-f]{8,}(?:-[0-9a-f]{4,}){3}-[0-9a-f]{12}\/(?:content|download))(?:[?#]${DOCUMENT_QUERY})?`, 'i'),
    new RegExp(String.raw`^(https?:\/\/.*?\/bitstream\/(?:handle\/)?[^"'<>?#\s]+?\.pdf)(?:[?#]${DOCUMENT_QUERY})?`, 'i'),
    new RegExp(String.raw`^(https?:\/\/.*?\.pdf)(?:[?#]${DOCUMENT_QUERY})?`, 'i'),
    new RegExp(String.raw`^(https?:\/\/.*?\.txt)(?:[?#]${DOCUMENT_QUERY})?`, 'i'),
];

function decodeBasicEntities(value: string): string {
    return value
        .replace(/&amp;/gi, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'");
}

function stripObviousJunk(value: string): string {
    let out = value.trim().replace(/^url\((['"]?)(.*?)\1\)$/i, '$2');
    const secondUrl = out.slice(8).search(/https?:\/\//i);
    if (secondUrl >= 0) out = out.slice(0, secondUrl + 8);
    return out.replace(/[)\],.;]+$/g, '');
}

function absoluteUrl(value: string, baseUrl?: string): string | null {
    try {
        if (/^https?:\/\//i.test(value)) return new URL(value).href;
        if (baseUrl) return new URL(value, baseUrl).href;
        return null;
    } catch {
        return null;
    }
}

export function hasBadDocumentHint(value: string): boolean {
    return BAD_DOCUMENT_HINTS.some((pattern) => pattern.test(value));
}

export function sanitizeDocumentUrl(rawUrl: string, baseUrl?: string): string | null {
    if (!rawUrl) return null;
    const decoded = stripObviousJunk(decodeBasicEntities(rawUrl));
    if (/\.pdf\.(?:jpg|jpeg|png|gif|webp)(?:$|[?#]?)/i.test(decoded) || /thumbnail|preview/i.test(decoded)) {
        return null;
    }

    const abs = absoluteUrl(decoded, baseUrl);
    if (!abs) return null;

    for (const pattern of DOCUMENT_URL_PATTERNS) {
        const match = abs.match(pattern);
        if (match?.[0]) {
            const clean = match[0].replace(/[)\],.;]+$/g, '');
            return hasBadDocumentHint(clean) ? null : clean;
        }
    }
    return null;
}

export function collectDocumentCandidateUrls(text: string, baseUrl?: string): string[] {
    const candidates: string[] = [];
    const add = (raw: string) => {
        const clean = sanitizeDocumentUrl(raw, baseUrl);
        if (clean && !candidates.includes(clean)) candidates.push(clean);
    };

    const attrRe = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = attrRe.exec(text)) !== null) add(match[1]);

    const absRe = /https?:\/\/[^\s<"'&]+(?:bitstreams?\/|api\/core\/bitstreams\/|download|\.pdf|\.txt)[^\s<"']*/gi;
    while ((match = absRe.exec(text)) !== null) add(match[0]);

    return candidates.sort((a, b) => scoreDocumentUrl(b) - scoreDocumentUrl(a));
}

export function scoreDocumentUrl(url: string): number {
    const lower = url.toLowerCase();
    let score = 0;
    if (lower.endsWith('.pdf') || lower.includes('.pdf?')) score += 100;
    if (lower.includes('/bitstreams/') && lower.endsWith('/download')) score += 80;
    if (lower.includes('/api/core/bitstreams/') && (lower.endsWith('/content') || lower.endsWith('/download'))) score += 75;
    if (lower.includes('/bitstream/')) score += 65;
    if (lower.endsWith('.txt') || lower.includes('.txt?')) score += 25;
    if (hasBadDocumentHint(lower)) score -= 500;
    return score;
}

export function isLikelyPdfBuffer(buffer: Buffer): boolean {
    return buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
}

export function isDocumentContentType(contentType: string): 'pdf' | 'text' | null {
    const lower = contentType.toLowerCase();
    if (lower.includes('application/pdf')) return 'pdf';
    if (lower.includes('text/plain')) return 'text';
    if (lower.includes('application/octet-stream')) return 'pdf';
    return null;
}

export function isClearlyNonDocumentContentType(contentType: string): boolean {
    const lower = contentType.toLowerCase();
    return /text\/html|image\/|application\/(json|xml|rdf\+xml)|text\/xml/.test(lower);
}

export function safePublicPdfUrlForMineru(source: string): string | null {
    const clean = sanitizeDocumentUrl(source);
    if (!clean) return null;
    if (/^https?:\/\/(?:dx\.)?doi\.org\//i.test(clean)) return null;
    return /\.pdf(?:$|[?#])/i.test(clean) || /\/(?:bitstreams\/|bitstream\/|api\/core\/bitstreams\/)/i.test(clean)
        ? clean
        : null;
}

export function isSafePublicPdfUrlForMineru(source: string): boolean {
    return Boolean(safePublicPdfUrlForMineru(source));
}
