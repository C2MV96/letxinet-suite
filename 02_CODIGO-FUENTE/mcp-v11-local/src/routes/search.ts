/**
 * POST /api/search — Multi-source academic search (V5)
 */

import { Router, Request, Response } from 'express';
import { SearchOptions, PaperResult } from '../types/search';
import { SOURCE_GROUPS } from './sources';
import * as providers from '../providers';
import { rerankByRelevanceSmart, extractKeyTerms, conceptMatchesWithSynonyms, normalizeForDedup, compactForMatching } from '../utils/reranking';
import { applyEnvUpperBound } from '../utils/client-detection';
import { withPromiseTimeout } from '../providers/base';
import { SEARCH_LIMITS } from '../utils/search-limits';
import { filtrarRepositorios, priorizarLocales } from '../utils/pertinencia-repositorios';
import { requestAborted } from '../utils/geo-context';
import { corregirUniversidades, resolverPdfDirectos } from '../utils/acabado-resultados';

const router = Router();

export const PROVIDER_MAP: Record<string, (query: string, options?: SearchOptions) => Promise<{ results: PaperResult[] }>> = {
    semantic: providers.searchSemanticScholar,
    openalex: providers.searchOpenAlex,
    pubmed: providers.searchPubMed,
    arxiv: providers.searchArxiv,
    scopus: providers.searchScopus,
    crossref: providers.searchCrossref,
    doaj: providers.searchDOAJ,
    zenodo: providers.searchZenodo,
    openaire: providers.searchOpenAIRE,
    core: providers.searchCORE,
    scielo: providers.searchSciELO,
    redalyc: providers.searchRedalyc,
    alicia: providers.searchAlicia,
    renati: providers.searchRenati,
    lareferencia: providers.searchLaReferencia,
    conacyt: providers.searchConacyt,
    unam: providers.searchUnam,
    anid: providers.searchAnid,
    oasisbr: providers.searchOasisbr,
    snrd: providers.searchSnrd,
    minciencias: providers.searchMinciencias,
    bdtd: providers.searchBdtd,
    rraae: providers.searchRraae,
    espana: providers.searchEspana,
    costarica: providers.searchCostaRica,
    uruguay: providers.searchUruguay,
    elsalvador: providers.searchElSalvador,
    laref_peru: providers.searchLaReferenciaPeru,
    laref_brasil: providers.searchLaReferenciaBrasil,
    laref_ecuador: providers.searchLaReferenciaEcuador,
    laref_mexico: providers.searchLaReferenciaMexico,
    laref_argentina: providers.searchLaReferenciaArgentina,
    laref_colombia: providers.searchLaReferenciaColombia,
    laref_chile: providers.searchLaReferenciaChile,
    serpapi: providers.searchSerpApi,
    // v2: New AI/ML & CS sources
    dblp: providers.searchDblp,
    paperswithcode: providers.searchPapersWithCode,
    huggingface: providers.searchHuggingFacePapers,
    openreview: providers.searchOpenReview,
};

// V4: Source aliases for convenience
const SOURCE_ALIASES: Record<string, string> = {
    'semanticscholar': 'semantic',
    'semantic_scholar': 'semantic',
    'semantic-scholar': 'semantic',
    'openalex': 'openalex',
    'open_alex': 'openalex',
    'open-alex': 'openalex',
    'la_referencia': 'lareferencia',
    'la-referencia': 'lareferencia',
    'papers_with_code': 'paperswithcode',
    'papers-with-code': 'paperswithcode',
    'hugging_face': 'huggingface',
    'hugging-face': 'huggingface',
    'open_review': 'openreview',
    'open-review': 'openreview',
    'bdtdbr': 'bdtd',
    'bdtd-br': 'bdtd',
    'rraae_ecuador': 'rraae',
    'rraae-ecuador': 'rraae',
    'recolecta': 'espana',
    'espana': 'espana',
    'españa': 'espana',
    'spain': 'espana',
    'kimuk': 'costarica',
    'costa_rica': 'costarica',
    'costa-rica': 'costarica',
    'timbo': 'uruguay',
    'timbó': 'uruguay',
    'redicces': 'elsalvador',
    'el_salvador': 'elsalvador',
    'el-salvador': 'elsalvador',
    'laref-peru': 'laref_peru',
    'laref-brasil': 'laref_brasil',
    'laref-ecuador': 'laref_ecuador',
    'laref-mexico': 'laref_mexico',
    'laref-argentina': 'laref_argentina',
    'laref-colombia': 'laref_colombia',
    'laref-chile': 'laref_chile',
};

