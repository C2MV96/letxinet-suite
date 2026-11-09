/**
 * Extraction Router — Dual-engine document → Markdown coordinator
 * Routes extraction requests between MinerU (cloud API) and MarkItDown (local Python/pymupdf4llm)
 * with configurable modes, fallback chain, security controls, and normalized output.
 * 
 * Modes:
 *   - auto: Decides based on document type and engine availability
 *   - mineru_first: MinerU → MarkItDown → pdf-parse
 *   - markitdown_first: MarkItDown → MinerU → pdf-parse  
 *   - local_only: MarkItDown → pdf-parse (never sends to cloud)
 *   - remote_only: MinerU → pdf-parse
 */

import * as path from 'path';
import { validarUrlPublica } from '../utils/url-segura';

// ─── Types ──────────────────────────────────────────────────────

export type ExtractorMode = 'auto' | 'mineru_first' | 'markitdown_first' | 'local_only' | 'remote_only';
export type ExtractorEngine = 'mineru-api' | 'markitdown' | 'pdf-parse';

export interface ExtractionResult {
    markdown: string;
    metadata: {
        title?: string;
        author?: string;
        pages?: number;
        fileSize?: number;
    };
    pages?: number;
    tables?: number;
    images_detected?: number;
    formulas?: number;
    extractor_used: ExtractorEngine;
    warnings: string[];
    timing_ms: number;
    chars: number;
    lines: number;
    format: string;
}

export interface ExtractionHealth {
    mode: ExtractorMode;
    mineru: {
        available: boolean;
        mode: 'precision' | 'flash' | 'unavailable';
        apiUrl: string;
        supportedFormats: string[];
    };
    markitdown: {
        available: boolean;
        pythonCmd: string | null;
        error?: string;
    };
    pdfParse: {
        available: boolean;
    };
    supported_formats: string[];
    allow_remote: boolean;
    recommendation: string;
}

// ─── Configuration ──────────────────────────────────────────────

function getConfig() {
    return {
        mode: (process.env.DOC_EXTRACTOR_MODE || 'auto') as ExtractorMode,
        allowRemote: process.env.ALLOW_REMOTE_EXTRACTION !== 'false',
        markitdownEnabled: process.env.MARKITDOWN_ENABLED !== 'false',
        markitdownPython: process.env.MARKITDOWN_PYTHON || 'python',
        timeoutMs: parseInt(process.env.EXTRACTOR_TIMEOUT_MS || '300000', 10),
        maxMb: parseInt(process.env.EXTRACTOR_MAX_MB || '200', 10),
    };
}

// ─── Security ───────────────────────────────────────────────────

const BLOCKED_URL_PATTERNS = [
    /^https?:\/\/localhost/i,
    /^https?:\/\/127\.0\.0\.1/i,
    /^https?:\/\/0\.0\.0\.0/i,
    /^https?:\/\/10\./i,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./i,
    /^https?:\/\/192\.168\./i,
    /^https?:\/\/\[::1\]/i,
    /^file:/i,
];

function isBlockedUrl(url: string): boolean {
    return BLOCKED_URL_PATTERNS.some(p => p.test(url));
}

function validateFileSize(buffer: Buffer, maxMb: number): void {
    const sizeMb = buffer.length / (1024 * 1024);
    if (sizeMb > maxMb) {
        throw new Error(`File too large: ${sizeMb.toFixed(1)}MB exceeds limit of ${maxMb}MB`);
    }
}

function detectFormatFromMagicBytes(buffer: Buffer): string | null {
    if (buffer.length < 5) return null;
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image';  // PNG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image';  // JPEG
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) return 'office'; // ZIP-based (docx/pptx/xlsx)
    if (buffer[0] === 0x49 && buffer[1] === 0x49) return 'image';  // TIFF LE
    if (buffer[0] === 0x4D && buffer[1] === 0x4D) return 'image';  // TIFF BE
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) return 'image';  // BMP
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF') return 'image'; // WebP
    return null;
}

// ─── Engine Decision Logic ──────────────────────────────────────

