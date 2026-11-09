// Junta los resultados del pool (hXX.json) y del comparativo (benchmark\*.json) en informe-pool.md.
'use strict';
const fs = require('fs');
const path = require('path');

const SALIDA = process.argv[2];
const BENCH = path.join(__dirname, 'benchmark');
const leer = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '-');
const md = [];
const L = (s = '') => md.push(s);

const hs = fs.readdirSync(SALIDA).filter((f) => /^h\d\d\.json$/.test(f)).sort().map((f) => leer(path.join(SALIDA, f)));
const total = { OK: 0, AVISO: 0, FALLA: 0, RED: 0, OMITIDA: 0 };
for (const h of hs) for (const k of Object.keys(total)) total[k] += h.resumen[k] || 0;
const n = Object.values(total).reduce((a, b) => a + b, 0);

L('# Informe del pool de harnesses de LetXinet Suite');
L();
L(`Fecha: ${new Date().toLocaleString('es-PE')}. Carpeta: \`${SALIDA}\`.`);
L();
L(`**Resumen:** ${n} pruebas en ${hs.length} harnesses: ${total.OK} OK, ${total.AVISO} avisos, ${total.FALLA} fallas, ${total.RED} fallos de la red externa y ${total.OMITIDA} omitidas.`);
L();
L('Estados: **OK** correcto; **AVISO** funciona con una limitación; **FALLA** error de LetXinet; **RED** falló un servicio externo o la red (no LetXinet); **OMITIDA** no aplicaba.');
L();
L('| Harness | OK | Avisos | Fallas | Red | Omitidas | Duración |');
L('|---|---|---|---|---|---|---|');
for (const h of hs) L(`| ${h.id} ${h.titulo} | ${h.resumen.OK} | ${h.resumen.AVISO} | ${h.resumen.FALLA} | ${h.resumen.RED} | ${h.resumen.OMITIDA} | ${Math.round(h.duracion_ms / 1000)} s |`);
L();

L('## Fallas, avisos y fallos de red');
L();
for (const estado of ['FALLA', 'AVISO', 'RED']) {
  const lista = hs.flatMap((h) => h.pruebas.filter((p) => p.estado === estado).map((p) => ({ h: h.id, ...p })));
  if (!lista.length) continue;
  L(`### ${estado === 'FALLA' ? 'Fallas' : estado === 'AVISO' ? 'Avisos' : 'Fallos de la red externa'} (${lista.length})`);
  L();
  for (const p of lista) L(`- **${p.h} · ${p.area} · ${p.nombre}:** ${String(p.detalle).replace(/\n/g, ' ').slice(0, 260)}`);
  L();
}

const h03 = hs.find((h) => h.id === 'h03');
if (h03 && h03.metricas.fuentes) {
  L('## Fuentes de V11, una por una');
  L();
  L(`${h03.metricas.fuentes_con_resultados} de ${h03.metricas.fuentes_total} fuentes devolvieron resultados.`);
  L();
  L('| Fuente | Región | Resultados | Tiempo | Estado |');
  L('|---|---|---|---|---|');
  for (const f of h03.metricas.fuentes) L(`| ${f.nombre} (\`${f.id}\`) | ${f.region} | ${f.resultados} | ${(f.ms / 1000).toFixed(1)} s | ${f.ok ? (f.resultados ? 'OK' : 'sin resultados') : String(f.error).replace(/\|/g, '/').slice(0, 70)} |`);
  L();
}

const h09 = hs.find((h) => h.id === 'h09');
if (h09) {
  L('## Rendimiento');
  L();
  L('| Medición | p50 | p95 | Máximo | Fallos |');
  L('|---|---|---|---|---|');
  for (const [k, m] of Object.entries(h09.metricas)) if (m && m.p50 !== undefined) L(`| ${k.replace(/^lat_/, '').replace(/_/g, ' ')} | ${m.p50} ms | ${m.p95} ms | ${m.max} ms | ${m.fallos} |`);
  L();
  for (const p of h09.pruebas.filter((x) => x.area === 'Carga')) L(`- ${p.nombre}: ${p.detalle}`);
  L();
}

