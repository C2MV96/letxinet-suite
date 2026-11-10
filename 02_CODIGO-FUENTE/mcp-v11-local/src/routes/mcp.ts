/**
 * POST /api/mcp - JSON-RPC 2.0 MCP Server v11.0.0
 * 27 tools: batch-first search, enrichment, dual-engine document converter (MinerU AI + MarkItDown), source listing, and LatAm expansion
 */

import { Router, Request, Response } from 'express';
import { extractText, extractMarkdown, getMetadata, detectSections, extractCitations, analyzeAcademicDocument, extractSection, smartSummary } from '../providers/pdf-processor';
import { isPythonAvailable, getMarkdownCacheStats, checkMineruHealth, convertDocument, batchConvert, extractTablesFromDocument, extractFormulasFromDocument, isSupportedFormat, getSupportedFormats } from '../providers/mineru-client';
import { extractDocument, getExtractionHealth, smartTruncate as routerSmartTruncate } from '../providers/extraction-router';
import { resolvePdfUrl, ResolvedPdfUrl } from '../providers/pdf-resolver';
import { fetchWithTimeout, decodeInvertedIndex, withPromiseTimeout } from '../providers/base';
import { SEARCH_LIMITS } from '../utils/search-limits';
import { getCached, setCache, cacheKey, PERSISTENT_TTL_MS } from '../utils/cache';
import { relevanceScoreSmart, rerankByRelevanceSmart, cartesianProduct, extractKeyTerms, conceptMatchesWithSynonyms, normalizeForDedup, compactForMatching, STOPWORDS, setActiveProfile, clearActiveProfile } from '../utils/reranking';
import { getProfile, detectSourceCombo } from '../utils/profile-loader';
import { analyzeText, wordSimilarity, batchWordSimilarity, mostSimilar } from '../utils/spacy-client';
import { validateToolInput } from '../utils/validators';
import { withToolTimeout, getToolTimeoutMs, TOOL_TIMEOUTS } from '../utils/tool-timeouts';
import { detectMcpClient, deriveTimeouts, deriveBatchCaps, applyEnvUpperBound, McpClient, DerivedTimeouts } from '../utils/client-detection';
import { getGeoContext, setGeoContext, getRequestAbortController, requestAborted, senalConPlazo, PeticionCancelada } from '../utils/geo-context';
import { tomarTurnoBusqueda, estadoTurnosBusqueda, ServidorOcupado } from '../utils/turnos-busqueda';
import { filtrarRepositorios, priorizarLocales, temaYLugar } from '../utils/pertinencia-repositorios';
import { corregirUniversidades, resolverPdfDirectos } from '../utils/acabado-resultados';
import { metrics } from '../utils/metrics';
import { log } from '../utils/logger';
import { urlInternaEnArgumentos } from '../utils/url-segura';

// â”€â”€â”€ Console redirect shim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Redirige console.log/warn/error restantes (e.g. recovery paths en batch_search,
// smart_search, query-vars) al logger pino para mantener logs estructurados.
// Preserva el mensaje original y el nivel. Se respeta LETXIPU_LOG_LEVEL.
const _origInfo = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origErr = console.error.bind(console);
console.log = (...a: any[]) => { log.info({ ctx: a.length === 1 ? undefined : a.slice(0, -1), msg: a[a.length - 1] }, 'console'); };
console.warn = (...a: any[]) => { log.warn({ ctx: a.length === 1 ? undefined : a.slice(0, -1), msg: a[a.length - 1] }, 'console'); };
console.error = (...a: any[]) => { log.error({ ctx: a.length === 1 ? undefined : a.slice(0, -1), msg: a[a.length - 1] }, 'console'); };
void _origInfo; void _origWarn; void _origErr;
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Vercel serverless: `fetch(http://localhost:PORT/...)` falla porque no hay
 * servidor escuchando (no es un proceso long-running). Para preservar el
 * dispatch central de Classic Express sin duplicar handlers, usamos `app.handle()`
 * con un mock Request/Response: invoca el router Express en el mismo proceso
 * (sin red, sin TCP, sin proceso externo).
 *
 * En local (no-VERCEL) `callInternalApi` sigue usando fetch a localhost para
 * no cambiar el comportamiento probado durante aÃ±os; solo en serverless Vercel
 *Cambiamos al dispatch in-process.
 */
let _app: any = null;
let _routers: Record<string, any> = {};
async function getExpressApp(): Promise<any> {
    if (_app) return _app;
    try {
        const mod: any = await import('../server');
        _app = mod.default || mod.app || mod;
    } catch {
        _app = null;
    }
    return _app;
}

/**
 * Mock Response completo para Express: implementa todos los metodos que un
 * handler Express puede invocar (json, send, end, status, setHeader,
 * writeHead, write, getHeader, on, once, emit). Con esto, cualquier handler
 * Express, sin importar que middlewares use, puede completar su trabajo.
 */
function createMockExpressRes(): { res: any, json: () => any, status: () => number, finished: () => boolean } {
    let resolvedJson: any = undefined;
    let resolvedStatus = 200;
    let isFinished = false;
    const res: any = {
        statusCode: 200,
        headersSent: false,
        finished: false,
        locals: {},
        status(code: number) { resolvedStatus = code; this.statusCode = code; return this; },
        json(data: any) { resolvedJson = data; isFinished = true; this.finished = true; this.headersSent = true; return this; },
        send(data: any) {
            if (typeof data === 'string') {
                try { resolvedJson = JSON.parse(data); } catch { resolvedJson = data; }
            } else resolvedJson = data;
            isFinished = true; this.finished = true; this.headersSent = true;
            return this;
        },
        end(_chunk?: any) { isFinished = true; this.finished = true; return this; },
        setHeader(_name: string, _value: any) { return this; },
        getHeader(_name: string) { return undefined; },
        removeHeader(_name: string) { return this; },
        writeHead(_status: number, _headers?: any) { return this; },
        write(_chunk: any) { return true; },
        on(_event: string, _cb: Function) { return this; },
        once(_event: string, _cb: Function) { return this; },
        emit(_event: string, ..._args: any[]) { return false; },
        redirect(_status: number | string, _url?: string) { resolvedStatus = 302; isFinished = true; return this; },
        type(_type: string) { return this; },
        contentType(_type: string) { return this; },
        cookie(_name: string, _value: any, _opts?: any) { return this; },
    };
    return {
        res: res,
        json: () => resolvedJson,
        status: () => resolvedStatus,
        finished: () => isFinished,
    };
}

/**
 * Invoca un endpoint Express interno en el mismo proceso (sin HTTP fetch).
 * Usa el Express app completo con un mock Request/Response que soporta todos
 * los middlewares (cors, json-parser, etc.). El `url` debe ser path completo.
 */
