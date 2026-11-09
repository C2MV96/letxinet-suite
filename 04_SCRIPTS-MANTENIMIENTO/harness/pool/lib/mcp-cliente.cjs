// Cliente MCP por HTTP para los harnesses del pool (mismo protocolo que bin\mcp\letxinet-mcp-bridge.cjs).
'use strict';

const URLS = {
  v11: process.env.LETXINET_V11_URL || 'http://127.0.0.1:4003/api/mcp',
  osm: process.env.LETXINET_OSM_URL || 'http://127.0.0.1:7082/mcp',
};

class ClienteMcp {
  constructor(id, url) {
    this.id = id;
    this.url = url || URLS[id];
    this.sesion = null;
    this.listo = false;
    this.n = 1;
  }

  async postar(cuerpo, ms) {
    const cab = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.sesion) cab['Mcp-Session-Id'] = this.sesion;
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(this.url, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo), signal: ctl.signal });
      const nueva = r.headers.get('mcp-session-id');
      if (nueva) this.sesion = nueva;
      const texto = await r.text();
      if (!r.ok && (r.status === 400 || r.status === 404) && this.sesion && cuerpo.method !== 'initialize') {
        this.sesion = null;
        const e = new Error(`sesion caducada (HTTP ${r.status})`);
        e.sesionCaducada = true;
        throw e;
      }
      if (!texto.trim()) return null;
      if (texto.trimStart().startsWith('{')) return JSON.parse(texto);
      const datos = texto.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
      return datos.length ? JSON.parse(datos[datos.length - 1]) : null;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`sin respuesta en ${Math.round(ms / 1000)} s`);
      throw e;
    } finally {
      clearTimeout(reloj);
    }
  }

  async iniciar() {
    this.sesion = null;
    await this.postar({
      jsonrpc: '2.0', id: this.n++, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'letxinet-pool', version: '1.1.2' } },
    }, 30000);
    try { await this.postar({ jsonrpc: '2.0', method: 'notifications/initialized' }, 10000); } catch { /* opcional */ }
    this.listo = true;
  }

  async pedir(method, params, ms = 120000) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        if (!this.listo) await this.iniciar();
        return await this.postar({ jsonrpc: '2.0', id: this.n++, method, params }, ms);
      } catch (e) {
        this.listo = false;
        if (!(e.sesionCaducada && intento === 0)) throw e;
      }
    }
    return null;
  }

  async herramientas() {
    const r = await this.pedir('tools/list', {}, 60000);
    return (r && r.result && r.result.tools) || [];
  }

  // Devuelve { ok, ms, texto, json, error } sin lanzar excepciones.
  async llamar(nombre, args, ms = 180000) {
    const t0 = Date.now();
    try {
      const r = await this.pedir('tools/call', { name: nombre, arguments: args || {} }, ms);
      const dur = Date.now() - t0;
      if (!r) return { ok: false, ms: dur, error: 'respuesta vacia' };
      if (r.error) return { ok: false, ms: dur, error: r.error.message || JSON.stringify(r.error) };
      const res = r.result || {};
      const texto = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      let json = null;
      if (res.structuredContent) json = res.structuredContent;
      else { try { json = JSON.parse(texto); } catch { /* texto libre */ } }
      // V11 suele responder isError=false con {"success": false, "error": ...} en el texto
      const fallo = res.isError || (json && json.success === false);
      const error = fallo ? String((json && json.error) || texto).slice(0, 300) : null;
      return { ok: !fallo, ms: dur, texto, json, error };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, error: e.message };
    }
  }
}

module.exports = { ClienteMcp, URLS };
