/**
 * Shared relevance scoring + reranking for search results.
 * Extracted from mcp.ts to be reusable by /api/search, smart_search, and batch_search.
 *
 * All configurable data (stopwords, synonyms, country keywords, source mappings,
 * university tiers) is loaded from JSON config files in src/config/.
 */

import stopwordsData from '../config/stopwords.json';
import { getGeoContext, setGeoContext } from './geo-context';
import synonymsData from '../config/academic-synonyms.json';
import countryData from '../config/country-keywords.json';
import sourceCountryData from '../config/source-country.json';
import universityData from '../config/university-tiers.json';
import uniCoordsData from '../data/peru-university-coords.json';
import { getProfile } from './profile-loader';

// ─── V18: Profile-based parameter access ────────────────────────────────
// The active profile is set by mcp.ts before calling rerank functions.
// Falls back to global profile (which has V18 defaults) if not set.

let _activeProfile: any = null;

/** Set the active profile (called by mcp.ts handleBatchSearch) */
export function setActiveProfile(profile: any): void {
    _activeProfile = profile;
}

/** Clear the active profile (called after reranking to prevent state leakage) */
export function clearActiveProfile(): void {
    _activeProfile = null;
}

/** Get a parameter from the active profile with fallback to global profile */
function P(path: string, defaultValue: any): any {
    const profile = _activeProfile || getProfile();
    const keys = path.split('.');
    let value = profile;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return defaultValue;
        }
    }
    return value !== undefined ? value : defaultValue;
}

// ─── Build in-memory data structures from JSON configs ──────────────────

/** Spanish/English/Portuguese stopwords that should not count as "key terms" */
export const STOPWORDS = new Set([
    ...stopwordsData.es,
    ...stopwordsData.en,
    ...stopwordsData.pt,
]);

/**
 * Country/region detection keywords.
 * Maps country ID → array of detection words (normalized, no accents).
 */
const COUNTRY_KEYWORDS: Record<string, string[]> = Object.fromEntries(
    // 1.1.6: se saltan todas las claves de metadatos ("_comment", "_version"...). "_version" es un
    // texto ("R3-v2") y se recorria letra a letra como si fueran palabras clave, asi que cualquier
    // resultado con un "3" o un "2" en la universidad o el titulo quedaba con pais "_version".
    Object.entries(countryData).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))
) as any;

/**
 * Map source name fragments to their country (for regional boosting).
 * Flattened from { "peru": ["alicia", "renati", ...] } to { "alicia": "peru", ... }
 */
const SOURCE_COUNTRY: Record<string, string> = {};
for (const [country, fragments] of Object.entries(sourceCountryData).filter(([k]) => k !== '_comment') as [string, string[]][]) {
    for (const fragment of fragments) {
        SOURCE_COUNTRY[fragment] = country;
    }
}

/**
 * Academic synonyms for word-level matching in concept phrases.
 * Built bidirectionally from JSON config: if A→[B,C], then B→[A,C] and C→[A,B] are auto-generated.
 */
const ACADEMIC_SYNONYMS: Record<string, Set<string>> = {};
for (const [key, syns] of Object.entries(synonymsData).filter(([k]) => k !== '_comment') as [string, string[]][]) {
    if (!ACADEMIC_SYNONYMS[key]) ACADEMIC_SYNONYMS[key] = new Set();
    for (const s of syns) {
        ACADEMIC_SYNONYMS[key].add(s);
        if (!ACADEMIC_SYNONYMS[s]) ACADEMIC_SYNONYMS[s] = new Set();
        ACADEMIC_SYNONYMS[s].add(key);
        for (const s2 of syns) {
            if (s2 !== s) ACADEMIC_SYNONYMS[s].add(s2);
        }
    }
}

/**
 * University quality tiers for LatAm.
 * Tier 1 (+6 pts), Tier 2 (+4 pts), Tier 3 patterns (+3 pts).
 */
const UNIVERSITY_TIERS = {
    tier1: new Set<string>(),
    tier2: new Set<string>(),
    tier3Patterns: (universityData as any).tier3_patterns as string[],
};
for (const unis of Object.values((universityData as any).tier1).filter(v => Array.isArray(v)) as string[][]) {
    for (const u of unis) UNIVERSITY_TIERS.tier1.add(u);
}
for (const unis of Object.values((universityData as any).tier2).filter(v => Array.isArray(v)) as string[][]) {
    for (const u of unis) UNIVERSITY_TIERS.tier2.add(u);
}

// ─── Helper functions ────────────────────────────────────────────────────

export function normalizeForDedup(value: string): string {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Compact text for phrase matching: remove 1-2 char words */
export function compactForMatching(text: string): string {
    return normalizeForDedup(text)
        .split(/\s+/)
        .filter(w => w.length > 1)
        .join(' ');
}

/**
 * Extract key terms, phrases, and concept phrases from a query.
 * Generates bigrams AND trigrams for better multi-word concept matching.
 */
export function extractKeyTerms(query: string): { tokens: string[]; phrases: string[]; conceptPhrases: string[] } {
    const normalized = normalizeForDedup(query);
    const longWords = normalized.split(/\s+/).filter(w => w.length > 1);
    const tokens = longWords.filter(w => !STOPWORDS.has(w) && w.length > 1);
    const phrases: string[] = [];
    const conceptPhrases: string[] = [];
    const isSubstantive = (w: string) => w.length >= 2 && !STOPWORDS.has(w);

    // Bigrams
    for (let i = 0; i < longWords.length - 1; i++) {
        const w1 = longWords[i], w2 = longWords[i + 1];
        if (STOPWORDS.has(w1) && STOPWORDS.has(w2)) continue;
        phrases.push(`${w1} ${w2}`);
        if (isSubstantive(w1) && isSubstantive(w2)) {
            conceptPhrases.push(`${w1} ${w2}`);
        }
    }

    // Trigrams — catches "cambio climatico global", "desempleo juvenil feminino"
    for (let i = 0; i < longWords.length - 2; i++) {
        const w1 = longWords[i], w2 = longWords[i + 1], w3 = longWords[i + 2];
        const substantiveCount = [w1, w2, w3].filter(isSubstantive).length;
        if (substantiveCount >= 3) {
            conceptPhrases.push(`${w1} ${w2} ${w3}`);
        }
    }

    return { tokens, phrases, conceptPhrases };
}

/**
 * Check if a concept phrase matches the haystack using synonym-aware matching.
 * Handles bigrams (2 words), trigrams (3 words), and longer phrases.
 *
 * Strategy: for each word in the concept, compute variants (word + synonyms).
 * Then check if ANY combination of variants appears contiguously in the haystack,
 * OR if ALL variant words appear non-contiguously anywhere in the haystack.
 */
export function conceptMatchesWithSynonyms(concept: string, haystack: string): boolean {
    const words = concept.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return false;
    if (words.length === 1) {
        const w = words[0];
        const variants = new Set([w, ...(ACADEMIC_SYNONYMS[w] || [])]);
        return [...variants].some(v => haystack.includes(v));
    }

    const wordVariants: Set<string>[] = words.map(w =>
        new Set([w, ...(ACADEMIC_SYNONYMS[w] || [])])
    );

    // Check 1: Contiguous match — generate all variant combinations and check substring
    // Only do this for ≤3 words (exponential blowup beyond that)
    if (words.length <= 3) {
        const combos = cartesianProduct(wordVariants);
        for (const combo of combos) {
            if (haystack.includes(combo.join(' '))) return true;
        }
    }

    // Check 2: Non-contiguous — every word (or a synonym) appears somewhere in haystack
    const allFound = wordVariants.some(variants =>
        [...variants].some(v => haystack.includes(v))
    );
    if (!allFound) return false;

    for (const variants of wordVariants) {
        if (![...variants].some(v => haystack.includes(v))) return false;
    }
    return true;
}

/** Generate cartesian product of arrays of sets (guarded against stack overflow) */
export function cartesianProduct(sets: Set<string>[], _depth = 0): string[][] {
    if (sets.length === 0) return [[]];
    // Guard: prevent stack overflow from deeply nested or malicious input
    if (_depth > 10) {
        console.warn(`[cartesianProduct] Recursion depth limit reached (${_depth}), truncating`);
        return [[]];
    }
    const [first, ...rest] = sets;
    const restCombos = cartesianProduct(rest, _depth + 1);
    const result: string[][] = [];
    const MAX_COMBOS = 1000;
    for (const v of first) {
        for (const combo of restCombos) {
            result.push([v, ...combo]);
            if (result.length >= MAX_COMBOS) return result; // cap combinatorial explosion
        }
    }
    return result;
}

/** Detect which countries a query mentions */
function detectQueryCountries(queries: string[]): Set<string> {
    const countries = new Set<string>();
    const queryText = normalizeForDedup(queries.join(' '));
    for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
        for (const kw of keywords) {
            if (queryText.includes(kw)) {
                countries.add(country);
                break;
            }
        }
    }
    return countries;
}