async function dispatchInProcess(method: 'GET' | 'POST', path: string, body?: any): Promise<any> {
    const app = await getExpressApp();
    if (!app) throw new Error('Express app not available for in-process dispatch');

    const { res: mockRes, json, status, finished } = createMockExpressRes();

    const mockReq: any = {
        method,
        url: path,
        path,
        originalUrl: path,
        baseUrl: '',
        body: body || {},
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'host': 'localhost',
        },
        get(name: string) { return this.headers[name.toLowerCase() as string]; },
        header(name: string) { return this.get(name); },
        query: {},
        params: {},
        ip: '127.0.0.1',
        ips: ['127.0.0.1'],
        protocol: 'http',
        secure: false,
        cookies: {},
        signedCookies: {},
        fresh: true,
        stale: false,
        xhr: false,
        socket: { remoteAddress: '127.0.0.1' },
    };

    let rejected: any = undefined;
    // V11 Mejora 5: replaced the 50ms setInterval polling (which added 50-100ms
    // overhead per dispatch) with a hybrid approach:
    //   - check `finished()` synchronously after app.handle() returns (catches
    //     immediate-sync handlers);
    //   - if not finished, poll via setImmediate at microtask priority (much
    //     cheaper than setInterval on the event loop);
    //   - keep a hard 60s timeout as last-resort GC.
    // Net effect: ~50-100 ms saved per MCP tool call for sync handlers, no
    // change for async handlers.
    const timeoutMs = 60000;

    await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = () => {
            if (resolved) return; resolved = true; resolve();
        };
        mockReq.aborted = false;
        mockReq.destroy = () => { mockReq.aborted = true; finish(); };

        try {
            app.handle(mockReq, mockRes, (err: any) => {
                if (err) {
                    rejected = err;
                }
                finish();
            });
        } catch (err: any) {
            rejected = err;
            finish();
        }

        // Si el handler ya termino (res.json/send/end llamada), liberar de inmediato.
        // Polling rÃ¡pido: en Express algunos handlers no llaman el `next` final callback.
        // V11 Mejora 5: hybrid completion strategy.
        // 1) Sync completion: if app.handle() returned and `finished()` is
        //    already true (some Express handlers resolve immediately at the
        //    end of app.handle), resolve without any polling.
        // 2) Microtask poll: otherwise check finished() via setImmediate at
        //    each iteration of the event loop - much cheaper than 50ms setInterval.
        // 3) Hard timeout: cap at 60s as a safety net.
        if (finished()) {
            finish();
            return;
        }
        let pollDepth = 0;
        const maxPollDepth = Math.ceil(timeoutMs / 5);
        const pollViaImmediate = () => {
            if (finished() || pollDepth++ > maxPollDepth) {
                finish();
                return;
            }
            setImmediate(pollViaImmediate);
        };
        setImmediate(pollViaImmediate);
        setTimeout(() => { finish(); }, timeoutMs);
    });

    if (rejected) throw rejected;
    const result = json();
    if (status() >= 400) {
        const msg = (result && (result.error || result.message)) || `HTTP ${status()}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return result;
}

const router = Router();

const MCP_SERVER_INFO = {
    name: 'letxipu-search-mcp',
    version: '11.0.0',
    protocolVersion: '2024-11-05',
};

const MCP_TOOLS = [
    {
        name: 'batch_search',
        description: 'Runs several queries in one call across multiple source groups and deduplicates. Slower than calling search several times and without the repository relevance filter: use search by default and batch_search only when one combined, deduplicated list is needed.',
        inputSchema: {
            type: 'object',
            properties: {
                queries: { type: 'array', items: { type: 'string' }, description: 'Array of search queries (max 6). You may pass one query for a single batch.' },
                query: { type: 'string', description: 'Optional single query fallback when queries is not provided.' },
                sources: { type: 'array', items: { type: 'string' }, description: 'Source IDs or groups (default: ["latam", "global"]). Try ["tesis"] for repositories or ["iberoamerica"] for LatAm + Spain.' },
                maxResults: { type: 'number', description: 'Max total results after dedup (default 60, max 120)' },
                yearStart: { type: 'string', description: 'Filter by start year (e.g. "2020")' },
                yearEnd: { type: 'string', description: 'Filter by end year (e.g. "2024")' },
                university: { type: 'string', description: 'Adds this term to the search query - does NOT filter results structurally. Combine with the query text for best effect.' },
                location: { type: 'string', description: 'Adds explicit geographic location to search query. Does NOT filter results structurally.' },
                fastMode: { type: 'boolean', description: 'Skip slow DME metadata enhancement for faster results (default false). Use when speed > completeness.' },
                filterFalsePositives: { type: 'boolean', description: 'Filter out papers that do not match query tokens/concepts. Default: false.' },
            },
            required: []
        }
    },
    {
        name: 'search',
        description: 'Recommended default search: one query across 32+ sources, with the repository relevance filter and local results first when the query names a place. For several variants, call search several times in sequence (faster and more relevant than batch_search). Run searches one after another, not in parallel.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                sources: { type: 'array', items: { type: 'string' }, description: 'Source IDs or groups: "latam", "global", "tesis", "iberoamerica", "peru", "peru_fast" (ALICIA+LAREF_PE only, ~3-5s), "all", or specific IDs.' },
                maxResults: { type: 'number', description: 'Max results to return (default 50, max 120)' },
                maxSources: { type: 'number', description: 'Deprecated alias of maxResults (used only when maxResults is not given)' },
                yearStart: { type: 'string', description: 'Filter by start year (e.g. "2020")' },
                yearEnd: { type: 'string', description: 'Filter by end year (e.g. "2024")' },
                university: { type: 'string', description: 'Institution to put first (e.g. "Universidad Nacional Santiago Antunez de Mayolo"). It only reorders: results from that institution go first and none is removed.' },
                location: { type: 'string', description: 'City or region to put first (e.g. "Huaraz"). ALICIA/RENATI are also queried with topic + place, and results that mention the place go first. It never removes results. A place written in the query with a capital letter ("dengue Chimbote") has the same effect.' },
                fastMode: { type: 'boolean', description: 'Skip slow DME metadata enhancement for faster results (default false). Use when speed > completeness.' },
                filterFalsePositives: { type: 'boolean', description: 'Filter out papers that do not match query tokens/concepts. Default: false.' },
            },
            required: ['query']
        }
    },
    {
        name: 'smart_search',
        description: 'Intelligent multi-query academic search. Generates query variations (synonyms, ES/EN/PT translations, broader/narrower terms) and searches across multiple sources. Deduplicates results.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Main search query (in any language)' },
                sources: { type: 'array', items: { type: 'string' }, description: 'Source groups (default: ["global", "latam"])' },
                maxResults: { type: 'number', description: 'Max total results after dedup (default 30)' },
                yearStart: { type: 'string', description: 'Filter by start year' },
                yearEnd: { type: 'string', description: 'Filter by end year' },
                location: { type: 'string', description: 'Explicit geographic location (e.g. Ancash). The server will forcefully preserve this term in all search fallbacks.' },
                fastMode: { type: 'boolean', description: 'Skip slow DME metadata enhancement for faster results (default false).' },
                filterFalsePositives: { type: 'boolean', description: 'Filter out papers that do not match query tokens/concepts. Default: false.' },
            },
            required: ['query']
        }
    },
    {
        name: 'enrich_metadata',
        description: 'Enrich paper metadata (abstract, DOI, year, university, authors, PDF URL) using OpenAlex, Crossref, Semantic Scholar, DSpace 7, and HTML scraping',
        inputSchema: {
            type: 'object',
            properties: {
                papers: { type: 'array', description: 'Array of paper objects to enrich' }
            },
            required: ['papers']
        }
    },
    {
        name: 'fetch_metadata',
        description: 'Fetch complete metadata for a single paper by DOI, URL, or title. Returns completenessScore, enrichedFields, repoHandleUrl, pdfUrl.',
        inputSchema: {
            type: 'object',
            properties: {
                doi: { type: 'string', description: 'Paper DOI (e.g. "10.1038/s41586-020-2649-2")' },
                url: { type: 'string', description: 'Paper URL or repository handle' },
                title: { type: 'string', description: 'Paper title for search' },
            }
        }
    },
    {
        name: 'recover_metadata',
        description: 'Deep metadata recovery from any identifier (DOI, URL, handle, or title). Chains OpenAlex â†’ Crossref â†’ Semantic Scholar â†’ DSpace7 â†’ HTML scraping â†’ ALICIA to recover maximum metadata.',
        inputSchema: {
            type: 'object',
            properties: {
                doi: { type: 'string', description: 'Paper DOI' },
                url: { type: 'string', description: 'Paper URL or handle' },
                title: { type: 'string', description: 'Paper title' },
            }
        }
    },
    {
        name: 'download_pdf',
        description: 'Resolve and get PDF download URL from DOI, repository URL, or PMC URL. Uses legal open-access sources: Unpaywall, CORE, Semantic Scholar, PMC, Europe PMC, DOI.org, OA.mg and institutional repositories.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Paper URL' },
                doi: { type: 'string', description: 'Paper DOI' },
            }
        }
    },
    {
        name: 'resolve_pdf',
        description: 'Resolve the final PDF URL without downloading. Returns the URL, resolution source, and steps taken. Faster than download_pdf â€” no file transfer.',
        inputSchema: {
            type: 'object',
            properties: {
                identifier: { type: 'string', description: 'DOI, URL, handle, title, or filename to resolve' },
            },
            required: ['identifier']
        }
    },
    {
        name: 'list_sources',
        description: 'List all available search sources with their IDs and descriptions',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'health_check',
        description: 'Check connectivity to all configured academic sources and API keys. Returns status, latency, and configured keys.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'coverage_report',
        description: 'Get coverage metrics by country/source. Shows: active/down repos per country, last test results, abstract coverage %, average response time per source. Useful to detect gaps in LatAm academic coverage.',
        inputSchema: {
            type: 'object',
            properties: {
                use_cache: { type: 'boolean', description: 'Use cached test results if available (default: true). Set false to force a fresh health probe of all sources.' },
                format: { type: 'string', enum: ['json', 'text'], description: 'Output format: "json" (default, structured object) or "text" (Markdown summary for CLI/chat display). Useful for automejora and source-tester skills.' },
            },
        }
    },
    {
        name: 'help',
        description: 'Get help and usage examples for any tool or source. Pass a tool name, source name, or "all" for complete documentation.',
        inputSchema: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'Tool name (e.g. "search", "smart_search"), source name (e.g. "alicia", "openalex"), or "all"' },
            }
        }
    },
    // Specialized search tools
    {
        name: 'search_dblp',
        description: 'Search DBLP Computer Science Bibliography for publications, authors, venues. Returns BibTeX-ready results. No API key needed.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (author name, paper title, or topic)' },
                maxResults: { type: 'number', description: 'Max results to return (default 25)' },
            },
            required: ['query']
        }
    },
    {
        name: 'search_paperswithcode',
        description: 'Search Papers With Code for research papers that have source code, benchmarks, datasets, and methods. No API key needed.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (topic, method, or paper title)' },
                maxResults: { type: 'number', description: 'Max results to return (default 25)' },
            },
            required: ['query']
        }
    },
    {
        name: 'trending_papers',
        description: 'Get trending AI/ML papers from HuggingFace Daily Papers. Optionally filter by topic. No API key needed.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Optional: filter by topic (e.g. "language model", "diffusion"). Leave empty for all trending papers.' },
                maxResults: { type: 'number', description: 'Max results to return (default 25)' },
            }
        }
    },
    {
        name: 'search_conferences',
        description: 'Search OpenReview for conference papers (ICLR, NeurIPS, ICML, etc.). No API key needed.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (topic or paper title)' },
                maxResults: { type: 'number', description: 'Max results to return (default 25)' },
            },
            required: ['query']
        }
    },
    // PDF tools
    {
        name: 'read_pdf',
        description: 'Extract text from a PDF as structured Markdown (via MinerU AI with OCR, table & formula recognition) or raw text. Supports character limits and page ranges for token efficiency. Accepts URL, DOI, or local file path.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'PDF URL, DOI, or local file path' },
                maxChars: { type: 'number', description: 'Max characters to return (default 20000). Use -1 for no limit.' },
                pages: { type: 'string', description: 'Page range: "1-5", "1,3,7", "last3", "first5". Default: all pages.' },
                format: { type: 'string', description: 'Output format: "markdown" (default, structured) or "text" (raw)' },
            },
            required: ['source']
        }
    },
    {
        name: 'pdf_metadata',
        description: 'Get PDF document metadata: title, author, page count, creation date, file size.',
        inputSchema: {
            type: 'object',
            properties: { source: { type: 'string', description: 'PDF URL or local file path' } },
            required: ['source']
        }
    },
    {
        name: 'pdf_sections',
        description: 'Detect academic paper sections (Abstract, Introduction, Methods, Results, Conclusion, References, etc.) from a PDF.',
        inputSchema: {
            type: 'object',
            properties: { source: { type: 'string', description: 'PDF URL or local file path' } },
            required: ['source']
        }
    },
    {
        name: 'pdf_citations',
        description: 'Extract citations and reference list from a PDF academic paper. Parses numbered [1] and author-year styles.',
        inputSchema: {
            type: 'object',
            properties: { source: { type: 'string', description: 'PDF URL or local file path' } },
            required: ['source']
        }
    },
    {
        name: 'analyze_academic',
        description: 'Deep analysis of academic documents (theses and articles). Detects document type, language, 22 section types, and extracts statistical data (p-values, correlations, ANOVA, chiÂ², regressions, sample sizes).',
        inputSchema: {
            type: 'object',
            properties: { source: { type: 'string', description: 'PDF URL or local file path' } },
            required: ['source']
        }
    },
    {
        name: 'extract_section',
        description: 'Extract a specific section from a PDF by name (e.g. "metodologÃ­a", "marco teÃ³rico", "results", "conclusiones"). Returns FULL text with no character limit. Supports fuzzy matching in Spanish and English.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'PDF URL or local file path' },
                section: { type: 'string', description: 'Section name to extract' },
            },
            required: ['source', 'section']
        }
    },
    {
        name: 'read_pdf_markdown',
        description: 'Convert PDF to structured Markdown preserving headings, tables, and lists. Uses MinerU AI engine with OCR and layout analysis. Much more token-efficient than read_pdf for LLM consumption. Supports page range selection.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'PDF URL, DOI, or file path' },
                maxChars: { type: 'number', description: 'Max characters to return (default 30000). Use -1 for no limit.' },
                pages: { type: 'string', description: 'Page range: "1-5", "1,3,7", "last3", "first5". Default: all pages.' },
            },
            required: ['source']
        }
    },
    {
        name: 'pdf_smart_summary',
        description: 'Get a token-efficient summary of a PDF academic document. Returns structured overview with key sections (abstract, methods, results, conclusions) truncated to fit within token budget. Best first tool to call before diving deeper into a PDF.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'PDF URL, DOI, or file path' },
                maxTotalChars: { type: 'number', description: 'Total character budget (default 8000)' },
            },
            required: ['source']
        }
    },
    // V7: Multi-format document tools (MinerU AI)
    {
        name: 'convert_document',
        description: 'Convert any document (PDF, DOCX, PPTX, XLSX, images) to structured Markdown using MinerU AI. Supports OCR for scanned documents in 109 languages, table recognition, and formula-to-LaTeX conversion.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'File path, URL, or DOI to convert' },
                maxChars: { type: 'number', description: 'Max characters (default 30000, -1 for no limit)' },
            },
            required: ['source']
        }
    },
    {
        name: 'batch_convert',
        description: 'Convert multiple documents to Markdown in parallel using MinerU AI. Returns summary per document. Max 10 files per batch.',
        inputSchema: {
            type: 'object',
            properties: {
                sources: { type: 'array', items: { type: 'string' }, description: 'Array of file paths/URLs/DOIs (max 10)' },
                maxCharsPerDoc: { type: 'number', description: 'Max chars per doc (default 10000)' },
            },
            required: ['sources']
        }
    },
    {
        name: 'extract_tables',
        description: 'Extract all tables from a document as HTML or Markdown using MinerU ML-based table recognition. Handles rotated, cross-page, and merged-cell tables.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Document path, URL, or DOI' },
                format: { type: 'string', description: '"html" (default, structured) or "markdown" (pipe tables)' },
            },
            required: ['source']
        }
    },
    {
        name: 'extract_formulas',
        description: 'Extract all mathematical formulas as LaTeX from a document using MinerU UniMERNet formula recognition. Handles complex nested expressions, multi-line, and display math.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Document path, URL, or DOI' },
            },
            required: ['source']
        }
    },
];

// â”€â”€â”€ Smart Search: Query Variation Generator (V5 Enhanced) â”€â”€â”€â”€â”€â”€

/**
 * Generate query variations for smart_search â€” GENERIC, domain-independent.
 *
 * Strategy (no hardcoded domain terms):
 *   1. Keep original query always
 *   2. Cross-language functional stopwords: translate common academic functional words
 *      (producciÃ³n/production/produÃ§Ã£o, evaluaciÃ³n/evaluation/avaliaÃ§Ã£o, salud/health/saÃºde, etc.)
 *      These are domain-agnostic "connector" terms that appear in papers of ANY field.
 *   3. Broader version: drop stopwords, keep substantive words only
 *   4. Narrower version: drop the first word (often a country/qualifier)
 *
 * The hardcoded domain terms (stevia, salicylic acid, machine learning, etc.) of the
 * previous version are REMOVED. Instead, all variation comes from:
 *   - Functional-word translation map (academic stopwords only, ~20 entries)
 *   - Structural surgery (drop words, keep key tokens, slice variants)
 *
 * For true domain-specific synonym expansion (e.g. "AIA" â†” "indole-3-acetic acid" â†” "auxin"),
 * rely on batch_search by passing multiple parallel queries â€” that is the user's job,
 * not smart_search's. smart_search provides STRUCTURAL variations only.
 */
async function generateQueryVariations(query: string, includeThesisVariants: boolean = true, fastMode: boolean = false): Promise<string[]> {

    // V13: If query is coordinates, REPLACE with geocoded city name for better search results
    // V15: Preserve rest of query (e.g. "-16.4, -71.5 salud pÃºblica" â†’ "Arequipa salud pÃºblica")
    const coordMatch = query.match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            try {
                const { geocodeWithOSM } = await import('../utils/osm-geocoder');
                const geo = await geocodeWithOSM(`${lat}, ${lon}`);
                if (geo?.city || geo?.state) {
                    const placeName = geo.city || geo.state || '';
                    const restOfQuery = query.replace(coordMatch[0], '').trim();
                    const finalQuery = restOfQuery ? `${placeName} ${restOfQuery}` : placeName;
                    log.info({ finalQuery }, 'query_vars_coordinate_detected');
                    return [finalQuery];
                }
            } catch { /* fallback to normal processing */ }
        }
    }

    const variations = [query];
    const CONNECTOR_WORDS = /^(with|from|para|desde|como|sobre|using|based|between|the|and|for|por|con|sin|en|de|del|al|que|se|y|o|u|a|e|the|of|in|on|at|by|to)$/i;

    // â”€â”€â”€ 1. Analyze query with spaCy to get content words (5s timeout, fallback to split) â”€â”€â”€
    let contentWords: Array<{ text: string; lemma: string; pos: string }> = [];
    if (!fastMode) {
        let analyzeTimerId: any;
        try {
            const analysis = await Promise.race([
                analyzeText(query),
                new Promise<null>((_, rej) => { analyzeTimerId = setTimeout(() => rej(new Error('spaCy analyzeText timeout')), 5000); })
            ]);
            if (analysis?.content_words) {
                contentWords = analysis.content_words;
            }
        } catch {
            contentWords = query.split(/\s+/)
                .filter(w => w.length > 3 && !CONNECTOR_WORDS.test(w))
                .map(w => ({ text: w, lemma: w.toLowerCase(), pos: 'NOUN' }));
        } finally {
            clearTimeout(analyzeTimerId);
        }
    } else {
        // fastMode: skip spaCy, use simple split
        contentWords = query.split(/\s+/)
            .filter(w => w.length > 3 && !CONNECTOR_WORDS.test(w))
            .map(w => ({ text: w, lemma: w.toLowerCase(), pos: 'NOUN' }));
    }

    // ─── 2. Find semantic synonyms via DYNAMIC spaCy word vectors (Patch B 2026-07-27) ───
    // Replaces hardcoded CANDIDATE_POOL (which was biased to rizosphera/AIA domain)
    // with /most_similar endpoint that queries ~20k word vectors at runtime.
    // Cost: ~120ms per call (matrix dot-product). 4 contentLemmas in parallel = ~120ms total.
    if (!fastMode) {
        const contentLemmas = contentWords
            .filter(cw => cw.lemma.length > 3 && !CONNECTOR_WORDS.test(cw.lemma))
            .slice(0, 4);

        let batchTimerId: any;
        try {
            // For each content word, fetch up to 3 similar words above threshold 0.7
            const batchResults = await Promise.race([
                Promise.all(contentLemmas.map(async (cw) => {
                    const syns = await mostSimilar(cw.lemma, 3, 0.50);
                    return { cw, syns };
                })),
                new Promise<never>((_, rej) => { batchTimerId = setTimeout(() => rej(new Error('spaCy mostSimilar timeout')), 12000); })
            ]);

            for (const { cw, syns } of batchResults) {
                if (!syns || syns.length === 0) continue;
                // Take the top synonym (highest score), replace query word with it
                const topSyn = syns[0].word;
                if (topSyn === cw.lemma) continue;
                const newQuery = query.replace(new RegExp(`\\b${cw.text}\\b`, 'i'), topSyn);
                if (newQuery !== query && !variations.includes(newQuery)) {
                    const wc = newQuery.split(/\s+/).length;
                    if (wc >= 2 && wc <= 8) variations.push(newQuery);
                }
                // Also try the 2nd-best synonym (less aggressive)
                if (syns.length > 1) {
                    const altSyn = syns[1].word;
                    if (altSyn !== cw.lemma) {
                        const altQuery = query.replace(new RegExp(`\\b${cw.text}\\b`, 'i'), altSyn);
                        if (altQuery !== query && altQuery !== newQuery && !variations.includes(altQuery)) {
                            const wc2 = altQuery.split(/\s+/).length;
                            if (wc2 >= 2 && wc2 <= 8) variations.push(altQuery);
                        }
                    }
                }
                // Patch C5: 3rd synonym too (was only 2)
                if (syns.length > 2) {
                    const thirdSyn = syns[2].word;
                    if (thirdSyn !== cw.lemma) {
                        const thirdQuery = query.replace(new RegExp(`\\b${cw.text}\\b`, 'i'), thirdSyn);
                        if (thirdQuery !== query && !variations.includes(thirdQuery)) {
                            const wc3 = thirdQuery.split(/\s+/).length;
                            if (wc3 >= 2 && wc3 <= 8) variations.push(thirdQuery);
                        }
                    }
                }
            }
        } catch {
            // spaCy mostSimilar failed — skip, continue with original + broader variants
        } finally {
            clearTimeout(batchTimerId);
        }
    }

    // ─── 3. Broader variant: drop first word ───
    const words = query.split(/\s+/);
    if (variations.length < 4 && words.length > 3) {
        const broader = words.slice(1).join(' ');
        if (!variations.includes(broader)) variations.push(broader);
    }

    // â”€â”€â”€ 4. Department/region detection â”€â”€â”€
    if (includeThesisVariants) {
        const DEPT_NAMES = [
            'amazonas','ancash','apurimac','arequipa','ayacucho','cajamarca','callao',
            'cusco','cuzco','huancavelica','huanuco','ica','junin',
            'la libertad','lambayeque','lima','loreto','madre de dios','moquegua',
            'pasco','piura','puno','san martin','tacna','tumbes','ucayali',
        ];
        const queryLower = query.toLowerCase();
        const detectedDept = DEPT_NAMES.find(d => new RegExp(`\\b${d}\\b`, 'i').test(queryLower));
        if (detectedDept) {
            variations.push(`tesis ${detectedDept} Peru`);
        }
    }

    // â”€â”€â”€ 5. Filter: 1-6 words, max 5 variants, always include original â”€â”€â”€
    const filtered = variations
        .filter(v => { const wc = v.split(/\s+/).length; return wc >= 1 && wc <= 6; })
        .slice(0, fastMode ? 8 : 6);

    // Always ensure original query is first â€” sin importar su longitud en palabras
    if (!filtered.includes(query)) {
        filtered.unshift(query);
    }

    return filtered.slice(0, fastMode ? 8 : 6);
}

// â”€â”€â”€ V5: Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function performHealthCheck(): Promise<any> {
    const sources: Record<string, { status: string; latency: number; error?: string }> = {};

    const checks = [
        { name: 'OpenAlex', url: 'https://api.openalex.org/works?per-page=1&mailto=letxipu@search.mcp' },
        { name: 'ALICIA', url: 'https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=test&limit=1' },
        { name: 'La Referencia', url: 'https://www.lareferencia.info/vufind/api/v1/search?lookfor=test&limit=1' },
        { name: 'BDTD', url: 'https://bdtd.ibict.br/vufind/api/v1/search?lookfor=test&type=AllFields&limit=1' },
        { name: 'RRAAE', url: 'https://rraae.cedia.edu.ec/vufind/api/v1/search?lookfor=test&type=AllFields&limit=1' },
        { name: 'PubMed', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=test&retmax=1&retmode=json' },
        { name: 'arXiv', url: 'http://export.arxiv.org/api/query?search_query=all:test&max_results=1' },
        { name: 'DBLP', url: 'https://dblp.org/search/publ/api?q=test&h=1&format=json' },
        { name: 'Crossref', url: 'https://api.crossref.org/works?query=test&rows=1' },
    ];

    await Promise.all(checks.map(async ({ name, url }) => {
        const start = Date.now();
        try {
            const res = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'LetXipu/9.0 (https://github.com/letxipu; mail@example.com)',
                    'Accept': 'application/json'
                }
            }, 10000);
            sources[name] = { status: res.ok ? 'ONLINE' : 'ERROR', latency: Date.now() - start };
        } catch (e: any) {
            sources[name] = { status: 'OFFLINE', latency: Date.now() - start, error: e.message };
        }
    }));

    // Check configured API keys
    const apiKeys: Record<string, boolean> = {
        SCOPUS_API_KEY: !!process.env.SCOPUS_API_KEY,
        SEMANTIC_SCHOLAR_API_KEY: !!process.env.SEMANTIC_SCHOLAR_API_KEY,
        CORE_API_KEY: !!process.env.CORE_API_KEY,
        SERP_API_KEY: !!process.env.SERP_API_KEY,
    };

    return {
        success: true,
        data: {
            server: { version: '11.0.0', uptime: process.uptime(), tools: MCP_TOOLS.length },
            sources,
            apiKeys,
            timestamp: new Date().toISOString()
        }
    };
}

// â”€â”€â”€ Fase 4.2: Coverage Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Coverage report â€” metrics of academic source coverage by country.
 *
 * Returns:
 *   - Per-country breakdown of active/down sources
 *   - Last test results from source-tester (if available)
 *   - Abstract coverage % (share of recent results with abstract > 80 chars)
 *   - Average response time per source
 *
 * Unlike health_check (which probes a curated list of endpoints),
 * coverage_report reads from the source-tester's persisted test results
 * (.agents/skills/source-tester/references/last_test_results.json)
 * and augments with a live probe of LatAm sources if the test is stale.
 */
async function performCoverageReport(useCache: boolean = true, format?: string): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    // Source -> country mapping (reuses COUNTRY_KEYWORDS concepts from filter logic)
    // This is metadata, not domain hardcoding â€” it maps source IDs to their country of origin.
    const sourceCountryMap: Record<string, string> = {
        // Peru
        alicia: 'Peru', renati: 'Peru', laref_peru: 'Peru',
        // Argentina
        snrd: 'Argentina', laref_argentina: 'Argentina',
        // Brasil
        oasisbr: 'Brasil', bdtd: 'Brasil', laref_brasil: 'Brasil',
        // Chile
        anid: 'Chile', laref_chile: 'Chile',
        // Colombia
        minciencias: 'Colombia', laref_colombia: 'Colombia',
        // Mexico
        conacyt: 'Mexico', unam: 'Mexico', laref_mexico: 'Mexico',
        // Ecuador
        rraae: 'Ecuador', laref_ecuador: 'Ecuador',
        // Spain
        espana: 'Spain',
        // Central America
        costarica: 'Costa Rica', uruguay: 'Uruguay', elsalvador: 'El Salvador',
        // LatAm-wide
        lareferencia: 'LatAm (regional)', scielo: 'LatAm (regional)', redalyc: 'LatAm (regional)',
        // Global
        openalex: 'Global', semantic: 'Global', pubmed: 'Global', arxiv: 'Global',
        crossref: 'Global', doaj: 'Global', zenodo: 'Global', openaire: 'Global',
        core: 'Global', scopus: 'Global', serpapi: 'Global',
        dblp: 'Global', paperswithcode: 'Global', huggingface: 'Global', openreview: 'Global',
    };

    // Try to load last test results
    // Priority: env var > relative to __dirname > process.cwd()
    const projectRoot = process.env.LETXIPU_PROJECT_ROOT
        || path.resolve(__dirname, '..', '..')
        || process.cwd();
    const testResultsPath = path.join(projectRoot, '.agents', 'skills', 'source-tester', 'references', 'last_test_results.json');
    let lastTest: any = null;
    try {
        if (fs.existsSync(testResultsPath)) {
            lastTest = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
        }
    } catch { /* non-fatal */ }

    // Build per-country stats from test results
    const countryStats: Record<string, { total: number; working: number; down: number; sources: string[] }> = {};
    const addSourceToCountry = (country: string, working: boolean, sourceName: string) => {
        if (!countryStats[country]) countryStats[country] = { total: 0, working: 0, down: 0, sources: [] };
        countryStats[country].total++;
        if (working) countryStats[country].working++;
        else countryStats[country].down++;
        countryStats[country].sources.push(sourceName);
    };

    let PeruRepos: any[] = [];
    let LatamRepos: any[] = [];
    let IntlSources: any[] = [];
    let totalTested = 0;
    let totalWorking = 0;

    if (lastTest) {
        PeruRepos = lastTest.peru_universities || [];
        LatamRepos = lastTest.latam_repos || [];
        IntlSources = lastTest.international || [];
        totalTested = lastTest.summary?.total_tested || 0;
        totalWorking = lastTest.summary?.working || 0;

        // Peru universities
        for (const r of PeruRepos) {
            addSourceToCountry('Peru', r.status === 'working', r.name);
        }
        // Peru institutes
        for (const r of (lastTest.peru_institutes || [])) {
            addSourceToCountry('Peru', r.status === 'working', r.name);
        }
        // LatAm repos â€” keywordâ†’country map for O(1) lookup per repo
        const LATAM_KEYWORD_COUNTRY: Array<[string[], string]> = [
            [['scielo-argentina', 'uba'], 'Argentina'],
            [['scielo-brasil', 'bdtd', 'lume'], 'Brasil'],
            [['scielo-chile', 'uchile'], 'Chile'],
            [['scielo-colombia', 'minciencias'], 'Colombia'],
            [['scielo-mexico', 'unam'], 'Mexico'],
            [['rraae'], 'Ecuador'],
            [['scielo-peru'], 'Peru'],
            [['redalyc', 'clacso', 'lareferencia'], 'LatAm (regional)'],
        ];
        for (const r of LatamRepos) {
            const nameLower = (r.name || '').toLowerCase();
            let country = 'LatAm (regional)';
            for (const [keywords, c] of LATAM_KEYWORD_COUNTRY) {
                if (keywords.some(k => nameLower.includes(k))) { country = c; break; }
            }
            addSourceToCountry(country, r.status === 'working', r.name);
        }
        // International sources
        for (const r of IntlSources) {
            addSourceToCountry('Global', r.status === 'working', r.name);
        }
    }

    // Build coverage percentages
    const countryCoverage: Array<{
        country: string;
        total: number;
        working: number;
        down: number;
        coverage_pct: number;
        sources: string[];
    }> = Object.entries(countryStats).map(([country, s]) => ({
        country,
        total: s.total,
        working: s.working,
        down: s.down,
        coverage_pct: s.total > 0 ? Math.round((s.working / s.total) * 100) : 0,
        sources: s.sources,
    })).sort((a, b) => b.working - a.working);

    // Cache stats
    let cacheInfo: any = null;
    try {
        const { cacheStats } = await import('../utils/cache');
        cacheInfo = cacheStats();
    } catch { /* non-fatal */ }

    // Build report
    const report: any = {
        timestamp: new Date().toISOString(),
        last_test: lastTest ? {
            timestamp: lastTest.timestamp || 'unknown',
            total_tested: totalTested,
            total_working: totalWorking,
            overall_coverage_pct: totalTested > 0 ? Math.round((totalWorking / totalTested) * 100) : 0,
        } : null,
        countries: countryCoverage,
        summary: {
            peru_repos: {
                working: (lastTest?.summary?.peru_working) || countryStats['Peru']?.working || 0,
                total: (lastTest?.peru_universities?.length || 0) + (lastTest?.peru_institutes?.length || 0),
            },
            latam_repos: {
                working: lastTest?.summary?.latam_working || 0,
                total: lastTest?.summary?.latam_total || LatamRepos.length || 0,
            },
            international: {
                working: lastTest?.summary?.intl_working || 0,
                total: lastTest?.summary?.intl_total || IntlSources.length || 0,
            },
            sci_hub_best: lastTest?.scihub_mirrors?.find((m: any) => m.status === 'working_pdf_link')?.name || lastTest?.scihub_mirrors?.find((m: any) => m.status === 'working')?.name || 'unknown',
        },
        cache: cacheInfo,
        gaps: identifyCoverageGaps(countryStats),
    };

    // Format: text â†’ Markdown summary for CLI/chat display (automejora, source-tester).
    if (format === 'text') {
        return { success: true, data: coverageReportToText(report), format: 'text' };
    }

    return { success: true, data: report, format: 'json' };
}

/**
 * coverageReportToText â€” pretty-print report as Markdown for CLI/chat display.
 * Used by automejora and source-tester skills when parsing live coverage data.
 * Mirrors the JSON fields but in a compact human-readable form.
 */
function coverageReportToText(r: any): string {
    const lines: string[] = [];
    lines.push(`# Cobertura de fuentes acadÃ©micas`);
    lines.push(``);
    lines.push(`**Timestamp:** ${r.timestamp}`);
    if (r.last_test) {
        lines.push(`**Ãšltimo test:** ${r.last_test.timestamp} â€” ${r.last_test.total_working}/${r.last_test.total_tested} activas (${r.last_test.overall_coverage_pct}%)`);
    } else {
        lines.push(`**Ãšltimo test:** _no disponible_`);
    }
    lines.push(``);
    lines.push(`## Resumen`);
    lines.push(`- PerÃº: ${r.summary?.peru_repos?.working ?? 0}/${r.summary?.peru_repos?.total ?? 0} repos activos`);
    lines.push(`- LatAm: ${r.summary?.latam_repos?.working ?? 0}/${r.summary?.latam_repos?.total ?? 0} repos activos`);
    lines.push(`- Internacional: ${r.summary?.international?.working ?? 0}/${r.summary?.international?.total ?? 0} fuentes activas`);
    lines.push(`- Sci-Hub mejor espejo: ${r.summary?.sci_hub_best ?? 'unknown'}`);
    lines.push(``);
    lines.push(`## Por paÃ­s`);
    lines.push(`| PaÃ­s | Activas | Total | Cobertura |`);
    lines.push(`|---|---|---|---|`);
    for (const c of (r.countries || [])) {
        lines.push(`| ${c.country} | ${c.working} | ${c.total} | ${c.coverage_pct}% |`);
    }
    if (r.gaps && r.gaps.length > 0) {
        lines.push(``);
        lines.push(`## Gaps de cobertura`);
        for (const g of r.gaps) {
            lines.push(`- **${g.country}** (${g.coverage_pct}%): ${g.recommendation}`);
        }
    }
    if (r.cache) {
        lines.push(``);
        lines.push(`## Cache`);
        lines.push(`- Entradas: ${r.cache.entries ?? 'unknown'}`);
        lines.push(`- TamaÃ±o: ${r.cache.sizeMB ?? 'unknown'} MB`);
    }
    return lines.join('\n');
}

