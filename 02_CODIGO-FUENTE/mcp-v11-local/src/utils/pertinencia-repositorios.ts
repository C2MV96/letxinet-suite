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

// ---------------------------------------------------------------------------------------------
// LetXinet Suite 1.1.6: el lugar en la consulta a ALICIA y en el orden de los resultados.
//
// En la prueba del 09/11/2026, ALICIA tenia 10 tesis de dengue en Chimbote, 13 de calidad del
// agua en Huaraz y 3 de desnutricion cronica en Arequipa, y ninguna salio en los 10 primeros de
// V11. Causa: con 4 palabras o mas, la consulta se partia en pares y un trio de las PRIMERAS
// palabras ("calidad agua", "agua relaves", "calidad agua relaves") y el lugar, que va al final,
// nunca se enviaba. Y `location` se anteponia a la consulta ("huaraz calidad"), lo que traia
// "calidad de servicio en Huaraz" y nada del tema.
// ---------------------------------------------------------------------------------------------

const CONECTORES = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'e', 'u', 'en', 'con', 'al', 'por', 'que', 'se', 'su', 'sus',
    'the', 'and', 'of', 'to', 'in', 'on', 'for', 'at', 'by',
]);
// Nombres que no distinguen un lugar dentro del Peru ni una institucion de otra
const LUGAR_GENERICO = new Set(['peru', 'peruano', 'peruana', 'latinoamerica', 'america', 'latina', 'region', 'provincia', 'distrito', 'departamento', 'ciudad']);
const INSTITUCION_GENERICA = new Set(['universidad', 'nacional', 'privada', 'particular', 'peruana', 'catolica', 'instituto', 'hospital', 'nuevo', 'regional', 'centro', 'salud', 'facultad', 'escuela']);

// Palabras del tema que por si solas no dicen de que trata un trabajo ("calidad", "factores"...)
const TEMA_GENERICO = new Set([
    'calidad', 'nivel', 'niveles', 'factores', 'factor', 'relacion', 'influencia', 'efecto', 'efectos', 'impacto', 'evaluacion',
    'gestion', 'sistema', 'servicio', 'servicios', 'propuesta', 'aplicacion', 'programa', 'conocimiento', 'conocimientos',
    'actitudes', 'practicas', 'caracteristicas', 'prevalencia', 'riesgo', 'asociados', 'asociado', 'determinacion', 'diseno',
    'modelo', 'desarrollo', 'uso', 'implementacion', 'mejora', 'proceso', 'percepcion', 'satisfaccion', 'desempeno', 'control',
    'manejo', 'casos', 'caso', 'pacientes', 'estudiantes', 'ninos', 'adultos', 'mayor', 'menores', 'anos', 'cronica', 'cronico',
    'infantil', 'social', 'publica', 'publico', 'general', 'comparativo', 'determinantes', 'incidencia',
]);
const DEPARTAMENTOS = new Set([
    'amazonas', 'ancash', 'apurimac', 'arequipa', 'ayacucho', 'cajamarca', 'callao', 'cusco', 'cuzco', 'huancavelica', 'huanuco',
    'ica', 'junin', 'libertad', 'lambayeque', 'lima', 'loreto', 'moquegua', 'pasco', 'piura', 'puno', 'tacna', 'tumbes', 'ucayali',
]);

const CIUDADES = new Set([
    'chimbote', 'huaraz', 'trujillo', 'chiclayo', 'iquitos', 'pucallpa', 'huancayo', 'juliaca', 'tarapoto', 'sullana', 'chincha',
    'huacho', 'huamanga', 'abancay', 'chachapoyas', 'moyobamba', 'jaen', 'talara', 'paita', 'ilo', 'pisco', 'nazca', 'tingo',
    'barranca', 'huaral', 'canete', 'andahuaylas', 'yurimaguas', 'chulucanas', 'sicuani', 'quillabamba', 'cerro',
    'coishco', 'casma', 'huarmey', 'carhuaz', 'yungay', 'caraz', 'huari', 'recuay', 'pomabamba', 'bagua', 'tarma', 'jauja',
    'satipo', 'oxapampa', 'tocache', 'juanjui', 'rioja', 'nauta', 'requena', 'camana', 'mollendo', 'majes', 'chivay',
    'urubamba', 'calca', 'espinar', 'azangaro', 'ayaviri', 'ilave', 'chota', 'cutervo', 'celendin', 'cajabamba', 'huamachuco',
    'otuzco', 'pacasmayo', 'chepen', 'ferrenafe', 'olmos', 'catacaos', 'sechura', 'zarumilla', 'huanta', 'puquio',
    'chalhuanca', 'huaycan', 'ventanilla', 'lurigancho', 'chorrillos', 'comas', 'carabayllo',
]);
// Nombres de lugar que tambien son palabras comunes: solo cuentan con mayuscula
const AMBIGUOS = new Set(['libertad', 'cerro', 'tingo', 'pasco', 'rioja', 'comas', 'majes', 'olmos', 'calca']);

