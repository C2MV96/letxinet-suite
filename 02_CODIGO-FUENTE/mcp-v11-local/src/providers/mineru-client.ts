/**
 * MinerU Client — Multi-format document → Markdown via MinerU Cloud API
 * Replaces markitdown-client.ts from v6 (pymupdf4llm).
 * 
 * Supported formats: PDF, DOCX, PPTX, XLSX, Images (PNG, JPG, TIFF)
 * 
 * Modes:
 *   - Flash (no token): 20 pages / 10MB per file, IP rate-limited
 *   - Precision (with token): 200 pages / 200MB, 5000 pages/day
 * 
 * Fallback: pdf-parse npm for basic text extraction when API is unavailable.
 */

import * as fs from 'fs';
import * as path from 'path';
import { safePublicPdfUrlForMineru } from '../utils/document-url';

// ─── Configuration ──────────────────────────────────────────────

const MINERU_API_URL = (process.env.MINERU_API_URL || 'https://mineru.net/api/v4').replace(/\/$/, '');
const MINERU_API_KEY = process.env.MINERU_API_KEY || '';
const MINERU_TIMEOUT = parseInt(process.env.MINERU_TIMEOUT || '300000', 10); // 5 min default

// ─── Types ──────────────────────────────────────────────────────

export interface MineruResult {
    markdown: string;
    chars: number;
    lines: number;
    pages?: number;
    format: string;
    source: 'mineru-api' | 'pdf-parse';
    contentBlocks?: number;
    tables?: number;
    formulas?: number;
    images?: number;
}

/** Alias for backward compatibility with pdf-processor.ts */
export interface MarkdownResult {
    markdown: string;
    chars: number;
    lines: number;
    pages: number;
    source: 'mineru-api' | 'pdf-parse';
}

export interface MineruHealth {
    available: boolean;
    mode: 'precision' | 'flash' | 'unavailable';
    supportedFormats: string[];
    apiUrl: string;
}

// ─── Supported Formats ─────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
    '.pdf', '.docx', '.pptx', '.xlsx',
    '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp',
]);

export function isSupportedFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
}

