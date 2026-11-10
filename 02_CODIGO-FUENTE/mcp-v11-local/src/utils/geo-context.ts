/**
 * Contexto geografico por peticion (LetXinet Suite 1.1.5).
 *
 * Antes, la ubicacion detectada en una busqueda (por geocodificacion de la consulta
 * o del parametro `location`) se guardaba en `globalThis.__osmGeoResult` y nunca se
 * borraba: la primera ubicacion detectada se aplicaba a todas las busquedas siguientes
 * de cualquier cliente hasta reiniciar el servicio, y una geocodificacion equivocada
 * contaminaba el ordenamiento de todo lo que venia despues.
 *
 * Ahora cada peticion HTTP corre dentro de su propio contexto (AsyncLocalStorage),
 * que server.ts abre con `runWithGeoContext`. Fuera de una peticion, `getGeoContext`
 * devuelve undefined y `setGeoContext` no guarda nada.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface GeoStore {
    geo?: any;
    // 1.1.6: cancelacion por peticion. Se dispara cuando vence el plazo de la herramienta o el
    // cliente cierra la conexion; fetchWithTimeout la consulta para no seguir trabajando en vano.
    cancelar: AbortController;
}

const almacen = new AsyncLocalStorage<GeoStore>();

export function runWithGeoContext<T>(fn: () => T): T {
    return almacen.run({ cancelar: new AbortController() }, fn);
}

/** Controlador de cancelacion de la peticion en curso (undefined fuera de una peticion). */
export function getRequestAbortController(): AbortController | undefined {
    return almacen.getStore()?.cancelar;
}

/** Senal de cancelacion de la peticion en curso (undefined fuera de una peticion). */
export function getRequestSignal(): AbortSignal | undefined {
    return almacen.getStore()?.cancelar.signal;
}

export function requestAborted(): boolean {
    return almacen.getStore()?.cancelar.signal.aborted === true;
}

/** Plazo en ms combinado con la cancelacion de la peticion: para los fetch internos. */
export function senalConPlazo(ms: number): AbortSignal {
    const propia = getRequestSignal();
    const plazo = AbortSignal.timeout(ms);
    return propia ? AbortSignal.any([plazo, propia]) : plazo;
}

export class PeticionCancelada extends Error {
    constructor(motivo = 'la peticion se cancelo (vencio su plazo o el cliente cerro la conexion)') {
        super(`Cancelado: ${motivo}`);
        this.name = 'PeticionCancelada';
    }
}

export function getGeoContext<T = any>(): T | undefined {
    return almacen.getStore()?.geo as T | undefined;
}

export function setGeoContext(geo: any): void {
    const store = almacen.getStore();
    if (store) store.geo = geo;
}