const esMayuscula = (w: string) => /^[A-ZÁÉÍÓÚÑ]/.test(w.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, ''));
const limpio =(w: string) => normalizar(w).replace(/[^a-z0-9]/g, '');

/**
 * Separa la consulta en palabras del tema y lugar.
 *
 * El lugar es `location` (si llega) y, en la consulta, la ULTIMA palabra con mayuscula que no sea
 * la primera de la frase: los lugares van al final ("dengue y Aedes aegypti Chimbote" -> Chimbote;
 * "Aedes" es tema). Si esa ultima palabra es un departamento y antes hay otra con mayuscula, manda
 * la anterior ("dengue Chimbote Ancash" -> Chimbote). Las demas palabras con mayuscula son tema.
 */
export function temaYLugar(query: string, location?: string | null): { tema: string[]; lugar: string[] } {
    const palabras = String(query || '').split(/\s+/).filter(Boolean);
    const tema: string[] = [];
    const lugar: string[] = [];
    const agregar = (lista: string[], n: string) => { if (n && !lista.includes(n)) lista.push(n); };
    // De `location` sale una sola palabra: la ultima del primer tramo ("Nuevo Chimbote, Ancash" ->
    // chimbote; "San Juan de Lurigancho" -> lurigancho). "nuevo" o "san" coincidirian con todo.
    const tramo = String(location || '').split(/[,;]/)[0].split(/\s+/).map(limpio)
        .filter(n => n.length >= 3 && !CONECTORES.has(n) && !LUGAR_GENERICO.has(n));
    if (tramo.length) agregar(lugar, tramo[tramo.length - 1]);
    const util = (n: string) => n.length >= 3 && !CONECTORES.has(n) && !VACIAS.has(n) && !/^\d+$/.test(n);
    // Candidatas a lugar: con mayuscula y no genericas. La primera palabra lleva mayuscula por ser
    // inicio de frase ("Dengue en adultos"), asi que solo cuenta si es un lugar conocido.
    // Un lugar conocido cuenta tambien en minuscula ("dengue chimbote"), salvo los nombres que
    // son ademas palabras comunes (lima, ica, libertad, cerro, santa...).
    const conocido = (n: string) => n.length >= 5 && !AMBIGUOS.has(n) && (DEPARTAMENTOS.has(n) || CIUDADES.has(n));
    const candidatas = palabras
        .map((w, i) => ({ n: limpio(w), i, w }))
        .filter(c => util(c.n) && !LUGAR_GENERICO.has(c.n) && !INSTITUCION_GENERICA.has(c.n)
            && (conocido(c.n) || (esMayuscula(c.w) && (c.i > 0 || DEPARTAMENTOS.has(c.n) || CIUDADES.has(c.n)))));
    let principal = candidatas[candidatas.length - 1];
    const anterior = candidatas[candidatas.length - 2];
    if (principal && anterior && DEPARTAMENTOS.has(principal.n) && !DEPARTAMENTOS.has(anterior.n)) principal = anterior;
    const departamentoFinal = principal && candidatas[candidatas.length - 1] !== principal ? candidatas[candidatas.length - 1].n : null;
    if (principal) agregar(lugar, principal.n);
    for (const w of palabras) {
        const n = limpio(w);
        if (!util(n) || lugar.includes(n) || n === departamentoFinal || LUGAR_GENERICO.has(n)) continue;
        agregar(tema, n);
    }
    return { tema, lugar };
}

