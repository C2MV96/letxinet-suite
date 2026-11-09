// h02: las 28 herramientas de V11 con llamadas reales.
// Los PDF de prueba se sirven por HTTP local; las herramientas que bloquean URL locales usan un PDF abierto de PLOS.
'use strict';
const { crearHarness, resultadosBusqueda } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');
const { servirFixtures } = require('./lib/servidor-fixtures.cjs');

const DOI_ART = '10.1371/journal.pntd.0004551'; // Bowman et al. 2016, PLoS NTD
const DOI_OA = '10.1371/journal.pntd.0007203';  // articulo abierto de PLoS NTD
const TITULO_ART = 'Is dengue vector control deficient in effectiveness or evidence?';

(async () => {
  const h = crearHarness('h02', 'V11: las 28 herramientas');
  const v = new ClienteMcp('v11');
  const fx = await servirFixtures();
  const pdfLocal = fx.url('articulo-prueba.pdf');
  const red = { dependeDeRed: true };
  const usadas = new Set();
  const llamar = (n, a, ms) => { usadas.add(n); return v.llamar(n, a, ms); };
  const texto = (r) => (r.texto || '');

  // --- Busqueda ---
  await h.prueba('Busqueda', 'search (pubmed)', async () => h.evaluar(await llamar('search', { query: 'dengue Aedes aegypti control', sources: ['pubmed'], maxSources: 5, fastMode: true }),
    (r) => { const n = resultadosBusqueda(r).length; return n ? `${n} resultados en ${r.ms} ms` : { estado: 'AVISO', detalle: '0 resultados' }; }, red));
  let handlePeru = null;
  await h.prueba('Busqueda', 'search (laref_peru)', async () => h.evaluar(await llamar('search', { query: 'dengue Chimbote', sources: ['laref_peru'], maxSources: 5, fastMode: true }),
    (r) => {
      const l = resultadosBusqueda(r);
      const enlace = (x) => x.url || x.pdfUrl || x.link;
      const conUrl = l.find((x) => /handle|repositorio|bitstream|hdl/i.test(enlace(x) || '')) || l.find(enlace);
      if (conUrl) handlePeru = enlace(conUrl);
      const mojibake = l.find((x) => /Ã[\u0080-¿]/.test(`${x.source} ${x.title}`));
      if (mojibake) h.metrica('mojibake_laref', mojibake.source);
      return l.length ? `${l.length} resultados en ${r.ms} ms` : { estado: 'AVISO', detalle: '0 resultados' };
    }, red));
  await h.prueba('Busqueda', 'smart_search', async () => h.evaluar(await llamar('smart_search', { query: 'anemia infantil Perú factores asociados', maxResults: 8, fastMode: true }, 240000),
    (r) => { const n = resultadosBusqueda(r).length; return n ? `${n} resultados en ${r.ms} ms` : { estado: 'AVISO', detalle: '0 resultados' }; }, red));
  await h.prueba('Busqueda', 'batch_search (2 consultas)', async () => h.evaluar(await llamar('batch_search', { queries: ['dengue Chimbote', 'anemia infantil Perú'], sources: ['laref_peru', 'renati'], maxResults: 20 }, 240000),
    (r) => { const n = resultadosBusqueda(r).length; return n ? `${n} resultados en ${r.ms} ms` : { estado: 'AVISO', detalle: `0 resultados: ${texto(r).slice(0, 120)}` }; }, red));
  await h.prueba('Busqueda', 'search_dblp', async () => h.evaluar(await llamar('search_dblp', { query: 'dengue prediction machine learning', maxResults: 5 }), (r) => `${texto(r).length} caracteres`, red));
  await h.prueba('Busqueda', 'search_paperswithcode', async () => h.evaluar(await llamar('search_paperswithcode', { query: 'dengue forecasting', maxResults: 5 }), (r) => `${texto(r).length} caracteres`, red));
  await h.prueba('Busqueda', 'trending_papers', async () => h.evaluar(await llamar('trending_papers', { query: 'epidemiology', maxResults: 5 }), (r) => `${texto(r).length} caracteres`, red));
  await h.prueba('Busqueda', 'search_conferences', async () => h.evaluar(await llamar('search_conferences', { query: 'epidemiology', maxResults: 5 }), (r) => `${texto(r).length} caracteres`, red));

  // --- Metadatos ---
  await h.prueba('Metadatos', 'fetch_metadata por DOI', async () => h.evaluar(await llamar('fetch_metadata', { doi: DOI_ART }),
    (r) => (/dengue/i.test(texto(r)) ? 'titulo correcto' : { estado: 'AVISO', detalle: `no aparece el titulo: ${texto(r).slice(0, 120)}` }), red));
  await h.prueba('Metadatos', 'recover_metadata por titulo', async () => h.evaluar(await llamar('recover_metadata', { title: TITULO_ART }),
    (r) => (texto(r).includes('pntd.0004551') ? 'recupero el DOI correcto' : { estado: 'AVISO', detalle: `no recupero el DOI: ${texto(r).replace(/\s+/g, ' ').slice(0, 150)}` }), red));
  await h.prueba('Metadatos', 'enrich_metadata', async () => h.evaluar(await llamar('enrich_metadata', { papers: [{ title: TITULO_ART, doi: DOI_ART }] }), (r) => `${texto(r).length} caracteres`, red));
  await h.prueba('Metadatos', 'fetch_metadata con DOI inexistente', async () => {
    const r = await llamar('fetch_metadata', { doi: '10.9999/no.existe.letxinet.2026' });
    if (!r.ok) return { detalle: `error claro: ${r.error.slice(0, 80)}` };
    const d = (r.json && r.json.data) || {};
    return d.title ? { estado: 'FALLA', detalle: `invento un titulo: ${d.title}` } : { estado: 'AVISO', detalle: 'no da error: responde success=true con titulo vacio (quien lo use debe revisar el titulo)' };
  });

  // --- PDF: resolver y descargar ---
  let pdfRemoto = null;
  await h.prueba('PDF', 'resolve_pdf por DOI', async () => h.evaluar(await llamar('resolve_pdf', { identifier: DOI_OA }),
    (r) => { pdfRemoto = r.json && r.json.data && r.json.data.pdfUrl; return pdfRemoto ? `via ${r.json.data.resolvedFrom}` : { estado: 'AVISO', detalle: 'sin pdfUrl' }; }, red));
  await h.prueba('PDF', 'resolve_pdf desde repositorio peruano', async () => {
    if (!handlePeru) return { estado: 'OMITIDA', detalle: 'la busqueda en laref_peru no dio una URL' };
    return h.evaluar(await llamar('resolve_pdf', { identifier: handlePeru }, 120000),
      (r) => {
        const d = (r.json && r.json.data) || {};
        if (d.pdfUrl) return `PDF: ${String(d.pdfUrl).slice(0, 90)}`;
        const paso = (d.steps || []).filter((s) => !/exhausted|Repository URL/i.test(s)).pop();
        return { estado: 'AVISO', detalle: `sin PDF: ${paso || 'el resolvedor no explica por que'}` };
      }, red);
  });
  await h.prueba('PDF', 'download_pdf (sin Sci-Hub)', async () => h.evaluar(await llamar('download_pdf', { doi: DOI_OA }, 120000),
    (r) => (/sci-hub|bban\.top|scihub/i.test(texto(r)) ? { estado: 'FALLA', detalle: `uso un espejo de Sci-Hub: ${texto(r).replace(/\s+/g, ' ').slice(0, 90)}` } : `${texto(r).replace(/\s+/g, ' ').slice(0, 100)}`), red));
  await h.prueba('PDF', 'read_pdf de un PDF remoto (PLOS)', async () => {
    if (!pdfRemoto) return { estado: 'OMITIDA', detalle: 'resolve_pdf no dio URL' };
    return h.evaluar(await llamar('read_pdf', { source: pdfRemoto, maxChars: 3000 }, 180000), (r) => `${texto(r).length} caracteres`, red);
  });
  await h.prueba('PDF', 'read_pdf con ruta local de Windows', async () => {
    const r = await llamar('read_pdf', { source: require('path').join(require('./lib/comun.cjs').FIXTURES, 'articulo-prueba.pdf'), maxChars: 300 });
    return r.ok ? { detalle: 'acepta rutas locales' } : { estado: 'AVISO', detalle: 'no acepta rutas locales de este PC; hay que pasar una URL o un DOI' };
  });

  // --- PDF: analisis sobre un paper real con tablas y bibliografia ---
  // Desde 1.1.3 V11 no lee URL internas (127.0.0.1), asi que se usa un PDF publico:
  // arXiv 1706.03762, "Attention Is All You Need" (4 tablas, 40 referencias).
  const ARXIV = 'https://arxiv.org/pdf/1706.03762';
  const sobrePdf = async (n, args, comprobar, ms = 180000) => h.prueba('PDF', n, async () => h.evaluar(await llamar(n, { source: ARXIV, ...args }, ms), comprobar, red));
  await sobrePdf('read_pdf', { maxChars: 6000 }, (r) => (/Transformer|attention/i.test(texto(r)) ? 'texto completo' : { estado: 'AVISO', detalle: 'no aparece el texto esperado' }));
  await sobrePdf('read_pdf_markdown', { maxChars: 6000 }, (r) => (/Transformer|attention/i.test(texto(r)) ? 'markdown correcto' : { estado: 'AVISO', detalle: 'no aparece el texto esperado' }));
  await sobrePdf('pdf_metadata', {}, (r) => (/Attention|pages|title/i.test(texto(r)) ? 'metadatos leidos' : { estado: 'AVISO', detalle: texto(r).replace(/\s+/g, ' ').slice(0, 140) }));
  await sobrePdf('pdf_sections', {}, (r) => { const n = ((r.json && r.json.data && r.json.data.sections) || []).length; return n >= 4 ? `${n} secciones` : { estado: 'AVISO', detalle: `${n} secciones` }; });
  await sobrePdf('pdf_citations', {}, (r) => { const n = ((r.json && r.json.data && r.json.data.citations) || []).length; return n >= 20 ? `${n} referencias` : { estado: 'AVISO', detalle: `${n} referencias` }; });
  await sobrePdf('analyze_academic', {}, (r) => `${texto(r).length} caracteres`);
  await sobrePdf('extract_section', { section: 'Introduction' }, (r) => (/Recurrent neural networks/.test(texto(r)) ? 'seccion correcta' : { estado: 'AVISO', detalle: texto(r).replace(/\s+/g, ' ').slice(0, 120) }));
  await sobrePdf('pdf_smart_summary', { maxTotalChars: 2000 }, (r) => `${texto(r).length} caracteres`);
  await sobrePdf('extract_tables', {}, (r) => { const n = ((r.json && r.json.data && r.json.data.tables) || []).length; return n ? `${n} tablas` : { estado: 'FALLA', detalle: 'no detecto ninguna tabla en un paper que tiene 4' }; });
  await sobrePdf('extract_formulas', {}, (r) => `${texto(r).replace(/\s+/g, ' ').slice(0, 100)}`);
  await h.prueba('PDF', 'read_pdf bloquea una URL de 127.0.0.1', async () => {
    const r = await llamar('read_pdf', { source: pdfLocal, maxChars: 200 });
    return r.ok ? { estado: 'FALLA', detalle: 'leyo un PDF servido en 127.0.0.1 (riesgo SSRF)' } : { detalle: r.error.slice(0, 90) };
  });
  await h.prueba('Configuracion', 'MINERU_API_KEY y convert_document con URL', async () => {
    let valor = '';
    try { valor = (require('fs').readFileSync('C:\\ProgramData\\LetXinet Suite\\LetXinet-Suite.env', 'utf8').match(/^MINERU_API_KEY=(.*)$/m) || [])[1] || ''; } catch { return { estado: 'OMITIDA', detalle: 'no se pudo leer el .env' }; }
    valor = valor.trim();
    if (!valor) return { detalle: 'vacia: convert_document descarga el PDF y lo convierte en local' };
    if (valor.length < 20) return { estado: 'AVISO', detalle: `tiene un valor de ${valor.length} caracteres que no parece una clave completa; desde 1.1.3 convert_document lo tolera, pero MinerU no funcionara hasta cargar la clave real` };
    return { detalle: 'parece una clave real' };
  });

  await h.prueba('PDF', 'convert_document bloquea una URL de 127.0.0.1', async () => {
    const r = await llamar('convert_document', { source: pdfLocal, maxChars: 500 });
    return r.ok ? { estado: 'FALLA', detalle: 'convirtio un PDF servido en 127.0.0.1 (riesgo SSRF)' } : { detalle: r.error.slice(0, 90) };
  });
  await h.prueba('PDF', 'convert_document (PDF de arXiv)', async () => h.evaluar(await llamar('convert_document', { source: ARXIV, maxChars: 3000 }, 240000),
    (r) => (/Transformer|attention/i.test(texto(r)) ? `texto extraido (${texto(r).length} caracteres)` : { estado: 'AVISO', detalle: texto(r).replace(/\s+/g, ' ').slice(0, 120) }), red));
  await h.prueba('PDF', 'batch_convert (PDF de arXiv)', async () => h.evaluar(await llamar('batch_convert', { sources: [ARXIV], maxCharsPerDoc: 1500 }, 240000),
    (r) => (/"successful":\s*1/.test(texto(r)) ? '1 de 1 convertido' : { estado: 'AVISO', detalle: texto(r).replace(/\s+/g, ' ').slice(0, 120) }), red));

  // --- Informacion ---
  await h.prueba('Info', 'list_sources', async () => h.evaluar(await llamar('list_sources', {}),
    (r) => { const n = ((r.json && r.json.data && r.json.data.sources) || []).length; return n === 39 ? '39 fuentes' : { estado: 'AVISO', detalle: `${n} fuentes` }; }));
  await h.prueba('Info', 'health_check', async () => h.evaluar(await llamar('health_check', {})));
  await h.prueba('Info', 'coverage_report', async () => h.evaluar(await llamar('coverage_report', { format: 'json', use_cache: true }, 240000), (r) => `${texto(r).length} caracteres`, red));
  await h.prueba('Info', 'help', async () => h.evaluar(await llamar('help', {}), (r) => `${texto(r).length} caracteres`));

  // --- Entradas invalidas ---
  await h.prueba('Robustez', 'search sin query', async () => h.evaluar(await v.llamar('search', {}), null, { errorEsperado: true }));
  await h.prueba('Robustez', 'herramienta inexistente', async () => h.evaluar(await v.llamar('no_existe_letxinet', {}), null, { errorEsperado: true }));

  const todas = (await v.herramientas()).map((t) => t.name);
  const sinProbar = todas.filter((n) => !usadas.has(n));
  h.metrica('herramientas_probadas', usadas.size);
  h.metrica('herramientas_sin_probar', sinProbar);
  await h.prueba('Cobertura', 'todas las herramientas probadas', async () => (sinProbar.length ? { estado: 'AVISO', detalle: `sin probar: ${sinProbar.join(', ')}` } : { detalle: `${usadas.size} de ${todas.length}` }));
  fx.cerrar();
  h.terminar();
})();
