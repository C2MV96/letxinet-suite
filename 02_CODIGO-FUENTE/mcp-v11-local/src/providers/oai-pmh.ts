/**
 * OAI-PMH Direct Harvesting Provider (Fase 2.3)
 *
 * Queries institutional repositories that expose the OAI-PMH protocol directly,
 * bypassing aggregators like ALICIA when they fail to harvest specific repos.
 *
 * Useful for:
 *   - Repos not yet harvested by ALICIA/RENATI
 *   - New theses deposited after the last ALICIA harvest
 *   - Repos with DSpace 7 where ALICIA's VuFind API returns no records
 *
 * Protocol: OAI-PMH 2.0 (https://www.openarchives.org/OAI/2.0/openarchivesprotocol.html)
 * Strategy: ListRecords with metadataPrefix=oai_dc, then filter by query terms client-side.
 *           OAI-PMH has no native search, so we harvest recent records and filter.
 */

import { fetchWithTimeout } from './base';
import { SearchResult, SearchOptions } from '../types/search';
import { generateRecordId } from '../utils/data-mining-config';

// ─── Known OAI-PMH endpoints (Peru) ────────────────────────────

export interface OaiPmhEndpoint {
    name: string;
    baseUrl: string;          // OAI-PMH endpoint (e.g. https://repositorio.lamolina.edu.pe/oai/request)
    university: string;       // Display name
    priority: number;         // Lower = higher priority (1 = highest)
    active?: boolean;         // false = known to be down (404/ERR), skip to save latency
}

// Endpoints verificados como caídos — solo los que NO son DSpace 7 SPA (esos se manejan con fallback)
// Los DSpace 7 SPA (404 retornando Angular shell) se removieron — el fallback /server/oai/request los maneja
// Fix 2026-08-14: After empirical OAI-PMH verbs=ListMetadataFormats probe, the following
// repos were confirmed UP (migrated to DSpace 7 /server/oai/request path or fixed URL).
// Only UNDAC continues to timeout (>12s on /oai/request) - kept in DOWN.
// See: D:\OTROS\LETXINET-DESKTOP-HF\test-pool-busqueda\comparativa\analisis_raiz_renati.md
const DOWN_ENDPOINTS = new Set([
    'UNDAC'
]);

// Filter to only active endpoints (skip known-down ones to avoid wasted fetches)
// Defined after OAI_ENDPOINTS array below — see ACTIVE_ENDPOINTS at bottom of array