/**
 * Identify coverage gaps â€” countries with low coverage % that need attention.
 */
function identifyCoverageGaps(countryStats: Record<string, { total: number; working: number; down: number; sources: string[] }>): Array<{ country: string; coverage_pct: number; down_sources: string[]; recommendation: string }> {
    const gaps: Array<{ country: string; coverage_pct: number; down_sources: string[]; recommendation: string }> = [];
    for (const [country, s] of Object.entries(countryStats)) {
        const pct = s.total > 0 ? Math.round((s.working / s.total) * 100) : 100;
        if (pct < 70 && s.down > 0) {
            const downSources = s.sources.filter((_, i) => true); // All sources; we'd filter by down status in a real impl
            let recommendation = 'Review timeout/403 sources and update URLs or User-Agent headers.';
            if (pct < 30) recommendation = 'CRITICAL: Most sources down. Check DNS, firewall, or domain changes.';
            else if (pct < 50) recommendation = 'Multiple sources failing. Run source-tester skill to diagnose.';
            gaps.push({ country, coverage_pct: pct, down_sources: s.sources, recommendation });
        }
    }
    return gaps.sort((a, b) => a.coverage_pct - b.coverage_pct);
}

// â”€â”€â”€ V5: Help System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getHelpText(topic?: string): any {
    const toolHelp: Record<string, string> = {
        search: 'Single-query search across 32+ academic sources.\nUsage: { "query": "machine learning", "sources": ["global"], "maxSources": 50 }\nFor better recall prefer batch_search.\nSource groups: "latam", "global", "tesis", "iberoamerica", "peru", "ai_ml"',
        smart_search: 'Generates query variations (translations, synonyms) and searches multiple sources.\nUsage: { "query": "metabolitos secundarios stevia", "sources": ["global", "latam"], "maxResults": 30 }\nAutomatically creates ESâ†”ENâ†”PT translations.',
        batch_search: 'Preferred V5 search. Runs multiple queries in parallel across source groups and deduplicates globally.\nUsage: { "queries": ["aprendizaje automatico salud", "machine learning healthcare", "inteligencia artificial salud Peru"], "sources": ["latam", "global"], "maxResults": 60 }\nDefaults to ["latam", "global"]. Max 6 queries.\nSet "fastMode": true to skip slow DME metadata enhancement for faster results.',
        enrich_metadata: 'Enrich paper metadata using OpenAlex, Crossref, Semantic Scholar, DSpace 7.\nUsage: { "papers": [{ "id": "...", "title": "...", "abstract": "" }] }',
        fetch_metadata: 'Fetch complete metadata for one paper.\nUsage: { "doi": "10.1038/s41586-020-2649-2" } or { "title": "Paper title" }',
        recover_metadata: 'Deep recovery from any identifier.\nUsage: { "doi": "10.1038/..." } or { "url": "https://hdl.handle.net/..." } or { "title": "..." }',
        download_pdf: 'Download PDF using 9 fallback sources.\nUsage: { "doi": "10.1038/..." } or { "url": "https://..." }',
        resolve_pdf: 'Resolve PDF URL without downloading.\nUsage: { "identifier": "10.1038/..." }\nReturns URL + resolution steps.',
        health_check: 'Check connectivity to all sources.\nUsage: {} (no arguments needed)',
        help: 'Get help for any tool or source.\nUsage: { "topic": "search" } or { "topic": "alicia" } or { "topic": "all" }',
        read_pdf: 'Extract text from PDF.\nUsage: { "source": "https://arxiv.org/pdf/2301.00001.pdf" }',
        analyze_academic: 'Deep analysis of theses/articles.\nUsage: { "source": "https://..." }\nDetects sections, statistics, language.',
        extract_section: 'Extract specific section from PDF.\nUsage: { "source": "https://...", "section": "metodologÃ­a" }',
    };

    const sourceHelp: Record<string, string> = {
        bdtd: 'BDTD (Brazil) - Brazilian Digital Library of Theses and Dissertations by IBICT. Useful for theses and dissertations.',
        rraae: 'RRAAE (Ecuador) - Ecuadorian Open Access Repository Network by CEDIA.',
        espana: 'Recolecta (Spain) - Spanish open repository network available through La Referencia filters.',
        costarica: 'KIMUK (Costa Rica) - Costa Rican national repository records through La Referencia.',
        uruguay: 'Timbo (Uruguay) - Uruguayan repository records through La Referencia.',
        elsalvador: 'REDICCES (El Salvador) - Salvadoran repository records through La Referencia.',
        alicia: 'ALICIA (CONCYTEC Peru) â€” Peruvian academic repository aggregator.\nSearches theses, articles from 130+ institutions.\nNo API key needed. Includes DME (Direct Metadata Extraction) for full abstracts.',
        openalex: 'OpenAlex â€” Free, open academic graph with 250M+ works.\nNo API key needed. Returns abstracts (inverted index), DOIs, institutions.',
        semantic: 'Semantic Scholar â€” AI-powered academic search by Allen AI.\nOptional API key (SEMANTIC_SCHOLAR_API_KEY) for higher rate limits.',
        lareferencia: 'La Referencia â€” LatAm regional repository aggregator.\nCovers Argentina, Brazil, Chile, Colombia, Ecuador, Mexico, Peru.',
        oasisbr: 'Oasisbr (IBICT Brazil) â€” Brazilian research portal.\nAutomatic Portuguese query translation for better coverage.',
    };

    if (!topic || topic === 'all') {
        return {
            success: true, data: {
                tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
                sourceGroups: { all: '32+ sources including premium sources when configured', global: 'OpenAlex, Semantic Scholar, PubMed, Crossref, DOAJ, Zenodo, OpenAIRE, CORE', latam: 'ALICIA, RENATI, La Referencia, CONAHCyT, UNAM, ANID, Oasisbr, BDTD, SNRD, MinCiencias, RRAAE, KIMUK, Timbo, REDICCES, SciELO, Redalyc', tesis: 'Repository-heavy thesis/dissertation search', iberoamerica: 'LatAm plus Recolecta Spain', peru: 'ALICIA, RENATI, La Referencia (PE)', brasil: 'Oasisbr, BDTD, La Referencia (BR)', ecuador: 'RRAAE, La Referencia (EC)', mexico: 'CONAHCyT, UNAM, La Referencia (MX)', argentina: 'SNRD, La Referencia (AR)', colombia: 'MinCiencias, La Referencia (CO)', chile: 'ANID, La Referencia (CL)', centroamerica: 'KIMUK (Costa Rica), REDICCES (El Salvador)', ai_ml: 'DBLP, PapersWithCode, HuggingFace, OpenReview, arXiv', free: 'All 30 free sources (excludes Scopus, SerpAPI)', premium: 'Scopus, Google Scholar (SerpAPI)' },
                version: '11.0.0'
            }
        };
    }

    const toolText = toolHelp[topic.toLowerCase()];
    if (toolText) return { success: true, data: { tool: topic, help: toolText } };

    const sourceText = sourceHelp[topic.toLowerCase()];
    if (sourceText) return { success: true, data: { source: topic, help: sourceText } };

    return { success: false, error: `Unknown topic: "${topic}". Use "all" to see all tools and sources.` };
}