/** Detect the country of a result based on its source name, university, and title */
function detectResultCountry(result: any): string | null {
    const sourceLower = String(result.source || '').toLowerCase();
    for (const [fragment, country] of Object.entries(SOURCE_COUNTRY)) {
        if (sourceLower.includes(fragment)) return country;
    }
    const uniNorm = normalizeForDedup(result.university || '');
    for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
        for (const kw of keywords) {
            if (uniNorm.includes(kw)) return country;
        }
    }
    // V18: Fallback — check title + abstract for country mentions
    const haystack = normalizeForDedup(`${result.title || ''} ${result.abstract || ''}`);
    if (haystack.length > 10) {
        for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
            for (const kw of keywords) {
                if (kw.length >= 4 && haystack.includes(kw)) return country;
            }
        }
    }
    // V18: Peru-specific university patterns (Catch-all for Peruvian universities)
    if (uniNorm.includes('universidad') || uniNorm.includes('universidade') || uniNorm.includes('universitario')) {
        const peruCityPatterns = ['lima', 'arequipa', 'cusco', 'cuzco', 'trujillo', 'piura', 'iquitos', 'huancayo',
            'chimbote', 'chiclayo', 'pucallpa', 'cajamarca', 'huanuco', 'tacna', 'puno', 'ayacucho',
            'ica', 'chincha', 'pisco', 'sullana', 'tarapoto', 'abancay', 'huaraz', 'tumbes',
            'chachapoyas', 'cerro de pasco', 'moyobamba', 'puerto maldonado', 'moquegua',
            'nacional', 'catolica', 'san marcos', 'san agustin', 'villarreal', 'ricardo palma',
            'cayetano heredia', 'nacional de ingenieria', 'agraria', 'pedro ruiz gallo',
            'santo toribio', 'señor de sipan', 'los angeles de chimbote', 'alas peruanas',
            'continental', 'cesar vallejo', 'privada de tacna', 'privada del norte',
            'jenaro herrera', 'nacional amazonica', 'nacional de la amazonia',
            'nacional de san antonio', 'nacional del centro', 'nacional del callao',
            'nacional de educacion', 'nacional tecnológica', 'nacional de jaen',
            'nacional de fronteira', 'nacional de tumbes', 'santiago antunez'];
        for (const pat of peruCityPatterns) {
            if (uniNorm.includes(pat)) return 'peru';
        }
    }
    // V18: Known foreign university patterns
    const foreignPatterns: Record<string, string[]> = {
        'mexico': ['unam', 'colmex', 'tecnologico de monterrey', 'itesm', 'uanl', 'uam', 'ipn', 'colima'],
        'colombia': ['andes', 'nacional de colombia', 'javeriana', 'antioquia', 'valle'],
        'chile': ['chile', 'catolica de chile', 'concepcion', 'santiago de chile', 'talca'],
        'argentina': ['buenos aires', 'cordoba', 'la plata', 'rosario', 'ubp'],
        'brasil': ['sao paulo', 'usp', 'unicamp', 'ufrj', 'ufmg', 'federal', 'estadual'],
        'ecuador': ['central del ecuador', 'catolica de quito', 'cuenca', 'guayaquil'],
        'espana': ['complutense', 'barcelona', 'autonoma', 'politecnica de catalunya', 'salamanca'],
    };
    for (const [country, patterns] of Object.entries(foreignPatterns)) {
        for (const pat of patterns) {
            if (uniNorm.includes(pat)) return country;
        }
    }
    return null;
}

/** Quality score based on metadata completeness */
function resultQualityScore(result: any): number {
    let score = 0;
    if (result.doi) score += 20;
    if (result.pdfUrl || result.url || result.handleUrl) score += 15;
    if (result.abstract && String(result.abstract).length > 80) score += 20;
    if (Array.isArray(result.authors) && result.authors.length > 0) score += 10;
    if (result.year) score += 10;
    if (result.university) score += 5;
    if (result.citationCount) score += Math.min(10, Number(result.citationCount) || 0);
    const srcCount = Number(result.sourceCount) || 1;
    if (srcCount >= 3) score += 12;
    else if (srcCount >= 2) score += 6;
    return score;
}

// ─── Public scoring functions ────────────────────────────────────────────

/**
 * Compute relevance score of a result against the executed queries (GENERIC).
 * Higher = more relevant. Combines key term coverage, phrase matches,
 * concept phrase matches, regional bonus, and quality signals.
 */
