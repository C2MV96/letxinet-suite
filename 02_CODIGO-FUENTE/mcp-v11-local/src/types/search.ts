export interface PaperResult {
    id: string;
    title: string;
    authors: string[];
    year: number | string | null;
    abstract: string;
    pdfUrl: string | null;
    source: string;
    doi: string | null;
    citationCount: number | null;
    university?: string;
    type?: string;
    handleUrl?: string;
    url?: string;
    isUsed?: boolean;
    isEnriched?: boolean;
    enrichedFields?: string[];
    bibtex?: string;
    snippet?: string;
    fullText?: string;
    evidenceLevel?: string;
    completenessScore?: number;
    smartFusionScore?: number;
    metadata?: PaperMetadata;
}

export interface PaperMetadata {
    authors?: string[];
    year?: string | number | null;
    title?: string;
    university?: string;
    pdfUrl?: string | null;
    abstract?: string | null;
    doi?: string | null;
    queries?: string[];
    url?: string;
    [key: string]: unknown;
}

export interface SearchOptions {
    yearStart?: string;
    yearEnd?: string;
    university?: string;
    location?: string;
    page?: number;
    limit?: number;
    scopusKey?: string;
    semanticKey?: string;
    serpApiKey?: string;
    countryCode?: string;
    countryFilter?: string;
    coreKey?: string;
    redalycToken?: string;
    fallbackStrategy?: FallbackStrategy;
    model?: string;
    abstractCharLimit?: number;
    /**
     * Parche 8 (2026-08-15): Override de profundidad de paginación para
     * providers OAI-PMH (renati) y otros que soportan multi-pagina.
     * Default: 7 (OAI-PMH). Rango 1-10.
     * El operador lo configura en Panel de Control > Fuentes académicas,
     * y se persiste como OAI_MAXPAGES en LetXinet-Suite.env.
     * Cada página = ~100 records. maxPages=7 -> hasta 700 records/endpoint.
     * Prioridad: option por query > process.env.OAI_MAXPAGES > default 7.
     */
    oaiMaxPages?: number;
    /**
     * Parche 9 (2026-08-15): Override de paginación POR SOURCE.
     * Permite asignar profundidad distinta a múltiples fuentes en la misma query.
     * Llaves aceptadas (case-insensitive, alias incluidos):
     *   - "renati", "oai", "oai-pmh" -> aplica a todos los endpoints OAI-PMH
     *   - "scielo"                  -> aplica a searchSciELO (per_page)
     *   - "openalex"                -> aplica a searchOpenAlex (per-page)
     *   - "scopus"                 -> aplica a searchScopus (count)
     *   - "pubmed"                 -> aplica a searchPubMed (retmax)
     *   - "semantic", "semanticscholar" -> aplica a searchSemanticScholar (limit)
     *   - "zenodo", "doaj", "crossref", "core", "redalyc", "serpapi" -> fuentes globales
     *   - "arxiv"                  -> aplica a searchArxiv (max_results)
     *   - "alicia", "lareferencia", "conacyt", "unam", "anid", "oasisbr",
     *     "snrd", "minciencias", "bdtd", "rraae" -> repos latam no-OAI
     * Valor: entero en rango [1..200] para fuentes API type "per_page"
     *         o [1..10] para OAI-PMH (paginas profundas).
     * Resolución por query (orden de precedencia):
     *   1. options.maxPagesBySource[sourceKey] (override granular por query)
     *   2. options.oaiMaxPages                 (legacy, solo OAI)
     *   3. process.env.<SOURCE>_MAXPAGES       (env por fuente: RENATI_MAXPAGES, SCIELO_MAXPAGES, OPENALEX_MAXPAGES, etc.)
     *   4. process.env.OAI_MAXPAGES            (env legacy global OAI)
     *   5. default por source (renati=7, scielo=20, openalex=25, scopus=25, pubmed=20, semantic=20, arxiv=50, zenodo=25)
     */
    maxPagesBySource?: Record<string, number>;
    fastMode?: boolean;     // Skip slow DME enhancement for faster results
    onProgress?: (data: { progress?: number; message?: string }) => void;
    /**
     * Phase 6 (2026-07-23): Client-aware adaptive timeouts threaded from
     * mcp.ts dispatcher. Used by search.ts (raceMs) and latam-repositories.ts
     * (tryMs) to replace hardcoded + env-var timeouts. Hidden (prefixed __)
     * so it doesn't appear in tool schemas.
     */
    __timeouts?: { outerMs: number; innerMs: number; raceMs: number; tryMs: number };
}

