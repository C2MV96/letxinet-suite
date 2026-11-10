/**
 * Base utilities for search providers
 * Shared functions used by all academic search providers
 */

import { generateRecordId } from '../utils/data-mining-config';
import { SearchResult, SearchOptions } from '../types/search';
import { acquireSlot, recordSuccess, recordFailure, CircuitOpenError } from '../utils/inter-process-provider-limiter';
import { getRequestSignal, PeticionCancelada } from '../utils/geo-context';

export { generateRecordId };
export type { SearchResult, SearchOptions };

class Semaphore {
    private tasks: (() => void)[] = [];
    private activeCount = 0;

    constructor(private concurrency: number) {}

    async acquire(): Promise<void> {
        if (this.activeCount < this.concurrency) {
            this.activeCount++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.tasks.push(resolve);
        });
    }

    release(): void {
        this.activeCount--;
        if (this.tasks.length > 0) {
            this.activeCount++;
            const nextTask = this.tasks.shift();
            if (nextTask) nextTask();
        }
    }
}

// Global connection pool: limit to 50 concurrent outbound HTTP requests
export const globalFetchLimiter = new Semaphore(50);

export const DEFAULT_TIMEOUT = 25000;

/**
 * Enhanced fetch with explicit timeout support and global connection pooling.
 *
 * V18 (anti-saturation): before issuing the request, this function acquires a
 * slot from the inter-process provider gate (`.cache/provider-gate.json`). The
 * gate enforces per-domain rate-limiting + circuit-breaking across all local
 * ports AND across HF Space restarts (state persists on disk). Domains not in
 * the critical list pass through with zero overhead. Returns from the gate are
 * propagated: `CircuitOpenError` means the caller should fail fast WITHOUT
 * hitting the upstream. Response status 429/503 calls recordFailure so the
 * shared counter can open the circuit process-wide.
 */
/**
 * LetXinet 1.1.3: espera una promesa de turno como maximo `ms`. Si el turno llega tarde,
 * se libera enseguida para que la cola no quede ocupada por una peticion que ya se rindio.
 */
function turnoConPlazo<T>(turno: Promise<T>, ms: number, liberarTarde: (v: T) => void, cola: string, cancelar?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let vencido = false;
        const salir = (e: Error) => { if (vencido) return; vencido = true; clearTimeout(t); cancelar?.removeEventListener('abort', alCancelar); reject(e); };
        const alCancelar = () => salir(new PeticionCancelada());
        const t = setTimeout(() => salir(new Error(`Tiempo agotado esperando turno en la cola de ${cola}`)), ms);
        cancelar?.addEventListener('abort', alCancelar, { once: true });
        turno.then(
            (v) => { if (vencido) liberarTarde(v); else { clearTimeout(t); cancelar?.removeEventListener('abort', alCancelar); resolve(v); } },
            (e) => { clearTimeout(t); cancelar?.removeEventListener('abort', alCancelar); if (!vencido) reject(e); },
        );
    });
}

export async function fetchWithTimeout(url: string, options: any = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
    // LetXinet 1.1.3: el plazo cubre toda la peticion. Antes el reloj empezaba despues de
    // conseguir turno en las colas (una cola llena esperaba sin limite y V11 se atascaba) y se
    // cancelaba al llegar las cabeceras (la lectura del cuerpo tampoco tenia limite).
    const limite = Date.now() + timeout;
    const restante = () => Math.max(1, limite - Date.now());
    let dominio = 'conexiones';
    try { dominio = new URL(url).hostname; } catch { /* URL rara: el fetch fallara solo */ }

    // LetXinet 1.1.6: si la peticion que pidio esta descarga ya se cancelo (vencio el plazo de la
    // herramienta o el cliente se fue), no se consulta la fuente ni se espera turno. Antes el
    // trabajo vencido seguia ocupando las colas y, con varios clientes, V11 se atascaba minutos.
    const cancelar = getRequestSignal();
    if (cancelar?.aborted) throw new PeticionCancelada();

    // Inter-process gate: rate-limit + circuit-breaker for critical domains.
    // For non-critical domains this is a noop (returns immediately + noop release).
    // CircuitOpenError propagates without hitting the upstream; callers
    // (search.ts Promise.allSettled) record the source as failed with a clear reason.
    const slot = await turnoConPlazo(acquireSlot(url, cancelar), restante(), (s) => s.release(), dominio, cancelar);
    try {
        await turnoConPlazo(globalFetchLimiter.acquire(), restante(), () => globalFetchLimiter.release(), 'conexiones salientes', cancelar);
    } catch (e) {
        slot.release();
        throw e;
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), restante());
    (id as any).unref?.();
    // Sin quitar el aviso al terminar: la misma cancelacion corta la lectura del cuerpo
    cancelar?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
        if (cancelar?.aborted) throw new PeticionCancelada();
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        // Sin clearTimeout: el mismo plazo limita la lectura del cuerpo que haga quien llama

        // V18: report to the gate.
        // 2xx → recordSuccess (clears consecutive-failure counter).
        // 429 / 503 → recordFailure (may open the circuit if threshold reached).
        if (response.ok) {
            recordSuccess(url);
        } else if (response.status === 429 || response.status === 503) {
            recordFailure(url);
            console.warn(`[GATE] ${url.substring(0, 80)} returned ${response.status} — recorded failure for domain`);
        }
        return response;
    } catch (e) {
        clearTimeout(id);
        // 1.1.6: una cancelacion nuestra no es un fallo de la fuente; no debe abrir su circuit breaker
        if (cancelar?.aborted) throw new PeticionCancelada();
        // Network error / timeout — also counts as a failure for the breaker.
        recordFailure(url);
        throw e;
    } finally {
        globalFetchLimiter.release();
        slot.release();
    }
}