export function relevanceScore(result: any, queries: string[]): number {
    const titleNorm = normalizeForDedup(result.title || '');
    const abstractNorm = normalizeForDedup(result.abstract || '');
    const compactHaystack = compactForMatching(`${result.title || ''} ${result.abstract || ''}`);

    const allTokens = new Set<string>();
    const allPhrases = new Set<string>();
    const allConceptPhrases = new Set<string>();
    for (const q of queries) {
        const { tokens, phrases, conceptPhrases } = extractKeyTerms(q);
        tokens.forEach(t => allTokens.add(t));
        phrases.forEach(p => allPhrases.add(p));
        conceptPhrases.forEach(cp => allConceptPhrases.add(cp));
    }

    const queryCountries = detectQueryCountries(queries);
    const resultCountry = detectResultCountry(result);
    const sourceLower = String(result.source || '').toLowerCase();
    const uniLower = normalizeForDedup(result.university || '');
    const matchedCount = Array.isArray(result.matchedQueries) ? result.matchedQueries.length : 0;
    const year = parseInt(String(result.year), 10);

    let score = 0;
    score += scoreTokenMatch(titleNorm, abstractNorm, allTokens);
    score += scorePhraseMatch(compactHaystack, allPhrases);
    for (const c of allConceptPhrases) { if (conceptMatchesWithSynonyms(c, compactHaystack)) score += 8; }
    score += scoreCountryBoost(sourceLower, queryCountries);
    if (queryCountries.size > 0 && resultCountry) score += queryCountries.has(resultCountry) ? 12 : 2;
    score += scoreUniversityBoost(uniLower, queryCountries, resultCountry);
    if (matchedCount > 1) score += matchedCount * 4;
    if (titleNorm.length < 15) score -= 5;
    // V18: Penalize generic/short titles that don't add regional specificity
    if (titleNorm.length < 25) score -= 8;  // Very short title → likely generic
    // V18: Penalize known generic titles that match everything
    const genericPatterns = ['economia informal', 'el castigo estimula el delito',
        'jovenes universitarios, violencia e inseguridad en colima',
        'proceso analitico jerarquico neutrosofico'];
    const titleCheck = titleNorm.substring(0, 60);
    for (const gp of genericPatterns) {
        if (titleCheck.includes(gp)) { score -= 15; break; }
    }
    if (!isNaN(year) && year >= 2018) score += 2;
    else if (!isNaN(year) && year >= 2010) score += 1;

    return Math.min(score, 100);
}

/**
 * Rerank deduplicated batch results by combined relevance + quality score.
 * Relevance dominates (70%), quality is a tiebreaker (30%).
 */
export function rerankByRelevance(results: any[], queries: string[]): any[] {
    return results.map(r => {
        const rel = relevanceScore(r, queries);
        const quality = resultQualityScore(r);
        const combined = rel * 0.7 + quality * 0.3;
        return { result: r, _relevance: rel, _quality: quality, _combined: combined };
    }).sort((a, b) => b._combined - a._combined).map(item => ({
        ...item.result,
        relevanceScore: item._relevance,
        qualityScore: item._quality,
    }));
}

// ─── spaCy-enhanced versions (V8) ────────────────────────────────────────

import {
    isSidecarReady,
    analyzeText,
    wordSimilarity,
    conceptMatch,
    type SpaCyAnalysis,
} from './spacy-client';

import { geocodeWithOSM, isOsmMcpAvailable } from './osm-geocoder';

/**
 * City → country mapping for NER entity resolution.
 * Extends country-keywords.json with city-level detection.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
    lima: 'peru', arequipa: 'peru', cusco: 'peru', puno: 'peru',
    trujillo: 'peru', piura: 'peru', iquitos: 'peru', huancayo: 'peru',
    chiclayo: 'peru', chimbote: 'peru', ica: 'peru', tacna: 'peru',
    'sao paulo': 'brasil', 'rio de janeiro': 'brasil', brasilia: 'brasil',
    'buenos aires': 'argentina', cordoba: 'argentina',
    santiago: 'chile', valparaiso: 'chile',
    bogota: 'colombia', medellin: 'colombia', cali: 'colombia',
    'ciudad de mexico': 'mexico', guadalajara: 'mexico', monterrey: 'mexico',
    quito: 'ecuador', guayaquil: 'ecuador',
    montevideo: 'uruguay', asuncion: 'paraguay',
    madrid: 'espana', barcelona: 'espana',
};

/**
 * Smart extractKeyTerms using spaCy lemmatization and noun chunks.
 * Falls back to sync version if sidecar unavailable.
 *
 * V11 Mejora 1: per-query LRU cache (Map<string, result>) so that 200+ results
 * for the same query reuse ONE spaCy call instead of 200. Cache size capped at
 * 256 entries; eviction policy = oldest (Map preserves insertion order).
 * V11 Mejora 6: when `skipSpacy=true` (fastMode), skip spaCy entirely — caller
 * gets the legacy synchronous extraction in <1ms instead of 30-100ms per query.
 */
const _extractKeyTermsCache = new Map<string, any>();
const _EXTRACT_CACHE_MAX = 256;

async function extractKeyTermsSmart(query: string, skipSpacy: boolean = false): Promise<{
    tokens: string[];
    phrases: string[];
    conceptPhrases: string[];
    detectedCountry: string | null;
    regions: string[];
}> {
    // V11 Mejora 6: fastMode bypasses spaCy NER entirely
    if (skipSpacy || !isSidecarReady()) {
        const legacy = extractKeyTerms(query);
        return { ...legacy, detectedCountry: null, regions: [] };
    }

    // V11 Mejora 1: cache hit
    const cacheKey = query;
    const cached = _extractKeyTermsCache.get(cacheKey);
    if (cached) {
        // LRU: move to end (re-insert to be first evicted last)
        _extractKeyTermsCache.delete(cacheKey);
        _extractKeyTermsCache.set(cacheKey, cached);
        return cached;
    }

    try {
        const analysis = await analyzeText(query);
        if (!analysis) {
            const legacy = extractKeyTerms(query);
            return { ...legacy, detectedCountry: null, regions: [] };
        }

        // Use spaCy lemmas as tokens (better than raw text)
        const lemmas = analysis.lemmas || [];
        const tokens = lemmas.filter((l: string) => l.length > 3 && !STOPWORDS.has(l));

        // Noun chunks as concept phrases (captures real academic concepts)
        const nounChunks = analysis.noun_chunks_lemmatized || [];

        // Also generate bigrams + trigrams as fallback
        const legacy = extractKeyTerms(query);

        // Combine: noun chunks + legacy concept phrases (deduplicated)
        const allConceptPhrases = [...new Set([...nounChunks, ...legacy.conceptPhrases])];

        // Country from NER
        const detectedCountry = analysis.detected_country || null;
        
        // V9 HYBRID: Extract Regions
        // V11.1 Fix: spaCy coalesces multi-word LOCs like "Pallasca Conchucos Ancash"
        // into a single entity, which then never matches real-world result titles.
        // Split multi-word entities into individual subtokens so each part can boost
        // results mentioning that specific place.
        const regions: string[] = [];
        const seenRegions = new Set<string>();
        const excludedRegions = new Set(['peru', 'brasil', 'chile', 'colombia', 'mexico', 'ecuador', 'argentina', 'uruguay', 'paraguay', 'bolivia', 'espana', 'america', 'europa']);
        const addRegion = (raw: string) => {
            const norm = normalizeForDedup(raw);
            if (norm.length > 2 && !excludedRegions.has(norm) && !seenRegions.has(norm)) {
                seenRegions.add(norm);
                regions.push(norm);
            }
        };
        for (const ent of analysis.entities || []) {
            if (ent.label === 'LOC' || ent.label === 'GPE') {
                // Original full entity (as before)
                addRegion(ent.text);
                // V11.1: also split multi-word entities into single-word region tokens
                const words = ent.text.split(/\s+/).filter((w: string) => w.length > 2);
                if (words.length > 1) {
                    for (const w of words) addRegion(w);
                }
            }
        }

        const result = { tokens, phrases: legacy.phrases, conceptPhrases: allConceptPhrases, detectedCountry, regions };

        // V11 Mejora 1: store in cache (evict oldest if over capacity)
        if (_extractKeyTermsCache.size >= _EXTRACT_CACHE_MAX) {
            const oldestKey = _extractKeyTermsCache.keys().next().value;
            if (oldestKey !== undefined) _extractKeyTermsCache.delete(oldestKey);
        }
        _extractKeyTermsCache.set(cacheKey, result);

        return result;
    } catch (err: any) {
        console.log(`[spaCy] extractKeyTermsSmart failed: ${err.message}`);
        const legacy = extractKeyTerms(query);
        return { ...legacy, detectedCountry: null, regions: [] };
    }
}