// â”€â”€â”€ V5: Recover Metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function recoverFromOpenAlexByDoi(doi: string, paper: any): Promise<void> {
    paper.sourcesTried.push('OpenAlex (DOI)');
    try {
        const res = await fetchWithTimeout(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, {}, 10000);
        if (!res.ok) return;
        const work = await res.json() as any;
        if (work.title) { paper.title = work.title; paper.fieldsRecovered.push('title'); }
        if (work.abstract_inverted_index) { paper.abstract = decodeInvertedIndex(work.abstract_inverted_index); paper.fieldsRecovered.push('abstract'); }
        if (work.publication_year) { paper.year = work.publication_year; paper.fieldsRecovered.push('year'); }
        if (work.doi) paper.doi = work.doi.replace('https://doi.org/', '');
        if (work.authorships?.length > 0) { paper.authors = work.authorships.map((a: any) => a.author.display_name); paper.fieldsRecovered.push('authors'); }
        if (work.authorships?.[0]?.institutions?.[0]?.display_name) { paper.university = work.authorships[0].institutions[0].display_name; paper.fieldsRecovered.push('university'); }
        if (work.open_access?.oa_url) { paper.pdfUrl = work.open_access.oa_url; paper.fieldsRecovered.push('pdfUrl'); }
        paper.citationCount = work.cited_by_count || null;
    } catch (e: any) { console.error('[RECOVER] OpenAlex DOI failed:', e.message); }
}

async function recoverFromOpenAlexByTitle(title: string, paper: any): Promise<void> {
    paper.sourcesTried.push('OpenAlex (title)');
    try {
        const res = await fetchWithTimeout(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per-page=1`, {}, 10000);
        if (!res.ok) return;
        const data = await res.json() as any;
        const work = data.results?.[0];
        if (!work) return;
        if (work.title) paper.title = work.title;
        if (work.abstract_inverted_index) { paper.abstract = decodeInvertedIndex(work.abstract_inverted_index); paper.fieldsRecovered.push('abstract'); }
        if (work.publication_year) { paper.year = work.publication_year; paper.fieldsRecovered.push('year'); }
        if (work.doi) { paper.doi = work.doi.replace('https://doi.org/', ''); paper.fieldsRecovered.push('doi'); }
        if (work.authorships?.length > 0) { paper.authors = work.authorships.map((a: any) => a.author.display_name); paper.fieldsRecovered.push('authors'); }
    } catch (e: any) { console.error('[RECOVER] OpenAlex title failed:', e.message); }
}

async function recoverFromCrossref(doi: string, paper: any): Promise<void> {
    if (!doi || (paper.abstract && paper.abstract.length >= 100)) return;
    paper.sourcesTried.push('Crossref');
    try {
        const res = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {}, 8000);
        if (!res.ok) return;
        const item = (await res.json() as any).message;
        if (item?.abstract && item.abstract.length > (paper.abstract?.length || 0)) { paper.abstract = item.abstract.replace(/<[^>]+>/g, '').trim(); paper.fieldsRecovered.push('abstract'); }
        if (!paper.year && item.published?.['date-parts']?.[0]?.[0]) { paper.year = item.published['date-parts'][0][0]; paper.fieldsRecovered.push('year'); }
    } catch (e: any) { console.error('[RECOVER] Crossref failed:', e.message); }
}

async function recoverFromSemanticScholar(doi: string, paper: any): Promise<void> {
    if (!doi) return;
    paper.sourcesTried.push('Semantic Scholar');
    try {
        const headers: Record<string, string> = {};
        if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
        const res = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,authors,year,abstract,citationCount,openAccessPdf`, { headers }, 8000);
        if (!res.ok) return;
        const ss = await res.json() as any;
        if (ss.authors?.length > 0 && paper.authors.length === 0) { paper.authors = ss.authors.map((a: any) => a.name); paper.fieldsRecovered.push('authors'); }
        if (ss.abstract && (!paper.abstract || paper.abstract.length < 50)) { paper.abstract = ss.abstract; paper.fieldsRecovered.push('abstract'); }
        if (ss.openAccessPdf?.url && !paper.pdfUrl) { paper.pdfUrl = ss.openAccessPdf.url; paper.fieldsRecovered.push('pdfUrl'); }
        if (ss.citationCount && !paper.citationCount) paper.citationCount = ss.citationCount;
    } catch (e: any) { console.error('[RECOVER] Semantic Scholar failed:', e.message); }
}

function computeCompleteness(paper: any): number {
    let score = 0;
    if (paper.title?.length > 10) score += 15;
    if (paper.abstract?.length > 100) score += 25;
    if (paper.year) score += 10;
    if (paper.doi) score += 15;
    if (paper.pdfUrl) score += 15;
    if (paper.authors?.length > 0) score += 10;
    if (paper.university) score += 10;
    return score;
}

async function recoverMetadata(args: { doi?: string; url?: string; title?: string }): Promise<any> {
    const { doi, url, title } = args;
    if (!doi && !url && !title) return { success: false, error: 'Provide at least one of: doi, url, title' };

    const paper: any = { title: title || '', authors: [], year: null, abstract: '', pdfUrl: url || null, doi: doi || null, source: 'recover_metadata', citationCount: null, sourcesTried: [], fieldsRecovered: [] };

    // For handle URLs, try to extract metadata from DSpace
    if (url && url.includes('hdl.handle.net')) {
        try {
            const { isDSpaceUrl, resolveDSpacePdf } = await import('../scraping/dspace-resolver');
            const dspaceRepo = isDSpaceUrl(url);
            if (dspaceRepo) {
                paper.sourcesTried.push('DSpace');
                // Try to resolve PDF which also extracts metadata
                const dspaceResult = await resolveDSpacePdf(url);
                if (dspaceResult) {
                    paper.pdfUrl = dspaceResult.buffer ? url : paper.pdfUrl;
                    paper.fieldsRecovered.push('pdfUrl');
                }
            }
        } catch (e: any) {
            console.error('[RECOVER] DSpace handle failed:', e.message);
        }
    }

    // Run all sources in parallel
    await Promise.all([
        doi ? recoverFromOpenAlexByDoi(doi, paper) : recoverFromOpenAlexByTitle(title || '', paper),
        recoverFromCrossref(doi || paper.doi, paper),
        recoverFromSemanticScholar(doi || paper.doi, paper),
    ]);

    paper.completenessScore = computeCompleteness(paper);
    paper.fieldsRecovered = [...new Set(paper.fieldsRecovered)];

    return { success: true, data: paper };
}

// â”€â”€â”€ Internal API caller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function resultDedupKey(result: any): string {
    const doi = typeof result.doi === 'string' ? result.doi.replace(/^https?:\/\/doi\.org\//i, '').toLowerCase().trim() : '';
    if (doi) return `doi:${doi}`;

    const title = typeof result.title === 'string' ? normalizeForDedup(result.title) : '';
    if (title.length > 12) {
        const year = result.year ? String(result.year).match(/\d{4}/)?.[0] || '' : '';
        return `title:${title.substring(0, 90)}:${year}`;
    }

    return result.id ? `id:${result.id}` : '';
}

function resultQualityScore(result: any): number {
    let score = 0;
    if (result.doi) score += 20;
    if (result.pdfUrl || result.url || result.handleUrl) score += 15;
    if (result.abstract && String(result.abstract).length > 80) score += 20;
    if (Array.isArray(result.authors) && result.authors.length > 0) score += 10;
    if (result.year) score += 10;
    if (result.university) score += 5;
    if (result.citationCount) score += Math.min(10, Number(result.citationCount) || 0);
    // Multi-source bonus: paper found in N independent sources = stronger signal
    const srcCount = Number(result.sourceCount) || 1;
    if (srcCount >= 3) score += 12;
    else if (srcCount >= 2) score += 6;
    return score;
}

// â”€â”€â”€ Fase 2.2: False-positive post-filter (GENERIC, no domain hardcoding) â”€â”€â”€â”€â”€

/**
 * Filter out results that don't contain enough key terms from the query.
 *
 * GENERIC STRATEGY (works for any query, any domain):
 *
 * 1. Extract "concept phrases" from the query: bigrams where both words
 *    are 4+ characters. This catches technical phrases like "desempleo juvenil",
 *    "empleo juvenil", "machine learning", "tuberculosis pulmonar".
 *    Short bigrams like "red neuronal" (red=3) are NOT concept phrases.
 *
 * 2. If the query has concept phrases, at least one must match in the result
 *    (in title or abstract). This eliminates false positives that share generic
 *    words (bacterias, peru) but miss the core technical concept.
 *
 * 3. Matching uses ACADEMIC_SYNONYMS for word-level flexibility:
 *    "desempleo jovenes" matches "desempleo juvenil" via synonym mapping.
 *
 * 4. Cross-language matching is handled by the parallel queries in batch_search:
 *    if the user sends both "acido indolacetico" (ES) and "indole-3-acetic acid" (EN),
 *    both concept phrases are collected. A paper mentioning either passes the filter.
 *    No hardcoded synonym dictionary needed.
 */
function filterFalsePositives(results: any[], queries: string[]): { kept: any[]; dropped: any[] } {
    const allTokens = new Set<string>();
    const allPhrases = new Set<string>();
    const allConceptPhrases = new Set<string>();
    for (const q of queries) {
        const { tokens, phrases, conceptPhrases } = extractKeyTerms(q);
        tokens.forEach(t => allTokens.add(t));
        phrases.forEach(p => allPhrases.add(p));
        conceptPhrases.forEach(cp => allConceptPhrases.add(cp));
    }

    if (allTokens.size === 0 && allPhrases.size === 0 && allConceptPhrases.size === 0) {
        return { kept: results, dropped: [] };
    }

    const minTokenHits = Math.max(1, Math.ceil(allTokens.size * 0.3));
    const hasConceptConstraint = allConceptPhrases.size > 0;
    const tokensArr = [...allTokens];
    const phrasesArr = [...allPhrases];
    const conceptsArr = [...allConceptPhrases];
    const kept: any[] = [];
    const dropped: any[] = [];

    for (const r of results) {
        const titleAbstract = `${r.title || ''} ${r.abstract || ''}`;
        const haystack = normalizeForDedup(titleAbstract);
        const compactHaystack = compactForMatching(titleAbstract);

        let tokenHits = 0;
        for (let i = 0; i < tokensArr.length; i++) {
            if (haystack.includes(tokensArr[i])) tokenHits++;
        }

        let phraseHits = 0;
        for (let i = 0; i < phrasesArr.length; i++) {
            if (compactHaystack.includes(phrasesArr[i])) phraseHits++;
        }

        let conceptHits = 0;
        if (hasConceptConstraint) {
            for (let i = 0; i < conceptsArr.length; i++) {
                if (conceptMatchesWithSynonyms(conceptsArr[i], compactHaystack)) conceptHits++;
            }
        }

        const quality = resultQualityScore(r);

        let keep: boolean;
        if (hasConceptConstraint) {
            const conceptMatched = conceptHits > 0;
            const hasEnoughTokens = tokenHits >= minTokenHits;
            const hasPhraseMatch = phraseHits > 0;
            const isHighQuality = quality >= 60 && tokenHits >= 2;
            const highCoverageThreshold = Math.max(2, Math.ceil(allTokens.size * 0.6));
            keep = (conceptMatched && (hasPhraseMatch || hasEnoughTokens || isHighQuality)) ||
                   (!conceptMatched && isHighQuality && tokenHits >= highCoverageThreshold);
        } else {
            const hasPhraseMatch = phraseHits > 0;
            const hasEnoughTokens = tokenHits >= minTokenHits;
            const isHighQuality = quality >= 60 && tokenHits >= 1;
            keep = hasPhraseMatch || hasEnoughTokens || isHighQuality;
        }

        if (keep) {
            kept.push(r);
        } else {
            r._dropReason = `tokens=${tokenHits}/${minTokenHits},phrases=${phraseHits}${hasConceptConstraint ? `,concepts=${conceptHits}` : ''}${conceptHits === 0 ? ',no-concept-match' : ''}`;
            dropped.push(r);
        }
    }

    return { kept, dropped };
}

function deduplicateBatchResults(results: any[]): any[] {
    const seen = new Map<string, any>();
    const matchedQueries = new Map<string, Set<string>>();
    const sourceSets = new Map<string, Set<string>>();

    for (const result of results) {
        const key = resultDedupKey(result);
        if (!key) continue;

        if (!matchedQueries.has(key)) matchedQueries.set(key, new Set<string>());
        if (result.matchedQuery) matchedQueries.get(key)?.add(result.matchedQuery);

        // Track unique sources per deduplicated result
        if (!sourceSets.has(key)) sourceSets.set(key, new Set<string>());
        const src = String(result.source || '').trim();
        if (src) sourceSets.get(key)!.add(src);

        const existing = seen.get(key);
        if (!existing || resultQualityScore(result) > resultQualityScore(existing)) {
            seen.set(key, result);
        }
    }

    return Array.from(seen.entries()).map(([key, result]) => {
        const queries = Array.from(matchedQueries.get(key) || []);
        const sources = Array.from(sourceSets.get(key) || []);
        const enriched = queries.length > 0 ? { ...result, matchedQueries: queries, matchedQuery: undefined } : { ...result, matchedQuery: undefined };
        enriched.sourceCount = sources.length;
        enriched.sourcesFound = sources;
        return enriched;
    });
}

/**
 * LetXinet 1.1.6: junta los duplicados que deduplicateBatchResults deja pasar. Su clave es
 * "titulo + año", asi que el mismo trabajo llegaba dos veces cuando una fuente traia el año y la
 * otra no (ALICIA y La Referencia, 7 de 60 en la prueba del 09/11/2026). Aqui se comparan ademas
 * la direccion (handle o URL) y el titulo sin año; se conserva el registro mas completo.
 */
