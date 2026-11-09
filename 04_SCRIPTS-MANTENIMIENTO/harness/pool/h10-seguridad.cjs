// h10: seguridad (puertos solo locales, claves en archivos instalados, URL internas bloqueadas).
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { crearHarness } = require('./lib/comun.cjs');
const { ClienteMcp } = require('./lib/mcp-cliente.cjs');

const APP = process.env.LETXINET_APP || 'C:\\Program Files\\LetXinet Suite';
const PUERTOS = { 4003: 'V11', 7082: 'OSM', 9090: 'metricas OSM', 7860: 'MarkItDown', 43123: 'gateway Desktop' };
const CLAVES = [/sk-[A-Za-z0-9_-]{20,}/, /hf_[A-Za-z0-9]{30,}/, /AIza[0-9A-Za-z_-]{30,}/, /ghp_[A-Za-z0-9]{30,}/, /sk-or-v1-[a-f0-9]{30,}/];

function conecta(host, puerto, ms = 2500) {
  return new Promise((ok) => {
    const s = net.connect({ host, port: puerto });
    const fin = (v) => { s.destroy(); ok(v); };
    s.setTimeout(ms, () => fin(false));
    s.on('connect', () => fin(true));
    s.on('error', () => fin(false));
  });
}

function ipLocal() {
  for (const lista of Object.values(os.networkInterfaces())) for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return null;
}

function* archivos(dir, prof = 0) {
  if (prof > 6) return;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|python-runtime|site-packages|locales|\.git/i.test(e.name)) yield* archivos(p, prof + 1); }
    else yield p;
  }
}

(async () => {
  const h = crearHarness('h10', 'Seguridad');
  const ip = ipLocal();
  for (const [puerto, nombre] of Object.entries(PUERTOS)) {
    await h.prueba('Puertos', `${puerto} (${nombre})`, async () => {
      const local = await conecta('127.0.0.1', Number(puerto));
      if (!ip) return { estado: 'OMITIDA', detalle: 'sin IP de red' };
      const desdeRed = await conecta(ip, Number(puerto));
      if (desdeRed) throw new Error(`abierto en la red (${ip}:${puerto})`);
      return { detalle: local ? `solo local (cerrado en ${ip})` : 'no escucha (servicio apagado)' };
    });
  }

  await h.prueba('Archivos', 'sin claves en la instalacion', async () => {
    const hallados = [];
    let revisados = 0;
    for (const f of archivos(APP)) {
      if (!/\.(js|cjs|mjs|json|env|cmd|ps1|txt|md|yml|yaml|ini|cfg)$/i.test(f)) continue;
      let st; try { st = fs.statSync(f); } catch { continue; }
      if (st.size > 15 * 1024 * 1024) continue;
      revisados++;
      const t = fs.readFileSync(f, 'utf8');
      if (CLAVES.some((re) => re.test(t))) hallados.push(path.relative(APP, f));
    }
    h.metrica('archivos_revisados', revisados);
    if (hallados.length) throw new Error(`posibles claves en: ${hallados.slice(0, 5).join(', ')}`);
    return { detalle: `${revisados} archivos revisados, ninguna clave` };
  });
  await h.prueba('Archivos', 'sin secrets.json', async () => {
    const s = [...archivos(APP)].filter((f) => /secrets\.json$/i.test(f));
    if (s.length) throw new Error(s.join(', '));
    return { detalle: 'no existe' };
  });

  const v = new ClienteMcp('v11');
  for (const [nombre, url] of [['metadatos de la nube (169.254.169.254)', 'http://169.254.169.254/latest/meta-data/'], ['red privada (192.168.1.1)', 'http://192.168.1.1/'], ['archivo local (file://)', 'file:///C:/Windows/win.ini'], ['127.0.0.1 escrito como 0x7f000001', 'http://0x7f000001:7860/'], ['127.0.0.1 en decimal (2130706433)', 'http://2130706433:7860/'], ['IPv6 local ([::1])', 'http://[::1]:7860/']]) {
    await h.prueba('SSRF', `convert_document bloquea ${nombre}`, async () => {
      const r = await v.llamar('convert_document', { source: url, maxChars: 200 }, 60000);
      if (!r.ok && /bloquead|blocked/i.test(r.error || '')) return { detalle: r.error.slice(0, 90) };
      return { estado: 'FALLA', detalle: r.ok ? 'acepto una URL interna' : `no la bloqueo; fallo por otra razon: ${String(r.error).slice(0, 80)}` };
    });
  }
  for (const [herramienta, args] of [['read_pdf', { source: 'http://127.0.0.1:7860/', maxChars: 100 }], ['resolve_pdf', { identifier: 'http://10.0.0.1/tesis.pdf' }], ['fetch_metadata', { url: 'http://192.168.0.1/item' }]]) {
    await h.prueba('SSRF', `${herramienta} con URL interna`, async () => {
      const r = await v.llamar(herramienta, args, 60000);
      if (!r.ok && /bloquead|blocked/i.test(r.error || '')) return { detalle: r.error.slice(0, 90) };
      return { estado: 'FALLA', detalle: r.ok ? 'acepto una URL interna' : `no la bloqueo; fallo por otra razon: ${String(r.error).slice(0, 80)}` };
    });
  }
  h.terminar();
})();
