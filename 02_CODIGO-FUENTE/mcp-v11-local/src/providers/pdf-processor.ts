/**
 * PDF Processor — Core PDF reading and analysis
 * Uses pdf-parse for text extraction and custom parsers for academic analysis.
 * Supports both URL downloads and local file paths.
 */

import { extractDocument, smartTruncate, parsePageRange, ExtractionResult } from './extraction-router';
import { convertToMarkdown, isPythonAvailable, MarkdownResult } from './mineru-client';
import { fetchWithTimeout, withPromiseTimeout } from './base';
import { resolvePdfBuffer, isSandboxPath, extractDoiFromSource, buildResolutionError } from './pdf-resolver';
import { safePublicPdfUrlForMineru } from '../utils/document-url';
import { validarUrlPublica } from '../utils/url-segura';

// eslint-disable-next-line @typescript-eslint/no-var-requires
let pdfParse: any = null;
async function getPdfParse() {
    if (!pdfParse) {
        pdfParse = require('pdf-parse');
    }
    return pdfParse;
}

/** In-memory cache for downloaded PDFs */
const pdfCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

/** In-memory cache for markdown conversions */
const markdownResultCache: Map<string, { result: MarkdownResult; timestamp: number }> = new Map();
const MARKDOWN_CACHE_TTL = 15 * 60 * 1000; // 15 min

// ─── PDF Loading ────────────────────────────────────────────────

/**
 * Load PDF from URL or file path, return Buffer
 */