export function expandSources(sources: string[], maxSources?: number): string[] {
    const expanded = new Set<string>();
    const visited = new Set<string>();
    const addSource = (source: string) => {
        const normalized = source.toLowerCase().trim();
        const aliased = SOURCE_ALIASES[normalized] || normalized;
        if (visited.has(aliased)) return;
        const group = SOURCE_GROUPS[aliased];
        if (group) {
            visited.add(aliased);
            group.forEach(addSource);
            return;
        }
        expanded.add(aliased);
    };
    for (const s of sources) {
        if (maxSources && expanded.size >= maxSources) break;
        addSource(s);
    }
    // If a cap is set, truncate to the cap (handles case where group expansion
    // added more sources than allowed after the loop)
    if (maxSources && expanded.size > maxSources) {
        return Array.from(expanded).slice(0, maxSources);
    }
    return Array.from(expanded);
}

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 60);
}

function deduplicateResults(results: PaperResult[]): PaperResult[] {
    const seen = new Map<string, PaperResult>();
    for (const r of results) {
        // V4: Stronger dedup — normalize titles + strip accents
        const titleKey = normalizeTitle(r.title);
        const doiKey = r.doi ? r.doi.toLowerCase() : null;

        // Check DOI first (exact match)
        if (doiKey && seen.has(`doi:${doiKey}`)) continue;
        // Then title similarity
        if (titleKey && seen.has(`title:${titleKey}`)) continue;

        if (doiKey) seen.set(`doi:${doiKey}`, r);
        if (titleKey) seen.set(`title:${titleKey}`, r);
    }

    // Deduplicate the values (a paper might be in both doi: and title: keys)
    const uniqueIds = new Set<string>();
    const unique: PaperResult[] = [];
    for (const r of seen.values()) {
        const uid = r.id || r.doi || r.title;
        if (!uniqueIds.has(uid)) {
            uniqueIds.add(uid);
            unique.push(r);
        }
    }
    return unique;
}

/**
 * V11.1 R2: Per-source overflow cap.
 * Some repos (e.g. UCV-Callao, rec_nmuenh) return dozens of duplicate/low-relevance
 * records for popular geo queries. Cap each source to a per-source max (default 8) to
 * preserve diversity and prevent one noisy source from saturating the reranked page.
 * Cap is applied BEFORE global deduplicateResults so normalization still runs.
 */
function capPerSource(results: PaperResult[], maxPerSource: number = 8): PaperResult[] {
    if (!results || results.length === 0) return results;
    const out: PaperResult[] = [];
    const sourceCounts = new Map<string, number>();
    // Normalize source label: UCV -> 'UCVV' prefix; preserve others.
    for (const r of results) {
        // Derive source key from id prefix (e.g. 'UCVV_xxx' -> 'UCVV')
        const idSrc = (r.id || '').split('_')[0];
        const srcKey = idSrc || (r.source || 'unknown').toLowerCase();
        const cur = sourceCounts.get(srcKey) || 0;
        if (cur < maxPerSource) {
            out.push(r);
            sourceCounts.set(srcKey, cur + 1);
        }
    }
    return out;
}