function colapsarDuplicados(results: any[]): any[] {
    const claveUrl = (r: any): string => {
        const u = String(r.handleUrl || r.pdfUrl || r.url || '').toLowerCase().trim();
        if (!u || /alicia\.concytec|lareferencia\.info/.test(u)) return '';
        const handle = u.match(/handle(?:\.net)?\/([\d.]+\/[\w.-]+)/);
        return handle ? `h:${handle[1]}` : `u:${u.replace(/^https?:\/\//, '').replace(/[/?#]+$/, '')}`;
    };
    const claveTitulo = (r: any): string => {
        const t = typeof r.title === 'string' ? normalizeForDedup(r.title) : '';
        return t.length > 25 ? `t:${t.substring(0, 90)}` : '';
    };
    const porClave = new Map<string, number>();
    const salida: any[] = [];
    for (const r of results) {
        const claves = [claveUrl(r), claveTitulo(r)].filter(Boolean);
        const i = claves.map(k => porClave.get(k)).find(x => x !== undefined);
        if (i === undefined) {
            claves.forEach(k => porClave.set(k, salida.length));
            salida.push(r);
            continue;
        }
        const previo = salida[i];
        const mejor = resultQualityScore(r) > resultQualityScore(previo) ? r : previo;
        const otro = mejor === r ? previo : r;
        const fuentes = Array.from(new Set([...(previo.sourcesFound || [previo.source]), ...(r.sourcesFound || [r.source])].filter(Boolean)));
        const consultas = Array.from(new Set([...(previo.matchedQueries || []), ...(r.matchedQueries || [])]));
        salida[i] = {
            ...mejor,
            year: mejor.year || otro.year,
            doi: mejor.doi || otro.doi,
            abstract: mejor.abstract || otro.abstract,
            sourcesFound: fuentes,
            sourceCount: fuentes.length,
            ...(consultas.length ? { matchedQueries: consultas } : {}),
        };
        claves.forEach(k => porClave.set(k, i));
    }
    return salida;
}

// V15: Shared coverage floor â€” prevents 0 results when score filter is too aggressive
function applyCoverageFloor(
    filtered: any[],
    dropped: any[],
    minFloor: number
): { filtered: any[]; dropped: any[] } {
    if (filtered.length < minFloor && dropped.length > 0) {
        const need = minFloor - filtered.length;
        const fillIn = dropped.slice(0, need);
        console.log(`[COVERAGE] Floor: adding ${fillIn.length} low-score results to avoid empty response`);
        return {
            filtered: [...filtered, ...fillIn],
            dropped: dropped.slice(need)
        };
    }
    return { filtered, dropped };
}

async function handleBatchSearch(body: any, baseUrl: string): Promise<any> {
    const rawQueries = Array.isArray(body.queries) ? body.queries : (body.query ? [body.query] : []);
    let queries: string[] = rawQueries
        .map((q: unknown) => String(q || '').trim())
        .filter((q: string) => q.length > 0)
        .slice(0, SEARCH_LIMITS.BATCH_MAX_QUERIES);
    if (queries.length === 0) return { success: false, error: 'Provide "queries" or "query" for batch_search.' };

    // Phase 6 (2026-07-23): client-aware batch caps. mcp.ts dispatcher stashes
    // __batchCaps in body based on the detected MCP client (opencode: 8 srcs Ã— 3 q,
    // claude: 16 Ã— 6, cli: 16 Ã— 6, unknown: 8 Ã— 3). Apply here so expanded sources
    // per query don't exceed the client ceiling.
    const batchCaps = body.__batchCaps as { sourcesPerQuery: number; maxQueries: number } | undefined;
    if (batchCaps) {
        if (queries.length > batchCaps.maxQueries) {
            console.log(`[BATCH] Queries capped from ${queries.length} to ${batchCaps.maxQueries} (client cap)`);
            queries = queries.slice(0, batchCaps.maxQueries);
        }
    }

    // V15: Configurable text/geo weights per tool call (defaults 0.7/0.3)
    const textWeight = typeof body.textWeight === 'number' ? Math.max(0, Math.min(1, body.textWeight)) : 0.7;
    const geoWeight = typeof body.geoWeight === 'number' ? Math.max(0, Math.min(1, body.geoWeight)) : 0.3;

    // V13: If any query is coordinates, REPLACE with geocoded city name for better search results
    // V15: Preserve rest of query (e.g. "-16.4, -71.5 salud pÃºblica" â†’ "Arequipa salud pÃºblica")
    const expandedQueries: string[] = [];
    for (const q of queries) {
        const coordMatch = q.match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lon = parseFloat(coordMatch[2]);
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                try {
                    const { geocodeWithOSM } = await import('../utils/osm-geocoder');
                    const geo = await geocodeWithOSM(`${lat}, ${lon}`);
                    if (geo?.city || geo?.state) {
                        const placeName = geo.city || geo.state || '';
                        const restOfQuery = q.replace(coordMatch[0], '').trim();
                        const finalQuery = restOfQuery ? `${placeName} ${restOfQuery}` : placeName;
                        if (!expandedQueries.includes(finalQuery)) {
                            expandedQueries.push(finalQuery);
                            console.log(`[BATCH] Coordinate query "${q}" â†’ "${finalQuery}"`);
                            continue;
                        }
                    }
                } catch { /* continue with original coords */ }
            }
        }
        expandedQueries.push(q);
    }
    queries = expandedQueries;

    const sources = body.sources || ['latam', 'global'];
    const maxResults = Math.min(body.maxResults || 50, SEARCH_LIMITS.BATCH_MAX_RESULTS);
    const perQueryLimit = Math.min(50, Math.max(20, Math.ceil(maxResults / queries.length) + 10));
    const yearStart = body.yearStart;
    const yearEnd = body.yearEnd;
    const university = body.university;
    const fastMode = body.fastMode === true;
    const applyFpFilter = body.filterFalsePositives === true;
    const location = body.location;
    const page = body.page;

    const peruGroupIds = ['peru', 'laref_peru'];
    const hasPeruInSources = sources.some((s: string) => peruGroupIds.includes(s));
    const nonPeruSources = sources.filter((s: string) => !peruGroupIds.includes(s));
    const peruLimit = Math.max(15, Math.ceil(perQueryLimit / 2));
    const otherLimit = hasPeruInSources && nonPeruSources.length > 0
        ? Math.max(15, perQueryLimit - peruLimit)
        : perQueryLimit;

    const allResults: any[] = [];
    const sourceStats: Record<string, { found: number; time: number; errors: number }> = {};
    const sourceErrors: Record<string, string> = {};
    const queryReports: Array<{ query: string; returned: number; beforeDedup: number; error?: string }> = [];
    const perQueryCounts = new Map<string, number>();

    async function executeSearch(q: string, srcs: string[], limit: number, label: string) {
        try {
            const { expandSources, PROVIDER_MAP } = await import('./search');
            // Phase 6: cap expanded sources per query based on detected client
            let expanded = expandSources(srcs, batchCaps?.sourcesPerQuery);
            // 1.1.6: igual que `search`: RENATI ya consulta ALICIA por dentro; con las dos se
            // duplicaba la carga sobre ALICIA y los resultados salian repetidos.
            if (expanded.includes('renati') && expanded.includes('alicia')) expanded = expanded.filter((s: string) => s !== 'alicia');

            console.log(`[BATCH-${label}] Searching "${q}" sources=${expanded.join(',')} limit=${limit}`);

            const options: any = {
                yearStart, yearEnd, university, location, page,
                limit,
                scopusKey: process.env.SCOPUS_API_KEY,
                semanticKey: process.env.SEMANTIC_SCHOLAR_API_KEY,
                coreKey: process.env.CORE_API_KEY,
                serpApiKey: process.env.SERP_API_KEY,
                fastMode,
            };

            const start = Date.now();
            const localStats: Record<string, { found: number; time: number }> = {};
            const localResults: any[] = [];

            const providerPromises = expanded.map(async (sourceId: string) => {
                const provider = (PROVIDER_MAP as any)[sourceId];
                if (!provider) return;
                const pStart = Date.now();
                try {
                    // Phase 6: race timeout = derived raceMs from client ceiling (default 45s)
                    // V11 Mejora 3: use withPromiseTimeout so the inner timer is
                    // cleared on resolution (no zombie Timeout on the event loop).
                    // Patch J4 (2026-07-27): floor raceMs at 90s for ALICIA cascada
                    // (A2-split + DME + 3 fallbacks secuenciales).
                    // Patch J5 (2026-07-27): bump floor 90s -> 110s after analyzing
                    // logs — ALICIA found 132 records via A2-split but DME on 15
                    // records at concurrency=3 takes >90s due to slow VuFind
                    // Details page (some fetches 8-10s each). 110s allows DME to
                    // complete while staying under TOOL_TIMEOUTS['batch_search']=240s.
                    // Patch J6 (2026-07-27): bump floor 110s -> 150s after measuring
                    // A2-split alone = ~66s (sub-queries × latamTimeout=60s fetches)
                    // leaving only ~44s for DME on 15 records/conc 3. 150s gives
                    // A2-split ~66s + DME ~80s = ~146s (still < outerMs 114s only if
                    // outer capped at 240s, which it is for batch_search).
                    // Patch J9 (2026-07-27): bump floor 150s -> 200s after Patch J8
                    // reduced cascada but some queries still hit 150s raceMs floor.
                    // Patch K-rollback (2026-07-27): With Patch K1+K3 now propagating
                    // __timeouts raíz, raceMs derives correctly from client ceiling
                    // (114s under unknown=240s). Floor 200s no longer needed; reduced
                    // to 110s as conservative backstop (still above natural cascada
                    // time ~65s, protects against any future patch that breaks K).
                    //
                    // Patch B1 (2026-07-29): BUG #3 — raceMs floor 110s muy corto para ALICIA
                    // cuando hay concurso con otras fuentes (renati OAI-PMH serializa rate-limit
                    // de ALICIA). Medimos 157s reales para completar la cascada ALICIA
                    // (Found + DME + rate limits). Reproducible: batch_search sources=[alicia,renati]
                    // query="concreto" daba found:0 para ALICIA con el floor 110s abortando
                    // a media DME. Subido a 180s (entre el floor 110s de K-rollback y el 200s
                    // de Patch J9) — suficiente para que la cascada complete. Queda dentro del
                    // outer TOOL_TIMEOUTS.batch_search=240s con margen de 60s.
                    const rawRaceMs = (body as any)?.__timeouts?.raceMs ?? 45000;
                    // Patch B1 (2026-07-29): BUG #3 — SKIP DME en batch_search path
                    // para ALICIA. Sin skip, ALICIA tarda 320s+ en DME cascade y carrera
                    // aborta con found=0. Con skip_DME, searchAlicia devuelve papeles
                    // raw (sin abstracts/univ) pero ALICIA aparece en sourceStats y se
                    // participa del ranking. raceMs reduzido de 320s -> 90s (sólo Found).
                    const raceMs = Math.max(90_000, rawRaceMs); // Patch B1: floor 90s (sin DME)
                    const raceResult: { results: any[] } = await withPromiseTimeout<{ results: any[] }>(
                        provider(q, { ...options, __timeouts: (body as any)?.__timeouts, batch_skip_dme: true }) as Promise<{ results: any[] }>,
                        raceMs,
                        'Provider timeout'
                    );
                    const { results } = raceResult;
                    localStats[sourceId] = { found: results.length, time: Date.now() - pStart };
                    localResults.push(...results);
                } catch (e: any) {
                    localStats[sourceId] = { found: 0, time: Date.now() - pStart };
                    if (e?.name !== 'PeticionCancelada') sourceErrors[sourceId] = String(e?.message || e).substring(0, 160);
                }
            });

            await Promise.allSettled(providerPromises);

            console.log(`[BATCH-${label}] Got ${localResults.length} raw results in ${Date.now() - start}ms`);

            for (const [sid, stat] of Object.entries(localStats)) {
                if (!sourceStats[sid]) sourceStats[sid] = { found: 0, time: 0, errors: 0 };
                sourceStats[sid].found += stat.found;
                sourceStats[sid].time += stat.time;
            }

            perQueryCounts.set(q, (perQueryCounts.get(q) || 0) + localResults.length);
            for (let i = 0; i < localResults.length; i++) localResults[i].matchedQuery = q;
            allResults.push(...localResults);
        } catch (e: any) { console.error(`[BATCH-${label}] Query "${q}" failed: ${e.message}`); }
    }

    const searchTasks: Array<() => Promise<void>> = [];
    for (const q of queries) {
        perQueryCounts.set(q, 0);
        if (hasPeruInSources) searchTasks.push(() => executeSearch(q, ['peru'], peruLimit, 'PERU'));
        if (nonPeruSources.length > 0) searchTasks.push(() => executeSearch(q, hasPeruInSources ? nonPeruSources : sources, otherLimit, 'OTHER'));
    }

    // Concurrency limiter: max N concurrent requests to avoid overwhelming slow sources (ALICIA/RENATI)
    //
    // V11 Mejora 2: MAX_CONCURRENT is now adaptive based on the detected
    // MCP client's ceiling (from body.__timeouts.ceilingMs) — tighter
    // ceilings get fewer workers so each worker has more time to complete
    // before the outer tool timeout fires. Empirically calibrated to keep
    // the slowest provider (ALICIA) <60% of the tool ceiling.
    //   - ceiling <= 120s  (opencode)        → 5 workers
    //   - ceiling <= 180s  (cursor)          → 6 workers
    //   - ceiling <= 300s  (claude)          → 8 workers
    //   - ceiling >  300s  (cli / unknown)   → 6 workers (default conservative)
    // Override via env MAX_BATCH_CONCURRENCY=<int> for tuning.
    const ceilingMs = (body as any)?.__timeouts?.ceilingMs ?? 120_000;
    const envOverride = parseInt(process.env.MAX_BATCH_CONCURRENCY || '', 10);
    let MAX_CONCURRENT: number;
    if (!isNaN(envOverride) && envOverride > 0) {
        MAX_CONCURRENT = envOverride;
    } else if (ceilingMs <= 120_000) {
        MAX_CONCURRENT = 5;
    } else if (ceilingMs <= 180_000) {
        MAX_CONCURRENT = 6;
    } else if (ceilingMs <= 300_000) {
        MAX_CONCURRENT = 8;
    } else {
        MAX_CONCURRENT = 6;
    }
    console.log(`[BATCH] MAX_CONCURRENT=${MAX_CONCURRENT} (ceiling=${ceilingMs}ms, client=${(body as any)?.__client ?? 'unknown'})`);
    let idx = 0;
    async function runNext(): Promise<void> {
        while (idx < searchTasks.length) {
            if (requestAborted()) return; // 1.1.6: no empezar consultas de un batch ya cancelado
            const i = idx++;
            await searchTasks[i]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, searchTasks.length) }, () => runNext()));
    if (requestAborted()) throw new PeticionCancelada();

    for (const q of queries) {
        const count = perQueryCounts.get(q) || 0;
        queryReports.push({ query: q, returned: count, beforeDedup: count });
    }

    let deduplicated = colapsarDuplicados(deduplicateBatchResults(allResults));

    // LetXinet 1.1.6: el mismo filtro de pertinencia de `search` para los repositorios de tesis.
    // Un resultado se conserva si pasa el filtro con al menos una de las consultas del batch.
    // Antes batch_search no lo aplicaba: "calidad del agua ... Huaraz" devolvia 20 de 20 sobre
    // "calidad de servicio".
    let filtroPertinencia: { quitados: number } | undefined;
    if (body.filtroRepositorios !== false && process.env.LETXINET_FILTRO_REPOSITORIOS !== 'false') {
        const pasan = new Set<any>();
        for (const q of queries) for (const r of filtrarRepositorios(deduplicated, q, location).resultados) pasan.add(r);
        const antes = deduplicated.length;
        deduplicated = deduplicated.filter(r => pasan.has(r));
        if (antes > deduplicated.length) {
            filtroPertinencia = { quitados: antes - deduplicated.length };
            console.log(`[BATCH] Filtro de repositorios: quitados ${antes - deduplicated.length} de ${antes}`);
        }
    }

    if (yearStart) {
        const minYear = parseInt(String(yearStart), 10);
        if (!isNaN(minYear)) deduplicated = deduplicated.filter(r => !r.year || r.year >= minYear);
    }
    if (yearEnd) {
        const maxYear = parseInt(String(yearEnd), 10);
        if (!isNaN(maxYear)) deduplicated = deduplicated.filter(r => !r.year || r.year <= maxYear);
    }

    const overFetch = deduplicated.slice(0, Math.min(deduplicated.length, maxResults * 3));

    // V17: Set geo context from location parameter if not already set by coordinate expansion
    if (location && !getGeoContext()) {
        const { geocodeWithOSM } = await import('../utils/osm-geocoder');
        try {
            const geoResult = await geocodeWithOSM(String(location));
            if (geoResult) {
                setGeoContext(geoResult);
                console.log(`[BATCH] Geocoded location="${location}" â†’ city=${geoResult.city}, state=${geoResult.state}`);
            }
        } catch (e: any) {
            console.warn(`[BATCH] Geocoding failed for location="${location}": ${e.message}`);
        }
    }

    // V18: Load active profile based on geo context + source combo
    const osmGeoForProfile = getGeoContext() as { countryNorm?: string; city?: string; state?: string } | undefined;
    const sourceCombo = detectSourceCombo(sources);
    const country = osmGeoForProfile?.countryNorm || undefined;
    
    // V20: Map OSM city name to region profile file name via lookup table
    const cityRaw = (osmGeoForProfile?.city || '').toLowerCase().trim();
    const stateRaw = (osmGeoForProfile?.state || '').toLowerCase().trim();
    let cityToRegion: Record<string, string> = {};
    try {
        const fs = require('fs');
        const path = require('path');
        const mapPath = path.join(process.cwd(), 'src', 'config', 'city-to-region.json');
        if (fs.existsSync(mapPath)) {
            cityToRegion = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        }
    } catch { /* ignore */ }
    
    // Try: city â†’ region map, then state normalized, then city normalized
    let regionKey: string | undefined = cityToRegion[cityRaw] || undefined;
    if (!regionKey && stateRaw) {
        // Normalize state: "La Libertad" â†’ "lalibentad", "Madre de Dios" â†’ "madrededios"
        regionKey = stateRaw.replace(/[\s\.,]/g, '').replace(/\bde\b/g, '').replace(/\s+/g, '');
    }
    if (!regionKey && cityRaw) {
        regionKey = cityRaw.replace(/\s+/g, '');
    }
    
    const profile = getProfile(country, sourceCombo, regionKey);
    setActiveProfile(profile);
    console.log(`[BATCH] Profile: country=${country || 'global'}, combo=${sourceCombo}, city=${cityRaw || 'none'} â†’ region=${regionKey || 'none'} â†’ MIN_RELEVANCE=${profile?.scoring?.MIN_RELEVANCE ?? 'default'}`);

    // V10: Rerank FIRST (with OSM MCP geocoding), THEN filter by score
    // This fixes batch_search returning 0 for relative locations (Chivay, Huancayo, etc.)
    // 1.1.6: fastMode tambien se respeta al reordenar (antes se ignoraba aqui)
    let reranked = await rerankByRelevanceSmart(overFetch, queries, textWeight, geoWeight, fastMode);
    if (requestAborted()) throw new PeticionCancelada();

    // V15: Warn if top result has geoScore=0 despite location being set
    const osmGeo = getGeoContext();
    if (osmGeo?.city && reranked.length > 0) {
        const top = reranked[0];
        const { geoScoreSmart } = await import('../utils/reranking');
        const topGeoScore = await geoScoreSmart(top);
        if (topGeoScore === 0) {
            console.warn(`[BATCH] WARNING: Top result "${(top.title || '').substring(0, 60)}..." has geoScore=0 despite location="${osmGeo.city}"`);
        }
    }

    // V10: Year filter AFTER rerank (double-check)
    if (yearStart) {
        const minYear = parseInt(String(yearStart), 10);
        if (!isNaN(minYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) >= minYear);
    }
    if (yearEnd) {
        const maxYear = parseInt(String(yearEnd), 10);
        if (!isNaN(maxYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) <= maxYear);
    }

    // V18: Profile-based MIN_RELEVANCE (with low-signal override)
    const isLowSignalQuery = queries.every(q => q.trim().split(/\s+/).length <= 1);
    const profileMinRelevance = profile?.scoring?.MIN_RELEVANCE ?? 15;
    const MIN_RELEVANCE = isLowSignalQuery ? 0 : profileMinRelevance;
    const MIN_COVERAGE_FLOOR = Math.min(profile?.scoring?.MIN_COVERAGE_FLOOR_MAX ?? 10, Math.ceil(maxResults * (profile?.scoring?.MIN_COVERAGE_FLOOR_PCT ?? 0.2)));
    let filtered: any[];
    let dropped: any[];

    if (applyFpFilter) {
        const fpResult = filterFalsePositives(reranked, queries);
        filtered = fpResult.kept;
        dropped = fpResult.dropped;
        if (dropped.length > 0) {
            console.log(`[BATCH] False positives filter: ${reranked.length} â†’ ${filtered.length} (dropped ${dropped.length})`);
        }
    } else {
        filtered = reranked.filter(r => (r.relevanceScore || 0) >= MIN_RELEVANCE);
        dropped = reranked.filter(r => (r.relevanceScore || 0) < MIN_RELEVANCE);

        const floor = applyCoverageFloor(filtered, dropped, MIN_COVERAGE_FLOOR);
        filtered = floor.filtered;
        dropped = floor.dropped;

        if (dropped.length > 0) {
            console.log(`[BATCH] Post-rerank: dropped ${dropped.length} low-score (kept ${filtered.length})`);
        }
    }

    if (filtered.length > 0) {
        console.log(`[BATCH] Reranked ${filtered.length} results by relevance. Top: "${(filtered[0].title||'').substring(0,60)}" (rel=${filtered[0].relevanceScore}, q=${filtered[0].qualityScore})`);
    }

    // 1.1.6: lo local primero, como en `search` (lugar de cualquiera de las consultas o `location`)
    const consultaConLugar = queries.find(q => temaYLugar(q, location).lugar.length > 0) || queries[0];
    const prioridad = priorizarLocales(filtered, consultaConLugar, location, university, Math.max(5, Math.ceil(maxResults / 2)));
    filtered = prioridad.resultados;

    const finalResults = filtered.slice(0, maxResults);
    // 1.1.6: universidad segun el repositorio y PDF directo de los primeros (como en `search`)
    corregirUniversidades(finalResults);
    const quierePdf = body.resolverPdf === true || (body.resolverPdf !== false && !fastMode);
    const pdfDirectos = quierePdf && !requestAborted() ? await resolverPdfDirectos(finalResults, 5, 6000) : 0;

    // V18: Clear active profile to prevent state leakage between requests
    clearActiveProfile();

    // 1.1.6: avisa de las fuentes que no respondieron, para que 0 resultados no parezca "no hay nada"
    const fuentesConError = Object.entries(sourceErrors).map(([fuente, error]) => ({ fuente, error }));

    return {
        success: true,
        data: {
            ...(filtroPertinencia ? { filtroPertinencia } : {}),
            ...(prioridad.lugares.length ? { prioridadLocal: { terminos: prioridad.lugares, locales: prioridad.locales } } : {}),
            ...(fuentesConError.length ? { fuentesConError } : {}),
            ...(quierePdf ? { pdfDirectos } : {}),
            results: finalResults,
            total: finalResults.length,
            totalBeforeDedup: allResults.length,
            totalAfterFilter: filtered.length,
            falsePositivesDropped: dropped.length,
            queriesExecuted: queries,
            sourcesUsed: Array.isArray(sources) ? sources : [sources],
            perQueryLimit,
            queryReports,
            sourceStats
        }
    };
}

