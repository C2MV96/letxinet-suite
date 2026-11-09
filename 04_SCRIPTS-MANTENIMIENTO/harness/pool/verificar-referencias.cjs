// Verifica las referencias de cada lado del comparativo contra fuentes independientes del sistema probado:
//   DOI -> Crossref (api.crossref.org/works/<doi>) y compara el titulo
//   sin DOI -> busca el titulo en Crossref y OpenAlex
//   enlace -> comprueba que abra (HTTP < 400)
// Lados: benchmark\ia-busqueda-web.json, benchmark\ia-memoria.json y una muestra de benchmark\letxinet.json.
// No usa V11 a proposito: fetch_metadata y recover_metadata estan marcadas como obsoletas en su propio codigo
// y se bloquean con carga (ver h02/h09). Escribe benchmark\verificacion.json.
// VERIFICAR_SOLO=letxinet.json rehace solo ese lado y conserva los demas.
'use strict';
const fs = require('fs');
const path = require('path');
const { http, enParalelo, RAIZ } = require('./lib/comun.cjs');

const BENCH = path.join(RAIZ, 'benchmark');
const UA = { 'User-Agent': 'LetXinet-Suite/1.1.2 (harness de pruebas)' };
const VACIAS = new Set('de la el los las del y en con para por una un the of and in on for a an to from with at by study analysis'.split(' '));

function palabras(t) {
  return new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !VACIAS.has(w)));
}
function parecido(a, b) {
  const A = palabras(a); const B = palabras(b);
  if (!A.size || !B.size) return 0;
  let c = 0; for (const w of A) if (B.has(w)) c++;
  return c / Math.min(A.size, B.size);
}
const limpiarDoi = (d) => String(d).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/[.,;)]+$/, '').trim();
const tituloUtil = (t) => t && !/aproximado|no visible|sin titulo/i.test(t) && palabras(t).size >= 3;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function crossrefDoi(doi) {
  const d = limpiarDoi(doi).split('/').map(encodeURIComponent).join('/');
  for (let i = 0; i < 4; i++) {
    try {
      const r = await http(`https://api.crossref.org/works/${d}`, { headers: UA }, 25000);
      if (r.status === 404) return { existe: false };
      if (r.ok && r.json) return { existe: true, titulo: ((r.json.message || {}).title || [''])[0] };
    } catch { /* reintento */ }
    await esperar(2000 * (i + 1)); // Crossref limita la concurrencia del acceso publico
  }
  return { existe: null };
}

async function buscarTitulo(titulo) {
  const q = encodeURIComponent(String(titulo).slice(0, 250));
  const cands = [];
  try {
    const r = await http(`https://api.crossref.org/works?query.bibliographic=${q}&rows=3&select=DOI,title`, { headers: UA }, 25000);
    for (const it of ((r.json || {}).message || {}).items || []) cands.push({ titulo: (it.title || [''])[0], doi: it.DOI, fuente: 'Crossref' });
  } catch { /* sigue con OpenAlex */ }
  try {
    const r = await http(`https://api.openalex.org/works?search=${q}&per-page=3&select=id,doi,title`, { headers: UA }, 25000);
    for (const it of (r.json || {}).results || []) cands.push({ titulo: it.title, doi: it.doi ? limpiarDoi(it.doi) : null, fuente: 'OpenAlex' });
  } catch { /* sin OpenAlex */ }
  let mejor = null;
  for (const c of cands) { const p = parecido(titulo, c.titulo); if (!mejor || p > mejor.p) mejor = { ...c, p }; }
  return mejor;
}

// rota = 404/410 o dominio inexistente; no_confirmada = el sitio bloquea robots (401/403/429/5xx) o no responde
async function abre(url) {
  try {
    const r = await http(url, { redirect: 'follow', headers: UA }, 20000);
    if (r.status < 400) return { ok: true, detalle: `HTTP ${r.status}` };
    return { ok: false, rota: r.status === 404 || r.status === 410, detalle: `HTTP ${r.status}` };
  } catch (e) { return { ok: false, rota: /ENOTFOUND/.test(e.message), detalle: e.message.slice(0, 80) }; }
}

