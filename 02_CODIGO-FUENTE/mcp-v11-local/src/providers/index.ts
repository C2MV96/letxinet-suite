// Provider barrel exports
export { searchSemanticScholar } from './semantic-scholar';
export { searchOpenAlex, centralizedOpenAlexFallback } from './openalex';
export { searchArxiv } from './arxiv';
export { searchPubMed } from './pubmed';
export { searchScopus, enrichMetadata, checkSearchSourcesHealth } from './scopus';
export { searchZenodo, searchOpenAIRE, searchDOAJ, searchCrossref, searchSciELO, searchCORE, searchRedalyc, searchSerpApi } from './global-academic';
export {
    searchAlicia, searchRenati, searchLaReferencia,
    searchConacyt, searchUnam, searchAnid, searchOasisbr, searchSnrd, searchMinciencias,
    searchBdtd, searchRraae, searchEspana, searchCostaRica, searchUruguay, searchElSalvador,
    searchLaReferenciaPeru, searchLaReferenciaBrasil, searchLaReferenciaEcuador,
    searchLaReferenciaMexico, searchLaReferenciaArgentina, searchLaReferenciaColombia, searchLaReferenciaChile,
    resolveUniversity, enhanceAbstractFromSource, fetchAliciaFullMetadata
} from './latam-repositories';
export { executeFallback } from './fallback-manager';

// Fase 2.3: OAI-PMH direct harvesting fallback
export { searchOaiPmhAll, searchOaiPmhFallback, listOaiPmhEndpoints } from './oai-pmh';

// v2: New AI/ML & CS sources
export { searchDblp, getDblpBibtex } from './dblp';
export { searchPapersWithCode } from './paperswithcode';
export { searchHuggingFacePapers } from './huggingface';
export { searchOpenReview } from './openreview';
