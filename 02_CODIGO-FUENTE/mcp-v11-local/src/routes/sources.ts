/**
 * GET /api/sources — Source Catalog
 */

import { Router, Request, Response } from 'express';

const router = Router();

export interface SourceInfo {
    id: string;
    name: string;
    country: string;
    category: 'free' | 'premium' | 'regional';
    help: string;
}

export const SOURCES_CATALOG: SourceInfo[] = [
    { id: 'semantic', name: 'Semantic Scholar', country: 'Global', category: 'free', help: 'AI-powered academic search engine by Allen AI. 200M+ papers.' },
    { id: 'openalex', name: 'OpenAlex', country: 'Global', category: 'free', help: 'Free comprehensive index of scholarly works. 250M+ records.' },
    { id: 'pubmed', name: 'PubMed', country: 'Global', category: 'free', help: 'Biomedical literature from MEDLINE, life science journals.' },
    { id: 'arxiv', name: 'arXiv', country: 'Global', category: 'free', help: 'Open-access preprints in physics, math, CS, biology, and more.' },
    { id: 'scopus', name: 'Scopus', country: 'Global', category: 'premium', help: 'Elsevier\'s abstract and citation database. Requires API key.' },
    { id: 'crossref', name: 'Crossref', country: 'Global', category: 'free', help: 'Global DOI registration agency. 140M+ DOI records.' },
    { id: 'doaj', name: 'DOAJ', country: 'Global', category: 'free', help: 'Directory of Open Access Journals. 9M+ articles.' },
    { id: 'zenodo', name: 'Zenodo', country: 'Global', category: 'free', help: 'CERN open repository for research data and publications.' },
    { id: 'openaire', name: 'OpenAIRE', country: 'Europe', category: 'free', help: 'European Open Science infrastructure. 150M+ records.' },
    { id: 'core', name: 'CORE', country: 'Global', category: 'free', help: 'Aggregator of open access research. Requires API key.' },
    { id: 'scielo', name: 'SciELO', country: 'LatAm/Spain', category: 'free', help: 'Scientific Electronic Library Online for Latin America.' },
    { id: 'redalyc', name: 'Redalyc', country: 'LatAm', category: 'free', help: 'Diamond Open Access network for LatAm journals.' },
    { id: 'alicia', name: 'ALICIA (CONCYTEC)', country: 'Peru', category: 'free', help: 'Peru\'s national repository aggregator by CONCYTEC.' },
    { id: 'renati', name: 'RENATI (SUNEDU)', country: 'Peru', category: 'free', help: 'Peru\'s national thesis registry by SUNEDU.' },
    { id: 'lareferencia', name: 'La Referencia', country: 'LatAm', category: 'free', help: 'Latin American open access research aggregator.' },
    { id: 'conacyt', name: 'CONAHCyT', country: 'Mexico', category: 'free', help: 'Mexico\'s national science and technology council repository.' },
    { id: 'unam', name: 'UNAM', country: 'Mexico', category: 'free', help: 'Universidad Nacional Autónoma de México repository.' },
    { id: 'anid', name: 'ANID', country: 'Chile', category: 'free', help: 'Chile\'s national research and development agency repository.' },
    { id: 'oasisbr', name: 'Oasisbr', country: 'Brazil', category: 'free', help: 'Brazil\'s open access portal by IBICT.' },
    { id: 'snrd', name: 'SNRD', country: 'Argentina', category: 'free', help: 'Argentina\'s national digital repository system.' },
    { id: 'minciencias', name: 'MinCiencias', country: 'Colombia', category: 'free', help: 'Colombia\'s ministry of science repository.' },
    { id: 'bdtd', name: 'BDTD', country: 'Brazil', category: 'free', help: 'Brazilian Digital Library of Theses and Dissertations by IBICT.' },
    { id: 'rraae', name: 'RRAAE', country: 'Ecuador', category: 'free', help: 'Ecuadorian Open Access Repository Network by CEDIA.' },
    { id: 'espana', name: 'Recolecta', country: 'Spain', category: 'free', help: 'Spanish open-access repository network through La Referencia.' },
    { id: 'costarica', name: 'KIMUK', country: 'Costa Rica', category: 'free', help: 'Costa Rican national open-access repository through La Referencia.' },
    { id: 'uruguay', name: 'Timbo', country: 'Uruguay', category: 'free', help: 'Uruguayan open-access repository records through La Referencia.' },
    { id: 'elsalvador', name: 'REDICCES', country: 'El Salvador', category: 'free', help: 'El Salvador open-access repository records through La Referencia.' },
    { id: 'laref_peru', name: 'La Referencia (Perú)', country: 'Peru', category: 'free', help: 'Peruvian repository records filtered through La Referencia network.' },
    { id: 'laref_brasil', name: 'La Referencia (Brasil)', country: 'Brazil', category: 'free', help: 'Brazilian repository records filtered through La Referencia network.' },
    { id: 'laref_ecuador', name: 'La Referencia (Ecuador)', country: 'Ecuador', category: 'free', help: 'Ecuadorian repository records filtered through La Referencia network.' },
    { id: 'laref_mexico', name: 'La Referencia (México)', country: 'Mexico', category: 'free', help: 'Mexican repository records filtered through La Referencia network.' },
    { id: 'laref_argentina', name: 'La Referencia (Argentina)', country: 'Argentina', category: 'free', help: 'Argentine repository records filtered through La Referencia network.' },
    { id: 'laref_colombia', name: 'La Referencia (Colombia)', country: 'Colombia', category: 'free', help: 'Colombian repository records filtered through La Referencia network.' },
    { id: 'laref_chile', name: 'La Referencia (Chile)', country: 'Chile', category: 'free', help: 'Chilean repository records filtered through La Referencia network.' },
    { id: 'serpapi', name: 'Google Scholar', country: 'Global', category: 'premium', help: 'Google Scholar via SerpApi. Requires API key.' },
    // v2: New AI/ML & CS sources
    { id: 'dblp', name: 'DBLP', country: 'Global', category: 'free', help: 'DBLP Computer Science Bibliography. Publications, authors, venues, BibTeX. No API key.' },
    { id: 'paperswithcode', name: 'Papers With Code', country: 'Global', category: 'free', help: 'Papers with source code, benchmarks, datasets, and methods. No API key.' },
    { id: 'huggingface', name: 'HuggingFace Daily Papers', country: 'Global', category: 'free', help: 'Trending AI/ML papers curated daily on HuggingFace. No API key.' },
    { id: 'openreview', name: 'OpenReview', country: 'Global', category: 'free', help: 'Conference papers from ICLR, NeurIPS, ICML, etc. Optional auth for full access.' },
];

