// h05: MarkItDown (API en 7860 y adaptador MCP por stdio).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { crearHarness, http, FIXTURES } = require('./lib/comun.cjs');

const APP = process.env.LETXINET_APP || 'C:\\Program Files\\LetXinet Suite';

async function convertir(nombre, tipo) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(path.join(FIXTURES, nombre))], { type: tipo }), nombre);
  return http('http://127.0.0.1:7860/convert', { method: 'POST', body: fd }, 120000);
}

function adaptadorMcp(lineas, ms = 60000) {
  return new Promise((ok, mal) => {
    const js = path.join(APP, 'MarkItDown', 'API', 'mcp-adapter', 'markitdown-mcp.js');
    if (!fs.existsSync(js)) return mal(new Error(`no existe ${js}`));
    const p = spawn(process.execPath, [js], { stdio: ['pipe', 'pipe', 'pipe'] });
    const resp = [];
    let resto = '';
    const reloj = setTimeout(() => { p.kill(); mal(new Error('el adaptador no respondio a tiempo')); }, ms);
    p.stdout.on('data', (d) => {
      resto += d;
      let i;
      while ((i = resto.indexOf('\n')) >= 0) {
        const l = resto.slice(0, i).trim(); resto = resto.slice(i + 1);
        if (l) { try { resp.push(JSON.parse(l)); } catch { /* ignora */ } }
        if (resp.filter((x) => x.id !== undefined).length >= lineas.filter((x) => x.id !== undefined).length) { clearTimeout(reloj); p.kill(); ok(resp); }
      }
    });
    for (const l of lineas) p.stdin.write(JSON.stringify(l) + '\n');
  });
}

(async () => {
  const h = crearHarness('h05', 'MarkItDown');
  await h.prueba('API', 'PDF academico a Markdown', async () => {
    const r = await convertir('articulo-prueba.pdf', 'application/pdf');
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.texto.slice(0, 120)}`);
    const md = JSON.stringify(r.json || r.texto);
    const conTabla = /Breteau/.test(md) && /\|/.test(md);
    h.metrica('markitdown_pdf_ms', r.ms);
    return conTabla ? { detalle: `texto y tabla en ${r.ms} ms` } : { estado: 'AVISO', detalle: 'convirtio pero sin tabla en Markdown' };
  });
  await h.prueba('API', 'DOCX (Word)', async () => {
    const r = await convertir('informe-prueba.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (r.ok && /Breteau/.test(JSON.stringify(r.json || r.texto))) return { detalle: 'convierte Word' };
    return { estado: 'AVISO', detalle: `no convierte Word (HTTP ${r.status}); esta API solo acepta PDF` };
  });
  await h.prueba('API', 'XLSX (Excel)', async () => {
    const r = await convertir('indices-prueba.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (r.ok && /Breteau/.test(JSON.stringify(r.json || r.texto))) return { detalle: 'convierte Excel' };
    return { estado: 'AVISO', detalle: `no convierte Excel (HTTP ${r.status}); esta API solo acepta PDF` };
  });
  await h.prueba('API', 'archivo vacio', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.alloc(0)], { type: 'application/pdf' }), 'vacio.pdf');
    const r = await http('http://127.0.0.1:7860/convert', { method: 'POST', body: fd }, 60000);
    return r.status >= 400 ? { detalle: `rechazado con HTTP ${r.status}` } : { estado: 'AVISO', detalle: `acepto un PDF vacio (HTTP ${r.status})` };
  });
  await h.prueba('API', '5 conversiones simultaneas', async () => {
    const t0 = Date.now();
    const rs = await Promise.all(Array.from({ length: 5 }, () => convertir('articulo-prueba.pdf', 'application/pdf')));
    const ok = rs.filter((r) => r.ok).length;
    if (ok < 5) throw new Error(`${ok} de 5 correctas`);
    return { detalle: `5 de 5 en ${Date.now() - t0} ms` };
  });
  await h.prueba('Adaptador MCP', 'initialize, tools/list y markitdown_health', async () => {
    const r = await adaptadorMcp([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'pool', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'markitdown_health', arguments: {} } },
    ]);
    const tools = (r.find((x) => x.id === 2) || {}).result;
    const salud = (r.find((x) => x.id === 3) || {}).result;
    if (!tools) throw new Error('sin tools/list');
    return { detalle: `${tools.tools.length} herramientas; health ${salud && !salud.isError ? 'ok' : 'con error'}` };
  });
  h.terminar();
})();