interface DocumentInfo {
    buffer: Buffer;
    filename: string;
    sourceUrl?: string;
    format: string;
    detectedFormat: string | null;
}

function shouldPreferMineru(doc: DocumentInfo): boolean {
    // MinerU is preferred for:
    // - Non-PDF formats (DOCX, PPTX, XLSX) — MarkItDown can't handle these
    // - Images (OCR needed)
    // - Scanned PDFs (heuristic: very little extractable text)
    // - Large documents
    const format = doc.format;
    if (['docx', 'pptx', 'xlsx'].includes(format)) return true;
    if (format === 'image') return true;
    if (doc.detectedFormat === 'office') return true;
    if (doc.detectedFormat === 'image') return true;
    // For PDFs, prefer MarkItDown (faster, local, private)
    return false;
}

function buildEngineOrder(mode: ExtractorMode, doc: DocumentInfo, config: ReturnType<typeof getConfig>): ExtractorEngine[] {
    const engines: ExtractorEngine[] = [];

    switch (mode) {
        case 'mineru_first':
            if (config.allowRemote) engines.push('mineru-api');
            if (config.markitdownEnabled && doc.format === 'pdf') engines.push('markitdown');
            engines.push('pdf-parse');
            break;

        case 'markitdown_first':
            if (config.markitdownEnabled && doc.format === 'pdf') engines.push('markitdown');
            if (config.allowRemote) engines.push('mineru-api');
            engines.push('pdf-parse');
            break;

        case 'local_only':
            if (config.markitdownEnabled && doc.format === 'pdf') engines.push('markitdown');
            engines.push('pdf-parse');
            break;

        case 'remote_only':
            if (config.allowRemote) engines.push('mineru-api');
            engines.push('pdf-parse');
            break;

        case 'auto':
        default:
            if (shouldPreferMineru(doc)) {
                // MinerU first for complex docs (images, Office, OCR)
                if (config.allowRemote) engines.push('mineru-api');
                if (config.markitdownEnabled && doc.format === 'pdf') engines.push('markitdown');
            } else {
                // MarkItDown first for normal PDFs (faster, local, private)
                if (config.markitdownEnabled && doc.format === 'pdf') engines.push('markitdown');
                if (config.allowRemote) engines.push('mineru-api');
            }
            engines.push('pdf-parse');
            break;
    }

    return engines;
}

// ─── Main Extraction Function ───────────────────────────────────

/**
 * Extract document to Markdown using the configured extraction strategy.
 * Tries engines in order based on mode, with automatic fallback.
 */
export async function extractDocument(
    buffer: Buffer,
    filename: string,
    sourceUrl?: string,
): Promise<ExtractionResult> {
    const config = getConfig();
    const startTime = Date.now();
    const warnings: string[] = [];

    // Security: validate file size
    if (buffer.length > 0) {
        validateFileSize(buffer, config.maxMb);
    }

    // Security: validate source URL (LetXinet 1.1.3: comprobacion completa, con IP normalizada y DNS)
    if (sourceUrl && /^https?:/i.test(sourceUrl)) {
        await validarUrlPublica(sourceUrl);
    } else if (sourceUrl && isBlockedUrl(sourceUrl)) {
        throw new Error(`Blocked URL: internal/private URLs are not allowed (${sourceUrl.substring(0, 30)}...)`);
    }

    // Security: check remote extraction permission
    if (!config.allowRemote) {
        warnings.push('Remote extraction disabled (ALLOW_REMOTE_EXTRACTION=false). Using local engines only.');
    }

    // Detect format
    const ext = path.extname(filename).toLowerCase().replace('.', '') || 'pdf';
    const formatMap: Record<string, string> = {
        pdf: 'pdf', docx: 'docx', pptx: 'pptx', xlsx: 'xlsx',
        png: 'image', jpg: 'image', jpeg: 'image', tiff: 'image',
        tif: 'image', bmp: 'image', webp: 'image',
    };
    const format = formatMap[ext] || 'pdf';
    const detectedFormat = buffer.length > 0 ? detectFormatFromMagicBytes(buffer) : null;

    const doc: DocumentInfo = { buffer, filename, sourceUrl, format, detectedFormat };

    // Build engine order based on mode
    const engineOrder = buildEngineOrder(config.mode, doc, config);

    if (engineOrder.length === 0) {
        throw new Error('No extraction engines available. Check DOC_EXTRACTOR_MODE, ALLOW_REMOTE_EXTRACTION, and MARKITDOWN_ENABLED settings.');
    }

    console.log(`[ExtractionRouter] Mode=${config.mode} | Format=${format} | Engines=${engineOrder.join(' → ')} | File=${filename}`);

    // Try engines in order
    let lastError: Error | null = null;

    for (const engine of engineOrder) {
        try {
            const result = await tryEngine(engine, doc, sourceUrl, config);
            result.warnings = warnings.concat(result.warnings);
            result.timing_ms = Date.now() - startTime;
            console.log(`[ExtractionRouter] ✅ Success with ${engine}: ${result.chars} chars in ${result.timing_ms}ms`);
            return result;
        } catch (e: any) {
            lastError = e;
            warnings.push(`${engine} failed: ${e.message}`);
            console.warn(`[ExtractionRouter] ⚠️ ${engine} failed: ${e.message}`);
        }
    }

    throw new Error(`All extraction engines failed for ${filename}. Last error: ${lastError?.message}. Engines tried: ${engineOrder.join(', ')}`);
}

