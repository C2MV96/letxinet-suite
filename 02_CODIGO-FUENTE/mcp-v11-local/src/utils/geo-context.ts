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
}

const almacen = new AsyncLocalStorage<GeoStore>();

export function runWithGeoContext<T>(fn: () => T): T {
    return almacen.run({}, fn);
}

export function getGeoContext<T = any>(): T | undefined {
    return almacen.getStore()?.geo as T | undefined;
}

export function setGeoContext(geo: any): void {
    const store = almacen.getStore();
    if (store) store.geo = geo;
}