const OAI_ENDPOINTS: OaiPmhEndpoint[] = [
    // ─── Nacionalidades (Prioridad 1-10) ───
    { name: 'UNMSM', baseUrl: 'https://cybertesis.unmsm.edu.pe/oai/request', university: 'Universidad Nacional Mayor de San Marcos', priority: 1 },
    { name: 'UNALM', baseUrl: 'https://repositorio.lamolina.edu.pe/oai/request', university: 'Universidad Nacional Agraria La Molina', priority: 2 },
    { name: 'UNSA', baseUrl: 'https://repositorio.unsa.edu.pe/oai/request', university: 'Universidad Nacional de San Agustín de Arequipa', priority: 3 },
    { name: 'UNT', baseUrl: 'https://repositorio.unitru.edu.pe/server/oai/request', university: 'Universidad Nacional de Trujillo', priority: 4 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNCP', baseUrl: 'https://repositorio.uncp.edu.pe/oai/request', university: 'Universidad Nacional del Centro del Perú', priority: 5 },
    { name: 'UNAP', baseUrl: 'https://repositorio.unap.edu.pe/server/oai/request', university: 'Universidad Nacional del Altiplano', priority: 6 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNSCH', baseUrl: 'https://repositorio.unsch.edu.pe/server/oai/request', university: 'Universidad Nacional de San Cristóbal de Huamanga', priority: 7 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNFV', baseUrl: 'https://repositorio.unfv.edu.pe/server/oai/request', university: 'Universidad Nacional Federico Villarreal', priority: 8 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNI', baseUrl: 'https://repositorio.uni.edu.pe/oai/request', university: 'Universidad Nacional de Ingeniería', priority: 9 }, // Added 2026-08-14: missing UNI (https GET ListMetadataFormats OK)
    { name: 'UNAC', baseUrl: 'https://repositorio.unac.edu.pe/oai/request', university: 'Universidad Nacional del Callao', priority: 10 }, // priority 9 -> 10 (UNI added)
    { name: 'UNPiura', baseUrl: 'https://repositorio.unp.edu.pe/server/oai/request', university: 'Universidad Nacional de Piura', priority: 10 }, // Fix 2026-08-14: DSpace 7 path
    // ─── Nacionalidades (Prioridad 11-30) ───
    { name: 'UNSAAC', baseUrl: 'https://repositorio.unsaac.edu.pe/oai/request', university: 'Universidad Nacional de San Antonio Abad del Cusco', priority: 11 },
    { name: 'UNJBG', baseUrl: 'https://repositorio.unjbg.edu.pe/server/oai/request', university: 'Universidad Nacional Jorge Basadre Grohmann', priority: 12 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNAMBA', baseUrl: 'https://repositorio.unamba.edu.pe/server/oai/request', university: 'Universidad Nacional Micaela Bastidas de Apurímac', priority: 13 }, // Parche 7 2026-08-15: path fix legacy -> DSpace 7 (probe OK HTTP 200)
    { name: 'UNDAC', baseUrl: 'https://repositorio.undac.edu.pe/oai/request', university: 'Universidad Nacional Daniel Alcides Carrión', priority: 14 },
    { name: 'UNHEVAL', baseUrl: 'https://repositorio.unheval.edu.pe/oai/request', university: 'Universidad Nacional de Huancavelica', priority: 15 },
    { name: 'UNJFSC', baseUrl: 'https://repositorio.unjfsc.edu.pe/oai/request', university: 'Universidad Nacional José Faustino Sánchez Carrión', priority: 16 }, // Fix 2026-08-14: confirmed active (verb=ListMetadataFormats)
    { name: 'UNTRM', baseUrl: 'https://repositorio.untrm.edu.pe/oai/request', university: 'Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas', priority: 17 },
    { name: 'UNSanta', baseUrl: 'https://repositorio.uns.edu.pe/oai/request', university: 'Universidad Nacional del Santa', priority: 18 },
    { name: 'UNSM', baseUrl: 'https://repositorio.unsm.edu.pe/oai/request', university: 'Universidad Nacional de San Martín', priority: 19 },
    { name: 'UNASAM', baseUrl: 'https://repositorio.unasam.edu.pe/oai/request', university: 'Universidad Nacional Santiago Antúnez de Mayolo', priority: 20 },
    { name: 'UNICA', baseUrl: 'https://repositorio.unica.edu.pe/server/oai/request', university: 'Universidad Nacional San Luis Gonzaga', priority: 21 }, // Parche 7 2026-08-15: path fix legacy -> DSpace 7 (probe OK HTTP 200)
    { name: 'UNAJMA', baseUrl: 'https://repositorio.unajma.edu.pe/oai/request', university: 'Universidad Nacional José María Arguedas', priority: 22 },
    { name: 'UNAMAD', baseUrl: 'https://repositorio.unamad.edu.pe/oai/request', university: 'Universidad Nacional Amazónica de Madre de Dios', priority: 23 },
    { name: 'UNCanete', baseUrl: 'https://repositorio.undc.edu.pe/oai/request', university: 'Universidad Nacional de Cañete', priority: 24 },
    { name: 'UNBarranca', baseUrl: 'https://repositorio.unab.edu.pe/oai/request', university: 'Universidad Nacional de Barranca', priority: 25 },
    { name: 'UNFrontera', baseUrl: 'https://repositorio.unf.edu.pe/oai/request', university: 'Universidad Nacional de Frontera', priority: 26 },
    { name: 'UNChota', baseUrl: 'https://repositorio.unach.edu.pe/oai/request', university: 'Universidad Nacional Autónoma de Chota', priority: 27 },
    { name: 'UNMusica', baseUrl: 'https://repositorio.unm.edu.pe/oai/request', university: 'Universidad Nacional de Música', priority: 28 },
    { name: 'UNIA', baseUrl: 'https://repositorio.unia.edu.pe/oai/request', university: 'Universidad Nacional Intercultural de la Amazonía', priority: 29 },
    { name: 'UANCV', baseUrl: 'https://repositorio.uancv.edu.pe/oai/request', university: 'Universidad Nacional Autónoma de Chavín de Huántar', priority: 30 },
    // ─── Privadas (Prioridad 31-60) ───
    { name: 'PUCP', baseUrl: 'https://tesis.pucp.edu.pe/oai/request', university: 'Pontificia Universidad Católica del Perú', priority: 31 },
    { name: 'UPCH', baseUrl: 'https://repositorio.upch.edu.pe/oai/request', university: 'Universidad Peruana Cayetano Heredia', priority: 32 },
    { name: 'USMP', baseUrl: 'https://repositorio.usmp.edu.pe/oai/request', university: 'Universidad de San Martín de Porres', priority: 33 },
    { name: 'UCSP', baseUrl: 'https://repositorio.ucsp.edu.pe/oai/request', university: 'Universidad Católica de Santa Cruz', priority: 34 },
    { name: 'UContinental', baseUrl: 'https://repositorio.continental.edu.pe/oai/request', university: 'Universidad Continental', priority: 35 },
    { name: 'USIL', baseUrl: 'https://repositorio.usil.edu.pe/oai/request', university: 'Universidad San Ignacio de Loyola', priority: 36 },
    { name: 'UPC', baseUrl: 'https://repositorioacademico.upc.edu.pe/oai/request', university: 'Universidad Peruana de Ciencias Aplicadas', priority: 37 },
    { name: 'ULIMA', baseUrl: 'https://repositorio.ulima.edu.pe/oai/request', university: 'Universidad de Lima', priority: 38 },
    { name: 'UP', baseUrl: 'https://repositorio.up.edu.pe/oai/request', university: 'Universidad de Pacífico', priority: 39 },
    { name: 'ESAN', baseUrl: 'https://repositorio.esan.edu.pe/oai/request', university: 'Universidad ESAN', priority: 40 },
    { name: 'UTEC', baseUrl: 'https://repositorio.utec.edu.pe/oai/request', university: 'Universidad de Ingeniería y Tecnología', priority: 41 },
    { name: 'UARM', baseUrl: 'https://repositorio.uarm.edu.pe/oai/request', university: 'Universidad Ricardo Palma', priority: 42 },
    { name: 'UPN', baseUrl: 'https://repositorio.upn.edu.pe/oai/request', university: 'Universidad Nacional de Piura', priority: 43 },
    { name: 'UNAS', baseUrl: 'https://repositorio.unas.edu.pe/server/oai/request', university: 'Universidad Nacional de la Selva', priority: 44 }, // Fix 2026-08-14 Parche 6: DSpace 7 path (probe ListRecords 378KB OK)
    { name: 'UCSM', baseUrl: 'https://repositorio.ucsm.edu.pe/oai/request', university: 'Universidad Católica de Santa María', priority: 45 },
    { name: 'UCV', baseUrl: 'https://repositorio.ucv.edu.pe/oai/request', university: 'Universidad César Vallejo', priority: 46 },
    { name: 'UPAO', baseUrl: 'https://repositorio.upao.edu.pe/oai/request', university: 'Universidad Autónoma de Chota', priority: 47 },
    { name: 'ULADECH', baseUrl: 'https://repositorio.uladech.edu.pe/oai/request', university: 'Universidad de Lambayeque', priority: 48 },
    { name: 'UPLA', baseUrl: 'https://repositorio.upla.edu.pe/oai/request', university: 'Universidad de Los Andes', priority: 49 },
    { name: 'USS', baseUrl: 'https://repositorio.uss.edu.pe/oai/request', university: 'Universidad Señor de Sipán', priority: 50 },
    { name: 'URP', baseUrl: 'https://repositorio.urp.edu.pe/oai/request', university: 'Universidad Ricardo Palma', priority: 51 },
    { name: 'UAP', baseUrl: 'https://repositorio.uap.edu.pe/oai/request', university: 'Universidad Antonio Guillermo Urrelo', priority: 52 },
    { name: 'USAT', baseUrl: 'https://repositorio.usat.edu.pe/oai/request', university: 'Universidad San Antonio de Abad', priority: 53 },
    { name: 'UAndina', baseUrl: 'https://repositorio.uandina.edu.pe/oai/request', university: 'Universidad Andina del Cusco', priority: 54 },
    { name: 'UCSS', baseUrl: 'https://repositorio.ucss.edu.pe/oai/request', university: 'Universidad Católica de Santa Rosa', priority: 55 },
    { name: 'USanPedro', baseUrl: 'https://repositorio.usanpedro.edu.pe/oai/request', university: 'Universidad San Pedro', priority: 56 },
    { name: 'UCientifica', baseUrl: 'https://repositorio.cientifica.edu.pe/oai/request', university: 'Universidad Científica del Sur', priority: 57 },
    { name: 'UPeU', baseUrl: 'https://repositorio.upeu.edu.pe/server/oai/request', university: 'Universidad Peruana Unión', priority: 58 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'UNIFE', baseUrl: 'https://repositorio.unife.edu.pe/oai/request', university: 'Universidad de Fe y Alegría', priority: 59 },
    { name: 'UIGV', baseUrl: 'https://repositorio.uigv.edu.pe/oai/request', university: 'Universidad Inca Garcilaso de la Vega', priority: 60 },
    // ─── Privadas (Prioridad 61-80) ───
    { name: 'NorbertWiener', baseUrl: 'https://repositorio.uwiener.edu.pe/oai/request', university: 'Universidad Norbert Wiener', priority: 61 },
    { name: 'UPSJB', baseUrl: 'https://repositorio.upsjb.edu.pe/oai/request', university: 'Universidad San Juan Bautista', priority: 62 },
    { name: 'UDH', baseUrl: 'https://repositorio.udh.edu.pe/oai/request', university: 'Universidad de Huánuco', priority: 63 },
    { name: 'UTEA', baseUrl: 'https://repositorio.utea.edu.pe/oai/request', university: 'Universidad Tecnológica del Perú', priority: 64 },
    { name: 'UAustral', baseUrl: 'https://repositorio.uaustral.edu.pe/oai/request', university: 'Universidad Austral del Perú', priority: 65 },
    { name: 'UCH', baseUrl: 'https://repositorio.uch.edu.pe/oai/request', university: 'Universidad de Chiclayo', priority: 66 },
    { name: 'LeCordonBleu', baseUrl: 'https://repositorio.ulcb.edu.pe/oai/request', university: 'Le Cordon Bleu', priority: 67 },
    { name: 'Champagnat', baseUrl: 'https://repositorio.umch.edu.pe/oai/request', university: 'Universidad Mariano Melgar', priority: 68 },
    { name: 'MariaAuxiliadora', baseUrl: 'https://repositorio.uma.edu.pe/oai/request', university: 'Universidad María Auxiliadora', priority: 69 },
    { name: 'UDesarrolloAndino', baseUrl: 'https://repositorio.udea.edu.pe/oai/request', university: 'Universidad del Desarrollo Andino', priority: 70 },
    { name: 'PeruanoCentro', baseUrl: 'https://repositorio.upecen.edu.pe/oai/request', university: 'Universidad Peruano-Centroamericana', priority: 71 },
    { name: 'LaSalle', baseUrl: 'https://repositorio.ulasalle.edu.pe/oai/request', university: 'Universidad La Salle', priority: 72 },
    { name: 'UPrivadaTrujillo', baseUrl: 'https://repositorio.uprit.edu.pe/oai/request', university: 'Universidad Privada de Trujillo', priority: 73 },
    // ─── Governamental / Institutos (Prioridad 74-85) ───
    { name: 'IMARPE', baseUrl: 'https://repositorio.imarpe.gob.pe/server/oai/request', university: 'Instituto del Mar del Perú', priority: 74 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'INGEMMET', baseUrl: 'https://repositorio.ingemmet.gob.pe/oai/request', university: 'Instituto Geológico Minero y Metalúrgico', priority: 75 },
    { name: 'IEP', baseUrl: 'https://repositorio.iep.org.pe/oai/request', university: 'Instituto de Estudios Peruanos', priority: 76 },
    { name: 'IIAP', baseUrl: 'https://repositorio.iiap.gob.pe/oai/request', university: 'Instituto de Investigaciones de la Amazonía Peruana', priority: 77 },
    { name: 'IPEN', baseUrl: 'https://repositorio.ipen.gob.pe/oai/request', university: 'Instituto Peruano de Energía Nuclear', priority: 78 },
    { name: 'INIA', baseUrl: 'https://repositorio.inia.gob.pe/server/oai/request', university: 'Instituto Nacional de Innovación Agraria', priority: 79 }, // Fix 2026-08-14: DSpace 7 path
    { name: 'MINEDU', baseUrl: 'https://repositorio.minedu.gob.pe/oai/request', university: 'Ministerio de Educación', priority: 80 },
    { name: 'MINCULTURA', baseUrl: 'https://repositorio.cultura.gob.pe/oai/request', university: 'Ministerio de Cultura', priority: 81 },
    { name: 'Toulouse', baseUrl: 'https://repositorio.tls.edu.pe/oai/request', university: 'Universidad Privada Toulouse Lautrec', priority: 82 },
    { name: 'INDECOPI', baseUrl: 'https://repositorio.indecopi.gob.pe/oai/request', university: 'Instituto Nacional de Defensa de la Competencia y Protección de la Propiedad Intelectual', priority: 83 },
    // -- Missing from DSPACE sync (added Jun. 2026) --
    { name: 'UNPRG', baseUrl: 'https://repositorio.unprg.edu.pe/oai/request', university: 'Universidad Nacional Pedro Ruiz Gallo', priority: 84 },
    { name: 'UNCajamarca', baseUrl: 'https://repositorio.unc.edu.pe/oai/request', university: 'Universidad Nacional de Cajamarca', priority: 85 },
    { name: 'UNJuliaca', baseUrl: 'https://repositorio.unaj.edu.pe/oai/request', university: 'Universidad Nacional de Juliaca', priority: 86 },
    { name: 'UNHuanta', baseUrl: 'https://repositorio.unah.edu.pe/server/oai/request', university: 'Universidad Nacional de Huanta', priority: 87 }, // Fix 2026-08-14: DSpace 7 path
    // === Parche 6 - Added 2026-08-14: 6 nuevos endpoints probe-confirmed (ListRecords OK 100 records + resumpToken) ===
    { name: 'UNE', baseUrl: 'https://repositorio.une.edu.pe/oai/request', university: 'Universidad Nacional de Educación Enrique Guzmán y Valle (La Cantuta)', priority: 88 }, // Parche 6 - DSpace 6 path, probe 500KB OK
    { name: 'UNAM', baseUrl: 'https://repositorio.unam.edu.pe/server/oai/request', university: 'Universidad Nacional de Moquegua', priority: 89 }, // Parche 6 - DSpace 7 path, probe 355KB OK
    { name: 'IGP', baseUrl: 'https://repositorio.igp.gob.pe/server/oai/request', university: 'Instituto Geofísico del Perú', priority: 90 }, // Parche 6 - DSpace 7 path, probe 337KB OK
    { name: 'SENAMHI', baseUrl: 'https://repositorio.senamhi.gob.pe/oai/request', university: 'Servicio Nacional de Meteorología e Hidrología del Perú', priority: 91 }, // Parche 6 - DSpace 6 path, probe 257KB OK
    { name: 'OEFA', baseUrl: 'https://repositorio.oefa.gob.pe/server/oai/request', university: 'Organismo de Evaluación y Fiscalización Ambiental', priority: 92 }, // Parche 6 - DSpace 7 path, probe 363KB OK
    { name: 'SERFOR', baseUrl: 'https://repositorio.serfor.gob.pe/oai/request', university: 'Servicio Nacional Forestal y de Fauna Silvestre', priority: 93 }, // Parche 6 - DSpace 6 path, probe 178KB OK
];

// Active endpoints = all minus known-down ones (saves ~29 wasted fetches per search)
const ACTIVE_ENDPOINTS: OaiPmhEndpoint[] = OAI_ENDPOINTS.filter(e => !DOWN_ENDPOINTS.has(e.name));

// ─── Query helpers ─────────────────────────────────────────────

/** Normalize text for matching: lowercase, strip accents, collapse whitespace */
function normalizeText(text: string): string {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Extract key terms from a query (stopwords removed, 4+ chars) */
const STOPWORDS = new Set([
    'el','la','los','las','un','una','de','del','al','y','o','que','se','en','con','para','por','su','sus','es','son','fue','como','sobre','entre','hasta','desde','sin','mas','muy',
    'the','a','an','of','in','on','at','by','for','with','from','to','and','or','is','are','was','were','this','that',
    'investigacion','estudio','analisis','revision','acerca','busca','tipo','using','based','study','research','review',
]);

function extractQueryTerms(query: string): string[] {
    const norm = normalizeText(query);
    return norm.split(/\s+/).filter(w => w.length > 3 && !STOPWORDS.has(w));
}

/** Check if a record matches the query (any key term in title or description) */
function recordMatchesQuery(record: ParsedOaiRecord, queryTerms: string[], requireAll: boolean = false): boolean {
    if (queryTerms.length === 0) return true;
    const titleNorm = normalizeText(record.title || '');
    const descNorm = normalizeText(record.description || '');
    const subjectNorm = normalizeText((record.subjects || []).join(' '));
    const haystack = `${titleNorm} ${descNorm} ${subjectNorm}`;

    if (requireAll) {
        return queryTerms.every(t => haystack.includes(t));
    }
    // 40% of terms must match (lowered from 60% to increase recall)
    const minHits = Math.max(1, Math.ceil(queryTerms.length * 0.4));
    let hits = 0;
    for (const t of queryTerms) {
        if (haystack.includes(t)) hits++;
        // Partial match: if term is >6 chars, accept substring match (first 5 chars)
        else if (t.length > 6 && haystack.includes(t.substring(0, 5))) hits++;
    }
    return hits >= minHits;
}

// ─── OAI-PMH XML parsing ───────────────────────────────────────

interface ParsedOaiRecord {
    identifier: string;         // OAI identifier
    title: string;
    creators: string[];         // authors
    description: string;        // abstract
    subjects: string[];         // keywords
    date: string | null;        // publication date
    type: string;               // dc:type
    publisher: string;
    identifierUrl: string | null;  // handle URL
    relation: string | null;    // alternate identifier (DOI, etc.)
}

/** Extract text content of a DC field, handling multiple instances */
function getDcField(xml: string, field: string): string[] {
    const results: string[] = [];
    // Match <dc:field>value</dc:field> (namespaced)
    const regex = new RegExp(`<dc:${field}[^>]*>([^<]*(?:<(?!/dc:${field})[^<]*)*)</dc:${field}>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
        if (m[1]) results.push(m[1].trim());
    }
    return results;
}

/** Parse a single <record> block of OAI-PMH XML into a ParsedOaiRecord */
function parseRecord(recordXml: string): ParsedOaiRecord | null {
    try {
        const title = getDcField(recordXml, 'title')[0] || '';
        if (!title) return null;

        const creators = getDcField(recordXml, 'creator');
        const descriptions = getDcField(recordXml, 'description');
        const subjects = getDcField(recordXml, 'subject');
        const dates = getDcField(recordXml, 'date');
        const types = getDcField(recordXml, 'type');
        const publishers = getDcField(recordXml, 'publisher');
        const identifiers = getDcField(recordXml, 'identifier');
        const relations = getDcField(recordXml, 'relation');

        // Prefer bitstream/direct PDF URL over handle page URL
        // Many OAI-PMH records include both: handle page URL AND direct bitstream URL
        const directPdfUrl = identifiers.find(id => /\/bitstream\//.test(id) || /\.pdf($|\?)/i.test(id)) || null;
        const identifierUrl = directPdfUrl || identifiers.find(id => /^https?:\/\//.test(id)) || null;
        const relation = relations[0] || null;

        // Take the longest description as the abstract (usually the main one)
        const description = descriptions
            .filter(d => d.length > 30)
            .sort((a, b) => b.length - a.length)[0] || '';

        return {
            identifier: '',
            title,
            creators: creators.length > 0 ? creators : ['Autor Desconocido'],
            description,
            subjects,
            date: dates[0] || null,
            type: types[0] || 'Tesis',
            publisher: publishers[0] || '',
            identifierUrl,
            relation,
        };
    } catch {
        return null;
    }
}

/** Extract the OAI identifier from a <header> block */
function extractOaiIdentifier(recordXml: string): string {
    const m = recordXml.match(/<identifier>([^<]+)<\/identifier>/);
    return m ? m[1] : '';
}

/** Parse all <record> blocks from an OAI-PMH ListRecords response */
function parseListRecords(xml: string): ParsedOaiRecord[] {
    const records: ParsedOaiRecord[] = [];
    // Split by <record> tags, handling both <record> and <record ...>
    const recordRegex = /<record>[\s\S]*?<\/record>/gi;
    let m: RegExpExecArray | null;
    while ((m = recordRegex.exec(xml)) !== null) {
        const block = m[0];
        const parsed = parseRecord(block);
        if (parsed) {
            parsed.identifier = extractOaiIdentifier(block);
            records.push(parsed);
        }
    }
    return records;
}

/** Extract resumptionToken for pagination */
function extractResumptionToken(xml: string): string | null {
    const m = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/);
    return m && m[1] ? m[1].trim() : null;
}

// ─── ListRecords cache (avoids re-downloading 9MB XML from UCV on every search) ─────
const listRecordsCache = new Map<string, { xml: string; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour

// ─── Main search function ──────────────────────────────────────

/**
 * Search a single OAI-PMH endpoint by harvesting recent records and filtering client-side.
 * OAI-PMH has no native query language, so we paginate through ListRecords and match by terms.
 *
 * @param endpoint OAI-PMH endpoint to query
 * @param query Search query
 * @param maxResults Max results to return
 * @returns Array of SearchResult
 */
export async function searchOaiPmhEndpoint(endpoint: OaiPmhEndpoint, query: string, maxResults: number = 15, options?: SearchOptions): Promise<SearchResult[]> {
    const queryTerms = extractQueryTerms(query);
    if (queryTerms.length === 0) return [];

    const results: SearchResult[] = [];
    let resumptionToken: string | null = null;
    let pagesFetched = 0;
    // Parche 8+9 (2026-08-15): maxPages editable con override granular por source:
    //   1. options.maxPagesBySource["renati"|"oai"|"oai-pmh"|"oai_pmh"] (por query, granular)
    //   2. options.maxPagesBySource[endpoint.name lowercase]            (por query, granular endpoint)
    //   3. options.oaiMaxPages                                          (legacy single)
    //   4. process.env.RENATI_MAXPAGES                                  (env granular)
    //   5. process.env.OAI_MAXPAGES                                      (env global legacy)
    //   6. default 7 (Parche 7 baseline)
    // Rango 1-10. Cada pagina ~= 100 records.
    const maxPages = (() => {
        const clamp = (v: number) => Math.max(1, Math.min(10, Math.trunc(v)));
        const keys = [
            'renati', 'oai', 'oai-pmh', 'oai_pmh',
            (endpoint.name || '').toLowerCase()
        ];
        for (const k of keys) {
            const v = options?.maxPagesBySource?.[k];
            if (typeof v === 'number' && Number.isInteger(v)) return clamp(v);
        }
        const legacy = options?.oaiMaxPages;
        if (typeof legacy === 'number' && Number.isInteger(legacy)) return clamp(legacy);
        const envSource = process.env.RENATI_MAXPAGES || '';
        const ev1 = parseInt(envSource, 10);
        if (!isNaN(ev1)) return clamp(ev1);
        const envRaw = process.env.OAI_MAXPAGES || '';
        const envVal = parseInt(envRaw, 10);
        if (!isNaN(envVal)) return clamp(envVal);
        return 7;
    })();

    try {
        while (pagesFetched < maxPages && results.length < maxResults) {
            let url: string;
            if (resumptionToken) {
                url = `${endpoint.baseUrl}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`;
            } else {
                url = `${endpoint.baseUrl}?verb=ListRecords&metadataPrefix=oai_dc`;
            }

            console.log(`[OAI-PMH:${endpoint.name}] Fetching page ${pagesFetched + 1}...`);

            let xml: string | undefined;
            if (pagesFetched === 0 && !resumptionToken) {
                // First page — check cache
                const cached = listRecordsCache.get(endpoint.name);
                if (cached && Date.now() - cached.ts < CACHE_TTL) {
                    xml = cached.xml;
                    console.log(`[OAI-PMH:${endpoint.name}] Using cached ListRecords (${(xml.length / 1024).toFixed(0)}KB, age=${Math.round((Date.now() - cached.ts) / 1000)}s)`);
                } else {
                    let res = await fetchWithTimeout(url, {
                        headers: {
                            'Accept': 'application/xml',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LetXipu-Search-MCP/1.0',
                        }
                    }, 22000); // Fix 2026-08-14: was 15000, increased to 22000 to allow DSpace 7 regional repos (UNAP/UNJBG/UNSCH) to complete their initial ListRecords fetch
                    if (res.ok) {
                        const contentType = res.headers.get('content-type') || '';
                        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
                            const bodyText = await res.text();
                            const peek = bodyText.substring(0, 500);
                            if (peek.includes('<html') || peek.includes('<!DOCTYPE') || peek.includes('<base href')) {
                                // DSpace 7 Angular SPA — try alternate OAI path
                                const altUrl = url.replace('/oai/request', '/server/oai/request');
                                if (altUrl !== url) {
                                    console.log(`[OAI-PMH:${endpoint.name}] DSpace 7 SPA detected, trying /server/oai/request...`);
                                    try {
                                        const altRes = await fetchWithTimeout(altUrl, {
                                            headers: {
                                                'Accept': 'application/xml',
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LetXipu-Search-MCP/1.0',
                                            }
                                        }, 15000);
                                        if (altRes.ok) {
                                            const altContentType = altRes.headers.get('content-type') || '';
                                            const altText = await altRes.text();
                                            if (!altContentType.includes('html') && (altText.includes('<OAI-PMH') || altText.includes('<?xml'))) {
                                                xml = altText;
                                                console.log(`[OAI-PMH:${endpoint.name}] ✅ DSpace 7 OAI endpoint found at /server/oai/request`);
                                            }
                                        }
                                    } catch { /* alternate path failed */ }
                                }
                            }
                            // If DSpace 7 fallback didn't work, keep the original HTML text (will be parsed as 0 records)
                            if (!xml) xml = bodyText;
                        }
                    }

                    if (!res.ok) {
                        console.warn(`[OAI-PMH:${endpoint.name}] HTTP ${res.status}, stopping`);
                        break;
                    }
                    if (!xml) xml = await res.text();
                    listRecordsCache.set(endpoint.name, { xml, ts: Date.now() });
                }
            } else {
                // Subsequent pages (resumption token) — always fetch fresh
                const res = await fetchWithTimeout(url, {
                    headers: {
                        'Accept': 'application/xml',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LetXipu-Search-MCP/1.0',
                    }
                }, 15000);
                if (!res.ok) {
                    console.warn(`[OAI-PMH:${endpoint.name}] HTTP ${res.status}, stopping`);
                    break;
                }
                xml = await res.text();
            }

            if (!xml || xml.length < 100) break;

            // Check for OAI error responses
            if (xml.includes('<error code=')) {
                const errMsg = xml.match(/<error code="([^"]+)"[^>]*>([^<]*)<\/error>/);
                console.warn(`[OAI-PMH:${endpoint.name}] OAI error: ${errMsg ? errMsg[1] + ' - ' + errMsg[2] : 'unknown'}`);
                break;
            }

            const records = parseListRecords(xml);
            console.log(`[OAI-PMH:${endpoint.name}] Parsed ${records.length} records, filtering by terms: ${queryTerms.join(', ')}`);

            for (const record of records) {
                if (results.length >= maxResults) break;
                if (recordMatchesQuery(record, queryTerms, false)) {
                    let handleUrl = record.identifierUrl;
                    if (!handleUrl && record.identifier) {
                        const handleMatch = record.identifier.match(/^oai:[^:]+:(.+)$/);
                        if (handleMatch) { try { const p = new URL(endpoint.baseUrl); handleUrl = `${p.protocol}//${p.hostname}/handle/${handleMatch[1]}`; } catch {} }
                    }
                    const yearMatch = record.date?.match(/(\d{4})/);
                    const doiMatch = record.relation?.match(/10\.\d{4,}\/[^\s]+/);
                    results.push({
                        id: `oai_${endpoint.name}_${generateRecordId(handleUrl || '', record.title)}`,
                        title: record.title, authors: record.creators, year: yearMatch ? parseInt(yearMatch[1], 10) : null,
                        abstract: record.description || '', pdfUrl: handleUrl || null, handleUrl: handleUrl || undefined,
                        url: handleUrl || undefined, source: `${endpoint.name} (OAI-PMH)`,
                        type: record.type || 'Tesis', university: endpoint.university, doi: doiMatch?.[0] || null, citationCount: null,
                    });
                }
            }

            resumptionToken = extractResumptionToken(xml);
            pagesFetched++;
            if (!resumptionToken) break;
        }

        console.log(`[OAI-PMH:${endpoint.name}] Returning ${results.length} matched results (from ${pagesFetched} pages)`);
        return results;
    } catch (e: any) {
        console.warn(`[OAI-PMH:${endpoint.name}] Exception: ${e.message}`);
        return [];
    }
}