// ─── Engine Implementations ─────────────────────────────────────

async function tryEngine(
    engine: ExtractorEngine,
    doc: DocumentInfo,
    sourceUrl: string | undefined,
    config: ReturnType<typeof getConfig>,
): Promise<ExtractionResult> {
    switch (engine) {
        case 'mineru-api':
            return await tryMineruEngine(doc, sourceUrl);
        case 'markitdown':
            return await tryMarkitdownEngine(doc);
        case 'pdf-parse':
            return await tryPdfParseEngine(doc);
        default:
            throw new Error(`Unknown engine: ${engine}`);
    }
}

async function tryMineruEngine(doc: DocumentInfo, sourceUrl?: string): Promise<ExtractionResult> {
    const { checkMineruHealth, convertDocument } = require('./mineru-client');
    const { safePublicPdfUrlForMineru } = require('../utils/document-url');

    const health = await checkMineruHealth();
    if (!health.available) {
        throw new Error('MinerU API not available (no API key or API unreachable)');
    }

    const mineruUrl = sourceUrl ? safePublicPdfUrlForMineru(sourceUrl) : null;
    const result = await convertDocument(doc.buffer, doc.filename, mineruUrl || sourceUrl);

    return {
        markdown: result.markdown,
        metadata: { pages: result.pages, fileSize: doc.buffer.length || undefined },
        pages: result.pages,
        tables: result.tables,
        images_detected: result.images,
        formulas: result.formulas,
        extractor_used: 'mineru-api',
        warnings: [],
        timing_ms: 0,
        chars: result.chars,
        lines: result.lines,
        format: result.format || doc.format,
    };
}

async function tryMarkitdownEngine(doc: DocumentInfo): Promise<ExtractionResult> {
    if (doc.format !== 'pdf') {
        throw new Error(`MarkItDown only supports PDF. Got: ${doc.format}`);
    }

    const markitdown = require('./markitdown-client');
    const available = await markitdown.isPythonAvailable();
    if (!available) {
        throw new Error('MarkItDown not available: Python 3 + pymupdf4llm required');
    }

    const result = await markitdown.convertToMarkdown(doc.buffer, doc.sourceUrl);

    // Count tables in markdown output
    const tableMatches = result.markdown.match(/\|[^\n]+\|\n\|[-:\s|]+\|/g);
    const tableCount = tableMatches ? tableMatches.length : 0;

    return {
        markdown: result.markdown,
        metadata: { pages: result.pages, fileSize: doc.buffer.length },
        pages: result.pages,
        tables: tableCount || undefined,
        images_detected: undefined,
        formulas: undefined,
        extractor_used: 'markitdown',
        warnings: [],
        timing_ms: 0,
        chars: result.chars,
        lines: result.lines,
        format: 'pdf',
    };
}