/** Palabras del tema que si lo identifican; si todas son genericas, se devuelven todas. */
function temaDistintivo(tema: string[]): string[] {
    const d = tema.filter(t => !TEMA_GENERICO.has(t));
    return d.length ? d : tema;
}

export interface ConsultaAlicia { lookfor: string; type: 'AllFields' | 'Title'; etiqueta: string }

/**
 * Consultas a enviar a ALICIA, de la mas especifica a la mas general. Devuelve null cuando basta
 * la consulta unica de siempre (3 palabras o menos y sin lugar).
 * ALICIA exige todas las palabras de `lookfor` (comprobado el 10/11/2026: 7 palabras devuelven
 * resultados), asi que ya no hace falta partir la consulta para que responda.
 */
export function planConsultasAlicia(query: string, location?: string | null): ConsultaAlicia[] | null {
    const { tema, lugar } = temaYLugar(query, location);
    if (!tema.length) return null;
    const plan: ConsultaAlicia[] = [];
    const agregar = (palabras: string[], type: 'AllFields' | 'Title', etiqueta: string) => {
        const lookfor = palabras.join(' ');
        if (lookfor && !plan.some(p => p.lookfor === lookfor && p.type === type)) plan.push({ lookfor, type, etiqueta });
    };
    if (lugar.length) {
        agregar([...tema.slice(0, 5), lugar[0]], 'AllFields', 'tema y lugar');
        if (tema.length > 1) {
            // Titulos del lugar: con las dos primeras palabras del tema y con la primera que lo identifica
            agregar([...tema.slice(0, 2), lugar[0]], 'Title', 'titulo local');
            agregar([temaDistintivo(tema)[0], lugar[0]], 'Title', 'titulo local amplio');
        }
        agregar(tema.slice(0, 4), 'AllFields', 'tema');
        return plan;
    }
    if (tema.length <= 3) return null;
    agregar(tema.slice(0, 7), 'AllFields', 'consulta completa');
    agregar(tema.slice(0, 3), 'AllFields', 'tres primeras');
    agregar(tema.slice(0, 2), 'AllFields', 'dos primeras');
    return plan;
}

/** Palabras que distinguen a una institucion ("Universidad Nacional Santiago Antunez de Mayolo" -> santiago, antunez, mayolo). */
function palabrasInstitucion(nombre?: string | null): string[] {
    const out: string[] = [];
    for (const w of String(nombre || '').split(/\s+/)) {
        const n = limpio(w);
        if (n.length >= 4 && !CONECTORES.has(n) && !INSTITUCION_GENERICA.has(n) && !out.includes(n)) out.push(n);
    }
    return out;
}

/** True si el resultado es de la institucion pedida (por su campo de universidad, el titulo o el resumen). */
export function esDeInstitucion(r: { title?: string; abstract?: string | null; university?: string | null }, nombre?: string | null): boolean {
    const claves = palabrasInstitucion(nombre);
    if (!claves.length) return false;
    const texto = normalizar(`${r.university || ''} ${r.title || ''} ${r.abstract || ''}`);
    return claves.every(c => texto.includes(c));
}

/**
 * Sube al inicio los resultados del lugar o de la institucion pedidos, sin quitar ninguno.
 * Primero los que nombran el lugar en el titulo (los que mas palabras del tema tienen en el
 * titulo van antes), despues los que lo nombran en el resumen o son de la institucion, y al
 * final el resto en el orden que traian.
 */
