/**
 * LetXinet Suite 1.1.6: acabado de los resultados antes de devolverlos (search, batch_search y
 * smart_search). Corrige dos fallos de la prueba del 09/11/2026:
 *
 *  - Universidad equivocada o generica. La Referencia y ALICIA a veces traen como "universidad"
 *    la editorial, otra institucion o solo el pais ("Ecuador", "Brasil", "Universidad Peruana").
 *    Si la direccion del registro es de un repositorio peruano conocido (por dominio o por prefijo
 *    de handle), manda el repositorio.
 *  - Ningun resultado traia el enlace directo al PDF (0 de 577): `pdfUrl` era la pagina del
 *    repositorio. Para los primeros resultados se resuelve el PDF dentro de un plazo corto.
 */
import { PERU_HANDLE_MAP } from '../scraping/handle-map';
import { withPromiseTimeout } from '../providers/base';
import { requestAborted } from './geo-context';

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const PAISES = new Set([
    'peru', 'ecuador', 'brasil', 'brazil', 'mexico', 'colombia', 'chile', 'argentina', 'bolivia', 'uruguay', 'paraguay',
    'venezuela', 'costa rica', 'el salvador', 'panama', 'cuba', 'espana', 'latinoamerica', 'pe', 'br', 'ec', 'mx', 'co', 'cl', 'ar',
]);
const GENERICAS = new Set(['universidad peruana', 'universidad', 'universidad nacional', 'latinoamerica', 'institucion peruana']);
const VACIAS = new Set(['universidad', 'nacional', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'privada', 'peruana', 'peru', 'instituto', 'repositorio', 'institucional']);

function repositorioDe(r: any): string | null {
    const urls = [r.pdfUrl, r.handleUrl, r.url, r?.metadata?.enrichmentUrl].filter((u: any) => typeof u === 'string' && u) as string[];
    for (const u of urls) {
        for (const [prefijo, config] of Object.entries(PERU_HANDLE_MAP)) {
            const base = String(config.base || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            if ((base && u.includes(base)) || u.includes(`/${prefijo}/`)) return config.name;
        }
    }
    return null;
}

const distintivas = (t: string) => norm(t).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !VACIAS.has(w));

/** Corrige `university` con el repositorio de la direccion. Devuelve cuantos cambio. */
export function corregirUniversidades(resultados: any[]): number {
    let cambios = 0;
    for (const r of resultados) {
        const actual = norm(r.university || '');
        const repo = repositorioDe(r);
        if (repo) {
            const a = distintivas(r.university || '');
            const b = new Set(distintivas(repo));
            // Mismo nombre escrito distinto ("UNSA" / "Universidad Nacional de San Agustin de Arequipa"): no se toca
            const coincide = a.length > 0 && a.some(w => b.has(w));
            if (!coincide && norm(repo) !== actual) {
                if (r.university && !GENERICAS.has(actual) && !PAISES.has(actual)) r.universityReported = r.university;
                r.university = repo;
                cambios++;
            }
        } else if (PAISES.has(actual)) {
            // Solo el pais: no es una universidad. El pais ya va en el campo `country`.
            r.university = '';
            cambios++;
        }
    }
    return cambios;
}

const esPdfDirecto = (u: string) => /\.pdf($|[?#])/i.test(u) || /\/bitstream(s)?\//i.test(u) || /\/download$/i.test(u);

/**
 * Resuelve el enlace directo al PDF de los primeros `cuantos` resultados, todos a la vez y con un
 * plazo total de `plazoMs`. Lo que no se resuelve a tiempo queda como estaba. El enlace anterior
 * (pagina del repositorio) se conserva en `handleUrl`.
 */
export async function resolverPdfDirectos(resultados: any[], cuantos: number = 5, plazoMs: number = 6000): Promise<number> {
    const candidatos = resultados.slice(0, cuantos).filter(r => {
        const u = String(r.pdfUrl || r.handleUrl || r.url || '');
        return u && !esPdfDirecto(u) && (u.includes('hdl.handle.net') || u.includes('/handle/'));
    });
    if (!candidatos.length || requestAborted()) return 0;
    const { resolveHandleToPdfUrl } = await import('../scraping/dspace-resolver');
    let resueltos = 0;
    await Promise.allSettled(candidatos.map(async r => {
        const origen = String(r.pdfUrl || r.handleUrl || r.url);
        const pdf = await withPromiseTimeout(resolveHandleToPdfUrl(origen), plazoMs, 'plazo del PDF');
        if (pdf && esPdfDirecto(pdf)) {
            if (!r.handleUrl) r.handleUrl = origen;
            r.pdfUrl = pdf;
            r.pdfDirecto = true;
            resueltos++;
        }
    }));
    return resueltos;
}