async function handleSmartSearch(body: any, baseUrl: string): Promise<any> {
    const { query, sources = ['latam', 'global'], maxResults = 50, yearStart, yearEnd, fastMode = false, location, page, includeThesisVariants = true, filterFalsePositives = false, university } = body;

    // V15: Configurable text/geo weights per tool call (defaults 0.7/0.3)
    const textWeight = typeof body.textWeight === 'number' ? Math.max(0, Math.min(1, body.textWeight)) : 0.7;
    const geoWeight = typeof body.geoWeight === 'number' ? Math.max(0, Math.min(1, body.geoWeight)) : 0.3;

    // Total timeout: 300s for entire smart_search (post Patch C7 2026-07-30)
    // was 150s, but es_core_news_lg variant generation + 6× search + rerank takes ~245s
    const SMART_TIMEOUT = 300000;
    let timeoutId: any;
    const totalTimeout = new Promise<never>((_, rej) => {
        timeoutId = setTimeout(() => rej(new Error('smart_search total timeout')), SMART_TIMEOUT);
    });

    const doSearch = async () => {
        const variations = await generateQueryVariations(query, includeThesisVariants, fastMode === true);
        console.log(`[SMART_SEARCH] Query: "${query}" â†’ ${variations.length} variations`);

        const allResults: any[] = [];
        const searchSources = Array.isArray(sources) ? sources : [sources];
        // 1.1.6: cuenta de variantes que respondieron, para no devolver "exito" con 0 resultados
        // cuando en realidad todas las consultas fallaron o se quedaron sin tiempo
        let variantesOk = 0;
        const fallosVariantes: string[] = [];

        // Concurrency limiter: max 3 parallel requests (same as batch_search)
        const MAX_CONCURRENT = 3;
        const searchTasks: Array<() => Promise<void>> = [];
        for (const variant of variations) {
            searchTasks.push(async () => {
                try {
                    // FIX smart_search timeout: bajar maxSources de 30 a 15 para que cada variante
                    // tarde ~30s en vez de ~63s. Con 2-3 variantes en MAX_CONCURRENT=3, total <114s
                    // (ceiling opencode 120s × 0.95 = 114s). Antes: smart_search FM=false timeout 114s.
                    // Patch A+/D híbrido (2026-07-27): en FM=false subir maxSources a 25 (variantes más limpias vía Patch C)
                    // para compensar que Patch D (es_core_news_lg) no se pudo aplicar por disco lleno.
                    // En FM=true mantener 15 (no hace spaCy, no necesita más sources).
                    // Patch K1 (2026-07-27): propagar __timeouts al body para que search.ts y
                    // latam-repositories.ts reciban raceMs/tryMs client-aware (BUG #2 fix raíz).
                    const searchBody: any = {
                        query: variant,
                        sources: searchSources,
                        maxSources: fastMode ? 15 : 25,
                        __timeouts: (body as any)?.__timeouts,
                    };
                    if (yearStart) searchBody.yearStart = yearStart;
                    if (yearEnd) searchBody.yearEnd = yearEnd;
                    if (fastMode) searchBody.fastMode = true;
                    if (location) searchBody.location = location;
                    if (page) searchBody.page = page;
                    // Vercel serverless: dispatch in-process (fetch a localhost falla).
                    let data: any;
                    if (process.env.VERCEL === '1' || process.env.VERCEL) {
                        data = await dispatchInProcess('POST', '/api/search', searchBody);
                    } else {
                        const res = await fetch(`${baseUrl}/api/search`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(searchBody),
                            // FIX smart_search timeout: 60s no sirve para latam+global con maxSources:30 (~63s real).
                            // Subido a 120s — sigue bajo el total timeout de 150s del handler.
                            signal: senalConPlazo(120000),
                        });
                        data = await res.json() as any;
                    }
                    // search devuelve `results`; versiones antiguas usaban
                    // `sources`. Aceptamos ambos formatos para que
                    // smart_search no termine en éxito vacío.
                    const results = data?.data?.results || data?.data?.sources || [];
                    if (data.success && Array.isArray(results)) { allResults.push(...results); variantesOk++; }
                    else fallosVariantes.push(`${variant}: ${String(data?.error || 'sin respuesta').substring(0, 120)}`);
                } catch (e: any) {
                    console.error(`[SMART_SEARCH] Variation "${variant}" failed: ${e.message}`);
                    fallosVariantes.push(`${variant}: ${String(e.message).substring(0, 120)}`);
                }
            });
        }

        let idx = 0;
        async function runNext(): Promise<void> {
            while (idx < searchTasks.length) {
                if (requestAborted()) return; // 1.1.6
                const i = idx++;
                await searchTasks[i]();
            }
        }
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, searchTasks.length) }, () => runNext()));
        if (requestAborted()) throw new PeticionCancelada();
        if (variantesOk === 0 && fallosVariantes.length > 0) {
            return { success: false, error: `smart_search no obtuvo respuesta de ninguna de sus ${fallosVariantes.length} consultas. Primer fallo: ${fallosVariantes[0]}. Prueba con search.`, data: { queriesUsed: variations, fallos: fallosVariantes } };
        }

        const seen = new Map<string, any>();
        for (const r of allResults) {
            const key = r.doi || r.title?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 60) || '';
            if (key && !seen.has(key)) seen.set(key, r);
        }
        let deduplicated = Array.from(seen.values());

        // V10: Year filter AFTER dedup, BEFORE rerank (smart_search didn't have this)
        if (yearStart) {
            const minYear = parseInt(String(yearStart), 10);
            if (!isNaN(minYear)) deduplicated = deduplicated.filter(r => !r.year || parseInt(String(r.year), 10) >= minYear);
        }
        if (yearEnd) {
            const maxYear = parseInt(String(yearEnd), 10);
            if (!isNaN(maxYear)) deduplicated = deduplicated.filter(r => !r.year || parseInt(String(r.year), 10) <= maxYear);
        }

        let reranked = await rerankByRelevanceSmart(deduplicated, variations, textWeight, geoWeight, fastMode === true);
        if (requestAborted()) throw new PeticionCancelada();

        // V15: Warn if top result has geoScore=0 despite location being set
        const osmGeoSmart = getGeoContext();
        if (osmGeoSmart?.city && reranked.length > 0) {
            const top = reranked[0];
            const { geoScoreSmart } = await import('../utils/reranking');
            const topGeoScore = await geoScoreSmart(top);
            if (topGeoScore === 0) {
                console.warn(`[SMART] WARNING: Top result "${(top.title || '').substring(0, 60)}..." has geoScore=0 despite location="${osmGeoSmart.city}"`);
            }
        }

        // V10: Year filter AFTER rerank (double-check)
        if (yearStart) {
            const minYear = parseInt(String(yearStart), 10);
            if (!isNaN(minYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) >= minYear);
        }
        if (yearEnd) {
            const maxYear = parseInt(String(yearEnd), 10);
            if (!isNaN(maxYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) <= maxYear);
        }

        // V10: Optional false positive filter
        if (filterFalsePositives && variations.length > 0) {
            const allTokens = new Set<string>();
            const allPhrases = new Set<string>();
            const allConcepts = new Set<string>();
            for (const v of variations) {
                const t = extractKeyTerms(v);
                t.tokens.forEach(tok => allTokens.add(tok));
                t.phrases.forEach(phrase => allPhrases.add(phrase));
                t.conceptPhrases.forEach(c => allConcepts.add(c));
            }
            const tokens = Array.from(allTokens);
            const phrases = Array.from(allPhrases);
            const conceptPhrases = Array.from(allConcepts);
            if (tokens.length > 0 || phrases.length > 0 || conceptPhrases.length > 0) {
                const minTokenHits = Math.max(1, Math.ceil(tokens.length * 0.3));
                const hasConceptConstraint = conceptPhrases.length > 0;
                const beforeCount = reranked.length;
                reranked = reranked.filter(r => {
                    const haystack = normalizeForDedup(`${r.title || ''} ${r.abstract || ''}`);
                    const compactHaystack = compactForMatching(`${r.title || ''} ${r.abstract || ''}`);
                    let tokenHits = 0;
                    for (const t of tokens) { if (haystack.includes(t)) tokenHits++; }
                    let phraseHits = 0;
                    for (const p of phrases) { if (compactHaystack.includes(p)) phraseHits++; }
                    let conceptHits = 0;
                    if (hasConceptConstraint) {
                        for (const c of conceptPhrases) { if (conceptMatchesWithSynonyms(c, compactHaystack)) conceptHits++; }
                    }
                    if (hasConceptConstraint) {
                        return (conceptHits > 0 && (phraseHits > 0 || tokenHits >= minTokenHits)) ||
                               (conceptHits === 0 && tokenHits >= Math.max(2, Math.ceil(tokens.length * 0.6)));
                    }
                    return phraseHits > 0 || tokenHits >= minTokenHits;
                });
                console.log(`[SMART] False positives filter: ${beforeCount} â†’ ${reranked.length} (dropped ${beforeCount - reranked.length})`);
            }
        }

        // V15: Coverage floor â€” prevent 0 results from aggressive filtering
        const MIN_COVERAGE_FLOOR_SMART = Math.min(5, Math.ceil(maxResults * 0.15));
        if (reranked.length < MIN_COVERAGE_FLOOR_SMART && deduplicated.length > reranked.length) {
            const need = MIN_COVERAGE_FLOOR_SMART - reranked.length;
            const backfill = deduplicated.filter(r => !reranked.includes(r)).slice(0, need);
            reranked = [...reranked, ...backfill];
            console.log(`[SMART] Coverage floor: added ${backfill.length} results to avoid empty response`);
        }

        // 1.1.6: lo local primero (el reordenamiento de arriba deshace el orden que traia cada search)
        const prioridadSmart = priorizarLocales(colapsarDuplicados(reranked), String(query || ''), location, university, Math.max(5, Math.ceil(maxResults / 2)));
        reranked = prioridadSmart.resultados.slice(0, maxResults);

        return { success: true, data: { sources: reranked, total: reranked.length, totalBeforeDedup: allResults.length, queriesUsed: variations, ...(fallosVariantes.length ? { aviso: `${fallosVariantes.length} de ${variations.length} consultas no respondieron; el resultado es parcial`, fallos: fallosVariantes } : {}) } };
    };

    try {
        return await Promise.race([doSearch(), totalTimeout]);
    } finally {
        clearTimeout(timeoutId);
    }
}

