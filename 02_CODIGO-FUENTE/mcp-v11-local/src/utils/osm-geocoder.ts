/**
 * OSM MCP Geocoder Client v10
 *
 * Uses letxipu-osm-mcp (Nominatim/Overpass) for dynamic geographic detection.
 * Replaces hardcoded CITY_TO_COUNTRY dictionary with live geocoding.
 *
 * Fixes: passes region="Peru" to override osmmcp default (Singapore),
 * validates importance >= 0.05 and country matches LATAM list.
 *
 * Falls back silently if OSM MCP is unavailable.
 */

// LetXinet Suite: OSM-MCP runs on port 7082 (not 7860 which was a V15 mistake
// inherited from GRADIO_SERVER_PORT). Use 127.0.0.1 (not localhost) to avoid
// IPv6 ::1 resolution issues on Windows. Operators can override via env.
const OSM_MCP_URL = process.env.OSM_MCP_URL || 'http://127.0.0.1:7082';
const OSM_TIMEOUT = 2000; // V15: reduced from 4000ms — OSM responds in 0-900ms
const MIN_IMPORTANCE = 0.05;

export interface OsmGeocodeResult {
    city: string | null;
    state: string | null;
    country: string | null;
    countryNorm: string | null;
    lat: number | null;
    lon: number | null;
}

// V15: In-memory + disk cache for geocode results
const geocodeCache = new Map<string, OsmGeocodeResult | null>();
const geocodeCacheTTL = new Map<string, number>();
const MAX_CACHE = 500;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GEOCODE_CACHE_PATH = require('path').join(process.cwd(), '.cache', 'osm-geocode-cache.json');

// Load disk cache on startup
try {
    const fs = require('fs');
    if (fs.existsSync(GEOCODE_CACHE_PATH)) {
        const disk = JSON.parse(fs.readFileSync(GEOCODE_CACHE_PATH, 'utf8'));
        for (const [k, v] of Object.entries(disk)) {
            geocodeCache.set(k, v as any);
            geocodeCacheTTL.set(k, Date.now() + GEOCODE_CACHE_TTL_MS);
        }
        console.log(`[OSM-CACHE] Loaded ${geocodeCache.size} geocode entries from disk`);
    }
} catch { /* ignore */ }

