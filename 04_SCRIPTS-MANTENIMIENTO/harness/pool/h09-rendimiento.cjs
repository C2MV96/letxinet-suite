// h09: rendimiento y carga (latencias p50/p95 y llamadas simultaneas).
'use strict';
const { crearHarness, resultadosBusqueda, percentil } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

async function medir(cliente, n, tool, args) {
  const t = [];
  let fallos = 0;
  for (let i = 0; i < n; i++) {
    const r = await cliente.llamar(tool, args, 180000);
    t.push(r.ms);
    if (!r.ok) fallos++;
  }
  return { p50: percentil(t, 50), p95: percentil(t, 95), max: Math.max(...t), fallos };
}

(async () => {
  const h = crearHarness('h09', 'Rendimiento y carga');
  const v = new ClienteMcp('v11');
  const o = new ClienteMcp('osm');
  const casos = [
    ['OSM', o, 20, 'geo_distance', { from: { latitude: -9.07, longitude: -78.59 }, to: { latitude: -9.13, longitude: -78.52 } }, 200],
    ['V11', v, 10, 'list_sources', {}, 500],
    ['V11', v, 5, 'fetch_metadata', { doi: '10.1371/journal.pntd.0004551' }, 5000],
    ['V11', v, 3, 'search', { query: 'dengue', sources: ['laref_peru'], maxSources: 10, fastMode: true }, 20000],
    ['V11', v, 3, 'search', { query: 'dengue', sources: ['pubmed'], maxSources: 10, fastMode: true }, 20000],
  ];
  for (const [area, cli, n, tool, args, limite] of casos) {
    const etiqueta = tool + (args.sources ? ` ${args.sources[0]}` : '');
    await h.prueba(area, `latencia ${etiqueta} (${n} llamadas)`, async () => {
      const m = await medir(cli, n, tool, args);
      h.metrica(`lat_${etiqueta.replace(/\s/g, '_')}`, m);
      const det = `p50 ${m.p50} ms, p95 ${m.p95} ms, max ${m.max} ms, fallos ${m.fallos}`;
      if (m.fallos === n) throw new Error(det);
      return { estado: m.fallos || m.p95 > limite ? 'AVISO' : 'OK', detalle: det };
    });
  }

  await h.prueba('Carga', '6 busquedas simultaneas en V11', async () => {
    const consultas = ['dengue', 'anemia', 'malaria', 'tuberculosis', 'zika', 'leishmaniasis'];
    const t0 = Date.now();
    const rs = await Promise.all(consultas.map((q) => new ClienteMcp('v11').llamar('search', { query: q, sources: ['laref_peru'], maxSources: 5, fastMode: true }, 240000)));
    const ok = rs.filter((r) => r.ok).length;
    const total = Date.now() - t0;
    h.metrica('carga_6_busquedas', { ok, total_ms: total, max_ms: Math.max(...rs.map((r) => r.ms)) });
    if (ok < 6) return { estado: ok ? 'AVISO' : 'FALLA', detalle: `${ok} de 6 en ${total} ms` };
    return { detalle: `6 de 6 en ${total} ms (la mas lenta ${Math.max(...rs.map((r) => r.ms))} ms)` };
  });
  await h.prueba('Carga', '30 llamadas simultaneas a OSM (calculo local)', async () => {
    const t0 = Date.now();
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => new ClienteMcp('osm').llamar('geo_distance', { from: { latitude: -9.07, longitude: -78.59 }, to: { latitude: -9.13 - i / 1000, longitude: -78.52 } })));
    const ok = rs.filter((r) => r.ok).length;
    return ok === 30 ? { detalle: `30 de 30 en ${Date.now() - t0} ms` } : { estado: 'FALLA', detalle: `${ok} de 30` };
  });
  await h.prueba('Carga', 'busqueda grande (maxSources 100)', async () => {
    const r = await v.llamar('search', { query: 'dengue', sources: ['peru_fast', 'pubmed', 'scielo'], maxSources: 100, fastMode: true }, 300000);
    if (!r.ok) throw new Error(r.error);
    const n = resultadosBusqueda(r).length;
    return { detalle: `${n} resultados, ${(r.texto.length / 1024).toFixed(0)} KB en ${r.ms} ms` };
  });
  h.terminar();
})();
