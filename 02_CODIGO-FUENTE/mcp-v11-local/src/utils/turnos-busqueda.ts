/**
 * LetXinet Suite 1.1.6: limite de busquedas simultaneas.
 *
 * En la prueba del 09/11/2026, tres clientes a la vez dejaron V11 atascado unos 20 minutos:
 * cada busqueda abre decenas de descargas, todas compiten por las mismas colas por dominio
 * (ALICIA admite 4 a la vez y una cada 1,5 s) y ninguna termina dentro de su plazo.
 *
 * Ahora `search`, `batch_search` y `smart_search` piden turno antes de empezar. Corren como
 * maximo LETXINET_MAX_BUSQUEDAS a la vez (3 por defecto); las demas esperan en fila. La espera
 * cuenta dentro del plazo de la herramienta y tiene su propio tope: si no hay turno en ese
 * tiempo, la llamada falla enseguida con un mensaje claro en vez de agotar el plazo completo.
 */

export class ServidorOcupado extends Error {
    constructor(public readonly enCurso: number, public readonly enFila: number, public readonly esperadoMs: number) {
        super(`V11 esta ocupado: ${enCurso} busquedas en curso y ${enFila} en fila. Esta espero ${Math.round(esperadoMs / 1000)} s sin conseguir turno. Reintenta en unos segundos y evita lanzar varias busquedas a la vez.`);
        this.name = 'ServidorOcupado';
    }
}

const MAXIMO = (() => {
    const n = parseInt(process.env.LETXINET_MAX_BUSQUEDAS || '', 10);
    return n > 0 ? n : 3;
})();

let enCurso = 0;
const fila: Array<() => void> = [];

function liberar(): void {
    const siguiente = fila.shift();
    if (siguiente) siguiente(); // el turno pasa directo al siguiente: enCurso no cambia
    else enCurso--;
}

/**
 * Espera turno como maximo `esperaMaxMs`. Devuelve la funcion que lo libera (se puede llamar
 * mas de una vez sin efecto). Si `cancelar` se dispara mientras espera, sale de la fila.
 */
export function tomarTurnoBusqueda(esperaMaxMs: number, cancelar?: AbortSignal): Promise<() => void> {
    const unaVez = () => { let hecho = false; return () => { if (!hecho) { hecho = true; liberar(); } }; };
    if (enCurso < MAXIMO) { enCurso++; return Promise.resolve(unaVez()); }
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        const entrar = () => { clearTimeout(reloj); cancelar?.removeEventListener('abort', salir); resolve(unaVez()); };
        const salir = () => {
            const i = fila.indexOf(entrar);
            if (i < 0) return; // ya tenia turno
            fila.splice(i, 1);
            clearTimeout(reloj);
            cancelar?.removeEventListener('abort', salir);
            reject(new ServidorOcupado(enCurso, fila.length, Date.now() - t0));
        };
        const reloj = setTimeout(salir, esperaMaxMs);
        cancelar?.addEventListener('abort', salir, { once: true });
        fila.push(entrar);
    });
}

export function estadoTurnosBusqueda(): { maximo: number; enCurso: number; enFila: number } {
    return { maximo: MAXIMO, enCurso, enFila: fila.length };
}