const ver = leer(path.join(BENCH, 'verificacion.json'));
const lx = leer(path.join(BENCH, 'letxinet.json'));
const web = leer(path.join(BENCH, 'ia-busqueda-web.json'));
const mem = leer(path.join(BENCH, 'ia-memoria.json'));
if (lx || web || mem) {
  L('## Comparativo: LetXinet frente a IA con búsqueda web y a IA sin búsqueda');
  L();
  const consultas = leer(path.join(BENCH, 'consultas.json')) || [];
  const lados = [['LetXinet', lx], ['IA con búsqueda web', web], ['IA sin búsqueda (memoria)', mem]].filter(([, j]) => j);
  const { esPertinente } = require('./lib/pertinencia.cjs');
  const grupos = Object.fromEntries(consultas.map((q) => [q.id, q.pertinencia]));
  const resumen = (j) => {
    const refs = j.consultas.flatMap((c) => (c.referencias || []).map((r) => ({ ...r, pert: esPertinente(r.titulo, grupos[c.id]) })));
    const pert = refs.filter((r) => r.pert);
    const seg = j.consultas.map((c) => c.segundos).filter(Boolean);
    return {
      refs: refs.length, pert: pert.length, pertPeru: pert.filter((r) => r.es_peru).length, pertTesis: pert.filter((r) => r.tipo === 'tesis').length,
      peru: refs.filter((r) => r.es_peru).length, tesis: refs.filter((r) => r.tipo === 'tesis').length, doi: refs.filter((r) => r.doi).length,
      anio: refs.filter((r) => r.anio).length, seg: seg.length ? Math.round(seg.reduce((a, b) => a + b, 0) / seg.length) : null,
    };
  };
  L('Pertinente = el título contiene los conceptos clave de la pregunta (misma regla para los tres lados, solo con el título). La IA elige sus referencias; LetXinet devuelve la lista completa de las bases de datos, con ruido.');
  L();
  L('| Indicador | ' + lados.map(([n]) => n).join(' | ') + ' |');
  L('|---|' + lados.map(() => '---').join('|') + '|');
  const rs = lados.map(([, j]) => resumen(j));
  L('| Referencias en total (8 consultas) | ' + rs.map((r) => r.refs).join(' | ') + ' |');
  L('| Pertinentes | ' + rs.map((r) => `${r.pert} (${pct(r.pert, r.refs)} de precisión)`).join(' | ') + ' |');
  L('| Pertinentes sobre el Perú | ' + rs.map((r) => r.pertPeru).join(' | ') + ' |');
  L('| Tesis pertinentes | ' + rs.map((r) => r.pertTesis).join(' | ') + ' |');
  L('| Tiempo por consulta | ' + rs.map((r) => (r.seg ? `${r.seg} s` : '-')).join(' | ') + ' |');
  L('| Sobre el Perú o de instituciones peruanas | ' + rs.map((r) => `${r.peru} (${pct(r.peru, r.refs)})`).join(' | ') + ' |');
  L('| Tesis | ' + rs.map((r) => r.tesis).join(' | ') + ' |');
  L('| Con DOI | ' + rs.map((r) => `${r.doi} (${pct(r.doi, r.refs)})`).join(' | ') + ' |');
  L('| Con año | ' + rs.map((r) => `${r.anio} (${pct(r.anio, r.refs)})`).join(' | ') + ' |');
  if (ver) {
    const v = Object.fromEntries(ver.lados.map((x) => [x.lado.replace('busqueda', 'búsqueda').replace('sin búsqueda', 'sin búsqueda'), x]));
    const buscar = (n) => ver.lados.find((x) => x.lado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    L('| Verificadas (DOI correcto, enlace que abre o encontrada por título) | ' + lados.map(([n]) => { const x = buscar(n); return x ? `${x.buenos} de ${x.total} (${pct(x.buenos, x.total)})${x.muestra !== 'todas' ? '*' : ''}` : '-'; }).join(' | ') + ' |');
    L('| Errores claros (DOI inexistente o de otro trabajo) | ' + lados.map(([n]) => { const x = buscar(n); return x ? `${x.inventados}` : '-'; }).join(' | ') + ' |');
    L('| Sin confirmar (fuera de Crossref y OpenAlex, sitio que bloquea robots o DOI equivocado de un trabajo real) | ' + lados.map(([n]) => { const x = buscar(n); return x ? `${x.otros}` : '-'; }).join(' | ') + ' |');
    void v;
  }
  L();
  if (ver && ver.lados.some((x) => x.muestra !== 'todas')) L('\\* En LetXinet se verificó una muestra (hasta 3 con DOI y 3 con enlace por consulta); sus referencias vienen directamente de las bases de datos.');
  L();
  L('### Por consulta (pertinentes de las encontradas)');
  L();
  L('| Consulta | ' + lados.map(([n]) => n).join(' | ') + ' |');
  L('|---|' + lados.map(() => '---').join('|') + '|');
  for (const q of consultas) {
    L(`| ${q.id}. ${q.consulta} | ` + lados.map(([, j]) => { const c = j.consultas.find((x) => x.id === q.id); if (!c) return '-'; const r = c.referencias || []; return `${r.filter((x) => esPertinente(x.titulo, q.pertinencia)).length} de ${r.length}`; }).join(' | ') + ' |');
  }
  L();
  if (ver) {
    L('### Referencias con problemas');
    L();
    for (const x of ver.lados) {
      const malos = x.items.filter((i) => !['verificada', 'url_abre', 'encontrada_por_titulo'].includes(i.verificacion.estado));
      if (!malos.length) continue;
      L(`**${x.lado}** (${malos.length}):`);
      L();
      for (const i of malos.slice(0, 40)) L(`- ${i.consulta} · *${String(i.ref.titulo).slice(0, 110)}*${i.ref.doi ? ` (DOI ${i.ref.doi})` : ''}: ${i.verificacion.estado.replace(/_/g, ' ')}. ${String(i.verificacion.detalle || '').slice(0, 160)}`);
      L();
    }
  }
}

fs.writeFileSync(path.join(SALIDA, 'informe-pool.md'), md.join('\n'));
console.log(`informe: ${path.join(SALIDA, 'informe-pool.md')} (${n} pruebas: ${total.OK} OK, ${total.AVISO} avisos, ${total.FALLA} fallas, ${total.RED} red)`);