export interface SearchFilters {
    semantic?: boolean;
    openalex?: boolean;
    alicia?: boolean;
    renati?: boolean;
    scopus?: boolean;
    pubmed?: boolean;
    arxiv?: boolean;
    lareferencia?: boolean;
    conacyt?: boolean;
    unam?: boolean;
    anid?: boolean;
    oasisbr?: boolean;
    snrd?: boolean;
    minciencias?: boolean;
    bdtd?: boolean;
    rraae?: boolean;
    espana?: boolean;
    costarica?: boolean;
    uruguay?: boolean;
    elsalvador?: boolean;
    zenodo?: boolean;
    openaire?: boolean;
    doaj?: boolean;
    crossref?: boolean;
    scielo?: boolean;
    core?: boolean;
    redalyc?: boolean;
    // v2: New sources
    dblp?: boolean;
    paperswithcode?: boolean;
    huggingface?: boolean;
    openreview?: boolean;
    [key: string]: boolean | undefined;
}

export interface FallbackStrategy {
    primary: string;
    secondary: string;
}

export interface EnrichmentReport {
    totalAttempted: number;
    recoveredAbstract: number;
    recoveredYear: number;
    recoveredDoi: number;
    recoveredPdf: number;
    recoveredUniversity: number;
    recoveredAuthors: number;
    skipped: number;
    fullyFailed: number;
}

export interface VuFindRecord {
    id?: string;
    title?: string;
    authors?: Record<string, string> | string[] | { primary?: Record<string, string> };
    publicationDates?: string[];
    summary?: string[];
    urls?: Array<string | { url: string; desc?: string }>;
    formats?: string[];
    institutions?: string[];
    country?: string;
    doi?: string;
    dcContributorAuthor?: string[];
    dcContributor?: string[];
    contributor?: string[];
    dcDateIssued?: string[];
    date?: string;
    publisher?: string;
    eu_institution?: string;
}

export interface VuFindResponse {
    resultCount?: number;
    records?: VuFindRecord[];
    status?: string;
}

export interface ScopusEntry {
    'dc:identifier'?: string;
    'dc:title'?: string;
    'dc:creator'?: string;
    'prism:coverDate'?: string;
    'dc:description'?: string;
    'prism:doi'?: string;
    affilname?: string;
}

export interface ScopusResponse {
    'search-results'?: {
        'opensearch:totalResults'?: string;
        entry?: ScopusEntry[];
    };
}

export interface SemanticPaper {
    paperId: string;
    title: string;
    authors?: { name: string }[];
    year?: number;
    abstract?: string;
    openAccessPdf?: { url: string };
    url?: string;
    venue?: string;
    externalIds?: { DOI?: string };
    citationCount?: number;
}

export interface SemanticResponse {
    data?: SemanticPaper[];
    total?: number;
}

export interface OpenAlexWork {
    id: string;
    title: string;
    abstract_inverted_index?: Record<string, number[]>;
    ids?: { doi?: string };
    primary_location?: { landing_page_url?: string };
    publication_year?: number;
    authorships?: { author: { display_name: string }; institutions?: { display_name: string; country_code?: string; type?: string }[] }[];
    type?: string;
    doi?: string;
    cited_by_count?: number;
    open_access?: { is_oa?: boolean; oa_url?: string };
}

export interface OpenAlexResponse {
    results?: OpenAlexWork[];
    meta?: { count?: number };
}

export type SearchResult = PaperResult;
export type HealthStatus = Record<string, { status: 'ONLINE' | 'OFFLINE'; latency: number; error?: string }>;
