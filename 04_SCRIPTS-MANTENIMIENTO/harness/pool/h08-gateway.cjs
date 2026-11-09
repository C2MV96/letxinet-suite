// h08: gateway de LetXinet Desktop (43123). Solo existe con la app abierta.
'use strict';
const { crearHarness, http } = require('./lib/comun.cjs');

const G = 'http://127.0.0.1:43123';
const nombres = (j) => ((j && j.tools) || []).map((t) => (t.function ? t.function.name : t.name));
const OSM = /^(geo_distance|geocode_address|reverse_geocode|find_|route_|get_route|osm_|explore_area|analyze_(neighborhood|commute)|bbox_from|centroid|polyline|polygon_from|sort_by|suggest_meeting|tile_cache|get_map_image|get_version|enrich_emissions|filter_tags)/;

(async () => {
  const h = crearHarness('h08', 'Gateway de LetXinet Desktop');
  let abierto = true;
  await h.prueba('Gateway', '/health', async () => {
    try {
      const r = await http(`${G}/health`, {}, 8000);
      return { detalle: (r.texto || '').replace(/\s+/g, ' ').slice(0, 120) };
    } catch { abierto = false; return { estado: 'OMITIDA', detalle: 'Desktop cerrado: abre LetXinet Desktop para probar el gateway' }; }
  });
  if (!abierto) return h.terminar();

  const esperado = { osm: [25, 30, true], v11: [28, 40, false], juntos: [50, 70, null], ambos: [50, 70, null], both: [50, 70, null], letxipu_osm: [25, 30, true] };
  for (const [sel, [min, max, soloOsm]] of Object.entries(esperado)) {
    await h.prueba('Filtro server=', sel, async () => {
      const r = await http(`${G}/api/mcp/tools?server=${sel}&refresh=1`, {}, 90000);
      const n = nombres(r.json);
      const deOsm = n.filter((x) => OSM.test(x)).length;
      h.metrica(`gateway_${sel}`, n.length);
      if (n.length < min || n.length > max) throw new Error(`${n.length} herramientas (esperado ${min}-${max})`);
      if (soloOsm === true && deOsm !== n.length) throw new Error(`${n.length - deOsm} herramientas que no son de OSM`);
      if (soloOsm === false && deOsm) throw new Error(`${deOsm} herramientas de OSM en el filtro v11`);
      return { detalle: `${n.length} herramientas (${deOsm} de OSM)` };
    });
  }
  const llamar = (tool, args) => http(`${G}/api/mcp/call`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool, name: tool, arguments: args, args }) }, 120000);
  await h.prueba('Llamadas', 'geo_distance por el gateway', async () => {
    const r = await llamar('geo_distance', { from: { latitude: -9.0745, longitude: -78.5936 }, to: { latitude: -9.129, longitude: -78.517 } });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.texto.slice(0, 120)}`);
    return { detalle: `${r.ms} ms: ${r.texto.replace(/\s+/g, ' ').slice(0, 80)}` };
  });
  await h.prueba('Llamadas', 'list_sources por el gateway', async () => {
    const r = await llamar('list_sources', {});
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.texto.slice(0, 120)}`);
    return { detalle: `${r.ms} ms, ${(r.texto.match(/\\?"id\\?"/g) || []).length} fuentes` };
  });
  await h.prueba('Llamadas', 'herramienta inexistente', async () => {
    const r = await llamar('no_existe_letxinet', {});
    return !r.ok || (r.json && r.json.success === false) ? { detalle: `rechazada (HTTP ${r.status})` } : { estado: 'AVISO', detalle: 'no devolvio error' };
  });
  h.terminar();
})();