async function tryPdfParseEngine(doc: DocumentInfo): Promise<ExtractionResult> {
    if (doc.format !== 'pdf' && doc.detectedFormat !== 'pdf') {
        throw new Error(`pdf-parse only supports PDF. Got: ${doc.format}`);
    }

    let pdfParse: any;
    try {
        pdfParse = require('pdf-parse');
    } catch {
        throw new Error('pdf-parse npm module not available');
    }

    const data = await pdfParse(doc.buffer);
    const text = data.text || '';

    return {
        markdown: text,
        metadata: {
            title: data.info?.Title || undefined,
            author: data.info?.Author || undefined,
            pages: data.numpages || 0,
            fileSize: doc.buffer.length,
        },
        pages: data.numpages || 0,
        tables: undefined,
        images_detected: undefined,
        formulas: undefined,
        extractor_used: 'pdf-parse',
        warnings: ['Using basic text extraction (pdf-parse). For better quality, configure MinerU API key or install Python + pymupdf4llm.'],
        timing_ms: 0,
        chars: text.length,
        lines: text.split('\n').length,
        format: 'pdf',
    };
}

// ─── Health Check ───────────────────────────────────────────────

/**
 * Get unified health status for all extraction engines.
 */
export async function getExtractionHealth(): Promise<ExtractionHealth> {
    const config = getConfig();

    // Check MinerU
    let mineruHealth: any;
    try {
        const { checkMineruHealth } = require('./mineru-client');
        mineruHealth = await checkMineruHealth();
    } catch {
        mineruHealth = { available: false, mode: 'unavailable', apiUrl: 'unknown', supportedFormats: [] };
    }

    // Check MarkItDown
    let markitdownAvailable = false;
    let pythonCmd: string | null = null;
    let markitdownError: string | undefined;
    try {
        if (config.markitdownEnabled) {
            const markitdown = require('./markitdown-client');
            markitdownAvailable = await markitdown.isPythonAvailable();
            pythonCmd = markitdownAvailable ? (config.markitdownPython || 'python') : null;
        } else {
            markitdownError = 'Disabled via MARKITDOWN_ENABLED=false';
        }
    } catch (e: any) {
        markitdownError = e.message;
    }

    // Check pdf-parse
    let pdfParseAvailable = false;
    try {
        require('pdf-parse');
        pdfParseAvailable = true;
    } catch {}

    // Build supported formats list
    const formats = new Set<string>();
    if (pdfParseAvailable || markitdownAvailable) formats.add('pdf');
    if (mineruHealth.available) {
        (mineruHealth.supportedFormats || []).forEach((f: string) => formats.add(f));
    }

    // Build recommendation
    let recommendation: string;
    if (mineruHealth.available && markitdownAvailable) {
        recommendation = 'Both engines available. Mode "auto" recommended for best coverage.';
    } else if (mineruHealth.available) {
        recommendation = 'Only MinerU available. Install Python + pymupdf4llm for local PDF fallback.';
    } else if (markitdownAvailable) {
        recommendation = 'Only MarkItDown available. Set MINERU_API_KEY for multi-format support (DOCX, PPTX, XLSX, images, OCR).';
    } else if (pdfParseAvailable) {
        recommendation = 'Only basic pdf-parse available. Set MINERU_API_KEY or install Python + pymupdf4llm for better extraction.';
    } else {
        recommendation = 'No extraction engines available! Install pdf-parse (npm), Python + pymupdf4llm, or set MINERU_API_KEY.';
    }

    return {
        mode: config.mode,
        mineru: {
            available: mineruHealth.available,
            mode: mineruHealth.mode,
            apiUrl: mineruHealth.apiUrl,
            supportedFormats: mineruHealth.supportedFormats || [],
        },
        markitdown: {
            available: markitdownAvailable,
            pythonCmd,
            error: markitdownError,
        },
        pdfParse: {
            available: pdfParseAvailable,
        },
        supported_formats: [...formats],
        allow_remote: config.allowRemote,
        recommendation,
    };
}

// ─── Convenience re-exports ─────────────────────────────────────

export { smartTruncate, parsePageRange } from './mineru-client';
