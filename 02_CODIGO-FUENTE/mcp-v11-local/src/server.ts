/**
 * LETXIPU SEARCH MCP - Standalone Server v11.0.0
 * Batch-first academic search + spaCy NLP sidecar (NER, lemmatization, word vectors)
 * MinerU AI (cloud) + MarkItDown/pymupdf4llm (local) — auto-routing extraction
 * PDF/DOCX/PPTX/XLSX/IMG → Markdown, OCR 109 languages, 27 tools
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import searchRouter from './routes/search';
import metadataRouter from './routes/metadata';
import pdfDownloadRouter from './routes/pdf';
import pdfReaderRouter from './routes/pdf-reader';
import sourcesRouter from './routes/sources';
import mcpRouter from './routes/mcp';
import { metrics } from './utils/metrics';
import { log } from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const IS_GATEWAY_MODE = process.env.LETXIPU_DESKTOP_GATEWAY === 'true';
const VERSION_LOCAL = '11.0.0-local';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Local-only lightweight health endpoint used by the LetXipu Desktop HF
// Electron main process to probe readiness quickly (timeout 2s). Avoids
// importing the extraction router (slow / network-dependent).
app.get('/api/health', async (_req, res) => {
    let pythonReady = false;
    try {
        const SPACY_PORT = parseInt(process.env.SPACY_PORT || '4002', 10);
        const r = await fetch(`http://127.0.0.1:${SPACY_PORT}/health`, { signal: AbortSignal.timeout(1500) });
        if (r.ok) {
            const data: any = await r.json();
            pythonReady = data.ready === true;
        }
    } catch {}
    res.json({
        status: 'ok',
        service: 'letxipu-search-mcp-local',
        version: VERSION_LOCAL,
        build: 'local',
        python: pythonReady,
        gateway_mode: IS_GATEWAY_MODE,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Routes
app.use('/api/search', searchRouter);
app.use('/api/metadata', metadataRouter);
app.use('/api/pdf/download', pdfDownloadRouter);
app.use('/api/pdf', pdfReaderRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/mcp', mcpRouter);

// Health check
app.get('/health', async (_req, res) => {
    let extractionInfo: any = {};
    try {
        const { getExtractionHealth } = await import('./providers/extraction-router');
        const health = await getExtractionHealth();
            extractionInfo = {
                mode: health.mode,
                engines: {
                    mineru: health.mineru.available ? (health.mineru.mode === 'precision' ? 'available (precision API)' : 'available (free tier)') : 'disabled (set MINERU_API_KEY to enable)',
                    markitdown: health.markitdown.available ? `available (${health.markitdown.pythonCmd})` : 'unavailable',
                    pdfParse: health.pdfParse.available ? 'available' : 'unavailable',
                },
                supported_formats: health.supported_formats,
                allow_remote: health.allow_remote,
                recommendation: health.recommendation,
            };
    } catch {}
    res.json({
        status: 'ok',
        service: 'letxipu-search-mcp',
        version: '11.0.0',
        tools: 28,
        extraction: extractionInfo,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// V18: Provider gate observability — shows circuit-breaker state + rate-limits
// for all critical academic upstreams. Safe to expose (no secrets).
app.get('/health/gate', async (_req, res) => {
    try {
        const { getGateSnapshot } = await import('./utils/inter-process-provider-limiter');
        const snapshot = getGateSnapshot();
        res.json({
            status: 'ok',
            criticalDomains: snapshot.length,
            openCircuits: snapshot.filter(s => s.circuitOpen).length,
            domains: snapshot,
            timestamp: new Date().toISOString()
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

// BL-07 (2026-07-25): OpenAlex throttle health — shows free-tier budget state.
app.get('/health/openalex', async (_req, res) => {
    try {
        const { getHealthSnapshot } = await import('./utils/openalex-throttle');
        const snap = getHealthSnapshot();
        res.json({
            status: 'ok',
            ...snap,
            timestamp: new Date().toISOString(),
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});





// Phase 2 (2026-07-23): Prometheus metrics endpoint. Optional; disabled by
// default in tests via LETXIPU_METRICS=0. Returns OpenMetrics text format
// exactly as Prometheus expects when scraping.
app.get('/metrics', async (_req, res) => {
    try {
        const text = await metrics.renderMetrics();
        res.set('Content-Type', metrics.contentType());
        res.send(text);
    } catch (e: any) {
        log.error({ err: e.message, stack: e.stack }, 'metrics_endpoint_failed');
        res.status(500).send('# error rendering metrics\n');
    }
});

// Root — rich manifest (GET /). 
// Single-source-of-truth for the catalog: tool list comes from MCP_TOOLS
// in routes/mcp.ts so this manifest is always in sync with tools/list.
// Phase 6 (2026-07-23): extended with client ceilings, adaptive-timeout
// info, deprecated markers, source groups, and hyperlinks.
app.get('/', async (_req, res) => {
    // Dynamic imports keep serverless cold-start minimal (Vercel).
    const TOOL_LINEARITY = 28; // length of MCP_TOOLS, asserted by tests.
    let mcpTools: any[] = [];
    let deprecated: Record<string, any> = {};
    try {
        const mcpMod = await import('./routes/mcp');
        mcpTools = (mcpMod as any).MCP_TOOLS ?? [];
        deprecated = (mcpMod as any).DEPRECATED ?? {};
    } catch (e: any) {
        log.warn({ err: e.message }, 'manifest_mcp_import_failed');
    }
    // Live extraction health (dual-engine MinerU + MarkItDown + pdf-parse)
    let extraction: any = null;
    try {
        const { getExtractionHealth } = await import('./providers/extraction-router');
        const health = await getExtractionHealth();
        extraction = {
            mode: health.mode,
            mineru:   { available: health.mineru.available, mode: health.mineru.mode },
            markitdown: { available: health.markitdown.available, pythonCmd: health.markitdown.pythonCmd || null },
            pdfParse: { available: health.pdfParse.available },
            supported_formats: health.supported_formats,
            allow_remote: health.allow_remote,
            recommendation: health.recommendation,
        };
    } catch {}
    // Adaptive-timeout ceilings per client (Phase 6).
    const clientCeilings = {
        opencode: { ceiling_s: 120, batch_cap_queries: 3, batch_cap_sources_per_query: 8 },
        claude:    { ceiling_s: 300, batch_cap_queries: 6, batch_cap_sources_per_query: 16 },
        'claude-code': { ceiling_s: 300, batch_cap_queries: 6, batch_cap_sources_per_query: 16 },
        cursor:    { ceiling_s: 180, batch_cap_queries: 4, batch_cap_sources_per_query: 12 },
        cli:       { ceiling_s: 600, batch_cap_queries: 6, batch_cap_sources_per_query: 16 },
        unknown:   { ceiling_s: 120, batch_cap_queries: 3, batch_cap_sources_per_query: 8 },
    };
    // Tool catalog for the manifest (id, name, summary, category, deprecated?).
    // Categorization is heuristic by tool name + description keywords.
    const CATEGORIES = [
        { id: 'search',   label: 'Academic search', members: ['search', 'batch_search', 'smart_search', 'search_dblp', 'trending_papers', 'search_conferences', 'search_paperswithcode'] },
        { id: 'metadata', label: 'Metadata enrichment', members: ['enrich_metadata', 'fetch_metadata', 'recover_metadata'] },
        { id: 'pdf',      label: 'PDF reading & extraction', members: ['read_pdf', 'read_pdf_markdown', 'pdf_smart_summary', 'pdf_metadata', 'pdf_sections', 'pdf_citations', 'batch_convert'] },
        { id: 'resolve',  label: 'PDF/DOI resolution', members: ['download_pdf', 'resolve_pdf'] },
        { id: 'system',   label: 'Operational & diagnostics', members: ['list_sources', 'health_check', 'coverage_report', 'help'] },
        { id: 'analyze',  label: 'Document analysis', members: ['analyze_academic', 'convert_document', 'extract_tables', 'extract_formulas', 'extract_section'] },
    ];
    const byCat = (id: string) => mcpTools
        .filter(t => CATEGORIES.find(c => c.id === id)?.members.includes(t.name))
        .map(t => {
            const d = deprecated[t.name];
            const cat = CATEGORIES.find(c => c.id === id)!;
            return {
                name: t.name,
                summary: typeof t.description === 'string'
                    ? t.description.split(/\.\s/)[0].slice(0, 120)
                    : String(t.description).slice(0, 120),
                deprecated: !!d,
                alternative: d?.alternative ?? null,
                deprecatedReason: d?.reason ?? null,
                inputRequired: t.inputSchema?.required ?? [],
            };
        });
    const toolsByCategory = CATEGORIES
        .map(c => ({ id: c.id, label: c.label, count: byCat(c.id).length, tools: byCat(c.id) }))
        .filter(c => c.count > 0);
    // Unclassified tools (safety net: if new tools are added before being
    // slotted in a category, surface them instead of silently dropping).
    const classified = new Set(CATEGORIES.flatMap(c => c.members));
    const unclassified = mcpTools
        .filter(t => !classified.has(t.name))
        .map(t => ({ name: t.name, summary: String(t.description).slice(0, 120) }));
    res.json({
        name: 'LetXipu Search MCP',
        version: '11.0.0',
        description: 'Batch-first academic search + MCP JSON-RPC 2.0 connector + dual-engine document converter (MinerU AI + MarkItDown). ' +
            `${mcpTools.length || TOOL_LINEARITY} tools across ${toolsByCategory.length} categories; adaptive timeouts per calling client.`,
        protocol: {
            name: 'MCP',
            version: '2025-06-18',
            transport: ['HTTP-POST JSON-RPC 2.0'],
            url: 'https://modelcontextprotocol.io',
        },
        endpoints: {
            mcp:                   { method: 'POST', path: '/api/mcp', description: 'MCP JSON-RPC 2.0 entry — tools/list, tools/call, initialize, ping' },
            search:                { method: 'POST', path: '/api/search', description: 'Direct academic search (same as mcp tool "search", skipped JSON-RPC envelope)' },
            sources:               { method: 'GET',  path: '/api/sources', description: 'Source catalog (35+ repos, grouped by region/category)' },
            metadataEnrich:        { method: 'POST', path: '/api/metadata/enrich', description: 'Batch metadata enrichment (OpenAlex→Crossref→Semantic→DSpace7→HTML)' },
            metadataFetch:         { method: 'POST', path: '/api/metadata/fetch', description: 'Single-paper metadata by DOI/URL/title' },
            pdfDownload:           { method: 'POST', path: '/api/pdf/download', description: 'Resolve + download PDF (9 fallback sources after DOI/repos)' },
            pdfRead:               { method: 'POST', path: '/api/pdf/read',        description: 'PDF text extraction (MinerU OCR or pdf-parse)' },
            pdfMetadata:           { method: 'POST', path: '/api/pdf/metadata',  description: 'PDF page count, creation date, file size, etc.' },
            pdfSections:           { method: 'POST', path: '/api/pdf/sections',  description: 'Academic section detection (deprecated: slow >4min)' },
            pdfCitations:          { method: 'POST', path: '/api/pdf/citations', description: 'Citation/reference list extraction (numbered + author-year)' },
            health:                { method: 'GET',  path: '/health',           description: 'Service liveness + extraction engines status' },
            healthGate:            { method: 'GET',  path: '/health/gate',      description: 'Provider gate snapshot (circuit breaker, rate-limit, domain counts)' },
            metrics:               { method: 'GET',  path: '/metrics',          description: 'Prometheus text exposition — tool_calls_total, latency, cache_hits' },
            adminReloadProfiles:   { method: 'POST', path: '/admin/reload-profiles', description: 'Hot-swap university source profiles without recompile' },
            adminProfile:          { method: 'GET',  path: '/admin/profile',    description: 'Show currently-loaded profile (debugging)' },
        },
        tools: {
            total: mcpTools.length || TOOL_LINEARITY,
            deprecatedCount: Object.keys(deprecated).length,
            deprecatedNames: Object.keys(deprecated),
            categories: toolsByCategory.map(c => ({ id: c.id, label: c.label, count: c.count })),
            catalog: [...toolsByCategory, ...(unclassified.length ? [{ id: '_other', label: 'Unclassified', count: unclassified.length, tools: unclassified }] : [])],
        },
        adaptiveTimeouts: {
            description: 'Server detects the MCP client via User-Agent and derives 4 nested timeouts (outer/inner/race/try) from a per-client ceiling. Env vars act as upper-bound only.',
            layers: ['outer = min(toolBase, ceiling × 0.95)', 'inner = outer × 0.95', 'race = outer × 0.50', 'try = race × 0.67'],
            clientCeilings,
            toolBasesMs: { search: 90000, batch_search: 240000, smart_search: 240000, read_pdf: 120000, convert_document: 120000 },
        },
        documentExtraction: extraction,
        sourceGroups: {
            latam:        'Latin America aggregated (scielo, redalyc, DSpace instances, LatAm Crossref slice)',
            global:       'International APIs (OpenAlex, Crossref, Semantic Scholar, OpenCitations, Unpaywall)',
            tesis:        'Thesis repositories (TDX, Repositórios Brasil, LatAm university archives)',
            iberoamerica: 'LatAm + Spain consolidated',
            peru:         'Peruvian academic sources (ALICIA, CONCYTEC, university repos, RENATI)',
            all:          'Union of all groups (~35 sources)',
        },
        cache: {
            description: 'Dual-layer in-memory + disk cache. Persistent TTL 24h for search/batch_search/smart_search results; 5min in-memory short TTL for transient.',
            persistentTtlMs: 24 * 60 * 60 * 1000,
            defaultTtlMs: 5 * 60 * 1000,
            cacheableTools: ['search', 'batch_search', 'smart_search', 'search_dblp', 'search_paperswithcode', 'trending_papers', 'search_conferences', 'list_sources'],
            cacheKeyExcludesHiddenKeys: true, // __timeouts / __batchCaps (Phase 6 fix)
        },
        stats: {
            uptime_s: parseFloat(process.uptime().toFixed(2)),
            memory_mb: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
            node_version: process.version,
            timestamp: new Date().toISOString(),
        },
        links: {
            health: '/health',
            metrics: '/metrics',
            mcp: '/api/mcp',
        },
    });
});

// V18: Profile reload endpoint (hot-swap without recompiling)
app.post('/admin/reload-profiles', async (_req, res) => {
    try {
        const { flushProfileCache, getProfile } = await import('./utils/profile-loader');
        flushProfileCache();
        const globalProfile = getProfile();
        res.json({
            status: 'ok',
            message: 'Profile cache flushed. All profiles will be re-read on next request.',
            globalParams: Object.keys(globalProfile),
            timestamp: new Date().toISOString()
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

// V18: Get current profile (for debugging)
app.get('/admin/profile', async (req, res) => {
    try {
        const { getProfile } = await import('./utils/profile-loader');
        const country = (req.query.country as string) || undefined;
        const sourceCombo = (req.query.combo as string) || undefined;
        const city = (req.query.city as string) || undefined;
        const profile = getProfile(country, sourceCombo, city);
        res.json({ profile, context: { country, sourceCombo, city } });
    } catch (e: any) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

// Start (local / HF Space / Docker). In Vercel serverless, Vercel imports `app` directly.
if (!process.env.VERCEL) {
// LetXinet Suite 1.1.2: en Windows solo escucha en este equipo; HF Spaces y Docker siguen en 0.0.0.0
const BIND_HOST = process.env.LETXINET_BIND_HOST || (process.env.SPACE_ID ? '0.0.0.0' : '127.0.0.1');
app.listen(PORT, BIND_HOST, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🔬 LETXIPU SEARCH MCP — v11.0.0                           ║
║  Running on http://${BIND_HOST}:${PORT}                            ║
║  28 MCP tools · 39 sources · Dual extraction engine         ║
║                                                              ║
║  v8.0 — spaCy NLP sidecar (NER, lemmas, word vectors)        ║
║    🧠 MinerU AI — Cloud API (OCR, tables, formulas, Office)  ║
║    📄 MarkItDown — Local Python (fast, private, PDF)         ║
║    🔀 Auto-routing with fallback chain                       ║
║    🔒 Security: ALLOW_REMOTE_EXTRACTION control              ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /api/search          — Multi-source search           ║
║    POST /api/metadata/enrich — Batch enrichment              ║
║    POST /api/metadata/fetch  — Single paper fetch            ║
║    POST /api/pdf/download    — PDF download                  ║
║    POST /api/pdf/read        — PDF text extraction           ║
║    POST /api/pdf/metadata    — PDF metadata                  ║
║    POST /api/pdf/sections    — Academic sections             ║
║    POST /api/pdf/citations   — Citation extraction           ║
║    GET  /api/sources         — Source catalog                ║
║    POST /api/mcp             — MCP JSON-RPC 2.0             ║
║    GET  /health              — Health check                  ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // V8: Start spaCy NLP sidecar
    console.log('\n🧠 Starting spaCy NLP sidecar...');
    import('./utils/spacy-client').then(async (spacy) => {
        const ready = await spacy.startSidecar();
        if (ready) {
            console.log('✅ spaCy sidecar ready — NER + lemmatization + word vectors active');
        } else {
            console.log('⚠️ spaCy sidecar unavailable — using JSON-only mode (degraded)');
        }
    }).catch((e) => {
        console.log(`⚠️ spaCy sidecar failed to start: ${e.message}`);
    });

    // V7.1: Check extraction router status
    import('./providers/extraction-router').then(async (router) => {
        const health = await router.getExtractionHealth();
        console.log(`\n🔀 Extraction Router: Mode = ${health.mode}`);
        if (health.mineru.available) {
            console.log(`   🧠 MinerU API: ✅ ${health.mineru.mode} mode`);
            console.log(`      URL: ${health.mineru.apiUrl}`);
            console.log(`      Formats: ${health.mineru.supportedFormats.join(', ')}`);
        } else {
            console.log(`   🧠 MinerU API: ⏸️  disabled (no MINERU_API_KEY — set this in HF Space secrets to enable)`);
            console.log(`      Fallback: MarkItDown (local, pymupdf4llm) — handles PDF/DOCX/PPTX/XLSX`);
        }
        console.log(`   📄 MarkItDown: ${health.markitdown.available ? '✅ Available (' + health.markitdown.pythonCmd + ')' : '⚠️ ' + (health.markitdown.error || 'unavailable')}`);
        console.log(`   📦 pdf-parse: ${health.pdfParse.available ? '✅ Available' : '⚠️ unavailable'}`);
        console.log(`   🔒 Remote extraction: ${health.allow_remote ? '✅ allowed' : '🚫 blocked'}`);
        console.log(`   💡 ${health.recommendation}`);
    }).catch((e) => {
        console.log(`🔀 Extraction Router: ⚠️ Failed to load: ${e.message}`);
    });
});
} // end if (!process.env.VERCEL)

// Graceful shutdown (local/HF only — not applicable in Vercel serverless)
if (!process.env.VERCEL) {
process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received — shutting down...');
    try { (await import('./utils/spacy-client')).stopSidecar(); } catch {}
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received — shutting down...');
    try { (await import('./utils/spacy-client')).stopSidecar(); } catch {}
    process.exit(0);
});
} // end if (!process.env.VERCEL)

export default app;
