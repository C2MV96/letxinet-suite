/**
 * V18: Profile Loader — Hierarchical JSON config with 4D inheritance
 *
 * Hierarchy: global → country → source_combo → city
 *
 * Example: getProfile('peru', 'all_sources', 'ica')
 *   1. Load global.json (base defaults)
 *   2. Merge peru.json on top (country overrides)
 *   3. Merge peru/all_sources.json on top (source combo overrides)
 *   4. Merge peru/ica.json on top (city overrides)
 *   5. Return merged profile
 *
 * Files are cached in memory with 5-minute TTL for hot-reload support.
 * The /admin/reload-profiles endpoint forces a cache flush.
 */

import fs from 'fs';
import path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'src', 'config', 'profiles');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _fileCache = new Map<string, { content: any; loadedAt: number }>();
let _lastFullFlush = 0;

/**
 * Load a JSON profile file with caching.
 * Returns null if file doesn't exist or is invalid.
 */
function loadProfileFile(filePath: string): any | null {
    // Check cache first
    const cached = _fileCache.get(filePath);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.content;
    }

    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, 'utf8');
        const content = JSON.parse(raw);
        _fileCache.set(filePath, { content, loadedAt: Date.now() });
        return content;
    } catch {
        return null;
    }
}

/**
 * Deep merge two objects. Properties from `override` take precedence.
 */
function deepMerge(base: any, override: any): any {
    if (typeof base !== 'object' || base === null) return override;
    if (typeof override !== 'object' || override === null) return override;

    const result: any = Array.isArray(base) ? [...base] : { ...base };
    for (const key of Object.keys(override)) {
        if (key in result && typeof result[key] === 'object' && result[key] !== null &&
            typeof override[key] === 'object' && override[key] !== null) {
            result[key] = deepMerge(result[key], override[key]);
        } else {
            result[key] = override[key];
        }
    }
    return result;
}

/**
 * Detect source combo from the sources array.
 * Returns a normalized combo name for profile lookup.
 */
export function detectSourceCombo(sources: string[]): string {
    const srcs = new Set(sources.map(s => s.toLowerCase().trim()));
    const hasPeru = srcs.has('peru') || srcs.has('alicia') || srcs.has('renati') || srcs.has('laref_peru');
    const hasLatam = srcs.has('latam') || srcs.has('conacyt') || srcs.has('unam') || srcs.has('anid') ||
                     srcs.has('oasisbr') || srcs.has('bdtd') || srcs.has('snrd') || srcs.has('minciencias') ||
                     srcs.has('rraae') || srcs.has('scielo') || srcs.has('redalyc') || srcs.has('lareferencia');
    const hasGlobal = srcs.has('global') || srcs.has('crossref') || srcs.has('zenodo') ||
                      srcs.has('semantic') || srcs.has('openalex') || srcs.has('pubmed') ||
                      srcs.has('doaj') || srcs.has('openaire') || srcs.has('core');

    const count = [hasPeru, hasLatam, hasGlobal].filter(Boolean).length;

    if (count === 0) return 'all_sources'; // default
    if (count === 3) return 'all_sources';
    if (hasPeru && hasLatam && !hasGlobal) return 'peru_latam';
    if (hasPeru && hasGlobal && !hasLatam) return 'peru_global';
    if (hasLatam && hasGlobal && !hasPeru) return 'latam_global';
    if (hasPeru) return 'peru_only';
    if (hasLatam) return 'latam_only';
    if (hasGlobal) return 'global_only';
    return 'all_sources';
}

/**
 * Get the active profile for a given context.
 * Merges global → country → source_combo → city with inheritance.
 */
export function getProfile(
    country?: string,
    sourceCombo?: string,
    city?: string
): any {
    // 1. Load global.json (base)
    const globalFile = path.join(PROFILES_DIR, 'global.json');
    let profile = loadProfileFile(globalFile) || {};

    if (!country) return profile;

    // 2. Merge country profile
    const countryFile = path.join(PROFILES_DIR, `${country}.json`);
    const countryData = loadProfileFile(countryFile);
    if (countryData) {
        profile = deepMerge(profile, countryData);
    }

    if (!sourceCombo) return profile;

    // 3. Merge source_combo profile
    const comboFile = path.join(PROFILES_DIR, country, `${sourceCombo}.json`);
    const comboData = loadProfileFile(comboFile);
    if (comboData) {
        profile = deepMerge(profile, comboData);
    }

    if (!city) return profile;

    // 4. Merge city profile
    const cityFile = path.join(PROFILES_DIR, country, `${city}.json`);
    const cityData = loadProfileFile(cityFile);
    if (cityData) {
        profile = deepMerge(profile, cityData);
    }

    return profile;
}

/**
 * Force a cache flush (called by /admin/reload-profiles).
 */
export function flushProfileCache(): void {
    _fileCache.clear();
    _lastFullFlush = Date.now();
    console.log(`[PROFILE] Cache flushed at ${new Date().toISOString()}`);
}

/**
 * Get a specific parameter from the profile with fallback.
 */
export function getParam(key: string, defaultValue: any, country?: string, sourceCombo?: string, city?: string): any {
    const profile = getProfile(country, sourceCombo, city);
    const keys = key.split('.');
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