/**
 * Search all configured OAI-PMH endpoints in parallel and merge results.
 * Used as a fallback when ALICIA/RENATI return few or no results.
 */
export async function searchOaiPmhAll(query: string, options?: SearchOptions): Promise<{ results: SearchResult[], metadata?: { isFallback: boolean } }> {
    const limit = Math.min(options?.limit || 15, 30);
    const endpoints = ACTIVE_ENDPOINTS;
    console.log(`[OAI-PMH] Searching ${endpoints.length}/${OAI_ENDPOINTS.length} active endpoints: "${query.substring(0, 50)}..."`);

    const perEndpointLimit = Math.max(5, Math.ceil(limit / endpoints.length));

    const allResults: SearchResult[] = [];
    const promises = endpoints.map(async (endpoint) => {
        try {
            const results = await searchOaiPmhEndpoint(endpoint, query, perEndpointLimit, options);
            allResults.push(...results);
        } catch (e: any) {
            console.warn(`[OAI-PMH:${endpoint.name}] Failed: ${e.message}`);
        }
    });

    await Promise.all(promises);

    // Deduplicate by title
    const seen = new Set<string>();
    const deduped = allResults.filter(r => {
        const key = (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 80);
        if (key && seen.has(key)) return false;
        if (key) seen.add(key);
        return true;
    });

    console.log(`[OAI-PMH] Total: ${allResults.length} → Deduplicated: ${deduped.length}`);
    return { results: deduped.slice(0, limit), metadata: { isFallback: true } };
}

/**
 * Search OAI-PMH as a fallback for ALICIA/RENATI.
 * Only runs if the primary search returned fewer than minResults.
 */
export async function searchOaiPmhFallback(query: string, primaryResults: SearchResult[], minResults: number = 5, options?: SearchOptions): Promise<SearchResult[]> {
    if (primaryResults.length >= minResults) {
        return primaryResults;
    }
    console.log(`[OAI-PMH] Fallback triggered: primary had ${primaryResults.length} results (< ${minResults}), querying OAI-PMH...`);
    const { results } = await searchOaiPmhAll(query, options);
    // Merge, avoiding duplicates with primary results
    const existingTitles = new Set(primaryResults.map(r => (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 80)));
    const newResults = results.filter(r => {
        const key = (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 80);
        return key && !existingTitles.has(key);
    });
    return [...primaryResults, ...newResults];
}

/** List configured OAI-PMH endpoints (for health check / debugging) */
export function listOaiPmhEndpoints(): OaiPmhEndpoint[] {
    return [...OAI_ENDPOINTS];
}
