import { SearchOptions, SearchResult, FallbackStrategy } from '../types/search';
import { searchOpenAlex } from './openalex';
import { searchSciELO } from './global-academic';

/**
 * Fallback Manager
 * Handling sequential fallback strategies (Primary -> Secondary)
 */

export async function executeFallback(
    query: string,
    options: SearchOptions | undefined,
    sourceLabel: string,
    originalResultsCount: number = 0
): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } } | null> {

    // If we have results, no fallback needed
    if (originalResultsCount > 0) return null;

    const strategy = options?.fallbackStrategy;
    if (!strategy) return null; // No strategy defined, no fallback

    console.log(`[${sourceLabel}] No results/Error. Initiating Fallback Protocol...`);
    console.log(`[${sourceLabel}] Strategy: Primary=${strategy.primary}, Secondary=${strategy.secondary}`);

    // --- LEVEL 1: PRIMARY FALLBACK ---
    let primaryResults: SearchResult[] = [];
    try {
        if (strategy.primary === 'openalex') {
            console.log(`[${sourceLabel}] Level 1 Fallback: OpenAlex`);
            const res = await searchOpenAlex(query, options);
            primaryResults = res.results;
        } else if (strategy.primary === 'scielo') {
            console.log(`[${sourceLabel}] Level 1 Fallback: SciELO`);
            const res = await searchSciELO(query, options);
            primaryResults = res.results;
        }
    } catch (e) {
        console.warn(`[${sourceLabel}] Level 1 Fallback Failed:`, e);
    }

    if (primaryResults.length > 0) {
        console.log(`[${sourceLabel}] Rescued via Level 1 (${strategy.primary}). Found ${primaryResults.length} docs.`);
        return {
            results: primaryResults.map(r => ({ ...r, source: `${sourceLabel} (via ${strategy.primary})` })),
            metadata: { isFallback: true }
        };
    }

    // --- LEVEL 2: SECONDARY FALLBACK ---
    // Only if Primary failed or found nothing
    let secondaryResults: SearchResult[] = [];
    try {
        if (strategy.secondary === 'scielo' && strategy.primary !== 'scielo') { // Avoid duplicate check
            console.log(`[${sourceLabel}] Level 2 Fallback: SciELO`);
            const res = await searchSciELO(query, options);
            secondaryResults = res.results;
        } else if (strategy.secondary === 'openalex' && strategy.primary !== 'openalex') {
            console.log(`[${sourceLabel}] Level 2 Fallback: OpenAlex`);
            const res = await searchOpenAlex(query, options);
            secondaryResults = res.results;
        }
    } catch (e) {
        console.warn(`[${sourceLabel}] Level 2 Fallback Failed:`, e);
    }

    if (secondaryResults.length > 0) {
        console.log(`[${sourceLabel}] Rescued via Level 2 (${strategy.secondary}). Found ${secondaryResults.length} docs.`);
        return {
            results: secondaryResults.map(r => ({ ...r, source: `${sourceLabel} (via ${strategy.secondary})` })),
            metadata: { isFallback: true }
        };
    }

    console.log(`[${sourceLabel}] All fallback levels exhausted.`);
    return null; // Let the original empty result stand
}

/**
 * Register SciELO provider as available fallback (no-op in V4, used for compatibility)
 */
export function registerSciELOFallback(_fn: any): void {
    // No-op: V4 fallback-manager imports searchSciELO directly
}

