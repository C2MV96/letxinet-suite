// Utilidades comunes del pool de harnesses: registro de pruebas, clasificacion de fallos y salida JSON.
'use strict';
const fs = require('fs');
const path = require('path');

// Errores que vienen de la red externa (bloqueos, TLS, servidores caidos), no de LetXinet.
// Un ECONNREFUSED a 127.0.0.1 no entra: es un servicio local caido y cuenta como falla.
const PATRON_RED = /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|TLS|SEC_E|certificate|handshake|fetch failed|timed? ?out|timeout|sin respuesta|no respondi|429|Too Many|502|503|504|Bad Gateway|Service Unavailable|Gateway Time|overpass|OSRM|rate limit/i;

const RAIZ = path.resolve(__dirname, '..');
const FIXTURES = path.join(RAIZ, 'fixtures');

function salida() {
  const d = process.env.POOL_SALIDA || path.join(RAIZ, 'resultados', 'suelto');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function crearHarness(id, titulo) {
  const pruebas = [];
  const metricas = {};
  const t0 = Date.now();

  // fn devuelve { estado?, detalle?, datos? } o lanza; estado por defecto OK.
  async function prueba(area, nombre, fn, opciones = {}) {
    const ini = Date.now();
    let reg;
    try {
      const r = (await fn()) || {};
      reg = { estado: r.estado || 'OK', detalle: r.detalle || '', datos: r.datos };
    } catch (e) {
      const msg = String((e && e.message) || e);
      const deRed = opciones.dependeDeRed && PATRON_RED.test(msg);
      reg = { estado: deRed ? 'RED' : 'FALLA', detalle: msg.slice(0, 400) };
    }
    reg.ms = Date.now() - ini;
    pruebas.push({ area, nombre, ...reg });
    const marca = { OK: 'OK   ', AVISO: 'AVISO', FALLA: 'FALLA', RED: 'RED  ', OMITIDA: 'OMIT ' }[reg.estado] || reg.estado;
    process.stdout.write(`[${id}] [${marca}] ${area} | ${nombre} | ${String(reg.detalle).slice(0, 120)} (${reg.ms} ms)\n`);
    return reg;
  }

  // Para herramientas MCP: convierte el resultado de ClienteMcp.llamar en estado.
  function evaluar(r, comprobar, opciones = {}) {
    if (!r.ok) {
      const msg = r.error || 'error sin detalle';
      if (opciones.dependeDeRed && PATRON_RED.test(msg)) return { estado: 'RED', detalle: msg.slice(0, 300) };
      if (opciones.errorEsperado) return { estado: 'OK', detalle: `error esperado: ${msg.slice(0, 200)}` };
      throw new Error(msg);
    }
    if (opciones.errorEsperado) return { estado: 'AVISO', detalle: 'se esperaba un error y respondio bien' };
    if (comprobar) {
      const c = comprobar(r);
      if (c === true || c === undefined) return { estado: 'OK', detalle: `${r.ms} ms` };
      if (typeof c === 'string') return { estado: 'OK', detalle: c };
      return c;
    }
    return { estado: 'OK', detalle: `${r.ms} ms` };
  }

  function metrica(k, v) { metricas[k] = v; }

  function terminar() {
    const resumen = { OK: 0, AVISO: 0, FALLA: 0, RED: 0, OMITIDA: 0 };
    for (const p of pruebas) resumen[p.estado] = (resumen[p.estado] || 0) + 1;
    const res = { id, titulo, inicio: new Date(t0).toISOString(), duracion_ms: Date.now() - t0, resumen, metricas, pruebas };
    fs.writeFileSync(path.join(salida(), `${id}.json`), JSON.stringify(res, null, 2));
    process.stdout.write(`[${id}] TERMINADO: ${resumen.OK} OK, ${resumen.AVISO} avisos, ${resumen.FALLA} fallas, ${resumen.RED} red externa (${Math.round(res.duracion_ms / 1000)} s)\n`);
    return res;
  }

  return { prueba, evaluar, metrica, terminar, pruebas };
}

// Cuenta resultados en la respuesta de search/smart_search de V11.
function resultadosBusqueda(r) {
  const j = r.json || {};
  const d = j.data || j;
  const lista = d.sources || d.results || d.papers || (Array.isArray(d) ? d : []);
  return Array.isArray(lista) ? lista : [];
}

async function http(url, opciones = {}, ms = 30000) {
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), ms);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...opciones, signal: ctl.signal });
    const texto = await r.text();
    let json = null; try { json = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: r.status, ok: r.ok, texto, json, ms: Date.now() - t0, headers: r.headers };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `sin respuesta en ${ms / 1000} s (${url})` : `${e.message}${e.cause ? ' ' + e.cause.code : ''} (${url})`);
  } finally {
    clearTimeout(reloj);
  }
}

// Ejecuta tareas con un limite de concurrencia.
async function enParalelo(items, limite, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

function percentil(valores, p) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
}

module.exports = { crearHarness, resultadosBusqueda, http, enParalelo, percentil, PATRON_RED, FIXTURES, RAIZ };