export function detectFormat(filename: string, buffer?: Buffer): string {
    const ext = path.extname(filename).toLowerCase();
    const formatMap: Record<string, string> = {
        '.pdf': 'pdf', '.docx': 'docx', '.pptx': 'pptx', '.xlsx': 'xlsx',
        '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
        '.tiff': 'image', '.tif': 'image', '.bmp': 'image', '.webp': 'image',
    };
    const detected = formatMap[ext] || 'unknown';
    if (detected !== 'unknown') return detected;
    // Fallback: detect by magic bytes when extension is missing (e.g. arxiv.org URLs without .pdf)
    if (buffer && buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
    return 'unknown';
}

export function getSupportedFormats(): string[] {
    return [...SUPPORTED_EXTENSIONS].map(e => e.slice(1));
}

// ─── Cache ──────────────────────────────────────────────────────

const markdownCache: Map<string, { result: MineruResult; timestamp: number }> = new Map();
const MARKDOWN_CACHE_TTL = 15 * 60 * 1000; // 15 min

// ─── Health Check ───────────────────────────────────────────────

let mineruAvailable: boolean | null = null;
let mineruCheckTimestamp = 0;
const HEALTH_CHECK_TTL = 60 * 1000; // Re-check every 60s

/**
 * Check if MinerU API is available and determine mode (precision/flash)
 */
export async function checkMineruHealth(): Promise<MineruHealth> {
    if (mineruAvailable !== null && Date.now() - mineruCheckTimestamp < HEALTH_CHECK_TTL) {
        return {
            available: mineruAvailable,
            mode: MINERU_API_KEY ? 'precision' : 'flash',
            supportedFormats: getSupportedFormats(),
            apiUrl: MINERU_API_URL,
        };
    }

    // No /health endpoint — test with a lightweight API call
    if (!MINERU_API_KEY) {
        mineruAvailable = false;
        mineruCheckTimestamp = Date.now();
        return {
            available: false,
            mode: 'unavailable',
            supportedFormats: ['pdf'], // MarkItDown/pdf-parse fallback
            apiUrl: MINERU_API_URL,
        };
    }

    try {
        // Quick connectivity test: HEAD request to the API domain
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${MINERU_API_URL}/extract/task`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${MINERU_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // Empty body → will return error but proves API is reachable
        });
        clearTimeout(timeout);

        // Any response (even 400) means API is reachable
        mineruAvailable = true;
        console.log(`[MinerU] ✅ API reachable (precision mode) at ${MINERU_API_URL}`);

        mineruCheckTimestamp = Date.now();
        return {
            available: true,
            mode: 'precision',
            supportedFormats: getSupportedFormats(),
            apiUrl: MINERU_API_URL,
        };
    } catch (e: any) {
        mineruAvailable = false;
        mineruCheckTimestamp = Date.now();
        console.warn(`[MinerU] ⚠️ API not reachable: ${e.message}`);
        return {
            available: false,
            mode: 'unavailable',
            supportedFormats: ['pdf'],
            apiUrl: MINERU_API_URL,
        };
    }
}

/**
 * Check if document conversion is available (MinerU API or MarkItDown/pymupdf4llm)
 */
export async function isPythonAvailable(): Promise<boolean> {
    // If MinerU API key is configured, check API
    if (MINERU_API_KEY) {
        const health = await checkMineruHealth();
        if (health.available) return true;
    }
    // Otherwise check local MarkItDown/pymupdf4llm
    try {
        const markitdown = require('./markitdown-client');
        return await markitdown.isPythonAvailable();
    } catch {
        return false;
    }
}

// ─── Document Conversion ────────────────────────────────────────

/**
 * Convert a document buffer to Markdown via MinerU Cloud API.
 * Falls back to pdf-parse for PDFs if MinerU is unavailable.
 * 
 * @param buffer - Raw file buffer
 * @param filename - Original filename (for format detection)
 * @param cacheKey - Optional cache key (typically the source URL/path)
 */
export async function convertDocument(
    buffer: Buffer,
    filename: string,
    cacheKey?: string,
): Promise<MineruResult> {
    // Check cache first
    if (cacheKey) {
        const cached = markdownCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < MARKDOWN_CACHE_TTL) {
            console.log(`[MinerU] Cache HIT: ${cacheKey.substring(0, 60)}`);
            return cached.result;
        }
    }

    const format = detectFormat(filename, buffer);

    // Strategy: MINERU_API_KEY configured → MinerU Cloud API
    //           No key + PDF → MarkItDown/pymupdf4llm (local Python)
    //           MarkItDown fails → pdf-parse (basic text, last resort)

    // 1. Try MinerU API if configured
    const mineruPublicUrl = cacheKey ? safePublicPdfUrlForMineru(cacheKey) : null;
    if (MINERU_API_KEY && mineruPublicUrl) {
        try {
            const health = await checkMineruHealth();
            if (health.available) {
                const result = await callMineruApi(buffer, filename, format, mineruPublicUrl);

                if (cacheKey) {
                    markdownCache.set(cacheKey, { result, timestamp: Date.now() });
                    console.log(`[MinerU] ✅ Converted (${result.source}): ${result.chars} chars, format=${format} (cached)`);
                } else {
                    console.log(`[MinerU] ✅ Converted (${result.source}): ${result.chars} chars, format=${format}`);
                }

                return result;
            }
        } catch (e: any) {
            console.warn(`[MinerU] API conversion failed: ${e.message}`);
        }
    }

    // 2. Fallback to MarkItDown/pymupdf4llm for PDFs (local Python)
    if (format === 'pdf') {
        try {
            const markitdown = require('./markitdown-client');
            const pyAvailable = await markitdown.isPythonAvailable();
            if (pyAvailable) {
                console.log(`[MinerU] No API key — falling back to MarkItDown (pymupdf4llm)`);
                const mdResult = await markitdown.convertToMarkdown(buffer, cacheKey);
                const result: MineruResult = {
                    markdown: mdResult.markdown,
                    chars: mdResult.chars,
                    lines: mdResult.lines,
                    pages: mdResult.pages,
                    format: 'pdf',
                    source: 'pdf-parse', // compatible type
                };
                if (cacheKey) {
                    markdownCache.set(cacheKey, { result, timestamp: Date.now() });
                }
                return result;
            }
        } catch (e: any) {
            console.warn(`[MinerU] MarkItDown fallback failed: ${e.message}`);
        }

        // 3. Last resort: pdf-parse (basic text extraction)
        console.log(`[MinerU] Falling back to pdf-parse (basic text)`);
        return await pdfParseFallback(buffer, cacheKey);
    }

    throw new Error(`No MINERU_API_KEY configured and no local fallback for format "${format}". Set MINERU_API_KEY in your MCP config or install Python + pymupdf4llm for PDF fallback.`);
}

/**
 * Backward-compatible function (replaces convertToMarkdown from v6)
 */
export async function convertToMarkdown(
    pdfBuffer: Buffer,
    cacheKey?: string,
    pages?: number[],
): Promise<MarkdownResult> {
    const result = await convertDocument(pdfBuffer, 'document.pdf', cacheKey);
    return {
        markdown: result.markdown,
        chars: result.chars,
        lines: result.lines,
        pages: result.pages || 0,
        source: result.source,
    };
}

/**
 * Call MinerU API to convert document.
 * Flow: POST /extract/task (submit URL) → GET /extract/task/{id} (poll) → download ZIP → extract full.md
 * 
 * NOTE: MinerU API works with URLs, not file uploads.
 * The source URL must be passed via convertDocument's cacheKey parameter.
 */
async function callMineruApi(buffer: Buffer, filename: string, format: string, sourceUrl?: string): Promise<MineruResult> {
    if (!sourceUrl || !sourceUrl.startsWith('http')) {
        throw new Error('MinerU Cloud API requires a public URL. Local files use MarkItDown fallback.');
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINERU_API_KEY}`,
    };

    console.log(`[MinerU] Submitting ${filename} (URL: ${sourceUrl.substring(0, 80)}...) to API...`);

    // Step 1: Submit task
    const submitRes = await fetch(`${MINERU_API_URL}/extract/task`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            url: sourceUrl,
            enable_formula: true,
            enable_table: true,
            is_ocr: false,
        }),
        signal: AbortSignal.timeout(30000),
    });

    const submitData = await submitRes.json() as any;
    if (submitData.code !== 0) {
        throw new Error(`MinerU submit failed: ${submitData.msg || JSON.stringify(submitData)}`);
    }

    const taskId = submitData.data?.task_id;
    if (!taskId) throw new Error('MinerU API did not return a task_id');
    console.log(`[MinerU] Task submitted: ${taskId}`);

    // Step 2: Poll for completion (max ~5 min)
    const maxPolls = 60;
    const pollInterval = 5000; // 5 seconds
    let resultData: any = null;

    for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, pollInterval));

        const pollRes = await fetch(`${MINERU_API_URL}/extract/task/${taskId}`, {
            headers: { 'Authorization': `Bearer ${MINERU_API_KEY}` },
            signal: AbortSignal.timeout(15000),
        });
        const pollData = await pollRes.json() as any;
        const state = pollData.data?.state;

        if (state === 'done') {
            resultData = pollData.data;
            console.log(`[MinerU] ✅ Task done (poll ${i + 1})`);
            break;
        } else if (state === 'failed' || state === 'error') {
            throw new Error(`MinerU task failed: ${pollData.data?.err_msg || 'unknown error'}`);
        }
        // else: still processing, continue polling
    }

    if (!resultData) {
        throw new Error(`MinerU task ${taskId} timed out after ${maxPolls * pollInterval / 1000}s`);
    }

    // Step 3: Download ZIP and extract full.md
    const zipUrl = resultData.full_zip_url;
    if (!zipUrl) throw new Error('MinerU task completed but no ZIP URL returned');

    console.log(`[MinerU] Downloading result ZIP...`);
    const zipRes = await fetch(zipUrl, { signal: AbortSignal.timeout(60000) });
    if (!zipRes.ok) throw new Error(`Failed to download ZIP: HTTP ${zipRes.status}`);

    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

    // Extract full.md from ZIP (simple ZIP parser — full.md is at known path)
    const markdown = extractMarkdownFromZip(zipBuffer);
    const contentList = extractContentListFromZip(zipBuffer);

    return {
        markdown,
        chars: markdown.length,
        lines: markdown.split('\n').length,
        pages: undefined,
        format,
        source: 'mineru-api',
        contentBlocks: contentList.length || undefined,
        tables: contentList.filter((b: any) => b.type === 'table').length || undefined,
        formulas: contentList.filter((b: any) => b.type === 'equation' || b.type === 'formula').length || undefined,
        images: contentList.filter((b: any) => b.type === 'image').length || undefined,
    };
}

