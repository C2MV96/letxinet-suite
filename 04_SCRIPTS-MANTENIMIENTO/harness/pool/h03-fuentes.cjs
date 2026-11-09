// h03: cada una de las fuentes de V11 por separado (responde, cuantos resultados, cuanto tarda).
'use strict';
const { crearHarness, resultadosBusqueda, enParalelo, PATRON_RED } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

const CONSULTA = process.env.POOL_CONSULTA_FUENTES || 'dengue';

(async () => {
  const h = crearHarness('h03', `V11: cada fuente por separado (consulta "${CONSULTA}")`);
  const base = new ClienteMcp('v11');
  const ls = await base.llamar('list_sources', {});
  const fuentes = (ls.json && ls.json.data && ls.json.data.sources) || [];
  h.metrica('fuentes_total', fuentes.length);
  const filas = [];

  await enParalelo(fuentes, 4, async (f) => {
    const c = new ClienteMcp('v11'); // una sesion por hilo
    await h.prueba(f.country || 'Fuente', `${f.id} (${f.name})`, async () => {
      const r = await c.llamar('search', { query: CONSULTA, sources: [f.id], maxSources: 5, fastMode: true }, 150000);
      const n = r.ok ? resultadosBusqueda(r).length : 0;
      filas.push({ id: f.id, nombre: f.name, region: f.country, categoria: f.category, ok: r.ok, resultados: n, ms: r.ms, error: r.ok ? null : (r.error || '').slice(0, 160) });
      if (!r.ok) {
        if (/key|clave|api_key|unauthori|401|403|forbidden/i.test(r.error || '')) return { estado: 'AVISO', detalle: `requiere clave o acceso: ${r.error.slice(0, 100)}` };
        if (PATRON_RED.test(r.error || '')) return { estado: 'RED', detalle: r.error.slice(0, 160) };
        throw new Error(r.error);
      }
      if (!n) return { estado: 'AVISO', detalle: `0 resultados en ${Math.round(r.ms / 1000)} s` };
      return { detalle: `${n} resultados en ${(r.ms / 1000).toFixed(1)} s` };
    });
  });

  filas.sort((a, b) => b.resultados - a.resultados || a.ms - b.ms);
  h.metrica('fuentes', filas);
  h.metrica('fuentes_con_resultados', filas.filter((f) => f.resultados > 0).length);
  h.terminar();
})();