/** V11 Mejora 1: clear the extract cache (useful for tests / profile resets). */
export function clearExtractKeyTermsCache(): void {
    _extractKeyTermsCache.clear();
}

/**
 * Smart concept matching using spaCy word vectors as fallback.
 * First tries JSON synonyms (fast), then cosine similarity (semantic).
 */
async function conceptMatchesWithSynonymsSmart(concept: string, haystack: string): Promise<boolean> {
    // Fast path: JSON synonym matching
    if (conceptMatchesWithSynonyms(concept, haystack)) return true;

    // If spaCy not available, return false
    if (!isSidecarReady()) return false;

    try {
        // Single HTTP call to server-side concept matching (replaces O(n*m) individual calls)
        return await conceptMatch(concept, haystack);
    } catch {
        return false;
    }
}

/**
 * spaCy-enhanced country detection using NER.
 * Falls back to JSON keyword matching if sidecar unavailable.
 */
async function detectQueryCountriesSmart(queries: string[]): Promise<Set<string>> {
    // Always try JSON first (fast, synchronous)
    const jsonCountries = detectQueryCountries(queries);

    // If spaCy available, enhance with NER
    if (isSidecarReady()) {
        try {
            const queryText = queries.join(' ');
            const analysis = await analyzeText(queryText);
            if (analysis?.detected_country) {
                jsonCountries.add(analysis.detected_country);
            }
            // Also check entities
            for (const ent of analysis?.entities || []) {
                if (ent.label === 'LOC' || ent.label === 'GPE') {
                    const country = CITY_TO_COUNTRY[ent.text.toLowerCase()];
                    if (country) jsonCountries.add(country);
                }
            }
        } catch {
            // Ignore errors, use JSON results
        }
    }

    // V10: OSM MCP - always try to enrich with dynamic geocoding
    // Adds country if JSON missed, adds city/state metadata for region detection
    try {
        const queryText = queries.join(' ');
        const osmResult = await geocodeWithOSM(queryText);
        if (osmResult?.countryNorm) {
            jsonCountries.add(osmResult.countryNorm);
        }
        // Store OSM metadata on global for region scoring
        if (osmResult) {
            setGeoContext(osmResult);
        }
    } catch {
        // Ignore OSM errors
    }

    return jsonCountries;
}

/**
 * Compute relevance score with spaCy enhancement (V8).
 * Uses lemmatization, NER country detection, and word vector similarity.
 */
function scoreTokenMatch(titleNorm: string, abstractNorm: string, tokens: Set<string>): number {
    let s = 0;
    for (const token of tokens) {
        if (titleNorm.includes(token)) s += 3;
        if (abstractNorm.includes(token)) s += 1;
    }
    return s;
}

function scorePhraseMatch(haystack: string, phrases: Set<string>): number {
    let s = 0;
    for (const phrase of phrases) { if (haystack.includes(phrase)) s += 5; }
    return s;
}

async function scoreConceptMatch(haystack: string, concepts: Set<string>): Promise<number> {
    let s = 0;
    for (const concept of concepts) { if (await conceptMatchesWithSynonymsSmart(concept, haystack)) s += 8; }
    return s;
}

const NON_PERU_SOURCES = /bdtd|oasisbr|laref_brasil|rraae|laref_ecuador|conacyt|unam|minciencias|snrd|anid/;
const PERU_SOURCES = /alicia|renati|laref_peru|scielo-peru/;

function scoreCountryBoost(sourceLower: string, queryCountries: Set<string>): number {
    if (!queryCountries.has('peru')) return 0;
    if (PERU_SOURCES.test(sourceLower)) return 25;
    if (NON_PERU_SOURCES.test(sourceLower)) return -10;
    return 0;
}

function scoreUniversityBoost(uniLower: string, queryCountries: Set<string>, resultCountry: string | null): number {
    if (!resultCountry || !queryCountries.has(resultCountry)) return 0;
    if (UNIVERSITY_TIERS.tier1.has(uniLower) || [...UNIVERSITY_TIERS.tier1].some(t => uniLower.includes(t))) return 6;
    if (UNIVERSITY_TIERS.tier2.has(uniLower) || [...UNIVERSITY_TIERS.tier2].some(t => uniLower.includes(t))) return 4;
    if (UNIVERSITY_TIERS.tier3Patterns.some(p => uniLower.includes(p))) return 3;
    return 0;
}

const REGION_SYNONYMS: Record<string, string[]> = {
    'amazonas': ['chachapoyas', 'bagua', 'condorcanqui', 'luya', 'rodriguez de mendoza', 'utcubamba', 'toribio rodriguez de mendoza', 'untrm'],
    'ancash': ['huaraz', 'chimbote', 'santa', 'carhuaz', 'yungay', 'santiago antunez de mayolo', 'unasam', 'santa'],
    'apurimac': ['abancay', 'andahuaylas', 'micaela bastidas', 'unamba', 'jose maria arguedas'],
    'arequipa': ['arequipa', 'caylloma', 'camaná', 'camana', 'islay', 'san agustin', 'unsa', 'catolica de santa maria', 'ucsm', 'catolica san pablo'],
    'ayacucho': ['huamanga', 'lucanas', 'san cristobal de huamanga', 'unsch'],
    'cajamarca': ['cajamarca', 'jaen', 'chota', 'unc'],
    'callao': ['callao', 'ventanilla', 'unac'],
    'cusco': ['cusco', 'cuzco', 'quillabamba', 'sicuani', 'urubamba', 'san antonio abad', 'unsaac', 'andina del cusco'],
    'huancavelica': ['huancavelica', 'tayacaja', 'unh', 'autonoma de tayacaja'],
    'huanuco': ['huanuco', 'tingo maria', 'leoncio prado', 'hermilio valdizan', 'unheval', 'unas'],
    'ica': ['ica', 'chincha', 'pisco', 'nazca', 'nasca', 'san luis gonzaga', 'unica'],
    'junin': ['huancayo', 'tarma', 'jauja', 'chanchamayo', 'satipo', 'centro del peru', 'uncp', 'peruana los andes', 'upla'],
    'la libertad': ['trujillo', 'pataz', 'sanchez carrion', 'nacional de trujillo', 'unt', 'cesar vallejo', 'ucv', 'upao'],
    'lambayeque': ['chiclayo', 'lambayeque', 'ferrenafe', 'pedro ruiz gallo', 'unprg', 'santo toribio de mogrovejo', 'usat'],
    'lima': ['lima', 'huacho', 'canete', 'barranca', 'san marcos', 'unmsm', 'uni', 'pucp', 'cayetano heredia', 'upc', 'villareal', 'unfv', 'urp', 'ulima', 'usil', 'esan', 'cientifica del sur', 'utp'],
    'loreto': ['iquitos', 'maynas', 'requena', 'nauta', 'amazonia peruana', 'unap'],
    'madre de dios': ['puerto maldonado', 'tahuamanu', 'manú', 'manu', 'amazonica de madre de dios', 'unamad'],
    'moquegua': ['moquegua', 'ilo', 'mariscal nieto', 'unam'],
    'pasco': ['cerro de pasco', 'oxapampa', 'daniel alcides carrion', 'undac'],
    'piura': ['piura', 'sullana', 'talara', 'paita', 'nacional de piura', 'unp', 'udep'],
    'puno': ['puno', 'juliaca', 'san roman', 'azangaro', 'altiplano', 'unap'],
    'san martin': ['moyobamba', 'tarapoto', 'juanjui', 'tocache', 'nacional de san martin', 'unsm'],
    'tacna': ['tacna', 'tarata', 'jorge basadre', 'unjbg', 'privada de tacna', 'upt'],
    'tumbes': ['tumbes', 'zarumilla', 'nacional de tumbes', 'untumbes'],
    'ucayali': ['pucallpa', 'coronel portillo', 'padre abad', 'nacional de ucayali', 'unu']
};