/**
 * Extract full.md content from a ZIP buffer.
 * Uses simple ZIP parsing (no external dependency) — looks for the file ending in 'full.md'.
 */
function extractMarkdownFromZip(zipBuffer: Buffer): string {
    // ZIP local file header signature: PK\x03\x04
    let offset = 0;
    while (offset < zipBuffer.length - 4) {
        const sig = zipBuffer.readUInt32LE(offset);
        if (sig !== 0x04034b50) break; // Not a local file header

        const fnLen = zipBuffer.readUInt16LE(offset + 26);
        const extraLen = zipBuffer.readUInt16LE(offset + 28);
        const compressedSize = zipBuffer.readUInt32LE(offset + 18);
        const filename = zipBuffer.toString('utf-8', offset + 30, offset + 30 + fnLen);
        const dataStart = offset + 30 + fnLen + extraLen;

        if (filename.endsWith('full.md')) {
            // Compression method 0 = stored (no compression)
            const method = zipBuffer.readUInt16LE(offset + 8);
            if (method === 0) {
                return zipBuffer.toString('utf-8', dataStart, dataStart + compressedSize);
            }
            // Method 8 = deflate — use zlib
            if (method === 8) {
                const zlib = require('zlib');
                const compressed = zipBuffer.slice(dataStart, dataStart + compressedSize);
                return zlib.inflateRawSync(compressed).toString('utf-8');
            }
        }

        offset = dataStart + compressedSize;
    }
    throw new Error('full.md not found in MinerU ZIP result');
}

