export {
    PERU_HANDLE_MAP,
    resolveHandleUrl,
    findUniversityFromUrl
} from './handle-map';
export type { RepositoryConfig } from './handle-map';

export {
    resilientFetch,
    insecureFetch,
    getRandomUserAgent,
    detectBotChallenge,
    isDomainBlocked
} from './resilient-fetch';
export type { FetchResult } from './resilient-fetch';

export {
    extractMetadataFromHtml,
    extractAliciaMetadata,
    fetchDSpace7Metadata,
    detectAndFetchDSpace7,
    isDSpace7Spa,
    cleanText
} from './metadata-extractor';
export type { ScrapedMetadata } from './metadata-extractor';

export {
    isAnubisChallenge,
    solveAnubisChallenge
} from './anubis-solver';

export {
    isPmcPowChallenge,
    isPmcUrl,
    extractPmcId,
    buildPmcPdfUrl,
    fetchPmcPdfWithPow,
    resolvePmcPdf
} from './pmc-solver';