function persistGeocodeCache(): void {
    try {
        const fs = require('fs');
        const dir = require('path').dirname(GEOCODE_CACHE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const obj: Record<string, any> = {};
        for (const [k, v] of geocodeCache.entries()) obj[k] = v;
        fs.writeFileSync(GEOCODE_CACHE_PATH, JSON.stringify(obj, null, 2));
    } catch { /* ignore */ }
}

function isGeocodeExpired(key: string): boolean {
    const expiry = geocodeCacheTTL.get(key);
    if (!expiry) return true;
    return Date.now() > expiry;
}

// V15: Rate limiter — max 1 request per second to avoid Nominatim 429
// Fase 3.1: Serialized queue (mutex pattern) instead of non-atomic timestamp
// V18: Inter-process rate limiter for multi-instance safety
import { interProcessRateLimit } from './inter-process-rate-limiter';
const OSM_RATE_LIMIT_MS = 1000;
let osmRateLimitChain: Promise<void> = Promise.resolve();

async function rateLimitOsm(): Promise<void> {
    // V18: Inter-process coordination (file-based, shared across instances)
    await interProcessRateLimit();
    // In-process serialization (promise chain)
    const prev = osmRateLimitChain;
    let release: () => void;
    osmRateLimitChain = new Promise<void>(r => { release = r; });
    try { await prev; } catch { /* prev rejected — still release */ }
    release!();
}

const LATAM_COUNTRIES = new Set([
    'peru', 'brasil', 'brazil', 'argentina', 'chile', 'colombia',
    'mexico', 'méxico', 'ecuador', 'bolivia', 'venezuela', 'uruguay',
    'paraguay', 'cuba', 'costa rica', 'el salvador', 'guatemala',
    'honduras', 'nicaragua', 'panamá', 'panama', 'república dominicana',
    'dominican republic', 'puerto rico',
]);

const COUNTRY_NAME_MAP: Record<string, string> = {
    'perú': 'peru', 'peru': 'peru',
    'brasil': 'brasil', 'brazil': 'brasil',
    'argentina': 'argentina',
    'chile': 'chile',
    'colombia': 'colombia',
    'méxico': 'mexico', 'mexico': 'mexico',
    'ecuador': 'ecuador',
    'bolivia': 'bolivia',
    'venezuela': 'venezuela',
    'uruguay': 'uruguay',
    'paraguay': 'paraguay',
    'cuba': 'cuba',
    'españa': 'espana', 'spain': 'espana',
    'costa rica': 'costarica',
    'el salvador': 'elsalvador',
    'guatemala': 'guatemala',
    'honduras': 'honduras',
    'nicaragua': 'nicaragua',
    'panamá': 'panama', 'panama': 'panama',
    'república dominicana': 'repdominicana', 'dominican republic': 'repdominicana',
    'puerto rico': 'puertorico',
    'united states': 'usa', 'estados unidos': 'usa',
    'united kingdom': 'uk', 'reino unido': 'uk',
    'alemania': 'alemania', 'germany': 'alemania', 'deutschland': 'alemania',
    'france': 'francia', 'francia': 'francia',
    'italia': 'italia', 'italy': 'italia',
    'portugal': 'portugal',
    'china': 'china',
    'japón': 'japon', 'japan': 'japon',
    'india': 'india',
};

let mcpSessionId: string | null = null;

async function ensureSession(): Promise<string | null> {
    if (mcpSessionId) return mcpSessionId;
    try {
        const res = await fetch(`${OSM_MCP_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'letxipu-v11', version: '11.0.0' },
                },
            }),
            signal: AbortSignal.timeout(OSM_TIMEOUT),
        });
        if (res.ok) {
            mcpSessionId = res.headers.get('mcp-session-id');
            return mcpSessionId;
        }
    } catch {}
    return null;
}

/**
 * Extract most likely place name from an academic query.
 * Strips thematic words, prepositions, and articles.
 * Always appends ", Peru" to help Nominatim resolve.
 */
function extractPlaceFromQuery(query: string): string {
    const stripWords = new Set([
        // Thematic / academic (both accented and unaccented)
        'contaminación', 'contaminacion', 'investigación', 'investigacion',
        'tesis', 'estudio', 'estudios', 'análisis', 'analisis', 'impacto', 'ambiental',
        'salud', 'pública', 'publica', 'agua', 'aire', 'suelo', 'minería', 'mineria', 'mercurio',
        'plomo', 'arsénico', 'arsenico', 'deforestación', 'deforestacion',
        'aguas', 'residuales', 'vehicular', 'atmosférica', 'atmosferica',
        'marítima', 'maritima', 'río', 'rio', 'bosque', 'selva', 'alta',
        'artesanal', 'industrial', 'urbana', 'urbano', 'población', 'poblacion',
        'ecosistema', 'biodiversidad', 'sostenible', 'desarrollo', 'gestión',
        'gestion', 'tratamiento', 'remediación', 'remediacion', 'evaluación',
        'evaluacion', 'monitoreo', 'control', 'prevención', 'prevencion',
        'calidad', 'metales', 'pesados', 'químicos', 'quimicos', 'sólidos',
        'solidos', 'orgánicos', 'organicos', 'inorgánicos', 'inorganicos',
        'turismo', 'turístico', 'turistica', 'pesca', 'pesquero', 'agricultura', 'ganadería', 'ganaderia',
        'energía', 'energia', 'renovable', 'solar', 'eólica', 'eolica',
        'térmica', 'termica', 'hidroeléctrica', 'hidroelectrica',
        'transporte', 'comunicación', 'comunicacion', 'tecnología', 'tecnologia',
        'educación', 'educacion', 'educativo', 'educativa', 'cultura', 'deporte',
        'nutrición', 'nutricion', 'alimentación', 'alimentacion',
        'vivienda', 'urbanismo', 'planeamiento', 'ordenamiento',
        'reciclaje', 'residuos', 'defensa', 'seguridad', 'justicia',
        'derecho', 'política', 'politica', 'economía', 'economia',
        'finanzas', 'comercio', 'industria', 'petróleo', 'petroleo', 'gas',
        'artesanal', 'industrial', 'comunitario', 'comunitaria',
        // Prepositions & articles (Spanish)
        'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno',
        'y', 'o', 'con', 'por', 'para', 'al', 'a', 'e',
        // English prepositions
        'in', 'of', 'the', 'and', 'or', 'for', 'to', 'at', 'by',
    ]);

    // V11: Map university acronyms to full names before geocoding
    const UNIVERSITY_ACRONYMS: Record<string, string> = {
        'upn': 'Universidad Privada del Norte, Piura, Peru',
        'unsaac': 'Universidad Nacional de San Antonio Abad del Cusco, Peru',
        'unap': 'Universidad Nacional de la Amazonía Peruana, Iquitos, Peru',
        'unsa': 'Universidad Nacional de San Agustín, Arequipa, Peru',
        'pucp': 'Pontificia Universidad Católica del Perú, Lima, Peru',
        'unmsm': 'Universidad Nacional Mayor de San Marcos, Lima, Peru',
        'unicarmelita': 'Universidad Carmelita, Lima, Peru',
        'upc': 'Universidad Peruana de Ciencias Aplicadas, Lima, Peru',
        'utec': 'Universidad de Ingeniería y Tecnología, Lima, Peru',
        'pucv': 'Pontificia Universidad Católica de Valparaíso, Chile',
        'usmp': 'Universidad San Martín de Porres, Lima, Peru',
        'unjbg': 'Universidad Nacional Jorge Basadre Grohmann, Tacna, Peru',
        'unho': 'Universidad Nacional Hermilio Valdizán, Huánuco, Peru',
        'unp': 'Universidad Nacional de Piura, Peru',
        'unj': 'Universidad Nacional de Jaén, Peru',
        'unhean': 'Universidad Nacional de Huancavelica, Peru',
        'unu': 'Universidad Nacional de Ucayali, Pucallpa, Peru',
    };
    const acronymLower = query.trim().toLowerCase();
    if (UNIVERSITY_ACRONYMS[acronymLower]) {
        return UNIVERSITY_ACRONYMS[acronymLower];
    }

    const words = query.split(/\s+/);
    const placeWords = words.filter(w => !stripWords.has(w.toLowerCase()));

    // If query already contains "Peru"/"Perú", don't append again
    const lowerQuery = query.toLowerCase();
    const hasPeru = lowerQuery.includes('peru') || lowerQuery.includes('perú');

    if (placeWords.length >= 1 && placeWords.length <= 3) {
        const place = placeWords.join(' ');
        return hasPeru ? place : `${place}, Peru`;
    }

    const fallback = words.slice(-2).join(' ');
    return hasPeru ? fallback : `${fallback}, Peru`;
}

/**
 * Validate that a geocoded result is plausible:
 * - importance >= MIN_IMPORTANCE
 * - country is in LATAM list or matches Peru context
 */
function validateResult(result: OsmGeocodeResult, importance: number): boolean {
    if (importance < MIN_IMPORTANCE) return false;
    if (result.countryNorm && LATAM_COUNTRIES.has(result.countryNorm)) return true;
    if (result.countryNorm === 'peru') return true;
    return false;
}

function isCoordinateQuery(query: string): { lat: number; lon: number } | null {
    const m = query.match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return { lat, lon };
    return null;
}

async function reverseGeocodeWithOSM(lat: number, lon: number): Promise<OsmGeocodeResult | null> {
    const cacheKey = `rev:${lat.toFixed(4)},${lon.toFixed(4)}`;
    // V15: Check cache with TTL
    if (geocodeCache.has(cacheKey) && !isGeocodeExpired(cacheKey)) return geocodeCache.get(cacheKey)!;
    if (isGeocodeExpired(cacheKey)) {
        geocodeCache.delete(cacheKey);
        geocodeCacheTTL.delete(cacheKey);
    }

    // V14: Try OSM MCP once (fast when Docker is up), fallback directly to Nominatim
    const sessionId = await ensureSession();
    if (sessionId) {
        try {
            await rateLimitOsm();
            const res = await fetch(`${OSM_MCP_URL}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sessionId },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                    params: { name: 'reverse_geocode', arguments: { latitude: lat, longitude: lon } },
                }),
                signal: AbortSignal.timeout(OSM_TIMEOUT),
            });

            // Fase 3.2: Detect invalid/expired MCP session and retry once
            if (!res.ok && (res.status === 400 || res.status === 404 || res.status === 410)) {
                mcpSessionId = null;
                const newSessionId = await ensureSession();
                if (newSessionId) {
                    await rateLimitOsm();
                    const retryRes = await fetch(`${OSM_MCP_URL}/mcp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': newSessionId },
                        body: JSON.stringify({
                            jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                            params: { name: 'reverse_geocode', arguments: { latitude: lat, longitude: lon } },
                        }),
                        signal: AbortSignal.timeout(OSM_TIMEOUT),
                    });
                    if (retryRes.ok) {
                        const retryData = await retryRes.json() as any;
                        const retryText = retryData?.result?.content?.[0]?.text;
                        if (retryText) {
                            const retryParsed = JSON.parse(retryText);
                            const retryPlace = retryParsed.place || retryParsed;
                            const city = retryPlace.address?.city || retryPlace.address?.town || retryPlace.address?.state || null;
                            const state = retryPlace.address?.state || null;
                            if (city || state) {
                                const rawCountry = retryPlace.address?.country || null;
                                const candidate: OsmGeocodeResult = {
                                    city, state,
                                    country: rawCountry,
                                    countryNorm: rawCountry ? (COUNTRY_NAME_MAP[rawCountry.toLowerCase()] || rawCountry.toLowerCase()) : null,
                                    lat, lon,
                                };
                                geocodeCache.set(cacheKey, candidate);
                                geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
                                persistGeocodeCache();
                                return candidate;
                            }
                        }
                    }
                }
            }

            if (res.ok) {
                const data = await res.json() as any;
                const text = data?.result?.content?.[0]?.text;
                if (text) {
                    const parsed = JSON.parse(text);
                    const place = parsed.place || parsed;
                    const city = place.address?.city || place.address?.town || place.address?.state || null;
                    const state = place.address?.state || null;
                    if (city || state) {
                        const rawCountry = place.address?.country || null;
                        const candidate: OsmGeocodeResult = {
                            city, state,
                            country: rawCountry,
                            countryNorm: rawCountry ? (COUNTRY_NAME_MAP[rawCountry.toLowerCase()] || rawCountry.toLowerCase()) : null,
                            lat, lon,
                        };
                        if (geocodeCache.size >= MAX_CACHE) { const fk = geocodeCache.keys().next().value; if (fk) geocodeCache.delete(fk); }
                        geocodeCache.set(cacheKey, candidate);
                        geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
                        persistGeocodeCache();
                        return candidate;
                    }
                }
            }
        } catch {}
    }

    // V14: Fallback — direct Nominatim API (no Docker dependency)
    try {
        await rateLimitOsm();
        const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            { headers: { 'User-Agent': 'letxipu-v11/14.0' }, signal: AbortSignal.timeout(3000) }
        );
        if (nomRes.ok) {
            const nomData = await nomRes.json() as any;
            const city = nomData?.address?.city || nomData?.address?.town || nomData?.address?.village || nomData?.address?.state || null;
            const state = nomData?.address?.state || null;
            if (city || state) {
                const rawCountry = nomData?.address?.country || null;
                const candidate: OsmGeocodeResult = {
                    city, state,
                    country: rawCountry,
                    countryNorm: rawCountry ? (COUNTRY_NAME_MAP[rawCountry.toLowerCase()] || rawCountry.toLowerCase()) : null,
                    lat, lon,
                };
                if (geocodeCache.size >= MAX_CACHE) { const fk = geocodeCache.keys().next().value; if (fk) geocodeCache.delete(fk); }
                geocodeCache.set(cacheKey, candidate);
                geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
                persistGeocodeCache();
                return candidate;
            }
        }
    } catch {}

    return null;
}

// LetXinet 1.1.6: una sola geocodificacion por consulta aunque la pidan muchos a la vez.
// El reordenamiento de batch_search y smart_search llamaba a geocodeWithOSM una vez por resultado
// con la misma consulta; como la cache aun estaba vacia, cada llamada hacia fila en el limite de
// 1 peticion por segundo y 60 resultados tardaban cerca de 60 s (ALICIA respondia en 9 s).
const geocodeEnCurso = new Map<string, Promise<OsmGeocodeResult | null>>();
export function geocodeWithOSM(query: string): Promise<OsmGeocodeResult | null> {
    const clave = String(query || '').toLowerCase().trim();
    const enCurso = geocodeEnCurso.get(clave);
    if (enCurso) return enCurso;
    const p = geocodeWithOSMUnaVez(query).finally(() => geocodeEnCurso.delete(clave));
    geocodeEnCurso.set(clave, p);
    return p;
}

async function geocodeWithOSMUnaVez(query: string): Promise<OsmGeocodeResult | null> {
    const coords = isCoordinateQuery(query);
    if (coords) {
        return reverseGeocodeWithOSM(coords.lat, coords.lon);
    }

    const placeName = extractPlaceFromQuery(query);
    const cacheKey = placeName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    // V15: Check cache with TTL
    if (geocodeCache.has(cacheKey) && !isGeocodeExpired(cacheKey)) return geocodeCache.get(cacheKey)!;
    if (isGeocodeExpired(cacheKey)) {
        geocodeCache.delete(cacheKey);
        geocodeCacheTTL.delete(cacheKey);
    }

    const sessionId = await ensureSession();
    if (!sessionId) return null;

    try {
        await rateLimitOsm();
        const res = await fetch(`${OSM_MCP_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'geocode_address',
                    arguments: { address: placeName, region: 'Peru' },
                },
            }),
            signal: AbortSignal.timeout(OSM_TIMEOUT),
        });

        // Fase 3.2: Detect invalid/expired MCP session and retry once
        if (!res.ok && (res.status === 400 || res.status === 404 || res.status === 410)) {
            console.log(`[OSM] MCP session invalid (${res.status}), regenerating...`);
            mcpSessionId = null;
            const newSessionId = await ensureSession();
            if (newSessionId) {
                await rateLimitOsm();
                const retryRes = await fetch(`${OSM_MCP_URL}/mcp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': newSessionId },
                    body: JSON.stringify({
                        jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                        params: { name: 'geocode_address', arguments: { address: placeName, region: 'Peru' } },
                    }),
                    signal: AbortSignal.timeout(OSM_TIMEOUT),
                });
                if (retryRes.ok) {
                    const retryData = await retryRes.json() as any;
                    const retryText = retryData?.result?.content?.[0]?.text;
                    if (retryText) {
                        const retryParsed = JSON.parse(retryText);
                        const retryPlace = retryParsed.place;
                        if (retryPlace) {
                            const rawCountry = retryPlace.address?.country || null;
                            const candidate: OsmGeocodeResult = {
                                city: retryPlace.address?.city || retryPlace.address?.town || retryPlace.address?.state || null,
                                state: retryPlace.address?.state || null,
                                country: rawCountry,
                                countryNorm: rawCountry ? (COUNTRY_NAME_MAP[rawCountry.toLowerCase()] || rawCountry.toLowerCase()) : null,
                                lat: retryPlace.location?.latitude ?? null,
                                lon: retryPlace.location?.longitude ?? null,
                            };
                            if (validateResult(candidate, retryPlace.importance ?? 0)) {
                                geocodeCache.set(cacheKey, candidate);
                                geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
                                persistGeocodeCache();
                                return candidate;
                            }
                        }
                    }
                }
            }
            return null; // Session regeneration failed too
        }

        if (!res.ok) return null;

        const data = await res.json() as any;
        const text = data?.result?.content?.[0]?.text;
        if (!text) return null;

        const parsed = JSON.parse(text);
        const place = parsed.place;
        if (!place) return null;

        const rawCountry = place.address?.country || null;
        const importance = place.importance ?? 0;
        const candidate: OsmGeocodeResult = {
            city: place.address?.city || place.address?.town || place.address?.state || null,
            state: place.address?.state || null,
            country: rawCountry,
            countryNorm: rawCountry
                ? (COUNTRY_NAME_MAP[rawCountry.toLowerCase()] || rawCountry.toLowerCase())
                : null,
            lat: place.location?.latitude ?? null,
            lon: place.location?.longitude ?? null,
        };

        if (!validateResult(candidate, importance)) {
            const candidates = parsed.candidates || [];
            for (const c of candidates) {
                const cCountry = c.address?.country || null;
                const cImportance = c.importance ?? 0;
                const cCandidate: OsmGeocodeResult = {
                    city: c.address?.city || c.address?.town || c.address?.state || null,
                    state: c.address?.state || null,
                    country: cCountry,
                    countryNorm: cCountry
                        ? (COUNTRY_NAME_MAP[cCountry.toLowerCase()] || cCountry.toLowerCase())
                        : null,
                    lat: c.location?.latitude ?? null,
                    lon: c.location?.longitude ?? null,
                };
                if (validateResult(cCandidate, cImportance)) {
                    if (geocodeCache.size >= MAX_CACHE) {
                        const firstKey = geocodeCache.keys().next().value;
                        if (firstKey) geocodeCache.delete(firstKey);
                    }
                    geocodeCache.set(cacheKey, cCandidate);
                    return cCandidate;
                }
            }
            geocodeCache.set(cacheKey, null);
            geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
            persistGeocodeCache();
            return null;
        }

        if (geocodeCache.size >= MAX_CACHE) {
            const firstKey = geocodeCache.keys().next().value;
            if (firstKey) { geocodeCache.delete(firstKey); geocodeCacheTTL.delete(firstKey); }
        }
        geocodeCache.set(cacheKey, candidate);
        geocodeCacheTTL.set(cacheKey, Date.now() + GEOCODE_CACHE_TTL_MS);
        persistGeocodeCache();
        return candidate;
    } catch {
        return null;
    }
}

export async function isOsmMcpAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OSM_MCP_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'health-check', version: '1.0' },
                },
            }),
            signal: AbortSignal.timeout(2000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export function osmGeocodeStats(): { cached: number; maxCache: number } {
    return { cached: geocodeCache.size, maxCache: MAX_CACHE };
}