/**
 * Extract content_list JSON from ZIP (for table/formula counts)
 */
function extractContentListFromZip(zipBuffer: Buffer): any[] {
    let offset = 0;
    while (offset < zipBuffer.length - 4) {
        const sig = zipBuffer.readUInt32LE(offset);
        if (sig !== 0x04034b50) break;

        const fnLen = zipBuffer.readUInt16LE(offset + 26);
        const extraLen = zipBuffer.readUInt16LE(offset + 28);
        const compressedSize = zipBuffer.readUInt32LE(offset + 18);
        const filename = zipBuffer.toString('utf-8', offset + 30, offset + 30 + fnLen);
        const dataStart = offset + 30 + fnLen + extraLen;

        if (filename.endsWith('content_list.json')) {
            try {
                const method = zipBuffer.readUInt16LE(offset + 8);
                let jsonStr: string;
                if (method === 0) {
                    jsonStr = zipBuffer.toString('utf-8', dataStart, dataStart + compressedSize);
                } else {
                    const zlib = require('zlib');
                    jsonStr = zlib.inflateRawSync(zipBuffer.slice(dataStart, dataStart + compressedSize)).toString('utf-8');
                }
                return JSON.parse(jsonStr);
            } catch { return []; }
        }

        offset = dataStart + compressedSize;
    }
    return [];
}

/**
 * Fallback: use pdf-parse npm for basic text extraction (PDF only)
 */
async function pdfParseFallback(buffer: Buffer, cacheKey?: string): Promise<MineruResult> {
    let pdfParse: any;
    try {
        pdfParse = require('pdf-parse');
    } catch {
        throw new Error('pdf-parse not available for fallback');
    }

    let text = '';
    let pages = 0;
    try {
        const data = await pdfParse(buffer);
        text = data.text || '';
        pages = data.numpages || 0;
    } catch (e: any) {
        console.warn(`[MinerU] pdf-parse fallback failed: ${e?.message || String(e)}`);
        text = '[Error extracting text with pdf-parse]';
    }

    const result: MineruResult = {
        markdown: text,
        chars: text.length,
        lines: text.split('\n').length,
        pages: pages,
        format: 'pdf',
        source: 'pdf-parse',
    };

    if (cacheKey) {
        markdownCache.set(cacheKey, { result, timestamp: Date.now() });
    }
    return result;
}

// ─── Batch Conversion ───────────────────────────────────────────

/**
 * Convert multiple documents in parallel
 */
export async function batchConvert(
    files: { buffer: Buffer; name: string }[],
    maxConcurrent: number = 5,
): Promise<{ name: string; result?: MineruResult; error?: string }[]> {
    const results: { name: string; result?: MineruResult; error?: string }[] = [];

    // Process in batches of maxConcurrent
    for (let i = 0; i < files.length; i += maxConcurrent) {
        const batch = files.slice(i, i + maxConcurrent);
        const batchResults = await Promise.allSettled(
            batch.map(f => convertDocument(f.buffer, f.name, f.name))
        );

        for (let j = 0; j < batch.length; j++) {
            const settled = batchResults[j];
            if (settled.status === 'fulfilled') {
                results.push({ name: batch[j].name, result: settled.value });
            } else {
                results.push({ name: batch[j].name, error: settled.reason?.message || 'Unknown error' });
            }
        }
    }

    return results;
}

// ─── Content Extraction (Tables, Formulas) ──────────────────────

/**
 * Extract only tables from a document's content_list
 */
