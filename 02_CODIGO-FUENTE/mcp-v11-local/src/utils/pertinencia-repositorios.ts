/**
 * LetXinet Suite 1.1.3: filtro de pertinencia para los repositorios de tesis (RENATI, ALICIA,
 * La Referencia y sus redes por pais).
 *
 * Por que hace falta: cuando la consulta original da 0 resultados, esos conectores reintentan con
 * una consulta recortada (simplifyQuery prioriza las palabras con mayuscula), que puede quitar la
 * palabra del tema y dejar solo el lugar: "dengue Chimbote Ancash" pasa a "Chimbote Ancash" y
 * vuelven tesis de Chimbote sobre cualquier cosa. El cosechador OAI-PMH, ademas, acepta registros
 * con el 40 % de las palabras. En la prueba del 08/11/2026 eso dio 0 resultados pertinentes de 24
 * y de 23 en dos preguntas.
 *
 * Regla: las palabras en minuscula de la consulta son el tema; las que empiezan con mayuscula son
 * lugares o nombres propios. Cada resultado de un repositorio debe tener todas las palabras del
 * tema (y al menos un lugar, si la consulta trae alguno). Si con esa regla quedan menos de 3, se
 * acepta el 60 % de las palabras del tema. Los resultados de otras fuentes no se tocan.
 */

const VACIAS = new Set([
    'para', 'sobre', 'entre', 'desde', 'hasta', 'como', 'segun', 'durante', 'contra', 'donde', 'cual', 'cuales',
    'este', 'esta', 'estos', 'estas', 'unos', 'unas', 'otros', 'otras', 'mediante', 'tras', 'ante',
    'with', 'from', 'that', 'this', 'into', 'about', 'their', 'between',
    'estudio', 'analisis', 'investigacion', 'revision', 'tesis', 'study', 'analysis', 'research', 'review',
]);

export const ES_REPOSITORIO = /renati|alicia|la referencia|laref|repositorio|oai/i;

const normalizar = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function terminosConsulta(query: string): { tema: string[]; lugar: string[] } {
    const tema: string[] = [];
    const lugar: string[] = [];
    for (const w of String(query || '').split(/\s+/)) {
        const n = normalizar(w).replace(/[^a-z0-9]/g, '');
        if (n.length < 4 || VACIAS.has(n) || /^\d+$/.test(n)) continue;
        const destino = /^[A-ZÁÉÍÓÚÑ]/.test(w.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '')) ? lugar : tema;
        if (!destino.includes(n)) destino.push(n);
    }
    return { tema, lugar };
}

/**
 * Consulta para reintentar cuando la original da 0: conserva todas las palabras del tema y solo el
 * primer lugar ("dengue Chimbote Ancash" -> "dengue Chimbote"). Devuelve null si no cambia nada.
 */
export function consultaConservandoTema(query: string): string | null {
    const tema: string[] = [];
    const lugares: string[] = [];
    for (const w of String(query || '').split(/\s+/).filter(Boolean)) {
        const n = normalizar(w).replace(/[^a-z0-9]/g, '');
        if (n.length < 4 || VACIAS.has(n) || /^\d+$/.test(n)) continue;
        (/^[A-ZÁÉÍÓÚÑ]/.test(w.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '')) ? lugares : tema).push(w);
    }
    if (!tema.length || lugares.length < 2) return null;
    return [...tema, lugares[0]].join(' ');
}

// Coincidencia con raiz corta: "insecticida" tambien acepta "insecticidas", "nebulizacion" acepta "nebulizaciones"
function contiene(texto: string, termino: string): boolean {
    return texto.includes(termino) || (termino.length > 6 && texto.includes(termino.slice(0, -2)));
}

export function filtrarRepositorios<T extends { title?: string; abstract?: string | null; source?: string }>(
    resultados: T[], query: string,
): { resultados: T[]; quitados: number; regla: string | null } {
    const { tema, lugar } = terminosConsulta(query);
    if (!tema.length) return { resultados, quitados: 0, regla: null };
    const puntos = new Map<T, { t: number; l: number }>();
    for (const r of resultados) {
        if (!ES_REPOSITORIO.test(String(r.source || ''))) continue;
        const texto = normalizar(`${r.title || ''} ${r.abstract || ''}`);
        puntos.set(r, { t: tema.filter(x => contiene(texto, x)).length, l: lugar.filter(x => contiene(texto, x)).length });
    }
    if (!puntos.size) return { resultados, quitados: 0, regla: null };
    const conLugar = (p: { l: number }) => lugar.length === 0 || p.l >= 1;
    const estricto = (p: { t: number; l: number }) => p.t === tema.length && conLugar(p);
    const minimo = Math.max(1, Math.ceil(tema.length * 0.6));
    const flexible = (p: { t: number; l: number }) => p.t >= minimo && (conLugar(p) || p.t === tema.length);
    const nEstricto = [...puntos.values()].filter(estricto).length;
    const acepta = nEstricto >= 3 ? estricto : flexible;
    const quedan = resultados.filter(r => { const p = puntos.get(r); return !p || acepta(p); });
    return {
        resultados: quedan,
        quitados: resultados.length - quedan.length,
        regla: nEstricto >= 3 ? `todas las palabras del tema (${tema.join(', ')})` : `al menos ${minimo} de ${tema.length} palabras del tema (${tema.join(', ')})`,
    };
}