function scoreRegionMatch(titleNorm: string, abstractNorm: string, university: string, source: string, requiredRegions: Set<string>): number {
    if (requiredRegions.size === 0) return 0;
    
    const uniNorm = normalizeForDedup(university);
    const srcNorm = normalizeForDedup(source);
    const haystack = `${titleNorm} ${abstractNorm} ${uniNorm} ${srcNorm}`;
    
    // Fase 1.4: Proportional penalty based on how many regions were expected but not found
    let regionsFound = 0;
    for (const region of requiredRegions) {
        if (haystack.includes(region)) { regionsFound++; continue; }
        
        const synonyms = REGION_SYNONYMS[region] || [];
        let found = false;
        for (const syn of synonyms) {
            if (haystack.includes(syn)) { found = true; break; }
        }
        if (found) regionsFound++;
    }
    
    if (regionsFound === requiredRegions.size) return 30; // All regions matched
    if (regionsFound > 0) return 15; // Partial match
    
    // No regions found at all: penalize proportionally (up to -25)
    const penalty = Math.min(25, requiredRegions.size * 8);
    return -penalty;
}

const UNI_COORDS: Record<string, { lat: number; lon: number; city: string; dept: string }> = uniCoordsData as any;

// V14: Full-name → key mapping for reliable university coordinate lookup
const UNIVERSITY_KEY_MAP: Record<string, string> = {
    'PONTIFICIA UNIVERSIDAD CATÓLICA DEL PERÚ': 'PUCP',
    'PONTIFICIA UNIVERSIDAD CATOLICA DEL PERU': 'PUCP',
    'UNIVERSIDAD CATÓLICA DE SANTA MARÍA': 'UCSM',
    'UNIVERSIDAD CATOLICA DE SANTA MARIA': 'UCSM',
    'UNIVERSIDAD NACIONAL DE SAN AGUSTÍN': 'UNSA',
    'UNIVERSIDAD NACIONAL DE SAN AGUSTIN': 'UNSA',
    'UNIVERSIDAD CATÓLICA SAN PABLO': 'UCSP',
    'UNIVERSIDAD CATOLICA SAN PABLO': 'UCSP',
    'UNIVERSIDAD NACIONAL DEL CENTRO DEL PERÚ': 'UNCP',
    'UNIVERSIDAD NACIONAL DEL CENTRO DEL PERU': 'UNCP',
    'UNIVERSIDAD NACIONAL DE INGENIERÍA': 'UNI',
    'UNIVERSIDAD NACIONAL DE INGENIERIA': 'UNI',
    'UNIVERSIDAD NACIONAL DE PIURA': 'UNP',
    'UNIVERSIDAD NACIONAL SAN MARCOS': 'UNMSM',
    'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS': 'UNMSM',
    'UNIVERSIDAD NACIONAL DEL CALLAO': 'UNAC',
    'UNIVERSIDAD NACIONAL DE CAJAMARCA': 'UNAJMA',
    'UNIVERSIDAD NACIONAL DEL ALTIPLANO': 'UNAP',
    'UNIVERSIDAD NACIONAL DE TACNA': 'UNATACNA',
    'UNIVERSIDAD NACIONAL DE TUMBES': 'UNT',
    'UNIVERSIDAD NACIONAL DE UCAYALI': 'UNU',
    'UNIVERSIDAD NACIONAL DE HUÁNUCO': 'UNHEVAL',
    'UNIVERSIDAD NACIONAL DE HUANUCO': 'UNHEVAL',
    'UNIVERSIDAD NACIONAL DE HUANCAVELICA': 'UNAH',
    'UNIVERSIDAD NACIONAL DE MADRE DE DIOS': 'UNAMAD',
    'UNIVERSIDAD NACIONAL DE SAN MARTÍN': 'UNSM',
    'UNIVERSIDAD NACIONAL DE SAN MARTIN': 'UNSM',
    'UNIVERSIDAD NACIONAL AGRARIA LA MOLINA': 'UNALM',
    'UNIVERSIDAD CESAR VALLEJO': 'UCV',
    'UNIVERSIDAD CÉSAR VALLEJO': 'UCV',
    'UNIVERSIDAD SAN MARTÍN DE PORRES': 'USMP',
    'UNIVERSIDAD SAN MARTIN DE PORRES': 'USMP',
    'UNIVERSIDAD RICARDO PALMA': 'URP',
    'UNIVERSIDAD SAN IGNACIO DE LOYOLA': 'USIL',
    'UNIVERSIDAD ANTONIO RAYMONDI': 'UARM',
    'UNIVERSIDAD JOSÉ CARLOS MARIÁTEGUI': 'UJCM',
    'UNIVERSIDAD JOSE CARLOS MARIATEGUI': 'UJCM',
    'UNIVERSIDAD NORBERT WIENER': 'UWIENER',
    'UNIVERSIDAD DE INCA GARCILASO DE LA VEGA': 'UIGV',
    'UNIVERSIDAD INCA GARCILASO DE LA VEGA': 'UIGV',
    'UNIVERSIDAD LA SALLE': 'LASALLE',
    'UNIVERSIDAD ANDINA DEL CUSCO': 'UAndina',
    'UNIVERSIDAD CONTINENTAL': 'UContinental',
    'UNIVERSIDAD ESAN': 'ESAN',
    'UNIVERSIDAD DE LIMA': 'DE LIMA',
    'UNIVERSIDAD DE PIURA': 'DE PIURA',
    'UNIVERSIDAD FRANCISCO SOLANO': 'UFS',
    'UNIVERSIDAD NACIONAL FRANCISCO VILLARREAL': 'UNFV',
    'UNIVERSIDAD AUTONOMA DEL SANTA': 'UNAS',
    'UNIVERSIDAD PRIVADA DE TRUJILLO': 'UPrivadaTrujillo',
    'UNIVERSIDAD PRIVADA DEL NORTE': 'UPN',
    'UNIVERSIDAD PRIVADA DEL CENTRO': 'UPC',
    'UNIVERSIDAD CIENTÍFICA DEL SUR': 'UCientifica',
    'UNIVERSIDAD CIENTIFICA DEL SUR': 'UCientifica',
    'UNIVERSIDAD MARÍA AUXILIADORA': 'MariaAuxiliadora',
    'UNIVERSIDAD MARIA AUXILIADORA': 'MariaAuxiliadora',
    'UNIVERSIDAD CHAMPAGNAT': 'Champagnat',
    'UNIVERSIDAD CATÓLICA SANTO TORIBIO DE MOGROVEJO': 'UCSS',
    'UNIVERSIDAD CATOLICA SANTO TORIBIO DE MOGROVEJO': 'UCSS',
    'UNIVERSIDAD PERUANO CIENTÍFICA DEL SUR': 'PeruanoCentro',
    'UNIVERSIDAD DE SAN PEDRO': 'USANPEDRO',
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// FASE 3: Dynamic geocoding cache for universities not in static JSON
// V15: TTL 24h for nulls + disk persistence
const uniGeoCache = new Map<string, { lat: number; lon: number; city: string; dept: string } | null>();
const UNI_GEO_CACHE_MAX = 200;
const UNI_GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const uniGeoCacheTTL = new Map<string, number>(); // timestamp → expiry
const UNI_GEO_CACHE_PATH = require('path').join(process.cwd(), '.cache', 'uni-geo-cache.json');

// V15: Rate limiter for Nominatim direct calls
// Fase 3.1: Serialized queue (mutex pattern) instead of non-atomic timestamp
let lastNominatimRequest = 0;
let nominatimRateChain: Promise<void> = Promise.resolve();
const NOMINATIM_RATE_LIMIT_MS = 1000;

// V18: Inter-process rate limiter (file-based) for multi-instance safety
import { interProcessRateLimit } from './inter-process-rate-limiter';

async function rateLimitNominatim(): Promise<void> {
    // V18: Inter-process coordination first (file-based, shared across instances)
    await interProcessRateLimit();
    // In-process serialization (promise chain) as secondary safety
    const prev = nominatimRateChain;
    let release: () => void;
    nominatimRateChain = new Promise<void>(r => { release = r; });
    try { await prev; } catch { /* prev rejected — still release */ }
    lastNominatimRequest = Date.now();
    release!();
}

// Load disk cache on startup
try {
    const fs = require('fs');
    if (fs.existsSync(UNI_GEO_CACHE_PATH)) {
        const disk = JSON.parse(fs.readFileSync(UNI_GEO_CACHE_PATH, 'utf8'));
        for (const [k, v] of Object.entries(disk)) {
            uniGeoCache.set(k, v as any);
            uniGeoCacheTTL.set(k, Date.now() + UNI_GEO_CACHE_TTL_MS);
        }
        console.log(`[CACHE] Loaded ${uniGeoCache.size} uni-geo entries from disk`);
    }
} catch { /* ignore */ }

function persistUniGeoCache(): void {
    try {
        const fs = require('fs');
        const dir = require('path').dirname(UNI_GEO_CACHE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const obj: Record<string, any> = {};
        for (const [k, v] of uniGeoCache.entries()) obj[k] = v;
        fs.writeFileSync(UNI_GEO_CACHE_PATH, JSON.stringify(obj, null, 2));
    } catch { /* ignore write errors */ }
}

function isCacheExpired(key: string): boolean {
    const expiry = uniGeoCacheTTL.get(key);
    if (!expiry) return true;
    return Date.now() > expiry;
}

function findUniCoordsSync(university: string): { lat: number; lon: number; city: string; dept: string } | null {
    if (!university) return null;
    const upper = university.toUpperCase().trim();
    // 1. Exact key match
    if (UNI_COORDS[upper]) return UNI_COORDS[upper];
    // 2. Check known full-name → abbreviation mappings (accent-insensitive)
    const norm = normalizeForDedup(university);
    const mapped = UNIVERSITY_KEY_MAP[upper] || UNIVERSITY_KEY_MAP[norm];
    if (mapped && UNI_COORDS[mapped]) return UNI_COORDS[mapped];
    // 3. Substring match — key must be substantial part of name
    for (const [key, val] of Object.entries(UNI_COORDS)) {
        if (key.length >= 5 && (upper.includes(key) || (key.includes(upper) && upper.length >= 5))) return val;
    }
    // 4. Normalized match
    for (const [key, val] of Object.entries(UNI_COORDS)) {
        const keyNorm = normalizeForDedup(key);
        if (keyNorm.length >= 5 && (norm.includes(keyNorm) || (keyNorm.includes(norm) && norm.length >= 5))) return val;
    }
    return null;
}

async function findUniCoordsDynamic(university: string): Promise<{ lat: number; lon: number; city: string; dept: string } | null> {
    if (!university) return null;

    // 1. Try static lookup first (fast, no network)
    const staticResult = findUniCoordsSync(university);
    if (staticResult) return staticResult;

    // 2. Check in-memory cache (skip expired entries)
    const cacheKey = normalizeForDedup(university);
    if (uniGeoCache.has(cacheKey) && !isCacheExpired(cacheKey)) return uniGeoCache.get(cacheKey)!;
    if (isCacheExpired(cacheKey)) {
        uniGeoCache.delete(cacheKey);
        uniGeoCacheTTL.delete(cacheKey);
    }

    // 3. Fallback: geocode via Nominatim directly (skip OSM MCP to avoid rate limit cascade)
    // Fase 2.2: First try without ", Peru" to detect real country of foreign universities
    try {
        // Fase 3.1: Use serialized rate limiter
        await rateLimitNominatim();

        // Try without ", Peru" first — detects foreign universities correctly
        const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(university)}&format=json&limit=1&zoom=10`,
            { headers: { 'User-Agent': 'letxipu-v17/17.0' }, signal: AbortSignal.timeout(3000) }
        );
        if (nomRes.ok) {
            const nomData = await nomRes.json() as any[];
            if (nomData.length > 0) {
                const entry = {
                    lat: parseFloat(nomData[0].lat),
                    lon: parseFloat(nomData[0].lon),
                    city: nomData[0].address?.city || nomData[0].address?.town || nomData[0].address?.village || '',
                    dept: nomData[0].address?.state || '',
                };
                if (uniGeoCache.size >= UNI_GEO_CACHE_MAX) {
                    const firstKey = uniGeoCache.keys().next().value;
                    if (firstKey) { uniGeoCache.delete(firstKey); uniGeoCacheTTL.delete(firstKey); }
                }
                uniGeoCache.set(cacheKey, entry);
                uniGeoCacheTTL.set(cacheKey, Date.now() + UNI_GEO_CACHE_TTL_MS);
                persistUniGeoCache();
                return entry;
            }
        }

        // Second try: with ", Peru" for Peruvian universities that need disambiguation
        await rateLimitNominatim();
        const nomRes2 = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(university + ', Peru')}&format=json&limit=1&zoom=10`,
            { headers: { 'User-Agent': 'letxipu-v17/17.0' }, signal: AbortSignal.timeout(3000) }
        );
        if (nomRes2.ok) {
            const nomData2 = await nomRes2.json() as any[];
            if (nomData2.length > 0) {
                const entry = {
                    lat: parseFloat(nomData2[0].lat),
                    lon: parseFloat(nomData2[0].lon),
                    city: nomData2[0].address?.city || nomData2[0].address?.town || nomData2[0].address?.village || '',
                    dept: nomData2[0].address?.state || '',
                };
                if (uniGeoCache.size >= UNI_GEO_CACHE_MAX) {
                    const firstKey = uniGeoCache.keys().next().value;
                    if (firstKey) { uniGeoCache.delete(firstKey); uniGeoCacheTTL.delete(firstKey); }
                }
                uniGeoCache.set(cacheKey, entry);
                uniGeoCacheTTL.set(cacheKey, Date.now() + UNI_GEO_CACHE_TTL_MS);
                persistUniGeoCache();
                return entry;
            }
        }
    } catch {
        // Nominatim unavailable
    }

    // Cache null with TTL so we don't retry indefinitely
    uniGeoCache.set(cacheKey, null);
    uniGeoCacheTTL.set(cacheKey, Date.now() + UNI_GEO_CACHE_TTL_MS);
    persistUniGeoCache();
    return null;
}

