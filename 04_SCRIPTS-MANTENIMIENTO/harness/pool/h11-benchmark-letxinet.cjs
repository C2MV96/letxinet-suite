// h11: lado LetXinet del comparativo. Mismas 8 consultas que los agentes de IA (benchmark\consultas.json).
// Para cada consulta busca en repositorios peruanos y en fuentes globales, y comprueba que los enlaces abran.
'use strict';
const fs = require('fs');
const path = require('path');
const { crearHarness, resultadosBusqueda, http, enParalelo, RAIZ } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

const BENCH = path.join(RAIZ, 'benchmark');
const PERU = ['renati', 'laref_peru'];
const GLOBAL = ['openalex', 'pubmed', 'scielo', 'crossref'];
const FUENTES_PERU = /renati|laref|referencia|alicia|peru|per[uú]|_pe\b|concytec/i;

function normalizar(x, fuenteBusqueda) {
  const url = x.url || x.link || x.pdfUrl || x.pdf_url || x.handle || null;
  const doi = (x.doi || (String(url || '').match(/10\.\d{4,9}\/[^\s"?#]+/) || [])[0] || null);
  const fuente = x.source || x.sourceName || x.repository || x.provider || fuenteBusqueda;
  const texto = `${x.title || ''} ${x.abstract || ''} ${url || ''}`;
  const esTesis = /tesis|thesis|dissert|bachiller|licenciad|maestr|doctor/i.test(`${x.type || ''} ${x.publicationType || ''} ${x.title || ''}`);
  return {
    titulo: x.title || '(sin titulo)',
    autores: Array.isArray(x.authors) ? x.authors.slice(0, 4).map((a) => (typeof a === 'string' ? a : a.name || '')) : [],
    anio: x.year || null,
    doi,
    url,
    fuente: String(fuente),
    tipo: esTesis ? 'tesis' : 'articulo',
    universidad: x.university || null,
    es_peru: FUENTES_PERU.test(String(fuente)) || /^per/i.test(String(x.country || '')) || /\.pe\//.test(String(url)) || /Per[uú]\b|Chimbote|Áncash|Ancash|Lima/i.test(`${texto} ${x.university || ''}`),
  };
}

async function abre(url) {
  try {
    const r = await http(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'LetXinet-Suite/1.1.2 (verificacion de enlaces)' } }, 20000);
    return r.status < 400;
  } catch { return false; }
}

(async () => {
  const h = crearHarness('h11', 'Comparativo: lado LetXinet');
  const consultas = JSON.parse(fs.readFileSync(path.join(BENCH, 'consultas.json'), 'utf8'));
  const salida = { lado: 'letxinet', fecha: new Date().toISOString().slice(0, 10), fuentes: { peru: PERU, global: GLOBAL }, consultas: [] };

  for (const q of consultas) {
    await h.prueba('Comparativo', `${q.id} ${q.consulta}`, async () => {
      const c = new ClienteMcp('v11');
      const t0 = Date.now();
      const [rp, rg] = await Promise.all([
        c.llamar('search', { query: q.terminos, sources: PERU, maxSources: 15, fastMode: true }, 240000),
        new ClienteMcp('v11').llamar('search', { query: q.terminos, sources: GLOBAL, maxSources: 15, fastMode: true }, 240000),
      ]);
      const segundos = (Date.now() - t0) / 1000;
      const vistos = new Set();
      const refs = [];
      for (const [r, f] of [[rp, 'peru'], [rg, 'global']]) {
        for (const x of resultadosBusqueda(r)) {
          const n = normalizar(x, f);
          const k = n.titulo.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 90);
          if (vistos.has(k)) continue;
          vistos.add(k);
          refs.push(n);
        }
      }
      // enlaces de las 6 primeras (3 peruanas y 3 globales si hay)
      const muestra = [...refs.filter((r) => r.es_peru).slice(0, 3), ...refs.filter((r) => !r.es_peru).slice(0, 3)].filter((r) => r.url);
      await enParalelo(muestra, 3, async (r) => { r.enlace_abre = await abre(r.url); });
      const verificados = muestra.filter((r) => r.enlace_abre).length;
      salida.consultas.push({
        id: q.id, consulta: q.consulta, segundos,
        errores: [rp, rg].filter((r) => !r.ok).map((r) => r.error),
        referencias: refs,
        enlaces_probados: muestra.length, enlaces_que_abren: verificados,
      });
      const peru = refs.filter((r) => r.es_peru).length;
      const tesis = refs.filter((r) => r.tipo === 'tesis').length;
      const msg = `${refs.length} referencias (${peru} de Peru, ${tesis} tesis, ${refs.filter((r) => r.doi).length} con DOI); enlaces ${verificados}/${muestra.length}; ${segundos.toFixed(0)} s`;
      return refs.length ? { detalle: msg } : { estado: 'AVISO', detalle: msg };
    });
  }
  fs.writeFileSync(path.join(BENCH, 'letxinet.json'), JSON.stringify(salida, null, 2));
  h.terminar();
})();
