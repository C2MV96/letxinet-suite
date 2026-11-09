// h04: las 28 herramientas de OSM, con coordenadas de Chimbote y Nuevo Chimbote.
// Las que dependen de Overpass, OSRM o Nominatim se marcan RED si fallan por la red externa.
'use strict';
const { crearHarness } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

const PLAZA = { latitude: -9.0745, longitude: -78.5936 };       // Plaza de Armas de Chimbote
const NUEVO = { latitude: -9.1290, longitude: -78.5170 };       // Nuevo Chimbote
const HOSPITAL = { latitude: -9.0849, longitude: -78.5833 };    // zona del Hospital La Caleta

(async () => {
  const h = crearHarness('h04', 'OSM: las 28 herramientas');
  const o = new ClienteMcp('osm');
  const red = { dependeDeRed: true };
  const usadas = new Set();
  const t = (n, args, comprobar, opc = {}, ms = 120000) => h.prueba(opc.area || 'OSM', n + (opc.etiqueta ? ` (${opc.etiqueta})` : ''), async () => {
    usadas.add(n);
    return h.evaluar(await o.llamar(n, args, ms), comprobar, opc);
  });
  const txt = (r) => (r.texto || '').replace(/\s+/g, ' ');

  // Sin internet (calculo local)
  await t('geo_distance', { from: PLAZA, to: NUEVO }, (r) => `${txt(r).slice(0, 80)}`, { area: 'Calculo local' });
  await t('bbox_from_points', { points: [PLAZA, NUEVO, HOSPITAL] }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  await t('centroid_points', { points: [PLAZA, NUEVO, HOSPITAL] }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  let poli = null;
  await t('polyline_encode', { points: [PLAZA, HOSPITAL, NUEVO] }, (r) => { poli = (r.json && (r.json.polyline || r.json.encoded)) || (txt(r).match(/"(?:polyline|encoded)"\s*:\s*"([^"]+)"/) || [])[1]; return poli ? `polyline de ${poli.length} caracteres` : txt(r).slice(0, 100); }, { area: 'Calculo local' });
  await t('polyline_decode', { polyline: poli || '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  await t('route_sample', { polyline: poli || '_p~iF~ps|U_ulLnnqC_mqNvxq`@', interval: 500 }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  await t('enrich_emissions', { options: [{ mode: 'car', distance: 9500, duration: 1200 }, { mode: 'bike', distance: 9500 }] }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  // Formato que documenta el servidor (OSMElement: id como texto)
  const elementos = [
    { type: 'node', id: '1', name: 'Hospital A', lat: -9.0849, lon: -78.5833, tags: { amenity: 'hospital', name: 'Hospital A' } },
    { type: 'node', id: '2', name: 'Clinica B', lat: -9.1290, lon: -78.5170, tags: { amenity: 'clinic', name: 'Clinica B' } },
    { type: 'node', id: '3', name: 'Farmacia C', lat: -9.0745, lon: -78.5936, tags: { amenity: 'pharmacy', name: 'Farmacia C' } },
  ];
  await t('filter_tags', { elements: elementos, tags: { amenity: ['hospital', 'clinic'] } }, (r) => (/Hospital A/.test(txt(r)) && !/Farmacia C/.test(txt(r)) ? 'filtro correcto' : { estado: 'AVISO', detalle: txt(r).slice(0, 120) }), { area: 'Calculo local' });
  await t('sort_by_distance', { elements: elementos, ref: PLAZA }, (r) => (txt(r).indexOf('Farmacia C') < txt(r).indexOf('Clinica B') ? 'orden correcto' : { estado: 'AVISO', detalle: txt(r).slice(0, 120) }), { area: 'Calculo local' });
  await h.prueba('Calculo local', 'filter_tags con id numerico (como lo da Overpass)', async () => {
    const r = await o.llamar('filter_tags', { elements: elementos.map((e) => ({ ...e, id: Number(e.id) })), tags: { amenity: ['hospital'] } });
    return r.ok ? { detalle: 'acepta id numerico' } : { estado: 'AVISO', detalle: `rechaza id numerico con un mensaje poco claro: ${String(r.error).slice(0, 60)}` };
  });
  await t('tile_cache', { action: 'stats' }, (r) => txt(r).slice(0, 100), { area: 'Calculo local' });
  await t('get_version', {}, (r) => txt(r).slice(0, 80), { area: 'Calculo local' });
  await t('osm_health', {}, (r) => txt(r).slice(0, 120), { area: 'Calculo local' });

  // Nominatim (geocodificacion)
  await t('geocode_address', { address: 'Plaza de Armas, Chimbote, Peru', region: 'pe' }, (r) => (/-9\.0|Chimbote/i.test(txt(r)) ? 'Chimbote encontrado' : { estado: 'AVISO', detalle: txt(r).slice(0, 120) }), { ...red, area: 'Nominatim' });
  await t('geocode_address', { address: 'Hospital Regional Eleazar Guzmán Barrón, Nuevo Chimbote' }, (r) => (/-9\.1|Chimbote/i.test(txt(r)) ? 'hospital encontrado' : { estado: 'AVISO', detalle: `no encontro el hospital: ${txt(r).slice(0, 100)}` }), { ...red, area: 'Nominatim', etiqueta: 'hospital' });
  await t('reverse_geocode', { ...PLAZA, lang: 'es' }, (r) => (/Chimbote|Áncash|Ancash/i.test(txt(r)) ? 'direccion de Chimbote' : { estado: 'AVISO', detalle: txt(r).slice(0, 120) }), { ...red, area: 'Nominatim' });
  await t('polygon_from_admin', { name: 'Chimbote', admin_level: 8, lang: 'es' }, (r) => txt(r).slice(0, 100), { ...red, area: 'Nominatim' });

  // Overpass (lugares)
  await t('find_nearby_places', { ...PLAZA, category: 'pharmacy', radius: 1500, limit: 5 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('find_schools_nearby', { ...PLAZA, radius: 1500, limit: 5 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('find_parking_facilities', { ...PLAZA, radius: 1500, limit: 5 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('find_charging_stations', { ...PLAZA, radius: 5000, limit: 5 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('find_nearby_batch', { queries: [{ ...PLAZA, category: 'hospital', radius: 3000, limit: 3, label: 'plaza' }, { ...NUEVO, category: 'clinic', radius: 3000, limit: 3, label: 'nuevo' }] }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('osm_query_bbox', { bbox: { minLat: -9.085, minLon: -78.60, maxLat: -9.070, maxLon: -78.585 }, tags: { amenity: 'hospital' } }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('explore_area', { ...PLAZA, radius: 800 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('analyze_neighborhood', { ...PLAZA, radius: 1000, neighborhood_name: 'Centro de Chimbote' }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);
  await t('suggest_meeting_point', { locations: [PLAZA, NUEVO], category: 'cafe', limit: 3 }, (r) => txt(r).slice(0, 100), { ...red, area: 'Overpass' }, 180000);

  // OSRM (rutas)
  await t('get_route_directions', { start_lat: PLAZA.latitude, start_lon: PLAZA.longitude, end_lat: NUEVO.latitude, end_lon: NUEVO.longitude, mode: 'car' }, (r) => txt(r).slice(0, 100), { ...red, area: 'OSRM' });
  await t('route_fetch', { start: PLAZA, end: NUEVO, mode: 'car' }, (r) => txt(r).slice(0, 100), { ...red, area: 'OSRM' });
  await t('route_fetch', { start: PLAZA, end: HOSPITAL, mode: 'foot' }, (r) => txt(r).slice(0, 100), { ...red, area: 'OSRM', etiqueta: 'a pie' });
  await t('analyze_commute', { home_latitude: NUEVO.latitude, home_longitude: NUEVO.longitude, work_latitude: HOSPITAL.latitude, work_longitude: HOSPITAL.longitude }, (r) => txt(r).slice(0, 100), { ...red, area: 'OSRM' }, 180000);

  // Teselas
  await t('get_map_image', { ...PLAZA, zoom: 14 }, (r) => `${(r.texto || '').length} caracteres`, { ...red, area: 'Teselas' });

  // Robustez
  await h.prueba('Robustez', 'geo_distance sin destino', async () => h.evaluar(await o.llamar('geo_distance', { from: PLAZA }), null, { errorEsperado: true }));
  await h.prueba('Robustez', 'latitud fuera de rango', async () => h.evaluar(await o.llamar('reverse_geocode', { latitude: 123, longitude: 500 }), null, { errorEsperado: true }));

  const todas = (await o.herramientas()).map((x) => x.name);
  const sinProbar = todas.filter((n) => !usadas.has(n));
  h.metrica('herramientas_probadas', usadas.size);
  h.metrica('herramientas_sin_probar', sinProbar);
  await h.prueba('Cobertura', 'todas las herramientas probadas', async () => (sinProbar.length ? { estado: 'AVISO', detalle: `sin probar: ${sinProbar.join(', ')}` } : { detalle: `${usadas.size} de ${todas.length}` }));
  h.terminar();
})();