async function scoreDistanceBoost(queryLat: number, queryLon: number, university: string): Promise<number> {
    const entry = await findUniCoordsDynamic(university);
    if (!entry) return 0;
    const km = haversineKm(queryLat, queryLon, entry.lat, entry.lon);
    // V18: Profile-based geo boost tiers
    let boost = 0;
    if (km < P('geoBoost.city.maxKm', 50))         boost = P('geoBoost.city.boost', 60);
    else if (km < P('geoBoost.region.maxKm', 200))  boost = P('geoBoost.region.boost', 35);
    else if (km < P('geoBoost.nearby.maxKm', 500))  boost = P('geoBoost.nearby.boost', 15);
    else if (km < P('geoBoost.far.maxKm', 2000))    boost = P('geoBoost.far.boost', -5);
    else                                             boost = P('geoBoost.foreign.boost', -30);

    // V14: Extra bonus if university name contains the geocoded city
    const osmGeo = getGeoContext() as { city?: string | null; state?: string | null } | undefined;
    const uniLower = (university || '').toLowerCase();
    const geoCity = (osmGeo?.city || '').toLowerCase();
    const geoState = (osmGeo?.state || '').toLowerCase();
    if (geoCity && uniLower.includes(geoCity)) boost += P('geoBoost.geoCityBoost', 25);
    else if (geoState && uniLower.includes(geoState)) boost += P('geoBoost.geoStateBoost', 15);

    return boost;
}

