// h01: servicios de la Suite (salud, versiones y catalogos).
'use strict';
const { crearHarness, http } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

(async () => {
  const h = crearHarness('h01', 'Servicios y salud');
  const v11 = new ClienteMcp('v11');
  const osm = new ClienteMcp('osm');

  await h.prueba('V11', 'GET /health', async () => {
    const r = await http('http://127.0.0.1:4003/health');
    if (!r.ok || !r.json) throw new Error(`HTTP ${r.status}`);
    h.metrica('v11_version', r.json.version);
    return { detalle: `status=${r.json.status} version=${r.json.version} tools=${r.json.tools}` };
  });
  await h.prueba('V11', 'MCP initialize y tools/list', async () => {
    const ts = await v11.herramientas();
    h.metrica('v11_herramientas', ts.length);
    if (ts.length !== 28) return { estado: 'AVISO', detalle: `${ts.length} herramientas (se esperaban 28)` };
    return { detalle: '28 herramientas' };
  });
  await h.prueba('V11', 'health_check (herramienta)', async () => h.evaluar(await v11.llamar('health_check', {}, 60000)));
  await h.prueba('OSM', 'GET /', async () => {
    const r = await http('http://127.0.0.1:7082/');
    return { detalle: `HTTP ${r.status}` };
  });
  await h.prueba('OSM', 'metricas en 9090', async () => {
    const r = await http('http://127.0.0.1:9090/metrics');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { detalle: `${r.texto.split('\n').length} lineas de metricas` };
  });
  await h.prueba('OSM', 'MCP tools/list', async () => {
    const ts = await osm.herramientas();
    h.metrica('osm_herramientas', ts.length);
    if (ts.length !== 28) return { estado: 'AVISO', detalle: `${ts.length} herramientas (se esperaban 28)` };
    return { detalle: '28 herramientas' };
  });
  await h.prueba('OSM', 'get_version', async () => h.evaluar(await osm.llamar('get_version', {}), (r) => (r.texto || '').slice(0, 100)));
  await h.prueba('OSM', 'osm_health', async () => h.evaluar(await osm.llamar('osm_health', {}), (r) => (r.texto || '').replace(/\s+/g, ' ').slice(0, 160)));
  await h.prueba('MarkItDown', 'GET /', async () => {
    const r = await http('http://127.0.0.1:7860/');
    if (!/online/i.test(r.texto)) throw new Error(`respuesta inesperada: ${r.texto.slice(0, 80)}`);
    return { detalle: 'online' };
  });
  await h.prueba('Desktop', 'gateway /health', async () => {
    let r;
    try { r = await http('http://127.0.0.1:43123/health', {}, 8000); } catch (e) {
      return { estado: 'OMITIDA', detalle: 'el Desktop no esta abierto (el gateway solo existe con la app abierta)' };
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { detalle: (r.texto || '').replace(/\s+/g, ' ').slice(0, 140) };
  });
  h.terminar();
})();