/**
 * Safe JSON parsing that handles potential HTML/PHP garbage at the start/end
 * of an API response (common with legacy academic portals).
 */
export async function safeJson(res: Response, sourceLabel: string): Promise<any> {
    const text = await res.text();
    try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const arrayStart = text.indexOf('[');
        const arrayEnd = text.lastIndexOf(']');

        let start = -1;
        let end = -1;

        if (jsonStart !== -1 && (arrayStart === -1 || jsonStart < arrayStart)) {
            start = jsonStart;
            end = jsonEnd;
        } else if (arrayStart !== -1) {
            start = arrayStart;
            end = arrayEnd;
        }

        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(text.substring(start, end + 1));
        }
        return JSON.parse(text);
    } catch (err: any) {
        console.error(`[${sourceLabel}] JSON Parse Failure: ${err.message}. Raw snippet: ${text.substring(0, 200)}`);
        throw new Error(`Invalid JSON response from ${sourceLabel}`);
    }
}

/**
 * Normalize Spanish/Portuguese accents to ASCII equivalents for API compatibility
 */
export function normalizeAccents(text: string): string {
    const accentMap: Record<string, string> = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ñ': 'n', 'ç': 'c',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ñ': 'N', 'Ç': 'C'
    };
    return text.split('').map(char => accentMap[char] || char).join('');
}

/**
 * Utility to strip LaTeX and other artifacts from a search query before hitting APIs.
 * Enhanced in V4 with broader LLM preamble detection.
 */