// V15: Split text scoring from geo scoring for configurable weights
// V11 Mejora 6: `skipSpacy` flag (when fastMode, skip NER and use legacy synchronous extraction)
async function textScoreSmart(result: any, queries: string[], skipSpacy: boolean = false): Promise<number> {
    const titleNorm = normalizeForDedup(result.title || '');
    const abstractNorm = normalizeForDedup(result.abstract || '');
    const compactHaystack = compactForMatching(`${result.title || ''} ${result.abstract || ''}`);

    const allTokens = new Set<string>();
    const allPhrases = new Set<string>();
    const allConceptPhrases = new Set<string>();
    const requiredRegions = new Set<string>();
    let nerCountry: string | null = null;

    for (const q of queries) {
        const extracted = await extractKeyTermsSmart(q, skipSpacy);
        extracted.tokens.forEach(t => allTokens.add(t));
        extracted.phrases.forEach(p => allPhrases.add(p));
        extracted.conceptPhrases.forEach(cp => allConceptPhrases.add(cp));
        extracted.regions.forEach(r => requiredRegions.add(r));
        if (extracted.detectedCountry) nerCountry = extracted.detectedCountry;
    }

    const queryCountries = skipSpacy ? detectQueryCountries(queries) : await detectQueryCountriesSmart(queries);
    if (nerCountry) queryCountries.add(nerCountry);

    const osmGeo = getGeoContext() as { city?: string | null; state?: string | null } | undefined;
    if (osmGeo?.city) requiredRegions.add(normalizeForDedup(osmGeo.city));
    if (osmGeo?.state) requiredRegions.add(normalizeForDedup(osmGeo.state));

    const resultCountry = detectResultCountry(result);
    const sourceLower = String(result.source || '').toLowerCase();
    const uniLower = normalizeForDedup(result.university || '');
    const matchedCount = Array.isArray(result.matchedQueries) ? result.matchedQueries.length : 0;
    const year = parseInt(String(result.year), 10);

    let score = 0;
    score += scoreTokenMatch(titleNorm, abstractNorm, allTokens);
    score += scorePhraseMatch(compactHaystack, allPhrases);
    score += await scoreConceptMatch(compactHaystack, allConceptPhrases);
    score += scoreCountryBoost(sourceLower, queryCountries);
    if (queryCountries.size > 0 && resultCountry) {
        score += queryCountries.has(resultCountry) ? P('countryBoost.matchBonus', 12) : P('countryBoost.missBonus', 2);
    }
    score += scoreUniversityBoost(uniLower, queryCountries, resultCountry);
    if (matchedCount > 1) score += matchedCount * P('matchedQueryBonus', 4);
    if (titleNorm.length < P('penalties.veryShortTitleThreshold', 15)) score += P('penalties.veryShortTitlePenalty', -5);
    // V18: Penalize generic/short titles that don't add regional specificity
    if (titleNorm.length < P('penalties.shortTitleThreshold', 25)) score += P('penalties.shortTitlePenalty', -8);
    // V18: Penalize known generic titles that match everything
    const genericPatterns = P('genericPatterns', ['economia informal', 'el castigo estimula el delito',
        'jovenes universitarios, violencia e inseguridad en colima',
        'proceso analitico jerarquico neutrosofico']);
    const titleCheck = titleNorm.substring(0, 60);
    for (const gp of genericPatterns) {
        if (titleCheck.includes(gp)) { score += P('penalties.genericTitlePenalty', -15); break; }
    }
    if (!isNaN(year) && year >= 2018) score += P('recency.year2018', 2);
    else if (!isNaN(year) && year >= 2010) score += P('recency.year2010', 1);
    score += scoreRegionMatch(titleNorm, abstractNorm, result.university || '', result.source || '', requiredRegions);

    // V18: Topic-relevance floor — penalize papers that don't contain ANY core topic terms
    // Core topic terms are the first 2-3 words of the query (before city/university)
    const coreTopicTokens = new Set<string>();
    for (const q of queries) {
        const parts = q.split(/\s+/);
        // Take first 2-3 meaningful words as topic (before city name and "universidad")
        for (let i = 0; i < Math.min(3, parts.length); i++) {
            const w = parts[i].toLowerCase().trim();
            if (w.length >= 4 && w !== 'universidad' && w !== 'del' && w !== 'la' && w !== 'el' && w !== 'de') {
                coreTopicTokens.add(normalizeForDedup(w));
            }
        }
    }
    if (coreTopicTokens.size > 0) {
        const hayLower = normalizeForDedup(`${result.title || ''} ${result.abstract || ''}`);
        let topicHits = 0;
        for (const tt of coreTopicTokens) {
            if (hayLower.includes(tt)) topicHits++;
        }
        // If NO core topic token is found in title+abstract → moderate penalty
        if (topicHits === 0) {
            score += P('penalties.offTopicPenalty', -25);  // V18: profile-based
        }
        // No partial penalty — keep it simple
    }

    return score;
}

