/**
 * LetXinet Suite 1.1.3: validacion de URL antes de descargar (proteccion SSRF).
 *
 * Bloquea direcciones internas para que una herramienta (read_pdf, convert_document,
 * resolve_pdf...) no pueda usarse para leer servicios de este equipo o de la red local:
 *   - loopback, red privada, enlace local (169.254.x.x, metadatos de la nube), CGNAT,
 *     0.0.0.0/8, multicast y sus equivalentes IPv6
 *   - formas alternativas de escribir una IP (0x7f000001, 2130706433, 0177.0.0.1):
 *     el parser WHATWG de URL las normaliza a 127.0.0.1 antes de comprobar
 *   - nombres que resuelven por DNS a una IP interna
 *
 * LETXINET_PERMITIR_URL_INTERNAS=true desactiva la comprobacion (solo para desarrollo).
 */

import dns from 'dns';
import net from 'net';

function ipv4Interna(ip: string): boolean {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some(n => isNaN(n))) return true;
    const [a, b] = p;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 192 && b === 0 && p[2] === 0) ||
        (a === 198 && (b === 18 || b === 19));
}

function ipv6Interna(ip: string): boolean {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (v === '::' || v === '::1') return true;
    const mapeada = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return ipv4Interna(mapeada[1]);
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v);
}

export function ipInterna(ip: string): boolean {
    const tipo = net.isIP(ip.replace(/^\[|\]$/g, ''));
    if (tipo === 4) return ipv4Interna(ip);
    if (tipo === 6) return ipv6Interna(ip);
    return false;
}

/** Lanza un error si la URL no es http(s) publica. Devuelve la URL normalizada. */
export async function validarUrlPublica(url: string): Promise<string> {
    if (process.env.LETXINET_PERMITIR_URL_INTERNAS === 'true') return url;
    let u: URL;
    try { u = new URL(url); } catch { throw new Error(`URL no valida: ${String(url).substring(0, 60)}`); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error(`URL bloqueada: solo se permiten http y https (${u.protocol})`);
    }
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
        throw new Error(`URL bloqueada: direccion interna (${host || 'vacia'})`);
    }
    if (net.isIP(host)) {
        if (ipInterna(host)) throw new Error(`URL bloqueada: direccion interna o privada (${host})`);
        return u.toString();
    }
    let direcciones: { address: string }[] = [];
    try {
        direcciones = await dns.promises.lookup(host, { all: true });
    } catch {
        return u.toString(); // sin DNS no hay a donde conectar; el fetch fallara solo
    }
    const interna = direcciones.find(d => ipInterna(d.address));
    if (interna) throw new Error(`URL bloqueada: ${host} apunta a una direccion interna (${interna.address})`);
    return u.toString();
}

/** Igual que validarUrlPublica pero devuelve el mensaje de error en vez de lanzar. */
export async function motivoBloqueo(url: string): Promise<string | null> {
    try { await validarUrlPublica(url); return null; } catch (e: any) { return e.message; }
}

/**
 * Revisa los argumentos de una herramienta MCP (source, url, identifier y sources[]) y devuelve
 * el motivo si alguno es una URL interna. Los valores que no son URL (DOI, IDs de fuentes) se ignoran.
 */
export async function urlInternaEnArgumentos(args: any): Promise<string | null> {
    const candidatos: string[] = [];
    for (const k of ['source', 'url', 'identifier']) if (typeof args?.[k] === 'string') candidatos.push(args[k]);
    if (Array.isArray(args?.sources)) for (const s of args.sources) if (typeof s === 'string') candidatos.push(s);
    for (const c of candidatos) {
        const v = c.trim();
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^file:/i.test(v)) continue;
        const motivo = await motivoBloqueo(v);
        if (motivo) return motivo;
    }
    return null;
}
