import handlePrefixesData from '../data/handle-prefixes.json';
import globalDomainsData from '../data/global-domains.json';

/**
 * Peru University Repository Handle Map
 * Maps Handle.net prefixes to repository configurations
 */
export interface RepositoryConfig {
    base: string;
    name: string;
    isDSpace7?: boolean;
    apiBase?: string;
}

/**
 * Comprehensive mapping of Handle.net prefixes to Peruvian university repositories
 */
export const PERU_HANDLE_MAP: Record<string, RepositoryConfig> = handlePrefixesData;

/**
 * Global Domains Mapping for External Repositories and Journals
 */
export const GLOBAL_DOMAIN_MAP: Record<string, string> = globalDomainsData;

// Pre-built reverse lookups (O(1) instead of linear scan)
const _urlToConfig = new Map<string, RepositoryConfig>();
const _apiToConfig = new Map<string, RepositoryConfig>();
for (const config of Object.values(PERU_HANDLE_MAP)) {
    _urlToConfig.set(config.base, config);
    if (config.apiBase) _apiToConfig.set(config.apiBase, config);
}

const _prefixByUrl = new Map<string, string>();
const _prefixByHdl = new Map<string, string>();
for (const [prefix, config] of Object.entries(PERU_HANDLE_MAP)) {
    _prefixByUrl.set(config.base, prefix);
    _prefixByHdl.set(prefix, config.base);
}

/**
 * Resolve handle URL to direct repository URL
 */
export function resolveHandleUrl(url: string): { url: string; config: RepositoryConfig | null } {
    if (url.includes('hdl.handle.net')) {
        for (const [prefix, directBase] of _prefixByHdl) {
            if (url.includes(prefix)) {
                const handleSuffix = url.match(new RegExp(`${prefix.replace(/\./g, '\\.')}/.+`))?.[0];
                if (handleSuffix) return { url: `${directBase}/${handleSuffix}`, config: PERU_HANDLE_MAP[prefix] || null };
            }
        }
        return { url, config: null };
    }
    if (url.includes('/handle/')) {
        for (const [prefix, config] of Object.entries(PERU_HANDLE_MAP)) {
            if (url.includes(prefix)) return { url, config };
        }
    }
    if (url.includes('alicia.concytec.gob.pe')) return { url, config: null };
    return { url, config: null };
}

/**
 * Find university name from URL
 */
export function findUniversityFromUrl(url: string): string | null {
    if (_urlToConfig.has(url)) return _urlToConfig.get(url)!.name;
    if (_apiToConfig.has(url)) return _apiToConfig.get(url)!.name;
    
    // 1. Check Global Domain Map first (high priority domain match)
    for (const [domain, name] of Object.entries(GLOBAL_DOMAIN_MAP)) {
        if (url.includes(domain)) return name;
    }

    // 2. Check Handle Prefix in URL
    for (const config of Object.values(PERU_HANDLE_MAP)) {
        if (url.includes(config.base) || (config.apiBase && url.includes(config.apiBase))) return config.name;
    }
    
    // 3. Fallback check for handle prefixes directly
    for (const [prefix, config] of Object.entries(PERU_HANDLE_MAP)) {
        if (url.includes(`/${prefix}/`)) return config.name;
    }

    return null;
}