export async function geoScoreSmart(result: any): Promise<number> {
    const osmCoords = getGeoContext() as { lat?: number | null; lon?: number | null } | undefined;
    if (osmCoords?.lat != null && osmCoords?.lon != null) {
        if (result.university) {
            return scoreDistanceBoost(osmCoords.lat, osmCoords.lon, result.university);
        }
        // V18: profile-based no-university penalty
        return P('penalties.noUniversityPenalty', -8);
    }
    return 0;
}

// V15: Combined score with configurable weights
export async function relevanceScoreSmart(result: any, queries: string[], textWeight: number = 0.7, geoWeight: number = 0.3): Promise<number> {
    const ts = await textScoreSmart(result, queries);
    const gs = await geoScoreSmart(result);
    return ts * textWeight + gs * geoWeight;
}

/**
 * Rerank with spaCy enhancement (V8).
 * V15: textWeight/geoWeight configurable per tool call.
 * V17: Fixed double textWeight — quality uses independent weight (0.15).
 * V17: Exposes country, textScore, geoScore per result.
 * V17: Hard filter for Peru when geo context is explicit.
 */
export async function rerankByRelevanceSmart(
    results: any[],
    queries: string[],
    textWeight: number = P('scoring.textWeight', 0.7),
    geoWeight: number = P('scoring.geoWeight', 0.3),
    skipSpacy: boolean = false
): Promise<any[]> {
    // V14: Check if OSM geo boost is active — if so, ALWAYS recalculate with distance
    const osmCoords = getGeoContext() as { lat?: number | null; lon?: number | null } | undefined;
    const hasGeoBoost = osmCoords?.lat != null && osmCoords?.lon != null;

    // V18: Profile-based weights and limits
    const QUALITY_WEIGHT = P('scoring.QUALITY_WEIGHT', 0.15);
    const FAST_PASS_LIMIT = P('scoring.FAST_PASS_LIMIT', 60);
    const GEOCODE_LIMIT = hasGeoBoost ? P('scoring.GEOCODE_LIMIT', 10) : 0;

    // V11.1 Fix: Warm the extractKeyTermsSmart cache BEFORE the parallel Promise.all.
    // Original V11 Mejora 1 had a race-condition bug: N parallel textScoreSmart calls
    // each hit the cache miss path simultaneously (cache empty), triggering N redundant
    // spaCy HTTP calls for the same query. Warming here reduces N hits → 1 per unique query.
    if (!skipSpacy && isSidecarReady()) {
        const uniqueQueries = [...new Set(queries)];
        await Promise.all(uniqueQueries.map(q => extractKeyTermsSmart(q, false)));
    }

    // Phase 1: Fast text-only scoring for ALL results (no network calls)
    // V11 Mejora 6: pass skipSpacy so fastMode uses legacy synchronous extractKeyTerms
    const fastScored = await Promise.all(results.map(async r => {
        const ts = await textScoreSmart(r, queries, skipSpacy);
        const quality = resultQualityScore(r);
        const fastRel = ts * textWeight;
        const fastCombined = fastRel * (1 - QUALITY_WEIGHT) + quality * QUALITY_WEIGHT;
        return { result: r, _textScore: ts, _quality: quality, _fastCombined: fastCombined };
    }));

    // Sort by fast score, take top FAST_PASS_LIMIT
    fastScored.sort((a, b) => b._fastCombined - a._fastCombined);
    const topCandidates = fastScored.slice(0, FAST_PASS_LIMIT);

    // Phase 2: Full scoring with geo for top candidates only
    const scored = await Promise.all(topCandidates.map(async item => {
        const gs = hasGeoBoost ? await geoScoreSmart(item.result) : 0;
        const rel = item._textScore * textWeight + gs * geoWeight;
        const combined = rel * (1 - QUALITY_WEIGHT) + item._quality * QUALITY_WEIGHT;
        const country = detectResultCountry(item.result);
        return { result: item.result, _relevance: rel, _quality: item._quality, _combined: combined, _country: country, _textScore: item._textScore, _geoScore: gs };
    }));

    // Phase 3: Remaining results get text-only scoring (no geo)
    const remaining = fastScored.slice(FAST_PASS_LIMIT);
    for (const item of remaining) {
        const rel = item._textScore * textWeight;
        const combined = rel * (1 - QUALITY_WEIGHT) + item._quality * QUALITY_WEIGHT;
        const country = detectResultCountry(item.result);
        scored.push({ result: item.result, _relevance: rel, _quality: item._quality, _combined: combined, _country: country, _textScore: item._textScore, _geoScore: 0 });
    }

    let sorted = scored.sort((a, b) => b._combined - a._combined);

    // V18: Stronger Peru hard filter — when geo context is Peru, deprioritize foreign papers
    if (hasGeoBoost) {
        const osmGeo = getGeoContext() as { countryNorm?: string | null } | undefined;
        const isPeruContext = osmGeo?.countryNorm === 'peru' || !osmGeo?.countryNorm;
        
        if (isPeruContext) {
            const peruResults = sorted.filter(item => item._country === 'peru');
            const unknownCountry = sorted.filter(item => !item._country || item._country === '');
            const foreignResults = sorted.filter(item => item._country && item._country !== 'peru');
            
            if (peruResults.length > 0) {
                // V18: Peru first, then unknown (might be Peru), then foreign LAST
                // V18: Profile-based foreign multiplier
                const fm = P('penalties.foreignMultiplier', 0.3);
                for (const fr of foreignResults) {
                    fr._combined = fr._combined * fm;
                }
                sorted = [...peruResults, ...unknownCountry, ...foreignResults];
            }
        }
    }

    return sorted.map(item => ({
        ...item.result,
        relevanceScore: item._relevance,
        qualityScore: item._quality,
        // Fase 5.1: Expose country
        country: item._country || '',
        // Fase 5.2: Expose breakdown
        textScore: item._textScore,
        geoScore: item._geoScore,
    }));
}