export async function loadPdf(source: string): Promise<Buffer> {
    // Check cache
    const cached = pdfCache.get(source);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.buffer;
    }

    let buffer: Buffer | null = null;

    // ── Case 1: Direct DOI (e.g. "10.1016/j.jclepro.2019.03.031") ──
    const directDoi = extractDoiFromSource(source);
    if (directDoi && !source.startsWith('http') && !source.includes('/') || (directDoi && source.match(/^10\.\d{4,}/))) {
        console.log(`[PDF] Direct DOI detected: ${directDoi}`);
        const result = await resolvePdfBuffer(source);
        if (result) {
            buffer = result.buffer;
            console.log(`[PDF] ✅ Resolved via ${result.resolvedFrom}`);
        } else {
            throw new Error(buildResolutionError(source, directDoi));
        }
    }
    // ── Case 2: URL ──
    else if (source.startsWith('http://') || source.startsWith('https://')) {
        // LetXinet 1.1.3: nunca descargar de direcciones internas (SSRF); falla antes de intentar nada
        await validarUrlPublica(source);
        console.log(`[PDF] Downloading: ${source.substring(0, 80)}...`);
        try {
            // Redirecciones a mano para validar cada salto (una URL publica podria redirigir a una interna)
            let actual = source;
            let res: Response | null = null;
            for (let salto = 0; salto < 6; salto++) {
                res = await fetchWithTimeout(actual, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/pdf,*/*',
                    },
                    redirect: 'manual',
                }, 60000);
                const destino = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
                if (!destino) break;
                actual = await validarUrlPublica(new URL(destino, actual).toString());
            }

            if (!res || !res.ok) {
                throw new Error(`HTTP ${res ? res.status : 'sin respuesta'}`);
            }

            const arrayBuffer = await res.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);

            // If the downloaded content is not a PDF, try multi-source resolver
            if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
                console.log(`[PDF] URL did not return a PDF, trying multi-source resolver...`);
                buffer = null; // Reset, fall through to resolver
            }
        } catch (urlError: any) {
            console.warn(`[PDF] Direct URL download failed: ${urlError.message}`);
            buffer = null; // Fall through to resolver
        }

        // Fallback: try multi-source resolver with DOI from URL
        if (!buffer) {
            const doi = extractDoiFromSource(source);
            if (doi) {
                console.log(`[PDF] Extracted DOI from URL: ${doi}, trying multi-source resolver...`);
                const result = await resolvePdfBuffer(doi);
                if (result) {
                    buffer = result.buffer;
                    console.log(`[PDF] ✅ Fallback resolved via ${result.resolvedFrom}`);
                }
            }
            if (!buffer) {
                // Last attempt: pass full URL to resolver
                const result = await resolvePdfBuffer(source);
                if (result) {
                    buffer = result.buffer;
                    console.log(`[PDF] ✅ Fallback resolved via ${result.resolvedFrom}`);
                }
            }
            if (!buffer) {
                throw new Error(buildResolutionError(source, doi));
            }
        }
    }
    // ── Case 3: Sandbox / unreachable local path ──
    else if (isSandboxPath(source)) {
        console.log(`[PDF] Sandbox path detected: ${source}`);
        console.log(`[PDF] Attempting to resolve via DOI extraction + multi-source download...`);

        const result = await resolvePdfBuffer(source);
        if (result) {
            buffer = result.buffer;
            console.log(`[PDF] ✅ Sandbox path resolved via ${result.resolvedFrom} (DOI: ${result.doi || 'inferred'})`);
        } else {
            throw new Error(buildResolutionError(source, directDoi));
        }
    }
    // ── Case 4: Actual local file ──
    else {
        const fs = await import('fs');
        if (!fs.existsSync(source)) {
            // Not a local file either — try as a search query
            console.log(`[PDF] File not found locally, trying multi-source resolver: ${source}`);
            const result = await resolvePdfBuffer(source);
            if (result) {
                buffer = result.buffer;
                console.log(`[PDF] ✅ Resolved via ${result.resolvedFrom}`);
            } else {
                throw new Error(buildResolutionError(source, directDoi));
            }
        } else {
            buffer = fs.readFileSync(source);
        }
    }

    // Validate it's a PDF
    if (!buffer || buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
        throw new Error('Invalid PDF: file does not start with %PDF- header');
    }

    // Cache it
    pdfCache.set(source, { buffer, timestamp: Date.now() });
    console.log(`[PDF] Loaded ${(buffer.length / 1024).toFixed(0)} KB`);
    return buffer;
}

// ─── Text Extraction ────────────────────────────────────────────

export interface PdfTextResult {
    text: string;
    pages: number;
    info: Record<string, any>;
}

/**
 * Extract text from PDF
 */
export async function extractText(source: string): Promise<PdfTextResult> {
    const buffer = await loadPdf(source);
    const parse = await getPdfParse();
    const data = await parse(buffer);

    return {
        text: data.text || '',
        pages: data.numpages || 0,
        info: data.info || {},
    };
}

/**
 * Extract text from PDF as structured Markdown (via MinerU AI)
 * Falls back to pdf-parse raw text if MinerU API is unavailable.
 */
export async function extractMarkdown(source: string, opts?: {
    maxChars?: number;
    pages?: string;
}): Promise<PdfTextResult & { format: 'markdown' | 'text' }> {
    const maxChars = opts?.maxChars ?? 20000;

    // Try MinerU API first
    try {
        const available = await isPythonAvailable();
        if (available) {
            const buffer = await loadPdf(source);

            // Parse page range if provided
            let pages: number[] | undefined;
            if (opts?.pages) {
                // We need total pages — get from pdf-parse quickly
                const parse = await getPdfParse();
                const data = await parse(buffer);
                pages = parsePageRange(opts.pages, data.numpages);
            }

            const mineruPublicSource = safePublicPdfUrlForMineru(source) || undefined;
            const mdResult = await convertToMarkdown(buffer, mineruPublicSource, pages);

            let text = mdResult.markdown;
            if (maxChars > 0 && text.length > maxChars) {
                text = smartTruncate(text, maxChars);
            }

            return {
                text,
                pages: mdResult.pages,
                info: { converter: 'mineru-api', originalChars: mdResult.chars },
                format: 'markdown',
            };
        }
    } catch (e: any) {
        console.warn(`[PDF] MinerU failed, falling back to pdf-parse: ${e.message}`);
    }

    // Fallback to pdf-parse
    const result = await extractText(source);
    let text = result.text;
    if (maxChars > 0 && text.length > maxChars) {
        text = smartTruncate(text, maxChars);
    }

    return {
        text,
        pages: result.pages,
        info: { ...result.info, converter: 'pdf-parse' },
        format: 'text',
    };
}

// ─── Metadata ───────────────────────────────────────────────────

export interface PdfMetadata {
    title: string;
    author: string;
    subject: string;
    creator: string;
    producer: string;
    creationDate: string;
    modificationDate: string;
    pages: number;
    fileSize: number;
}

export async function getMetadata(source: string): Promise<PdfMetadata> {
    const buffer = await loadPdf(source);
    const parse = await getPdfParse();
    const data = await parse(buffer);
    const info = data.info || {};

    return {
        title: info.Title || '',
        author: info.Author || '',
        subject: info.Subject || '',
        creator: info.Creator || '',
        producer: info.Producer || '',
        creationDate: info.CreationDate || '',
        modificationDate: info.ModDate || '',
        pages: data.numpages || 0,
        fileSize: buffer.length,
    };
}

// ─── Academic Section Patterns (shared by detectSections + analyzeAcademicDocument) ──

/**
 * Academic section patterns for theses and articles
 * Supports both Spanish (tesis) and English (articles)
 */
const ACADEMIC_SECTION_PATTERNS_FULL = [
    // ── Pre-content ──
    { name: 'Resumen / Abstract', category: 'front', pattern: /\b(resumen|abstract|sumario)\b/i },
    { name: 'Palabras Clave / Keywords', category: 'front', pattern: /\b(palabras\s+clave|keywords|key\s+words)\b/i },
    
    // ── Introduction ──
    { name: 'Introducción / Introduction', category: 'intro', pattern: /\b(\d+\.?\s*introducci[oó]n|\d+\.?\s*introduction|introducci[oó]n|introduction)\b/i },
    { name: 'Planteamiento del Problema', category: 'intro', pattern: /\b(planteamiento\s+del\s+problema|problem\s+statement|formulaci[oó]n\s+del\s+problema|definici[oó]n\s+del\s+problema)\b/i },
    { name: 'Justificación', category: 'intro', pattern: /\b(justificaci[oó]n|justification|importancia|relevancia|motivation)\b/i },
    { name: 'Objetivos', category: 'intro', pattern: /\b(objetivos?\s*(generales?|espec[ií]ficos?)?|objectives?|goals?|aims?)\b/i },
    { name: 'Hipótesis', category: 'intro', pattern: /\b(hip[oó]tesis|hypothesis|hypotheses)\b/i },
    
    // ── Theoretical Framework ──
    { name: 'Marco Teórico', category: 'theory', pattern: /\b(marco\s+te[oó]rico|theoretical\s+framework|fundamento\s+te[oó]rico|bases\s+te[oó]ricas|theoretical\s+background|state\s+of\s+the\s+art)\b/i },
    { name: 'Antecedentes', category: 'theory', pattern: /\b(antecedentes|background|related\s+work|literature\s+review|revisi[oó]n\s+de\s+literatura|estado\s+del\s+arte|trabajos\s+previos|prior\s+work)\b/i },
    { name: 'Bases Conceptuales', category: 'theory', pattern: /\b(bases\s+conceptuales|marco\s+conceptual|conceptual\s+framework|definici[oó]n\s+de\s+t[eé]rminos|glosario)\b/i },
    { name: 'Marco Legal', category: 'theory', pattern: /\b(marco\s+legal|marco\s+normativo|legal\s+framework|regulatory\s+framework)\b/i },
    
    // ── Methodology ──
    { name: 'Metodología / Methods', category: 'methods', pattern: /\b(\d+\.?\s*metodolog[ií]a|\d+\.?\s*methods?|metodolog[ií]a|methods?|methodology|materiales?\s+y\s+m[eé]todos?|materials?\s+and\s+methods?|procedimiento|approach|proposed\s+method|dise[ñn]o\s+metodol[oó]gico)\b/i },
    { name: 'Población y Muestra', category: 'methods', pattern: /\b(poblaci[oó]n\s+y\s+muestra|population\s+and\s+sample|sample\s+size|muestra|participants?|participantes|sujetos)\b/i },
    { name: 'Instrumentos', category: 'methods', pattern: /\b(instrumentos?\s+de\s+recolecci[oó]n|instruments?|herramientas|cuestionario|encuesta|survey|data\s+collection)\b/i },
    { name: 'Diseño Experimental', category: 'methods', pattern: /\b(dise[ñn]o\s+experimental|experimental\s+design|experimental\s+setup|setup|implementaci[oó]n|implementation)\b/i },
    
    // ── Results ──
    { name: 'Resultados / Results', category: 'results', pattern: /\b(\d+\.?\s*resultados|\d+\.?\s*results|resultados|results|findings|hallazgos)\b/i },
    { name: 'Análisis de Datos', category: 'results', pattern: /\b(an[aá]lisis\s+de\s+(datos|resultados)|data\s+analysis|analysis\s+of\s+results|an[aá]lisis\s+estad[ií]stico|statistical\s+analysis)\b/i },
    { name: 'Discusión / Discussion', category: 'results', pattern: /\b(\d+\.?\s*discusi[oó]n|\d+\.?\s*discussion|discusi[oó]n|discussion|interpretaci[oó]n)\b/i },
    
    // ── Conclusion ──
    { name: 'Conclusiones / Conclusions', category: 'conclusion', pattern: /\b(\d+\.?\s*conclusi[oó]n|\d+\.?\s*conclusions?|conclusi[oó]n|conclusions?|concluding\s+remarks)\b/i },
    { name: 'Recomendaciones', category: 'conclusion', pattern: /\b(recomendaciones|recommendations|sugerencias|suggestions|future\s+work|trabajo\s+futuro|trabajos?\s+futuros?)\b/i },
    
    // ── Back Matter ──
    { name: 'Referencias / References', category: 'back', pattern: /\b(referencias|references|bibliograf[ií]a|bibliography|works\s+cited)\b/i },
    { name: 'Anexos / Appendix', category: 'back', pattern: /\b(anexos?|appendix|appendices|ap[eé]ndices?|supplementary|material\s+complementario)\b/i },
];

// ─── Academic Section Detection ─────────────────────────────────

export interface PdfSection {
    name: string;
    content: string;
    startIndex: number;
}

export async function detectSections(source: string): Promise<PdfSection[]> {
    // Try MinerU for better section detection via markdown headings
    let text: string;
    let useMarkdownDetection = false;

    try {
        const available = await isPythonAvailable();
        if (available) {
            const buffer = await loadPdf(source);
            const mdResult = await convertToMarkdown(buffer, source);
            text = mdResult.markdown;
            useMarkdownDetection = true;
        } else {
            const result = await extractText(source);
            text = result.text;
        }
    } catch {
        const result = await extractText(source);
        text = result.text;
    }

    const lines = text.split('\n');
    const sections: PdfSection[] = [];
    const sectionStarts: { name: string; lineIdx: number; charIdx: number }[] = [];

    let charOffset = 0;

    // Strategy 1: Detect via markdown headings (more reliable)
    if (useMarkdownDetection) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
            if (headingMatch) {
                const headingText = headingMatch[2].trim();
                for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                    if (sp.pattern.test(headingText)) {
                        sectionStarts.push({ name: sp.name, lineIdx: i, charIdx: charOffset });
                        break;
                    }
                }
            }
            charOffset += lines[i].length + 1;
        }
    }

    // Strategy 2: Fallback to regex on raw text
    if (sectionStarts.length < 2) {
        sectionStarts.length = 0;
        charOffset = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0 && line.length < 80) {
                for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                    if (sp.pattern.test(line)) {
                        sectionStarts.push({ name: sp.name, lineIdx: i, charIdx: charOffset });
                        break;
                    }
                }
            }
            charOffset += lines[i].length + 1;
        }
    }

    // Extract content between section headers
    for (let i = 0; i < sectionStarts.length; i++) {
        const start = sectionStarts[i];
        const endCharIdx = i + 1 < sectionStarts.length
            ? sectionStarts[i + 1].charIdx
            : text.length;

        const content = text.substring(start.charIdx, endCharIdx).trim();
        // Limit content to first 3000 chars per section for manageability
        sections.push({
            name: start.name,
            content: content.substring(0, 3000),
            startIndex: start.charIdx,
        });
    }

    console.log(`[PDF] Detected ${sections.length} academic sections`);
    return sections;
}