router.post('/', async (req: Request, res: Response) => {
    try {
        const { query, sources = ['latam', 'global'], yearStart, yearEnd, university, fastMode = false, location, page, filterFalsePositives = false } = req.body;
        const maxResults = req.body.maxResults || 50;
        let expandedSources = expandSources(Array.isArray(sources) ? sources : [sources]);
        // Patch C9f (2026-07-30): dedup alicia cuando renati esta presente
        // (equivalente al B6 del gateway en la ruta atomic_multisource).
        // searchRenati llama internamente a searchAlicia, por lo que correr
        // ambos providers en paralelo martillea el mismo upstream VuFind
        // (alicia A2-split = 3 sub-queries concurrentes + renati queries),
        // rate-limiting mutuo que lleva a alicia >90s → Provider timeout
        // 90009ms reproducido con query="mercado de abastos Chimbote higiene
        // salubridad vendedores" sources=[alicia,renati] fastMode=true.
        // renati devuelve registros ALICIA + SUNEDU, asi que soltar alicia
        // no pierde cobertura significativa.
        if (expandedSources.includes('renati') && expandedSources.includes('alicia')) {
            console.log(`[SEARCH] C9f: dropping 'alicia' (renati present — renati covers ALICIA upstream internally, avoids VuFind rate-limit race)`);
            expandedSources = expandedSources.filter(s => s !== 'alicia');
        }
        if (!query && !expandedSources.includes('huggingface')) return res.status(400).json({ success: false, error: 'Missing "query" field' });
        // Preserve the private deadline budget sent by the MCP dispatcher.
        // This route builds a fresh provider options object, so it must carry
        // the value forward explicitly.
        const options: SearchOptions & { __timeouts?: unknown } = {
            yearStart, yearEnd, university, location, page,
            limit: maxResults,
            scopusKey: process.env.SCOPUS_API_KEY,
            semanticKey: process.env.SEMANTIC_SCHOLAR_API_KEY,
            coreKey: process.env.CORE_API_KEY,
            serpApiKey: process.env.SERP_API_KEY,
            fastMode,
            __timeouts: req.body.__timeouts,
        };

        console.log(`\n[${'='.repeat(50)}]`);
        console.log(`[SEARCH] Query: "${query.substring(0, 80)}..."`);
        console.log(`[SEARCH] Sources: ${expandedSources.join(', ')}`);

        const stats: Record<string, { found: number; time: number; error?: string }> = {};
        const allResults: PaperResult[] = [];

        const promises = expandedSources.map(async (sourceId) => {
            const provider = PROVIDER_MAP[sourceId];
            if (!provider) return;
            const start = Date.now();
            try {
                // Per-provider race timeout (Phase 6, 2026-07-23):
                // Auto-derived from the calling MCP client's ceiling via
                // args.__timeouts.raceMs (default outer × 0.50). Falls back to
                // PROVIDER_TIMEOUT_MS env var as upper-bound; if neither set,
                // 45s default. Bounded by the outer TOOL_TIMEOUTS.
                //
                // V11 Mejora 3: use `withPromiseTimeout` instead of raw
                // Promise.race+setTimeout so the timer is cleared on
                // resolution (no zombie Timeout objects on the event loop).
                // A3 (2026-07-24): make raceMs fully client-aware.
                // BEFORE: the `else` branch ignored the client-provided
                // `__timeouts.raceMs` (or `tryMs`) when neither env var nor
                // explicit raceMs was set, falling back to a hardcoded 45s.
                // That 45s was the wrong race floor — too tight for the
                // ALICIA DME enrichment + OAI-PMH fallback chain on peru
                // queries (which lays 25-45s even today), yet too generous
                // for quick global providers (openalex semantic-scholar).
                // AFTER: prefer client-derived raceMs, then `tryMs` ×1.5 as
                // race (per Phase 6 convention tryMs=ceiling×0.67 = race×0.5),
                // then PROVIDER_TIMEOUT_MS env, then 60s (up from 45s) as the
                // Patch J (2026-07-27): bump race default 60s -> 90s.
                // BUG #2: mcp.ts:1998 no propaga __timeouts al hacer fetch interno
                // a /api/search, por lo que el default 60s hardcoded mata a ALICIA
                // (que internamente hace A2-split de 5 sub-queries + DME de 10 records,
                // cascada fácilmente >60s). 90s le da margen suficiente. El techo
                // outer outerMs (114s para opencode) sigue por encima.
                // Patch C9a (2026-07-30): floor 90s global para search tool.
                // Antes: el override del cliente (`__timeouts.tryMs` desde playground/opencode)
                // ignoraba el floor de 90s y quedaba en tryMs*1.5 (40s*1.5=60s), matando
                // ALICIA/RENATI/lareferencia que tardan 8-15s en A2-split + OAI-PMH.
                // Con floor 90s: provider rápido (openalex 2s) resuelve en 2s (race es techo,
                // no espera fija), y providers lentos tienen margen suficiente.
                // Coherente con batch_search que ya tiene Math.max(90_000, raceMs) (Patch B1).
                const __t = (options as any)?.__timeouts;
                const env = parseInt(process.env.PROVIDER_TIMEOUT_MS || '', 10);
                const raceMs = Math.max(90_000,
                    __t?.raceMs
                        ? applyEnvUpperBound(__t.raceMs, 'PROVIDER_TIMEOUT_MS')
                        : __t?.tryMs
                            ? applyEnvUpperBound(__t.tryMs * 1.5, 'PROVIDER_TIMEOUT_MS')
                            : (env > 0 ? env : 90000)
                );
                // BL-09 fix (2026-07-25): CORE v3 API has HIGHLY variable latency
                // (3s warm → 53s cold observed). fetchWithTimeout already uses
                // TIMEOUT_CORE=120s internally, but the outer race must not abort
                // before. Bump race to TIMEOUT_CORE+5000 for core specifically.
                const effectiveRaceMs = sourceId === 'core'
                    ? Math.max(raceMs, SEARCH_LIMITS.TIMEOUT_CORE + 5000)
                    : raceMs;
                // A4 (2026-07-24): propagate raceMs into the options so that
                // ALICIA's enhanceAliciaResults can bound DME work to the
                // available deadline (was queueing 25 records / concurrency 3
                // blindly, which alone takes ~42s and guarantees timeout when
                // raceMs is short).
                const providerOpts = options && typeof options === 'object'
                    ? { ...options, __timeouts: { ...(options as any).__timeouts, raceMs: effectiveRaceMs } }
                    : { __timeouts: { raceMs: effectiveRaceMs } };
                const { results } = await withPromiseTimeout(
                    provider(query, providerOpts),
                    effectiveRaceMs,
                    'Provider timeout'
                );
                stats[sourceId] = { found: results.length, time: Date.now() - start };
                allResults.push(...results);
            } catch (e: any) {
                stats[sourceId] = { found: 0, time: Date.now() - start, error: e.message };
                console.error(`[SEARCH] ${sourceId} failed (${Date.now() - start}ms):`, e.message);
            }
        });

        await Promise.allSettled(promises);

        // 1.1.6: si la peticion se cancelo (vencio el plazo o el cliente se fue), no se ordena ni
        // se filtra: nadie va a leer la respuesta y ese trabajo retrasaba a las busquedas siguientes.
        if (requestAborted()) {
            console.warn(`[SEARCH] Cancelada: "${String(query).substring(0, 60)}" (se descarta el posproceso)`);
            if (!res.headersSent) res.status(499).json({ success: false, error: 'Busqueda cancelada: vencio su plazo o el cliente cerro la conexion' });
            return;
        }

        // V11.1 R2: per-source cap to prevent UCV-Callao (rec_nmuenh) overflow
        const cappedResults = capPerSource(allResults, 8);
        let deduplicated = deduplicateResults(cappedResults);

        // Strict post-filtering to guarantee years
        if (yearStart) {
            const minYear = parseInt(String(yearStart), 10);
            if (!isNaN(minYear)) deduplicated = deduplicated.filter(r => {
                if (!r.year) return true;
                return parseInt(String(r.year), 10) >= minYear;
            });
        }
        if (yearEnd) {
            const maxYear = parseInt(String(yearEnd), 10);
            if (!isNaN(maxYear)) deduplicated = deduplicated.filter(r => {
                if (!r.year) return true;
                return parseInt(String(r.year), 10) <= maxYear;
            });
        }

        // Apply relevance-based reranking with spaCy enhancement (V8)
        // V11 Mejora 6: fastMode bypasses spaCy NER
        let reranked = await rerankByRelevanceSmart(deduplicated, [query], undefined, undefined, fastMode);

        // V10: Year filter AFTER rerank (double-check)
        if (yearStart) {
            const minYear = parseInt(String(yearStart), 10);
            if (!isNaN(minYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) >= minYear);
        }
        if (yearEnd) {
            const maxYear = parseInt(String(yearEnd), 10);
            if (!isNaN(maxYear)) reranked = reranked.filter(r => !r.year || parseInt(String(r.year), 10) <= maxYear);
        }

        // LetXinet 1.1.3: filtro de pertinencia para RENATI, ALICIA y La Referencia (activo por defecto;
        // se desactiva con filtroRepositorios=false o LETXINET_FILTRO_REPOSITORIOS=false)
        let filtroPertinencia: { quitados: number; regla: string | null } | undefined;
        if (req.body.filtroRepositorios !== false && process.env.LETXINET_FILTRO_REPOSITORIOS !== 'false') {
            const f = filtrarRepositorios(reranked, String(query || ''), location);
            reranked = f.resultados;
            if (f.quitados) {
                filtroPertinencia = { quitados: f.quitados, regla: f.regla };
                console.log(`[SEARCH] Filtro de repositorios: quitados ${f.quitados} (${f.regla})`);
            }
        }

        // LetXinet 1.1.6: lo local primero. Si la consulta nombra un lugar (palabra con mayuscula)
        // o llegan `location` / `university`, los resultados que los mencionan suben al inicio,
        // sin quitar ninguno. Antes `location` y `university` recortaban la lista (Huaraz de 6 a 0)
        // y las tesis del lugar quedaban fuera de los primeros puestos.
        const prioridad = priorizarLocales(reranked, String(query || ''), location, university, Math.max(5, Math.ceil(maxResults / 2)));
        reranked = prioridad.resultados;
        if (prioridad.lugares.length) console.log(`[SEARCH] Prioridad local (${prioridad.lugares.join(', ')}): ${prioridad.locales} de ${reranked.length} al inicio`);

        // V10: Optional false positive filter
        console.log(`[SEARCH] filterFalsePositives=${filterFalsePositives}, query="${query}"`);
        if (filterFalsePositives) {
            const { tokens, phrases, conceptPhrases } = extractKeyTerms(query);
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
                console.log(`[SEARCH] False positives filter: ${beforeCount} → ${reranked.length} (dropped ${beforeCount - reranked.length})`);
            }
        }

        // Apply pagination
        const pageNum = Math.max(1, parseInt(String(page || 1), 10));
        const startIndex = (pageNum - 1) * maxResults;
        const endIndex = startIndex + maxResults;
        const sliced = reranked.slice(startIndex, endIndex);

        // LetXinet 1.1.6: universidad segun el repositorio y enlace directo al PDF de los primeros.
        // El PDF se resuelve por defecto, salvo en fastMode (ahi solo con resolverPdf=true) porque
        // puede sumar hasta 6 s cuando los repositorios responden lento.
        corregirUniversidades(sliced);
        let pdfDirectos = 0;
        const quierePdf = req.body.resolverPdf === true || (req.body.resolverPdf !== false && !fastMode);
        if (quierePdf && !requestAborted()) pdfDirectos = await resolverPdfDirectos(sliced, 5, 6000);

        console.log(`[SEARCH] Total: ${allResults.length} → Deduplicated: ${deduplicated.length} → Reranked → Page ${pageNum}: ${sliced.length}`);
        res.json({
            success: true,
            data: {
                sources: sliced,
                stats,
                total: sliced.length,
                totalBeforeDedup: allResults.length,
                ...(filtroPertinencia ? { filtroPertinencia } : {}),
                ...(quierePdf ? { pdfDirectos } : {}),
                ...(prioridad.lugares.length ? { prioridadLocal: { terminos: prioridad.lugares, locales: prioridad.locales } } : {})
            }
        });
    } catch (e: any) {
        console.error('[SEARCH] Fatal error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