export function priorizarLocales<T extends { title?: string; abstract?: string | null; university?: string | null }>(
    resultados: T[], query: string, location?: string | null, university?: string | null, maximo: number = Infinity,
): { resultados: T[]; lugares: string[]; locales: number } {
    const { tema, lugar } = temaYLugar(query, location);
    const hayInstitucion = palabrasInstitucion(university).length > 0;
    if (!lugar.length && !hayInstitucion) return { resultados, lugares: [], locales: 0 };
    const distintivo = temaDistintivo(tema);
    const nivel = (r: T): number => {
        const titulo = normalizar(r.title || '');
        if (lugar.some(l => contiene(titulo, l))) return 0;
        const resto = normalizar(`${r.abstract || ''} ${r.university || ''}`);
        if (lugar.some(l => contiene(resto, l)) || (hayInstitucion && esDeInstitucion(r, university))) return 1;
        return 2;
    };
    const temaEnTitulo = (r: T): number => {
        const titulo = normalizar(r.title || '');
        return distintivo.filter(x => contiene(titulo, x)).length * 10 + tema.filter(x => contiene(titulo, x)).length;
    };
    const grupos: T[][] = [[], [], []];
    for (const r of resultados) grupos[nivel(r)].push(r);
    for (const g of [grupos[0], grupos[1]]) {
        const puntos = new Map(g.map((r, i) => [r, { p: temaEnTitulo(r), i }]));
        g.sort((a, b) => (puntos.get(b)!.p - puntos.get(a)!.p) || (puntos.get(a)!.i - puntos.get(b)!.i));
    }
    // Suben como maximo `maximo` (media pagina en `search`): asi los resultados exactos del tema
    // que no son del lugar siguen a la vista. Los locales que no suben conservan su puesto.
    const suben = [...grupos[0], ...grupos[1]].slice(0, maximo);
    const subidos = new Set(suben);
    return {
        resultados: [...suben, ...resultados.filter(r => !subidos.has(r))],
        lugares: [...lugar, ...(hayInstitucion ? [String(university)] : [])],
        locales: suben.length,
    };
}

// Coincidencia con raiz corta: "insecticida" tambien acepta "insecticidas", "nebulizacion" acepta "nebulizaciones"
function contiene(texto: string, termino: string): boolean {
    return texto.includes(termino) || (termino.length > 6 && texto.includes(termino.slice(0, -2)));
}

export function filtrarRepositorios<T extends { title?: string; abstract?: string | null; source?: string }>(
    resultados: T[], query: string, location?: string | null,
): { resultados: T[]; quitados: number; regla: string | null } {
    // 1.1.6: el lugar se detecta con temaYLugar ("Aedes" ya no cuenta como lugar por su mayuscula)
    const { tema, lugar } = temaYLugar(query);
    // Lugar para la regla local: el de la consulta mas el parametro `location`
    const lugarLocal = temaYLugar(query, location).lugar;
    const distintivo = temaDistintivo(tema);
    if (!tema.length) return { resultados, quitados: 0, regla: null };
    type P = { t: number; l: number; local: boolean };
    const puntos = new Map<T, P>();
    for (const r of resultados) {
        if (!ES_REPOSITORIO.test(String(r.source || ''))) continue;
        const texto = normalizar(`${r.title || ''} ${r.abstract || ''}`);
        puntos.set(r, {
            t: tema.filter(x => contiene(texto, x)).length,
            l: lugar.filter(x => contiene(texto, x)).length,
            // 1.1.6: un trabajo del lugar que trata el tema (al menos una palabra que lo identifica)
            // se conserva aunque no tenga todas las palabras. Antes se descartaban las tesis locales
            // ("calidad del agua ... Huaraz" no pasaba por no decir "relaves mineros").
            local: lugarLocal.some(x => contiene(texto, x)) && distintivo.some(x => contiene(texto, x)),
        });
    }
    if (!puntos.size) return { resultados, quitados: 0, regla: null };
    const conLugar = (p: P) => lugar.length === 0 || p.l >= 1;
    const estricto = (p: P) => p.t === tema.length && conLugar(p);
    const minimo = Math.max(1, Math.ceil(tema.length * 0.6));
    const flexible = (p: P) => p.t >= minimo && (conLugar(p) || p.t === tema.length);
    const nEstricto = [...puntos.values()].filter(estricto).length;
    const regla = nEstricto >= 3 ? estricto : flexible;
    const acepta = (p: P) => regla(p) || p.local;
    const quedan = resultados.filter(r => { const p = puntos.get(r); return !p || acepta(p); });
    return {
        resultados: quedan,
        quitados: resultados.length - quedan.length,
        regla: nEstricto >= 3 ? `todas las palabras del tema (${tema.join(', ')})` : `al menos ${minimo} de ${tema.length} palabras del tema (${tema.join(', ')})`,
    };
}