// ─── Citation Extraction ────────────────────────────────────────

export interface PdfCitation {
    index: number;
    text: string;
    authors: string;
    year: string | null;
}

export async function extractCitations(source: string): Promise<PdfCitation[]> {
    const { text } = await extractText(source);

    // Find the References section
    const refMatch = text.match(/\b(references|bibliography|works\s+cited)\b/i);
    if (!refMatch || refMatch.index === undefined) {
        return [];
    }

    const refText = text.substring(refMatch.index);
    const citations: PdfCitation[] = [];

    // Pattern 1: Numbered references [1] Author, Title...
    const numberedRefs = refText.matchAll(/\[(\d+)\]\s*([^\[]{10,500})/g);
    for (const m of numberedRefs) {
        const citText = m[2].trim().replace(/\s+/g, ' ');
        const yearMatch = citText.match(/\b(19|20)\d{2}\b/);
        // Extract first author (up to first comma or period)
        const authorsMatch = citText.match(/^([^,.]+)/);
        citations.push({
            index: parseInt(m[1]),
            text: citText.substring(0, 300),
            authors: authorsMatch ? authorsMatch[1].trim() : '',
            year: yearMatch ? yearMatch[0] : null,
        });
    }

    // If no numbered refs found, try newline-separated entries
    if (citations.length === 0) {
        const lines = refText.split('\n').filter(l => l.trim().length > 20);
        for (let i = 0; i < Math.min(lines.length, 100); i++) {
            const line = lines[i].trim().replace(/\s+/g, ' ');
            const yearMatch = line.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                const authorsMatch = line.match(/^([^(,.]+)/);
                citations.push({
                    index: citations.length + 1,
                    text: line.substring(0, 300),
                    authors: authorsMatch ? authorsMatch[1].trim() : '',
                    year: yearMatch[0],
                });
            }
        }
    }

    console.log(`[PDF] Extracted ${citations.length} citations`);
    return citations;
}

// ─── Deep Academic Document Analysis ────────────────────────────
// ACADEMIC_SECTION_PATTERNS_FULL is defined above (before detectSections)
// so both functions can share it.

/** Statistical/numerical patterns to detect in text */
const STATS_PATTERNS = [
    { name: 'p-value', pattern: /p\s*[<>=≤≥]\s*0?\.\d+/gi },
    { name: 'percentage', pattern: /\d+[\.,]\d*\s*%/g },
    { name: 'mean_std', pattern: /(?:media|mean|promedio|average|M)\s*[=:]\s*\d+[\.,]?\d*/gi },
    { name: 'correlation', pattern: /r\s*[=]\s*[+-]?0?\.\d+/gi },
    { name: 'chi_square', pattern: /(?:chi|χ)[²2]\s*[=()]\s*\d+[\.,]?\d*/gi },
    { name: 'confidence_interval', pattern: /(?:IC|CI)\s*[=:(\[]\s*\d+/gi },
    { name: 't_test', pattern: /t\s*[=(]\s*\d+[\.,]?\d*/gi },
    { name: 'f_test', pattern: /F\s*[=(]\s*\d+[\.,]?\d*/gi },
    { name: 'n_sample', pattern: /(?:n|N)\s*[=]\s*\d+/g },
    { name: 'alpha', pattern: /(?:α|alfa|alpha)\s*[=]\s*0?\.\d+/gi },
    { name: 'r_squared', pattern: /R[²2]\s*[=]\s*0?\.\d+/gi },
    { name: 'anova', pattern: /ANOVA|an[aá]lisis\s+de\s+varianza/gi },
    { name: 'regression', pattern: /regresi[oó]n\s+(?:lineal|log[ií]stica|m[uú]ltiple)|(?:linear|logistic|multiple)\s+regression/gi },
    { name: 'table_reference', pattern: /(?:tabla|table|cuadro|figure|figura)\s+\d+/gi },
];

export interface StatisticalData {
    type: string;
    matches: string[];
    count: number;
}

export interface AcademicSection {
    name: string;
    category: string;
    content: string;
    contentLength: number;
    statistics: StatisticalData[];
    hasNumericalData: boolean;
}

export interface AcademicAnalysis {
    documentType: 'thesis' | 'article' | 'report' | 'unknown';
    language: 'es' | 'en' | 'mixed';
    pages: number;
    totalWords: number;
    sections: AcademicSection[];
    globalStatistics: StatisticalData[];
    summary: {
        totalSections: number;
        sectionsWithStats: number;
        totalStatisticalItems: number;
        detectedCategories: string[];
    };
}

/**
 * Classify document type based on content patterns
 */
function classifyDocument(text: string): { type: 'thesis' | 'article' | 'report' | 'unknown'; language: 'es' | 'en' | 'mixed' } {
    const lower = text.substring(0, 5000).toLowerCase();
    
    // Language detection
    const esWords = (lower.match(/\b(de|en|la|el|los|las|del|para|por|con|una|que|como)\b/g) || []).length;
    const enWords = (lower.match(/\b(the|and|of|in|to|for|with|that|this|from|are|was)\b/g) || []).length;
    const language = esWords > enWords * 1.5 ? 'es' : enWords > esWords * 1.5 ? 'en' : 'mixed';
    
    // Document type
    const thesisIndicators = [
        /tesis|tesina|disertaci[oó]n|dissertation|thesis/i,
        /para\s+optar\s+(?:el|al)\s+(?:t[ií]tulo|grado)/i,
        /asesor|advisor|tutor|director\s+de\s+tesis/i,
        /universidad|university|facultad|faculty|escuela\s+de/i,
        /bachiller|licenciatura|maestr[ií]a|doctorado|master|phd/i,
    ];
    
    const articleIndicators = [
        /\babstract\b.*\bintroduction\b/is,
        /journal|revista|proceedings|conference/i,
        /doi:\s*10\.\d+/i,
        /\bsubmitted\s+to\b|\bpublished\s+in\b/i,
    ];
    
    const thesisScore = thesisIndicators.filter(p => p.test(text.substring(0, 10000))).length;
    const articleScore = articleIndicators.filter(p => p.test(text.substring(0, 10000))).length;
    
    let type: 'thesis' | 'article' | 'report' | 'unknown' = 'unknown';
    if (thesisScore >= 2) type = 'thesis';
    else if (articleScore >= 2) type = 'article';
    else if (thesisScore > articleScore) type = 'thesis';
    else if (articleScore > thesisScore) type = 'article';
    
    return { type, language };
}

/**
 * Extract statistical/numerical data from text
 */
function extractStatisticsFromText(text: string): StatisticalData[] {
    const stats: StatisticalData[] = [];
    
    for (const sp of STATS_PATTERNS) {
        const matches = [...text.matchAll(sp.pattern)].map(m => m[0].trim());
        if (matches.length > 0) {
            // Deduplicate
            const unique = [...new Set(matches)];
            stats.push({
                type: sp.name,
                matches: unique.slice(0, 20), // Cap at 20 per type
                count: matches.length,
            });
        }
    }
    
    return stats;
}

/**
 * Deep academic document analysis — bilingual (ES/EN), statistics extraction
 */
export async function analyzeAcademicDocument(source: string): Promise<AcademicAnalysis> {
    const ANALYSIS_TIMEOUT = 120000;
    return withPromiseTimeout(
        _doAnalyzeAcademic(source), 
        ANALYSIS_TIMEOUT, 
        `Analysis timeout: processing took longer than ${ANALYSIS_TIMEOUT / 1000}s. The PDF may be too large. Try extract_section for specific sections instead.`
    );
}

async function _doAnalyzeAcademic(source: string): Promise<AcademicAnalysis> {
    const { text, pages } = await extractText(source);
    const { type: documentType, language } = classifyDocument(text);
    const totalWords = text.split(/\s+/).filter(w => w.length > 1).length;
    
    const lines = text.split('\n');
    const sections: AcademicSection[] = [];
    
    // Detect section headers
    const sectionStarts: { name: string; category: string; lineIdx: number; charIdx: number }[] = [];
    let charOffset = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Section headers are typically short lines (< 100 chars) and not empty
        if (line.length > 2 && line.length < 100) {
            for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                if (sp.pattern.test(line)) {
                    // Avoid duplicate consecutive sections of same name
                    const lastSection = sectionStarts[sectionStarts.length - 1];
                    if (!lastSection || lastSection.name !== sp.name || i - lastSection.lineIdx > 3) {
                        sectionStarts.push({ name: sp.name, category: sp.category, lineIdx: i, charIdx: charOffset });
                    }
                    break;
                }
            }
        }
        charOffset += lines[i].length + 1;
    }
    
    // Extract content and statistics per section
    for (let i = 0; i < sectionStarts.length; i++) {
        const start = sectionStarts[i];
        const endCharIdx = i + 1 < sectionStarts.length
            ? sectionStarts[i + 1].charIdx
            : text.length;
        
        const content = text.substring(start.charIdx, endCharIdx).trim();
        const sectionText = content.substring(0, 8000); // More content for analysis
        const statistics = extractStatisticsFromText(sectionText);
        const hasNumericalData = statistics.length > 0 || /\d+[\.,]\d+/.test(sectionText);
        
        sections.push({
            name: start.name,
            category: start.category,
            content: sectionText.substring(0, 5000), // Return up to 5000 chars
            contentLength: content.length,
            statistics,
            hasNumericalData,
        });
    }
    
    // Global statistics across entire document
    const globalStatistics = extractStatisticsFromText(text);
    
    // Summary
    const detectedCategories = [...new Set(sections.map(s => s.category))];
    const sectionsWithStats = sections.filter(s => s.statistics.length > 0).length;
    const totalStatisticalItems = globalStatistics.reduce((sum, s) => sum + s.count, 0);
    
    console.log(`[PDF] Academic analysis: ${documentType} (${language}), ${sections.length} sections, ${totalStatisticalItems} stats items`);
    
    return {
        documentType,
        language,
        pages,
        totalWords,
        sections,
        globalStatistics,
        summary: {
            totalSections: sections.length,
            sectionsWithStats,
            totalStatisticalItems,
            detectedCategories,
        },
    };
}

// ─── Section Extraction (no char limit) ─────────────────────────

export interface ExtractedSection {
    name: string;
    category: string;
    content: string;
    contentLength: number;
    statistics: StatisticalData[];
}

/**
 * Extract a specific section from a PDF by name.
 * Fuzzy matches the requested section name against detected sections.
 * Returns FULL content (no char limit unlike analyze_academic).
 */
export async function extractSection(source: string, sectionName: string): Promise<{ found: boolean; section?: ExtractedSection; availableSections: string[] }> {
    const { text, pages } = await extractText(source);
    const lines = text.split('\n');
    
    // Detect all section headers
    const sectionStarts: { name: string; category: string; lineIdx: number; charIdx: number }[] = [];
    let charOffset = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length > 2 && line.length < 100) {
            for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                if (sp.pattern.test(line)) {
                    const lastSection = sectionStarts[sectionStarts.length - 1];
                    if (!lastSection || lastSection.name !== sp.name || i - lastSection.lineIdx > 3) {
                        sectionStarts.push({ name: sp.name, category: sp.category, lineIdx: i, charIdx: charOffset });
                    }
                    break;
                }
            }
        }
        charOffset += lines[i].length + 1;
    }
    
    const availableSections = [...new Set(sectionStarts.map(s => s.name))];
    
    // Fuzzy match the requested section
    const query = sectionName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Find matching section(s) — combine if multiple matches (e.g. multiple "Results")
    const matchingStarts = sectionStarts.filter(s => {
        const name = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cat = s.category.toLowerCase();
        return name.includes(query) || query.includes(cat) || cat.includes(query)
            || query.split(/\s+/).some(word => word.length > 3 && (name.includes(word) || cat.includes(word)));
    });
    
    if (matchingStarts.length === 0) {
        console.log(`[PDF] Section "${sectionName}" not found. Available: ${availableSections.join(', ')}`);
        return { found: false, availableSections };
    }
    
    // Combine all matching sections' content
    let combinedContent = '';
    const allIdx = sectionStarts.map((s, i) => i);
    
    for (const match of matchingStarts) {
        const idx = sectionStarts.indexOf(match);
        const endCharIdx = idx + 1 < sectionStarts.length
            ? sectionStarts[idx + 1].charIdx
            : text.length;
        
        const sectionContent = text.substring(match.charIdx, endCharIdx).trim();
        combinedContent += (combinedContent ? '\n\n---\n\n' : '') + sectionContent;
    }
    
    const statistics = extractStatisticsFromText(combinedContent);
    
    const primaryMatch = matchingStarts[0];
    console.log(`[PDF] Extracted section "${primaryMatch.name}" (${combinedContent.length} chars, ${matchingStarts.length} sub-sections)`);
    
    return {
        found: true,
        section: {
            name: primaryMatch.name,
            category: primaryMatch.category,
            content: combinedContent,
            contentLength: combinedContent.length,
            statistics,
        },
        availableSections,
    };
}