export const SOURCE_GROUPS: Record<string, string[]> = {
    latam: ['alicia', 'renati', 'lareferencia', 'conacyt', 'unam', 'anid', 'oasisbr', 'bdtd', 'snrd', 'minciencias', 'rraae', 'costarica', 'uruguay', 'elsalvador', 'scielo', 'redalyc'],
    iberoamerica: ['latam', 'espana'],
    global: ['semantic', 'openalex', 'pubmed', 'crossref', 'doaj', 'zenodo', 'openaire', 'core'],
    free: ['semantic', 'openalex', 'pubmed', 'arxiv', 'crossref', 'doaj', 'zenodo', 'openaire', 'core', 'scielo', 'redalyc', 'alicia', 'renati', 'lareferencia', 'conacyt', 'unam', 'anid', 'oasisbr', 'bdtd', 'snrd', 'minciencias', 'rraae', 'espana', 'costarica', 'uruguay', 'elsalvador', 'dblp', 'paperswithcode', 'huggingface', 'openreview'],
    premium: ['scopus', 'serpapi'],
    // A6 (2026-07-24): drop 'alicia' from the peru group default. RENATI
    // internally invokes searchAlicia (see latam-repositories.ts:841
    // Promise.allSettled([searchAlicia, searchOaiPmhAll])), so listing both
    // 'renati' AND 'alicia' in the group caused searchAlicia to be invoked
    // TWICE in parallel per single peru query — doubling VuFind traffic and
    // blowing the 60s raceMs with N=10 concurrent fetches (A2-split × 5 × 2
    // invocations) saturating CRITICAL_DOMAINS[alicia].maxConcurrent=4.
    // Callers can still add 'alicia' explicitly via sources=["alicia","renati"]
    // if they need it standalone. The LaRef_Peru endpoint is independent.
    peru_fast: ['alicia', 'laref_peru'],
    peru: ['renati', 'laref_peru'],
    brasil: ['oasisbr', 'bdtd', 'laref_brasil'],
    ecuador: ['rraae', 'laref_ecuador'],
    mexico: ['conacyt', 'unam', 'laref_mexico'],
    argentina: ['snrd', 'laref_argentina'],
    colombia: ['minciencias', 'laref_colombia'],
    chile: ['anid', 'laref_chile'],
    centroamerica: ['costarica', 'elsalvador'],
    tesis: ['alicia', 'renati', 'bdtd', 'rraae', 'lareferencia', 'snrd', 'minciencias', 'espana', 'costarica', 'uruguay', 'elsalvador'],
    ai_ml: ['arxiv', 'huggingface', 'paperswithcode', 'openreview', 'dblp'],
    all: ['semantic', 'openalex', 'pubmed', 'arxiv', 'scopus', 'crossref', 'doaj', 'zenodo', 'openaire', 'core', 'scielo', 'redalyc', 'alicia', 'renati', 'lareferencia', 'conacyt', 'unam', 'anid', 'oasisbr', 'bdtd', 'snrd', 'minciencias', 'rraae', 'espana', 'costarica', 'uruguay', 'elsalvador', 'serpapi', 'dblp', 'paperswithcode', 'huggingface', 'openreview'],
};

router.get('/', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            sources: SOURCES_CATALOG,
            groups: SOURCE_GROUPS,
            total: SOURCES_CATALOG.length
        }
    });
});

export default router;