export function sanitizeQueryForSearch(query: string): string {
    if (!query) return '';

    // 0. Aggressive: Remove markdown blocks (```latex ... ```)
    let cleaned = query.replace(/```(?:[a-z]+)?([\s\S]*?)```/g, '$1');

    // 0b. Remove single backticks
    cleaned = cleaned.replace(/`/g, ' ');

    // 1. Strip LaTeX and specific artifacts
    cleaned = cleaned
        .replace(/\\documentclass[\s\S]*?\\begin\{document\}/gi, '')
        .replace(/\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}/gi, ' ')
        .replace(/\\[a-z*]+\s*(?:\[[^\]]*\])?\s*\{([^\}]*)\}/gi, '$1')
        .replace(/\\[a-z*]+/gi, ' ')
        .replace(/[\{\}\$\\\^\_%]/g, ' ')
        .replace(/["()]/g, ' ')
        .replace(/\s+/g, ' ');

    // 2. Remove common LLM conversational preambles (enhanced for V4)
    const preambles = [
        /^(?:the user|i will|here is|certainly|sure|assistant|of course|claro|seguro|tengo entendido|aquí tienes|consulta\s+de\s+b[uú]squeda|possible\s+query|search\s+query|recommended\s+search),?\s+(?:is asking|has requested|wants|translate|write|help|is a possible|the translation|the query|que|la consulta|la b[uú]squeda):?\s*/gi,
        /^(?:the user is asking me to translate|here is the translation|aquí está la traducción|consulta\s+de\s+b[uú]squeda|search\s+query|la consulta\s+de\s+b[uú]squeda):?\s*/gi,
        /^(?:queries?\s+(?:de\s+)?b[uú]squedas?|b[uú]squedas?\s+recomendadas?|subqueries?|consultas?|search\s+queries?|possible\s+queries?):?\s*/gi,
        /^["']|["']$/g // Remove surrounding quotes
    ];

    preambles.forEach(p => {
        cleaned = cleaned.replace(p, '');
    });

    return cleaned
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Year-token detection: matches standalone years (1999, 2025) or year ranges
 * (2020-2025, 2020–2025). Year filters should be applied via `filter[]=publishDate`
 * (VuFind/ALICIA) or equivalent API params, NEVER as AND keywords in `lookfor`,
 * because strict engines like VuFind require the year string to be present in the
 * indexed document text — most academic records don't, so it kills recall.
 */
const YEAR_TOKEN_REGEX = /^\d{4}$|^\d{4}[-–]\d{4}$/;

/**
 * Strip year tokens (and pure-numeric 4-digit ranges) from a tokenized word list.
 * Used by query builders so that "causas del sicariato Lima 2020-2026" becomes
 * "causas del sicariato Lima" before hitting the `lookfor` param.
 */
function stripYearTokens(words: string[]): string[] {
    return words.filter(w => {
        // Skip standalone years (e.g. "2020", "2026") and ranges (e.g. "2020-2026")
        if (YEAR_TOKEN_REGEX.test(w)) return false;
        // Also drop isolated 4-digit leftovers after lowercasing/punctuation split
        // (e.g. when "2020-2026" was split into ["2020", "2026"] by the non-word replace)
        if (/^\d{4}$/.test(w)) return false;
        return true;
    });
}

/**
 * Smart Boolean Query Constructor
 * Transforms a long natural language query into a structured boolean query for strict engines.
 *
 * CRITICAL: Year tokens (YYYY or YYYY-YYYY) are stripped from the boolean query. Strict
 * engines like VuFind (ALICIA, La Referencia) treat every `lookfor` token as a required
 * AND keyword against indexed document text. Academic records rarely contain literal
 * "2020" or "2026" inside their titles/abstracts, so including years as keywords drops
 * recall to zero. Year filtering must happen via `filter[]=publishDate:[YYYY TO YYYY]`,
 * which the search providers already do via the `yearStart`/`yearEnd` options.
 */
export function constructBooleanQuery(query: string): string {
    const stopwords = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'para', 'con', 'del', 'al', 'como', 'que', 'por', 'sobre', 'se', 'su', 'es', 'son', 'ser', 'si', 'the', 'and', 'of', 'to', 'in', 'on', 'with', 'for', 'at', 'by', 'from']);
    const minWordLength = 3;
    const maxTerms = 5;

    const rawWords = query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= minWordLength && !stopwords.has(word));

    // CRITICAL: strip year tokens — they break VuFind AND-keyword matching.
    const words = stripYearTokens(rawWords);

    const uniqueWords = Array.from(new Set(words));
    const topWords = uniqueWords.slice(0, maxTerms);

    if (topWords.length === 0) return query.trim();

    return topWords.join(' ');
}

/**
 * Simplify query to max N words (plain text)
 *
 * Year tokens are stripped here (and again in constructBooleanQuery defensively) because
 * they otherwise survive into the `lookfor` URL param of VuFind/ALICIA and similar strict
 * engines, which treat every token as a required AND keyword. Years are filtered by the
 * providers via `filter[]=publishDate` instead, so they never belong in the text query.
 */
export function simplifyQuery(query: string, maxWords: number = 6, location?: string): string {
    let words = query.split(/\s+/).filter(w => w.length > 2);

    // Strip year tokens (YYYY or YYYY-YYYY) so they never leak into `lookfor`.
    // Year filtering is handled by providers via filter[]=publishDate.
    words = stripYearTokens(words);

    // Si hay una ubicación forzada por el LLM, nos aseguramos de que NUNCA se elimine
    const forcedLocationParts = location ? location.trim().split(/\s+/) : [];
    if (forcedLocationParts.length > 0) {
        // Remover la ubicación de las palabras originales si el usuario la incluyó en el query para no duplicar
        words = words.filter(w => !forcedLocationParts.map(l => l.toLowerCase()).includes(w.toLowerCase()));
    }

    if (words.length <= maxWords && forcedLocationParts.length === 0) return words.join(' ');

    // Identificar posibles entidades (palabras que empiezan con Mayúscula)
    const entities = words.filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w));
    const normalWords = words.filter(w => !/^[A-ZÁÉÍÓÚÑ]/.test(w));

    // Construir la nueva consulta asegurando que la ubicación explícita y las entidades SIEMPRE estén
    let finalWords = [...forcedLocationParts, ...entities];

    // Rellenar con palabras normales hasta llegar al maxWords
    for (let w of normalWords) {
        if (finalWords.length >= maxWords) break;
        finalWords.push(w);
    }

    return finalWords.join(' ');
}

/**
 * Construct a very clean, simple query for engines that don't like any special chars
 */
export function constructSimpleQuery(query: string): string {
    return query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Decode OpenAlex's abstract_inverted_index into a readable string.
 */
export function decodeInvertedIndex(invertedIndex: Record<string, number[]> | null | undefined): string {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';

    try {
        // Find the maximum index to determine the size of the array
        let maxIndex = -1;
        Object.values(invertedIndex).forEach(indices => {
            indices.forEach(idx => {
                if (idx > maxIndex) maxIndex = idx;
            });
        });

        if (maxIndex === -1) return '';

        // Reconstruct the words in their original positions
        const words: string[] = new Array(maxIndex + 1);
        Object.entries(invertedIndex).forEach(([word, indices]) => {
            indices.forEach(idx => {
                words[idx] = word;
            });
        });

        return words.join(' ').trim();
    } catch (e) {
        console.warn('[BASE] Failed to decode inverted index:', e);
        return '';
    }
}

/**
 * Safely adds a timeout to a promise, ensuring the internal timer is cleared
 * whether the promise resolves, rejects, or times out.
 * This prevents Node.js event loop memory leaks common with simple Promise.race + setTimeout.
 */
export async function withPromiseTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string = 'Promise timed out'): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

