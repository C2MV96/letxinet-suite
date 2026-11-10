#!/usr/bin/env node
// letxinet-mcp-bridge.cjs (LetXinet Suite 1.1.5)
// Puente MCP por stdio hacia los servicios de la Suite, sin pasar por la app Desktop:
//   V11 (busqueda academica y PDF)  http://127.0.0.1:4003/api/mcp
//   OSM (mapas y rutas)             http://127.0.0.1:7082/mcp
//
// LETXINET_SELECCION elige que expone:
//   ambos (por defecto) -> las herramientas de V11 y de OSM juntas, en un solo servidor
//   v11                 -> solo V11
//   osm                 -> solo OSM
// Sirve para los clientes que solo aceptan servidores stdio (Claude Desktop) y para el modo "juntos"
// sin depender de que LetXinet Desktop este abierto. Si un servicio no responde, se exponen las
// herramientas del otro y la llamada fallida devuelve un error claro.
//
// Variables opcionales: LETXINET_V11_URL, LETXINET_OSM_URL, LETXINET_TIMEOUT_MS (por defecto 300000).
'use strict';

const SELECCION = (process.env.LETXINET_SELECCION || 'ambos').trim().toLowerCase();
const TIMEOUT_MS = Number(process.env.LETXINET_TIMEOUT_MS || 300000);
const SERVIDORES = [
  { id: 'v11', nombre: 'V11', url: process.env.LETXINET_V11_URL || 'http://127.0.0.1:4003/api/mcp' },
  { id: 'osm', nombre: 'OSM', url: process.env.LETXINET_OSM_URL || 'http://127.0.0.1:7082/mcp' },
].filter((s) => SELECCION === 'ambos' || SELECCION === 'both' || SELECCION === 'juntos' || SELECCION === s.id);

const log = (m) => process.stderr.write(`[letxinet-mcp-bridge] ${m}\n`);
if (!SERVIDORES.length) {
  log(`LETXINET_SELECCION no valida: "${SELECCION}" (usa ambos, v11 u osm)`);
  process.exit(2);
}

// ---- Cliente MCP por HTTP hacia cada servicio (respuesta JSON o text/event-stream) ----
const sesiones = new Map();
let idInterno = 1;

async function postar(servidor, cuerpo, ms) {
  const cab = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  const sid = sesiones.get(servidor.id);
  if (sid) cab['Mcp-Session-Id'] = sid;
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(servidor.url, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo), signal: ctl.signal });
    const nuevo = r.headers.get('mcp-session-id');
    if (nuevo) sesiones.set(servidor.id, nuevo);
    const texto = await r.text();
    if (!r.ok && (r.status === 400 || r.status === 404) && sid) {
      sesiones.delete(servidor.id);
      const e = new Error(`sesion caducada (HTTP ${r.status})`);
      e.sesion = true;
      throw e;
    }
    if (!texto.trim()) return null;
    if (texto.trimStart().startsWith('{')) return JSON.parse(texto);
    const datos = texto.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
    return datos.length ? JSON.parse(datos[datos.length - 1]) : null;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${servidor.nombre} no respondio en ${Math.round(ms / 1000)} s`);
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

async function iniciar(servidor) {
  sesiones.delete(servidor.id);
  await postar(servidor, {
    jsonrpc: '2.0', id: idInterno++, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'letxinet-mcp-bridge', version: '1.1.6' } },
  }, 30000);
  try { await postar(servidor, { jsonrpc: '2.0', method: 'notifications/initialized' }, 10000); } catch { /* opcional */ }
  servidor.listo = true;
}

async function pedir(servidor, method, params, ms) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      if (!servidor.listo) await iniciar(servidor);
      const r = await postar(servidor, { jsonrpc: '2.0', id: idInterno++, method, params }, ms);
      if (r && r.error && /session/i.test(JSON.stringify(r.error)) && intento === 0) { servidor.listo = false; continue; }
      return r;
    } catch (e) {
      servidor.listo = false;
      if (!(e.sesion && intento === 0)) throw e;
    }
  }
  return null;
}

// ---- Catalogo combinado ----
let rutas = new Map(); // nombre de herramienta -> servidor
let catalogo = null;

async function cargarCatalogo() {
  const nuevas = new Map();
  const herramientas = [];
  for (const s of SERVIDORES) {
    try {
      const r = await pedir(s, 'tools/list', {}, 60000);
      for (const t of (r && r.result && r.result.tools) || []) {
        if (nuevas.has(t.name)) { log(`herramienta repetida ${t.name}: se usa la de ${nuevas.get(t.name).nombre}`); continue; }
        nuevas.set(t.name, s);
        herramientas.push(t);
      }
    } catch (e) {
      log(`${s.nombre} no responde (${e.message}); se omiten sus herramientas`);
    }
  }
  if (herramientas.length) { rutas = nuevas; catalogo = herramientas; }
  return herramientas;
}

// ---- Servidor MCP por stdio (JSON por linea) ----
function enviar(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
const ok = (id, result) => enviar({ jsonrpc: '2.0', id, result });
const mal = (id, code, message) => enviar({ jsonrpc: '2.0', id, error: { code, message } });

async function atender(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notificaciones: no llevan respuesta
  try {
    if (method === 'initialize') {
      return ok(id, {
        protocolVersion: (params && params.protocolVersion) || '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `letxinet-${SELECCION === 'both' || SELECCION === 'juntos' ? 'ambos' : SELECCION}`, version: '1.1.5' },
        instructions: 'Herramientas de LetXinet Suite: busqueda academica y PDF (V11) y mapas y rutas de OpenStreetMap (OSM). En las busquedas indica siempre las fuentes (por ejemplo sources: ["renati"]).',
      });
    }
    if (method === 'ping') return ok(id, {});
    if (method === 'tools/list') {
      const lista = await cargarCatalogo();
      return ok(id, { tools: lista });
    }
    if (method === 'tools/call') {
      const nombre = params && params.name;
      if (!catalogo || !rutas.has(nombre)) await cargarCatalogo();
      const s = rutas.get(nombre);
      if (!s) return ok(id, { content: [{ type: 'text', text: `Herramienta desconocida o servicio caido: ${nombre}` }], isError: true });
      try {
        const r = await pedir(s, 'tools/call', { name: nombre, arguments: (params && params.arguments) || {} }, TIMEOUT_MS);
        if (r && r.error) return ok(id, { content: [{ type: 'text', text: `${s.nombre}: ${r.error.message || JSON.stringify(r.error)}` }], isError: true });
        return ok(id, (r && r.result) || { content: [], isError: true });
      } catch (e) {
        return ok(id, { content: [{ type: 'text', text: `${s.nombre} no disponible: ${e.message}. Revisa que el servicio de LetXinet Suite este en marcha.` }], isError: true });
      }
    }
    if (method === 'resources/list') return ok(id, { resources: [] });
    if (method === 'prompts/list') return ok(id, { prompts: [] });
    return mal(id, -32601, `Metodo no soportado: ${method}`);
  } catch (e) {
    return mal(id, -32603, e.message);
  }
}

let resto = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (trozo) => {
  resto += trozo;
  let i;
  while ((i = resto.indexOf('\n')) >= 0) {
    const linea = resto.slice(0, i).trim();
    resto = resto.slice(i + 1);
    if (!linea) continue;
    let msg;
    try { msg = JSON.parse(linea); } catch { log('linea no valida ignorada'); continue; }
    atender(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
log(`listo (seleccion=${SELECCION}; ${SERVIDORES.map((s) => `${s.nombre}=${s.url}`).join(', ')})`);