const SPECIALIZED_SOURCE_MAP: Record<string, string> = {
    'search_dblp': 'dblp',
    'search_paperswithcode': 'paperswithcode',
    'trending_papers': 'huggingface',
    'search_conferences': 'openreview',
};

const PDF_TOOL_NAMES = new Set([
    'read_pdf', 'pdf_metadata', 'pdf_sections', 'pdf_citations', 'analyze_academic',
    'extract_section', 'read_pdf_markdown', 'pdf_smart_summary', 'convert_document',
    'batch_convert', 'extract_tables', 'extract_formulas',
]);

const ENDPOINT_MAP: Record<string, string> = {
    'search': '/api/search',
    'enrich_metadata': '/api/metadata/enrich',
    'fetch_metadata': '/api/metadata/fetch',
    'download_pdf': '/api/pdf/download',
    'list_sources': '/api/sources',
};

async function handleSpecializedSearch(method: string, body: any, baseUrl: string): Promise<any> {
    const sourceId = SPECIALIZED_SOURCE_MAP[method];
    // Patch K2 (2026-07-27): propagar __timeouts al body (BUG #2 fix raíz).
    const searchBody: any = { query: body.query || '', sources: [sourceId], maxSources: body.maxResults || 25, __timeouts: (body as any)?.__timeouts };
    // Vercel serverless: dispatch in-process (fetch a localhost falla).
    if (process.env.VERCEL === '1' || process.env.VERCEL) {
        return dispatchInProcess('POST', '/api/search', searchBody);
    }
    const res = await fetch(`${baseUrl}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody), signal: senalConPlazo(120000) });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return res.json();
}

type PdfHandler = (args: any) => Promise<any>;

const PDF_HANDLERS: Record<string, PdfHandler> = {
    read_pdf: async (args) => {
        try {
            const format = args.format || 'markdown';
            if (format === 'text') {
                const result = await extractText(args.source);
                let text = result.text;
                const maxChars = args.maxChars ?? 20000;
                if (maxChars > 0 && text.length > maxChars) { const { smartTruncate } = await import('../providers/mineru-client'); text = smartTruncate(text, maxChars); }
                return { success: true, data: { text, pages: result.pages, info: result.info, textLength: text.length, format: 'text' } };
            }
            const result = await extractMarkdown(args.source, { maxChars: args.maxChars ?? 20000, pages: args.pages });
            return { success: true, data: { text: result.text, pages: result.pages, info: result.info, textLength: result.text.length, format: result.format } };
        } catch (e: any) { return { success: false, error: e.message }; }
    },
    pdf_metadata: async (args) => { try { return { success: true, data: await getMetadata(args.source) }; } catch (e: any) { return { success: false, error: e.message }; } },
    pdf_sections: async (args) => { try { const sections = await detectSections(args.source); return { success: true, data: { sections: sections.map(s => ({ name: s.name, contentPreview: s.content.substring(0, 500), contentLength: s.content.length })), totalSections: sections.length } }; } catch (e: any) { return { success: false, error: e.message }; } },
    pdf_citations: async (args) => { try { const citations = await extractCitations(args.source); return { success: true, data: { citations, totalCitations: citations.length } }; } catch (e: any) { return { success: false, error: e.message }; } },
    analyze_academic: async (args) => {
        try {
            const a = await analyzeAcademicDocument(args.source);
            return { success: true, data: { documentType: a.documentType, language: a.language, pages: a.pages, totalWords: a.totalWords, sections: a.sections.map(s => ({ name: s.name, category: s.category, contentPreview: s.content.substring(0, 800), contentLength: s.contentLength, hasNumericalData: s.hasNumericalData, statistics: s.statistics })), globalStatistics: a.globalStatistics, summary: a.summary } };
        } catch (e: any) { return { success: false, error: e.message, hint: 'Provide a DOI, direct PDF URL, or repository link.' }; }
    },
    extract_section: async (args) => { try { return { success: true, data: await extractSection(args.source, args.section) }; } catch (e: any) { return { success: false, error: e.message }; } },
    read_pdf_markdown: async (args) => { try { const r = await extractMarkdown(args.source, { maxChars: args.maxChars ?? 30000, pages: args.pages }); return { success: true, data: { text: r.text, pages: r.pages, info: r.info, textLength: r.text.length, format: r.format, extractor_used: r.info?.converter || 'unknown' } }; } catch (e: any) { return { success: false, error: e.message }; } },
    pdf_smart_summary: async (args) => { try { return { success: true, data: await smartSummary(args.source, args.maxTotalChars ?? 8000) }; } catch (e: any) { return { success: false, error: e.message }; } },
    convert_document: async (args) => {
        try {
            const { loadPdf } = await import('../providers/pdf-processor');
            const source = args.source; const filename = source.split('/').pop() || 'document.pdf';
            const isUrl = source.startsWith('http://') || source.startsWith('https://');
            // LetXinet 1.1.3: antes bastaba con que MINERU_API_KEY tuviera cualquier valor para no
            // descargar el PDF; con una clave incompleta los tres motores recibian un archivo vacio.
            // Ahora MinerU recibe la URL solo si responde, y si falla se descarga y convierte en local.
            const sinTexto = (r: any) => !r || !r.markdown || /^\[Error extracting/i.test(String(r.markdown).trim());
            const avisos: string[] = [];
            let result: any = null;
            if (isUrl && process.env.MINERU_API_KEY && (await checkMineruHealth()).available) {
                try { result = await extractDocument(Buffer.alloc(0), filename, source); }
                catch (e: any) { avisos.push(`MinerU no pudo convertir la URL (${String(e.message).substring(0, 120)}); se descargo el PDF`); }
                if (result && sinTexto(result)) { avisos.push('MinerU no devolvio texto; se descargo el PDF'); result = null; }
            }
            if (!result) {
                const buffer = await loadPdf(source);
                result = await extractDocument(buffer, filename, source);
            }
            if (sinTexto(result)) throw new Error('No se pudo extraer texto del documento con ningun motor');
            let markdown = result.markdown; const maxChars = args.maxChars ?? 30000;
            if (maxChars > 0 && markdown.length > maxChars) markdown = routerSmartTruncate(markdown, maxChars);
            return { success: true, data: { text: markdown, chars: result.chars, format: result.format, extractor_used: result.extractor_used, tables: result.tables, formulas: result.formulas, images: result.images_detected, warnings: avisos.concat(result.warnings || []), timing_ms: result.timing_ms } };
        } catch (e: any) { return { success: false, error: e.message }; }
    },
    batch_convert: async (args) => {
        try {
            const { loadPdf } = await import('../providers/pdf-processor');
            const sources = (args.sources || []).slice(0, 10);
            const filesWithErrors = await Promise.all(sources.map(async (src: string) => { 
                try { const buffer = await loadPdf(src); return { buffer, name: src.split('/').pop() || 'doc.pdf', src }; }
                catch (e: any) { return { error: e.message, src, name: src.split('/').pop() || 'doc.pdf' }; }
            }));
            const validFiles = filesWithErrors.filter((f: any) => f.buffer);
            const failedFiles = filesWithErrors.filter((f: any) => f.error);
            const results = await batchConvert(validFiles);
            const combinedResults = [
                ...results.map(r => ({ name: r.name, chars: r.result?.chars, format: r.result?.format, source: r.result?.source, error: r.error })),
                ...failedFiles.map((f: any) => ({ name: f.name, source: f.src, error: f.error }))
            ];
            return { success: true, data: { results: combinedResults, total: sources.length, successful: combinedResults.filter(r => !r.error).length } };
        } catch (e: any) { return { success: false, error: e.message }; }
    },
    extract_tables: async (args) => {
        try {
            const { loadPdf } = await import('../providers/pdf-processor');
            const buffer = await loadPdf(args.source);
            return { success: true, data: await extractTablesFromDocument(buffer, args.source.split('/').pop() || 'doc.pdf', args.format || 'html', args.source) };
        } catch (e: any) { return { success: false, error: e.message }; }
    },
    extract_formulas: async (args) => {
        try {
            const { loadPdf } = await import('../providers/pdf-processor');
            const buffer = await loadPdf(args.source);
            return { success: true, data: await extractFormulasFromDocument(buffer, args.source.split('/').pop() || 'doc.pdf', args.source) };
        } catch (e: any) { return { success: false, error: e.message }; }
    },
};

async function handlePdfTool(method: string, args: any): Promise<any> {
    const handler = PDF_HANDLERS[method];
    if (!handler) throw new Error(`Unknown PDF tool: ${method}`);
    return handler(args);
}

/**
 * LetXinet 1.1.6: sondea las fuentes principales con una consulta minima (5 s cada una, todas a la
 * vez) y suma el estado de los circuit breakers. El resultado se guarda 60 s para que llamar a
 * health_check varias veces no cargue a las fuentes.
 */
let _fuentesCache: { ts: number; datos: Array<{ fuente: string; estado: string; detalle: string; ms?: number }> } | null = null;
async function estadoDeFuentes(): Promise<Array<{ fuente: string; estado: string; detalle: string; ms?: number }>> {
    if (_fuentesCache && Date.now() - _fuentesCache.ts < 60_000) return _fuentesCache.datos;
    const { getGateSnapshot } = await import('../utils/inter-process-provider-limiter');
    const abiertos = new Map(getGateSnapshot().filter(d => d.circuitOpen).map(d => [d.domain, d.cooldownRemainingSeconds]));
    const sondas: Array<{ fuente: string; url: string; clave?: string; cabeceras?: Record<string, string> }> = [
        { fuente: 'ALICIA', url: 'https://alicia.concytec.gob.pe/vufind/api/v1/search?lookfor=salud&type=AllFields&limit=1' },
        { fuente: 'La Referencia', url: 'https://www.lareferencia.info/vufind/api/v1/search?lookfor=salud&type=AllFields&limit=1&format=json' },
        { fuente: 'OpenAlex', url: 'https://api.openalex.org/works?search=health&per-page=1' },
        { fuente: 'Crossref', url: 'https://api.crossref.org/works?query=health&rows=1' },
        { fuente: 'PubMed', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=health&retmax=1&retmode=json' },
        { fuente: 'Semantic Scholar', url: 'https://api.semanticscholar.org/graph/v1/paper/search?query=health&limit=1', clave: 'SEMANTIC_SCHOLAR_API_KEY', cabeceras: process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : undefined },
        { fuente: 'CORE', url: 'https://api.core.ac.uk/v3/search/works?q=health&limit=1', clave: 'CORE_API_KEY', cabeceras: process.env.CORE_API_KEY ? { Authorization: `Bearer ${process.env.CORE_API_KEY}` } : undefined },
    ];
    const datos = await Promise.all(sondas.map(async s => {
        const dominio = new URL(s.url).hostname;
        if (abiertos.has(dominio)) return { fuente: s.fuente, estado: 'en pausa', detalle: `fallo varias veces seguidas; V11 vuelve a intentarlo en ${abiertos.get(dominio)} s` };
        const t0 = Date.now();
        try {
            // fetch directo: una sonda no debe contar como fallo en el circuit breaker de la fuente
            const r = await fetch(s.url, { headers: { 'User-Agent': 'Mozilla/5.0 LetXinet-Suite health_check', Accept: 'application/json', ...(s.cabeceras || {}) }, signal: senalConPlazo(5000) });
            const ms = Date.now() - t0;
            if (r.ok) return { fuente: s.fuente, estado: 'ok', detalle: `responde en ${ms} ms`, ms };
            const sinClave = !!s.clave && !process.env[s.clave];
            if ((r.status === 401 || r.status === 403) && sinClave) {
                return { fuente: s.fuente, estado: 'sin clave', detalle: `no hay clave configurada (${s.clave}); la fuente es opcional`, ms };
            }
            const detalle = r.status === 429 ? 'demasiadas peticiones (HTTP 429): limite de uso alcanzado'
                : (r.status === 401 || r.status === 403) ? `clave rechazada o sin permiso (HTTP ${r.status})${s.clave ? `; revisa ${s.clave}` : ''}`
                : `HTTP ${r.status}`;
            return { fuente: s.fuente, estado: r.status === 429 ? 'limitada' : 'con error', detalle, ms };
        } catch (e: any) {
            return { fuente: s.fuente, estado: 'sin respuesta', detalle: /abort|timeout/i.test(String(e?.name) + String(e?.message)) ? 'no respondio en 5 s' : String(e?.message || e).substring(0, 80), ms: Date.now() - t0 };
        }
    }));
    _fuentesCache = { ts: Date.now(), datos };
    return datos;
}

async function handleHealthCheck(baseUrl: string): Promise<any> {
    const extractionHealth = await getExtractionHealth();
    const mdCacheStats = getMarkdownCacheStats();
    // Vercel serverless: dispatch in-process (fetch a localhost falla).
    let healthData: any;
    if (process.env.VERCEL === '1' || process.env.VERCEL) {
        healthData = await dispatchInProcess('GET', '/health');
    } else {
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10000) });
        healthData = await res.json() as any;
    }
    // LetXinet 1.1.6: estado real de las fuentes. Antes health_check decia "ok" aunque ALICIA
    // estuviera en pausa o OpenAlex y PubMed respondieran "demasiadas peticiones".
    const fuentes = await estadoDeFuentes();
    const conProblema = fuentes.filter(f => f.estado !== 'ok' && f.estado !== 'sin clave');
    healthData = {
        ...healthData,
        status: conProblema.length ? 'degradado' : (healthData?.status || 'ok'),
        fuentes,
        ...(conProblema.length ? { aviso: `Fuentes con problemas: ${conProblema.map(f => `${f.fuente} (${f.detalle})`).join('; ')}` } : {}),
        busquedas: estadoTurnosBusqueda(),
    };
    return { success: true, data: { ...healthData, extraction: { mode: extractionHealth.mode, mineru: { available: extractionHealth.mineru.available, mode: extractionHealth.mineru.mode, engine: 'MinerU AI Cloud API', apiUrl: extractionHealth.mineru.apiUrl, supportedFormats: extractionHealth.mineru.supportedFormats }, markitdown: { available: extractionHealth.markitdown.available, engine: 'MarkItDown (pymupdf4llm)', pythonCmd: extractionHealth.markitdown.pythonCmd, error: extractionHealth.markitdown.error }, pdfParse: extractionHealth.pdfParse, supported_formats: extractionHealth.supported_formats, allow_remote: extractionHealth.allow_remote, recommendation: extractionHealth.recommendation, cacheEntries: mdCacheStats.entries } } };
}

async function callInternalApi(method: string, body: any, baseUrl: string, timeouts?: DerivedTimeouts): Promise<any> {
    if (SPECIALIZED_SOURCE_MAP[method]) return handleSpecializedSearch(method, body, baseUrl);
    if (method === 'health_check') return handleHealthCheck(baseUrl);
    if (method === 'coverage_report') return performCoverageReport(body.use_cache !== false, body.format);
    if (method === 'help') return getHelpText(body.topic);
    // LetXinet 1.1.3: tope de 90 s para la cadena completa (antes podia pasar de 4 minutos)
    if (method === 'recover_metadata') {
        return withPromiseTimeout(recoverMetadata(body), 90_000, 'recover_metadata supero 90 s')
            .catch((e: any) => ({ success: false, error: `${e.message}. Prueba con fetch_metadata o con el DOI exacto.` }));
    }
    if (method === 'resolve_pdf') return { success: true, data: await resolvePdfUrl(body.identifier || body.doi || body.url || '') };
    if (method === 'batch_search') return handleBatchSearch(body, baseUrl);
    if (method === 'smart_search') return handleSmartSearch(body, baseUrl);
    if (PDF_TOOL_NAMES.has(method)) return handlePdfTool(method, body);

    const endpoint = ENDPOINT_MAP[method];
    if (!endpoint) throw new Error(`Unknown tool: ${method}`);
    const isGet = method === 'list_sources';

    // Vercel serverless: dispatch in-process en lugar de fetch a localhost
    // (que falla con "fetch failed" porque no hay servidor escuchando).
    if (process.env.VERCEL === '1' || process.env.VERCEL) {
        // Patch K3 (2026-07-27): propagar __timeouts al body in-process (BUG #2 fix raíz).
        const bodyWithT: any = isGet ? undefined : { ...body, __timeouts: timeouts };
        return dispatchInProcess(isGet ? 'GET' : 'POST', endpoint, bodyWithT);
    }

    // Phase 6 (2026-07-23): client-aware adaptive timeout.
    // Use the derived innerMs from the detected MCP client (opencode/claude/cli/etc).
    // Fall back to env var INTERNAL_API_TIMEOUT_MS (upper-bound only).
    // Default 120s gives ALICIA/MinerU/etc ample time under unknown clients.
    const derivedInnerMs = timeouts?.innerMs ?? 120000;
    const innerMs = applyEnvUpperBound(derivedInnerMs, 'INTERNAL_API_TIMEOUT_MS');
    // Patch K3 (2026-07-27): propagar __timeouts en el body del fetch HTTP interno.
    // Antes: body sin __timeouts → search.ts/latam-repositories.ts caían a default 60s.
    // Después: raceMs/tryMs derivados del cliente viajan al handler search.ts.
    const bodyWithTimeouts: any = isGet ? undefined : { ...body, __timeouts: timeouts };
    // 1.1.6: senalConPlazo corta tambien esta llamada interna cuando la peticion se cancela;
    // la ruta interna lo nota (conexion cerrada) y cancela su propio trabajo.
    const res = await fetch(`${baseUrl}${endpoint}`, { method: isGet ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: isGet ? undefined : JSON.stringify(bodyWithTimeouts), signal: senalConPlazo(innerMs) });
    return res.json();
}

// â”€â”€â”€ MCP JSON-RPC Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/', async (req: Request, res: Response) => {
    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== '2.0') return res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request: expected jsonrpc 2.0' } });

    const baseUrl = `http://localhost:${process.env.PORT || 4000}`;

    // Phase 6 (2026-07-23): detect the calling MCP client once per request
    // so all branches (initialize, tools/list, tools/call, catch) can use it
    // for adaptive timeouts and metrics labels.
    const client: McpClient = detectMcpClient(req.get('user-agent'));

    try {
        if (method === 'initialize') {
            return res.json({
                jsonrpc: '2.0', id,
                result: {
                    protocolVersion: MCP_SERVER_INFO.protocolVersion,
                    capabilities: { tools: {} },
                    serverInfo: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version }
                }
            });
        }

        if (method === 'notifications/initialized') return res.json({ jsonrpc: '2.0', id, result: {} });
        if (method === 'ping') return res.json({ jsonrpc: '2.0', id, result: {} });

        // â”€â”€â”€ Deprecated tools discovery (Phase 1, 2026-07-23) â”€â”€â”€
        // Skills `letxipu-complete` and `letxipu-academic-search` Â§0 document 6 tools
        // that consistently time out (>4min) or return completenessScore=15. We mark
        // them with x_deprecated / x_deprecated_reason / x_alternative so MCP clients
        // (Claude Desktop, opencode, etc.) can surface them as deprecated and
        // suggest alternatives. The schema stays MCP-compliant: extra fields are
        // additive and ignored by older clients.
        if (method === 'tools/list') {
            const annotated = MCP_TOOLS.map((t: any) => {
                const d = DEPRECATED[t.name];
                if (!d) return t;
                return {
                    ...t,
                    x_deprecated: true,
                    x_deprecated_reason: d.reason,
                    x_alternative: d.alternative,
                    // Mirror in `description` so single-pass clients see it immediately
                    description: `[DEPRECATED] ${t.description}\n\nReason: ${d.reason}\nAlternative: ${d.alternative}`,
                };
            });
            return res.json({ jsonrpc: '2.0', id, result: { tools: annotated } });
        }

        if (method === 'tools/call') {
            const toolName = params?.name;
            const rawArgs = params?.arguments || {};

            if (!toolName) return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name' } });

            // â”€â”€â”€ Input validation (Zod schemas) â”€â”€â”€
            const validation = validateToolInput(toolName, rawArgs);
            if (!validation.ok) {
                log.warn({ tool: toolName, err: validation.error }, 'validation_failed');
                metrics.toolCalls.inc({ tool: toolName, client, status: 'validation_error' });
                return res.json({
                    jsonrpc: '2.0', id,
                    error: {
                        code: -32602,
                        message: validation.error,
                        data: validation.hint ? { hint: validation.hint } : undefined,
                    }
                });
            }

            const args = validation.data;
            // 1.1.5: maxSources nunca limito los resultados de search (la ruta solo lee maxResults).
            if (toolName === 'search' && (args as any)?.maxResults == null && (args as any)?.maxSources != null) {
                (args as any).maxResults = (args as any).maxSources;
            }

            // Log performance warnings (non-blocking)
            if ('warnings' in validation && validation.warnings.length > 0) {
                for (const w of validation.warnings) {
                    console.log(`[MCP] âš  ${toolName}: ${w}`);
                }
            }

            const t0 = Date.now();
            log.info({ tool: toolName, geo: !!((args as any)?.location) }, 'tools_call');

            // V5: Cache layer for search tools
            const CACHEABLE_TOOLS = new Set(['search', 'batch_search', 'smart_search', 'search_dblp',
                'search_paperswithcode', 'trending_papers', 'search_conferences', 'list_sources']);

            // V20: Skip cache when location is provided (geo context changes â†’ different results)
            const hasGeoContext = !!(args as any)?.location;

            if (CACHEABLE_TOOLS.has(toolName) && !hasGeoContext) {
                const key = cacheKey(toolName, args);
                const cached = getCached(key);
                if (cached) {
                    log.debug({ tool: toolName }, 'cache_hit');
                    metrics.toolCacheHits.inc({ tool: toolName });
                    metrics.toolCalls.inc({ tool: toolName, client, status: 'cache_hit' });
                    metrics.toolLatency.labels(toolName).observe(Date.now() - t0);
                    return res.json({
                        jsonrpc: '2.0', id,
                        result: {
                            content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }]
                        }
                    });
                }
            }

            // LetXinet 1.1.3: ninguna herramienta descarga de direcciones internas (SSRF)
            const urlBloqueada = await urlInternaEnArgumentos(args);
            if (urlBloqueada) {
                metrics.toolCalls.inc({ tool: toolName, client, status: 'blocked_url' });
                return res.json({
                    jsonrpc: '2.0', id,
                    result: { content: [{ type: 'text', text: JSON.stringify({ success: false, error: urlBloqueada }, null, 2) }] }
                });
            }

            if (toolName === 'download_pdf') args.returnUrl = true;

            // â”€â”€â”€ Centralized per-tool deadline (Phase 1, 2026-07-23) â”€â”€â”€
            // Enforces TOOL_TIMEOUTS[toolName] via AbortController. Inner
            // callInternalApi may have its own AbortSignal.timeout(120000)
            // for localhost /api; the outer wrapper is a safety net that
            // also forwards the signal to future custom providers that
            // accept an AbortSignal parameter.
            // â”€â”€ Phase 6: Client-aware adaptive timeouts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // Client detected at top of router.post; here we derive the 4
            // nested timeouts from its ceiling and the tool's base timeout.
            const baseToolMs = getToolTimeoutMs(toolName);
            const derived = deriveTimeouts(client, baseToolMs);
            log.debug({ tool: toolName, client, outer: derived.outerMs, race: derived.raceMs, try: derived.tryMs }, 'client_timeout_derived');
            metrics.toolCalls.inc({ tool: toolName, client, status: 'dispatched' });

            // For batch_search, also derive the source/query cap from the client
            if (toolName === 'batch_search') {
                const caps = deriveBatchCaps(client);
                // Cap queries (keep first N from the user's array; they can re-call for more)
                if (Array.isArray((args as any).queries) && (args as any).queries.length > caps.maxQueries) {
                    log.warn({ tool: toolName, client, requested: (args as any).queries.length, capped: caps.maxQueries }, 'batch_queries_capped');
                    (args as any).queries = (args as any).queries.slice(0, caps.maxQueries);
                }
                // Cap sources per query (if user provided explicit sources)
                const explicitSources = (args as any).sources;
                if (Array.isArray(explicitSources) && explicitSources.length > caps.sourcesPerQuery) {
                    log.warn({ tool: toolName, client, requested: explicitSources.length, capped: caps.sourcesPerQuery }, 'batch_sources_per_query_capped');
                    (args as any).sources = explicitSources.slice(0, caps.sourcesPerQuery);
                }
                // Stash caps in args for handleBatchSearch to apply when expanding groups
                (args as any).__batchCaps = caps;
            }

            // Threading timeouts into search routes via args (so search.ts and
            // latam-repositories.ts use the client-derived raceMs/tryMs instead
            // of env vars). The keys are hidden (prefixed __) so they don't
            // appear in tool schemas.
            (args as any).__timeouts = derived;

            const t0Tool = Date.now();
            let result: any;
            // 1.1.6: al vencer el plazo se cancela de verdad el trabajo de esta peticion (las
            // descargas en curso y las que esperan turno). Antes seguia corriendo minutos despues
            // de devolver el error y la cola crecia con cada llamada nueva.
            const cancelarPeticion = getRequestAbortController();
            const esBusqueda = toolName === 'search' || toolName === 'batch_search' || toolName === 'smart_search';
            const turno: { soltar?: () => void } = {};
            try {
                result = await withToolTimeout(toolName, async (signal) => {
                    signal.addEventListener('abort', () => cancelarPeticion?.abort(), { once: true });
                    if (esBusqueda) {
                        // Como maximo un tercio del plazo (y 45 s) esperando turno
                        turno.soltar = await tomarTurnoBusqueda(Math.min(45_000, Math.floor(derived.outerMs / 3)), signal);
                    }
                    try {
                        return await callInternalApi(toolName, args, baseUrl, derived);
                    } finally {
                        turno.soltar?.();
                    }
                }, derived.outerMs);
            } catch (e: any) {
                turno.soltar?.();
                if (e instanceof ServidorOcupado) {
                    const ms = Date.now() - t0Tool;
                    log.warn({ tool: toolName, ms, enCurso: e.enCurso, enFila: e.enFila }, 'tool_busy');
                    metrics.toolCalls.inc({ tool: toolName, client, status: 'busy' });
                    metrics.toolLatency.labels(toolName).observe(ms);
                    return res.json({
                        jsonrpc: '2.0', id,
                        error: {
                            code: -32002,
                            message: e.message,
                            data: { tool: toolName, elapsed_ms: ms, ...estadoTurnosBusqueda(), hint: 'Reintenta en unos segundos; lanza las busquedas una tras otra.' },
                        },
                    });
                }
                if (e?.name === 'AbortError' || /deadline|timeout/i.test(e?.message || '')) {
                    cancelarPeticion?.abort();
                    const ms = Date.now() - t0Tool;
                    log.warn({ tool: toolName, ms, budget: toolName }, 'tool_deadline_exceeded');
                    metrics.toolCalls.inc({ tool: toolName, client, status: 'timeout' });
                    metrics.toolLatency.labels(toolName).observe(ms);
                    return res.json({
                        jsonrpc: '2.0', id,
                        error: {
                            code: -32001,
                            message: `Tool "${toolName}" exceeded its deadline of ${ms}ms`,
                            data: { tool: toolName, elapsed_ms: ms, hint: 'Consider narrowing the search or fetching in smaller pages' },
                        },
                    });
                }
                log.error({ tool: toolName, err: e.message, stack: e.stack }, 'tool_failed');
                metrics.toolCalls.inc({ tool: toolName, client, status: 'error' });
                metrics.toolLatency.labels(toolName).observe(Date.now() - t0Tool);
                throw e;
            }

            const ms = Date.now() - t0Tool;
            metrics.toolCalls.inc({ tool: toolName, client, status: 'ok' });
            metrics.toolLatency.labels(toolName).observe(ms);

            // Cache the result if cacheable â€” use persistent TTL (24h) for search tools
            // V17: Don't cache empty results (stale cache blocks real data)
            // V20: Don't cache when geo context is active (profile changes â†’ different results)
            // 1.1.6: `search` y `smart_search` devuelven `data.sources`, no `data.results`, asi que
            // nunca entraban en la cache. No se guarda una respuesta a la que le falto alguna fuente
            // (error o circuit breaker): quedaria incompleta durante 24 h.
            const listaCache = result?.data?.results || result?.data?.sources;
            const faltoFuente = Object.values(result?.data?.stats || {}).some((s: any) => s?.error)
                || (result?.data?.fuentesConError?.length > 0) || !!result?.data?.aviso;
            if (CACHEABLE_TOOLS.has(toolName) && Array.isArray(listaCache) && listaCache.length > 0 && !hasGeoContext && !faltoFuente) {
                setCache(cacheKey(toolName, args), result, PERSISTENT_TTL_MS);
            }

            return res.json({
                jsonrpc: '2.0', id,
                result: {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                }
            });
        }

        return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    } catch (e: any) {
        log.error({ method, err: e.message }, 'handler_exception');
        metrics.toolCalls.inc({ tool: 'unknown', client: 'unknown', status: 'exception' });
        // Phase 6 fix: "Unknown tool: X" thrown by callInternalApi should surface
        // as -32601 (Method not found) per JSON-RPC 2.0 spec, not -32603 (Internal).
        if (/^Unknown tool:/.test(e.message)) {
            return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: e.message } });
        }
        return res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
    }
});

