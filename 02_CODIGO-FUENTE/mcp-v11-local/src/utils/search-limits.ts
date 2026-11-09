/**
 * SEARCH PROVIDER LIMITS CONFIGURATION — V5
 */

export const SEARCH_LIMITS = {
    // ── LatAm Repositories ──
    ALICIA: 50,
    RENATI: 30,
    LA_REFERENCIA: 30,
    CONACYT: 30,
    UNAM: 30,
    ANID: 30,
    OASISBR: 30,
    SNRD: 30,
    MINCIENCIAS: 30,
    BDTD: 30,
    RRAAE: 30,
    ESPANA: 30,
    COSTARICA: 30,
    URUGUAY: 30,
    ELSALVADOR: 30,

    // ── Global Academic ──
    OPENALEX: 100,
    SEMANTIC_SCHOLAR: 100,
    SCOPUS: 25,
    PUBMED: 40,
    CROSSREF: 50,
    DOAJ: 50,
    ZENODO: 25,
    OPENAIRE: 50,
    CORE: 50,
    SCIELO: 50,
    REDALYC: 30,
    SERPAPI: 20,
    ARXIV: 50,

    // ── AI/ML & CS (v2) ──
    DBLP: 25,
    PAPERSWITHCODE: 25,
    HUGGINGFACE: 25,
    OPENREVIEW: 25,

    // ── Defaults ──
    FALLBACK_DEFAULT: 50,

    // ── Timeouts ──
    TIMEOUT_STANDARD: 20000,
    TIMEOUT_LONG: 30000,
    TIMEOUT_EXTENDED: 40000,
    TIMEOUT_CORE: 120000,       // BL-09 fix: CORE v3 API has HIGHLY variable latency (3s warm → 53s cold observed 2026-07-25). 30s caused false timeouts on cold hits.
    TIMEOUT_PER_SOURCE: 15000,

    // ── Batch search ──
    BATCH_MAX_QUERIES: 6,
    BATCH_MAX_RESULTS: 120,
};