async function verificar(ref) {
  if (ref.doi) {
    const c = await crossrefDoi(ref.doi);
    if (c.existe === null) return { estado: 'sin_respuesta', detalle: 'Crossref no respondio' };
    if (c.existe) {
      const p = parecido(ref.titulo, c.titulo);
      if (p >= 0.6 || !tituloUtil(ref.titulo)) return { estado: 'verificada', detalle: `DOI correcto en Crossref (${Math.round(p * 100)} % de coincidencia del titulo)`, titulo_real: c.titulo };
      const b = tituloUtil(ref.titulo) ? await buscarTitulo(ref.titulo) : null;
      if (b && b.p >= 0.75) return { estado: 'existe_con_otro_doi', detalle: `el DOI dado es de "${String(c.titulo).slice(0, 70)}"; el trabajo existe con DOI ${b.doi || '(sin DOI)'}`, titulo_real: b.titulo };
      return { estado: 'doi_de_otro_trabajo', detalle: `el DOI es de otro trabajo: "${String(c.titulo).slice(0, 90)}"`, titulo_real: c.titulo };
    }
    const b = tituloUtil(ref.titulo) ? await buscarTitulo(ref.titulo) : null;
    if (b && b.p >= 0.75) return { estado: 'existe_con_otro_doi', detalle: `el DOI no existe; el trabajo si existe${b.doi ? ` con DOI ${b.doi}` : ''} (${b.fuente})`, titulo_real: b.titulo };
    return { estado: 'doi_inexistente', detalle: `Crossref no tiene el DOI${b ? `; lo mas parecido: "${String(b.titulo).slice(0, 70)}"` : ''}` };
  }
  if (ref.url) {
    const u = await abre(ref.url);
    if (u.ok) return { estado: 'url_abre', detalle: u.detalle };
    const b = tituloUtil(ref.titulo) ? await buscarTitulo(ref.titulo) : null;
    if (b && b.p >= 0.75) return { estado: 'encontrada_por_titulo', detalle: `el enlace no abre (${u.detalle}) pero el trabajo existe (${b.fuente})`, titulo_real: b.titulo };
    return u.rota ? { estado: 'url_rota', detalle: u.detalle } : { estado: 'url_no_confirmada', detalle: `${u.detalle} (el sitio bloquea robots o no respondio; en un navegador puede abrir)` };
  }
  if (!tituloUtil(ref.titulo)) return { estado: 'no_verificable', detalle: 'sin DOI, sin enlace y sin titulo completo' };
  const b = await buscarTitulo(ref.titulo);
  if (b && b.p >= 0.75) return { estado: 'encontrada_por_titulo', detalle: `existe en ${b.fuente}${b.doi ? ` (DOI ${b.doi})` : ''}`, titulo_real: b.titulo };
  return { estado: 'no_encontrada', detalle: b ? `lo mas parecido: "${String(b.titulo).slice(0, 80)}" (${Math.round(b.p * 100)} %)` : 'sin coincidencias en Crossref ni OpenAlex' };
}

// BUENOS = confirmadas. INVENTADOS = errores claros (un DOI que no existe o que es de otro trabajo).
// El resto queda "sin confirmar": no esta en Crossref ni OpenAlex (normas, boletines, tesis sin indexar),
// enlaces que bloquean robots, o trabajos reales citados con un DOI equivocado (existe_con_otro_doi).
const BUENOS = new Set(['verificada', 'url_abre', 'encontrada_por_titulo']);
const INVENTADOS = new Set(['doi_inexistente', 'doi_de_otro_trabajo']);

(async () => {
  const solo = process.env.VERIFICAR_SOLO;
  const previo = solo && fs.existsSync(path.join(BENCH, 'verificacion.json')) ? JSON.parse(fs.readFileSync(path.join(BENCH, 'verificacion.json'), 'utf8')).lados : [];
  const lados = previo.filter((l) => l.archivo !== solo);
  for (const [archivo, nombre, muestra] of [['ia-busqueda-web.json', 'IA con busqueda web', null], ['ia-memoria.json', 'IA sin busqueda (memoria)', null], ['letxinet.json', 'LetXinet', 3]]) {
    if (solo && archivo !== solo) continue;
    const f = path.join(BENCH, archivo);
    if (!fs.existsSync(f)) { console.log(`falta ${archivo}; se omite`); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const items = [];
    for (const c of j.consultas) {
      let refs = c.referencias || [];
      if (muestra) refs = [...refs.filter((r) => r.doi).slice(0, muestra), ...refs.filter((r) => !r.doi && r.url).slice(0, muestra)];
      for (const r of refs) items.push({ consulta: c.id, ref: r });
    }
    await enParalelo(items, 2, async (it) => {
      it.verificacion = await verificar(it.ref);
      process.stdout.write(`[${nombre}] ${it.consulta} ${it.verificacion.estado}: ${String(it.ref.titulo).slice(0, 60)}\n`);
    });
    const cuenta = {};
    for (const it of items) cuenta[it.verificacion.estado] = (cuenta[it.verificacion.estado] || 0) + 1;
    const total = items.length;
    const buenos = items.filter((i) => BUENOS.has(i.verificacion.estado)).length;
    const inventados = items.filter((i) => INVENTADOS.has(i.verificacion.estado)).length;
    lados.push({ lado: nombre, archivo, modelo: j.modelo || null, muestra: muestra ? `hasta ${muestra} con DOI y ${muestra} con enlace por consulta` : 'todas', total, buenos, inventados, otros: total - buenos - inventados, cuenta, items });
    console.log(`${nombre}: ${buenos}/${total} verificadas, ${inventados} inventadas o equivocadas`);
  }
  fs.writeFileSync(path.join(BENCH, 'verificacion.json'), JSON.stringify({ fecha: new Date().toISOString(), metodo: 'Crossref y OpenAlex directos; enlaces por HTTP', lados }, null, 2));
})();