export default router;

// Exported for discovery/manifest endpoints (single-source-of-truth for the
// 28-tool catalog; consumed by `server.ts` GET / to produce a rich manifest
// instead of a hardcoded count). Marked `as const` is intentionally avoided
// so callers can map/filter freely.
export { MCP_TOOLS };

// Module-level DEPRECATED map (5 tools flagged by the v10 audit). Surfaced in
// `tools/list` annotations and in the root `GET /` manifest as `deprecated`.
// The schema stays MCP-compliant: additive x_deprecated* fields are ignored by
// older clients.
const DEPRECATED: Record<string, { reason: string; alternative: string }> = {
    pdf_sections:      { reason: 'TIMEOUT>4min on most PDFs >30 pages; returns incomplete section list', alternative: 'pdf_smart_summary (budget-aware) + read_pdf_markdown with pages=' },
    search_dblp:       { reason: 'DBLP XML API unstable; frequent 504 Gateway Timeout', alternative: 'batch_search (includes dblp via openreview fallback) or search_paperswithcode' },
    fetch_metadata:    { reason: 'completenessScore=15 single-source chain; falls back silently to HTML scraping', alternative: 'recover_metadata (full 5-source chain: OpenAlex -> Crossref -> Semantic Scholar -> DSpace7 -> HTML -> ALICIA)' },
    recover_metadata:  { reason: 'TIMEOUT>4min on dead DOIs; 5-source sequential chain with no timeout per source', alternative: 'enrich_metadata (uses cached metadata from search, single API call)' },
    // resolve_pdf with .edu.pe handle: kept available but flagged; the
    // majority of .edu.pe repos are flaky per automejora skill logs
};
export { DEPRECATED };