export async function extractTablesFromDocument(
    buffer: Buffer,
    filename: string,
    outputFormat: 'html' | 'markdown' = 'html',
    cacheKey?: string,
): Promise<{ tables: string[]; count: number }> {
    const result = await convertDocument(buffer, filename, cacheKey);
    // Tables are embedded in the markdown — extract them.
    // LetXinet 1.1.3: MinerU devuelve tablas HTML, pero MarkItDown y pdf-parse devuelven tablas
    // Markdown (|...|). Antes, con el formato por defecto (html), sin MinerU nunca salia ninguna.
    const html = result.markdown.match(/<table[\s\S]*?<\/table>/gi) || [];
    const md = (result.markdown.match(/(?:^|\n)\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]*\|[^\S\n]*(?:\r?\n|$))*/g) || []).map(t => t.trim());
    const tables = outputFormat === 'html' ? (html.length ? html : md) : (md.length ? md : html);
    return { tables, count: tables.length };
}

/**
 * Extract mathematical formulas (LaTeX) from a document
 */
export async function extractFormulasFromDocument(
    buffer: Buffer,
    filename: string,
    cacheKey?: string,
): Promise<{ formulas: string[]; count: number }> {
    const result = await convertDocument(buffer, filename, cacheKey);
    // Extract LaTeX formulas from markdown
    const formulaPatterns = [
        /\$\$[\s\S]+?\$\$/g,           // Display math $$...$$
        /\\\[[\s\S]+?\\\]/g,           // Display math \[...\]
        /\$(?!\$)[^\n$]+?\$/g,         // Inline math $...$
        /\\\([\s\S]+?\\\)/g,           // Inline math \(...\)
    ];

    const formulas: Set<string> = new Set();
    for (const pattern of formulaPatterns) {
        const matches = result.markdown.match(pattern) || [];
        matches.forEach(m => formulas.add(m.trim()));
    }

    return { formulas: [...formulas], count: formulas.size };
}

// ─── Smart Truncation (migrated from markitdown-client.ts) ──────

/**
 * Smart truncation: truncate markdown at section boundaries
 * Instead of cutting mid-sentence, cuts at the nearest heading or paragraph break
 */
export function smartTruncate(markdown: string, maxChars: number): string {
    if (markdown.length <= maxChars) return markdown;

    const breakPatterns = [
        /\n#{1,6}\s/g,      // Heading boundary
        /\n---\n/g,          // Horizontal rule
        /\n\n/g,             // Paragraph break
        /\n/g,               // Line break
    ];

    let bestBreak = maxChars;

    for (const pattern of breakPatterns) {
        let match;
        let lastGoodMatch = -1;
        while ((match = pattern.exec(markdown)) !== null) {
            if (match.index <= maxChars && match.index > lastGoodMatch) {
                lastGoodMatch = match.index;
            }
            if (match.index > maxChars) break;
        }
        if (lastGoodMatch > maxChars * 0.7) {
            bestBreak = lastGoodMatch;
            break;
        }
    }

    const truncated = markdown.substring(0, bestBreak).trimEnd();
    const remaining = markdown.length - bestBreak;
    return truncated + `\n\n---\n*[Truncado: ${remaining.toLocaleString()} caracteres restantes. Use extract_section o pages para obtener secciones específicas.]*`;
}

// ─── Page Range Parser (migrated from markitdown-client.ts) ─────

/**
 * Parse page range string into array of 0-indexed page numbers
 * Supports: "1-5", "1,3,5", "last3", "first5", "1-3,7,9-11"
 */
export function parsePageRange(range: string, totalPages: number): number[] {
    const pages: Set<number> = new Set();

    if (range.toLowerCase().startsWith('last')) {
        const n = parseInt(range.slice(4)) || 3;
        for (let i = Math.max(0, totalPages - n); i < totalPages; i++) pages.add(i);
        return [...pages];
    }
    if (range.toLowerCase().startsWith('first')) {
        const n = parseInt(range.slice(5)) || 5;
        for (let i = 0; i < Math.min(n, totalPages); i++) pages.add(i);
        return [...pages];
    }

    for (const part of range.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = Math.max(0, start - 1); i < Math.min(end, totalPages); i++) {
                    pages.add(i);
                }
            }
        } else {
            const p = parseInt(trimmed);
            if (!isNaN(p) && p >= 1 && p <= totalPages) {
                pages.add(p - 1);
            }
        }
    }

    return [...pages].sort((a, b) => a - b);
}

// ─── Cache Management ───────────────────────────────────────────

/** Get markdown cache stats */
export function getMarkdownCacheStats(): { entries: number; oldestAge: number } {
    let oldestAge = 0;
    const now = Date.now();
    for (const val of markdownCache.values()) {
        const age = now - val.timestamp;
        if (age > oldestAge) oldestAge = age;
    }
    return { entries: markdownCache.size, oldestAge };
}