// ─── Smart Summary (token-efficient) ────────────────────────────

export interface SmartSummary {
    documentType: 'thesis' | 'article' | 'report' | 'unknown';
    language: 'es' | 'en' | 'mixed';
    pages: number;
    totalWords: number;
    format: 'markdown' | 'text';
    sections: { name: string; category: string; preview: string }[];
    totalChars: number;
}

/**
 * Generate a token-efficient summary of an academic PDF.
 * Extracts key sections (abstract, methods, results, conclusions) with smart truncation.
 * Designed to give LLMs maximum context with minimum tokens.
 */
export async function smartSummary(source: string, maxTotalChars: number = 8000): Promise<SmartSummary> {
    // Try markdown extraction first for better structure
    const mdResult = await extractMarkdown(source, { maxChars: -1 });
    const text = mdResult.text;
    const format = mdResult.format;

    const { type: documentType, language } = classifyDocument(text);
    const totalWords = text.split(/\s+/).filter(w => w.length > 1).length;

    // Detect sections
    const lines = text.split('\n');
    const sectionStarts: { name: string; category: string; lineIdx: number; charIdx: number }[] = [];
    let charOffset = 0;

    // If markdown, detect via headings first
    if (format === 'markdown') {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
            if (headingMatch) {
                const headingText = headingMatch[2].trim();
                // Try to match to an academic section
                for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                    if (sp.pattern.test(headingText)) {
                        sectionStarts.push({ name: sp.name, category: sp.category, lineIdx: i, charIdx: charOffset });
                        break;
                    }
                }
            }
            charOffset += lines[i].length + 1;
        }
    }

    // Fallback to regex detection if markdown headings didn't find sections
    if (sectionStarts.length < 3) {
        sectionStarts.length = 0;
        charOffset = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 2 && line.length < 100) {
                for (const sp of ACADEMIC_SECTION_PATTERNS_FULL) {
                    if (sp.pattern.test(line)) {
                        const lastSection = sectionStarts[sectionStarts.length - 1];
                        if (!lastSection || lastSection.name !== sp.name || i - lastSection.lineIdx > 3) {
                            sectionStarts.push({ name: sp.name, category: sp.category, lineIdx: i, charIdx: charOffset });
                        }
                        break;
                    }
                }
            }
            charOffset += lines[i].length + 1;
        }
    }

    // Priority sections for summary (in order of importance)
    const priorityCategories = ['front', 'conclusion', 'results', 'methods', 'intro', 'theory'];
    const charsPerSection = Math.floor(maxTotalChars / Math.min(sectionStarts.length || 1, 6));

    const sections: { name: string; category: string; preview: string }[] = [];
    let usedChars = 0;

    // Sort sections by priority for budget allocation
    const sortedSections = [...sectionStarts].sort((a, b) => {
        const aIdx = priorityCategories.indexOf(a.category);
        const bIdx = priorityCategories.indexOf(b.category);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    for (const sec of sortedSections) {
        if (usedChars >= maxTotalChars) break;

        const idx = sectionStarts.indexOf(sec);
        const endCharIdx = idx + 1 < sectionStarts.length
            ? sectionStarts[idx + 1].charIdx
            : text.length;

        const content = text.substring(sec.charIdx, endCharIdx).trim();
        const budget = Math.min(charsPerSection, maxTotalChars - usedChars);
        const preview = content.substring(0, budget);

        sections.push({ name: sec.name, category: sec.category, preview });
        usedChars += preview.length;
    }

    // Re-sort by document order
    sections.sort((a, b) => {
        const aIdx = sectionStarts.findIndex(s => s.name === a.name);
        const bIdx = sectionStarts.findIndex(s => s.name === b.name);
        return aIdx - bIdx;
    });

    console.log(`[PDF] Smart summary: ${documentType} (${language}), ${sections.length} sections, ${usedChars} chars total`);

    return {
        documentType,
        language,
        pages: mdResult.pages,
        totalWords,
        format,
        sections,
        totalChars: usedChars,
    };
}

// ─── Cleanup ────────────────────────────────────────────────────

/** Clear expired cache entries */
export function clearPdfCache(): void {
    const now = Date.now();
    for (const [key, val] of pdfCache.entries()) {
        if (now - val.timestamp > CACHE_TTL) {
            pdfCache.delete(key);
        }
    }
}
