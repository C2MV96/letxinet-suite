// h06: puentes MCP por stdio (letxinet-mcp-bridge en sus 3 modos y letxinet-jobs-bridge).
'use strict';
const path = require('path');
const { crearHarness } = require('./lib/comun.cjs');
const { sesionStdio, iniciarStdio } = require('./lib/stdio-mcp.cjs');

const APP = process.env.LETXINET_APP || 'C:\\Program Files\\LetXinet Suite';
const PUENTE = path.join(APP, 'bin', 'mcp', 'letxinet-mcp-bridge.cjs');
const JOBS = path.join(APP, 'bin', 'mcp', 'letxinet-jobs-bridge.cjs');
const texto = (m) => ((m && m.result && m.result.content) || []).map((c) => c.text || '').join(' ');

(async () => {
  const h = crearHarness('h06', 'Puentes MCP por stdio');

  for (const [sel, minimo] of [['ambos', 50], ['v11', 25], ['osm', 25]]) {
    const s = sesionStdio(PUENTE, { LETXINET_SELECCION: sel });
    await h.prueba(`Puente ${sel}`, 'initialize', async () => {
      const r = await iniciarStdio(s);
      return { detalle: `${r.result.serverInfo.name} ${r.result.serverInfo.version}` };
    });
    await h.prueba(`Puente ${sel}`, 'tools/list', async () => {
      const r = await s.pedir('tools/list', {}, 90000);
      const n = r.result.tools.length;
      h.metrica(`puente_${sel}_herramientas`, n);
      if (n < minimo) throw new Error(`${n} herramientas (minimo ${minimo})`);
      const nombres = r.result.tools.map((t) => t.name);
      if (new Set(nombres).size !== nombres.length) return { estado: 'AVISO', detalle: 'nombres repetidos' };
      return { detalle: `${n} herramientas` };
    });
    if (sel !== 'v11') await h.prueba(`Puente ${sel}`, 'geo_distance', async () => {
      const r = await s.pedir('tools/call', { name: 'geo_distance', arguments: { from: { latitude: -9.0745, longitude: -78.5936 }, to: { latitude: -9.129, longitude: -78.517 } } });
      if (r.result.isError) throw new Error(texto(r));
      return { detalle: texto(r).replace(/\s+/g, ' ').slice(0, 80) };
    });
    if (sel !== 'osm') await h.prueba(`Puente ${sel}`, 'list_sources', async () => {
      const r = await s.pedir('tools/call', { name: 'list_sources', arguments: {} });
      if (r.result.isError) throw new Error(texto(r));
      return { detalle: `${(texto(r).match(/"id"/g) || []).length} fuentes` };
    });
    if (sel === 'v11') await h.prueba('Puente v11', 'no expone herramientas de OSM', async () => {
      const r = await s.pedir('tools/call', { name: 'geo_distance', arguments: {} });
      return r.result.isError ? { detalle: 'geo_distance rechazada como desconocida' } : { estado: 'AVISO', detalle: 'el modo v11 acepto una herramienta de OSM' };
    });
    if (sel === 'ambos') {
      await h.prueba('Puente ambos', 'ping', async () => { const r = await s.pedir('ping', {}); return r.result ? { detalle: 'ok' } : { estado: 'AVISO', detalle: JSON.stringify(r) }; });
      await h.prueba('Puente ambos', 'notificaciones sin respuesta', async () => {
        const antes = s.extra.length;
        s.notificar('notifications/initialized', {});
        s.notificar('notifications/cancelled', { requestId: 99 });
        await new Promise((r) => setTimeout(r, 1500));
        return s.extra.length === antes ? { detalle: 'no respondio a las notificaciones (correcto)' } : { estado: 'FALLA', detalle: 'respondio a una notificacion' };
      });
      await h.prueba('Puente ambos', 'linea JSON invalida', async () => {
        s.crudo('{esto no es json');
        const r = await s.pedir('ping', {});
        return r.result ? { detalle: 'la ignora y sigue respondiendo' } : { estado: 'FALLA', detalle: 'dejo de responder' };
      });
      await h.prueba('Puente ambos', 'metodo no soportado', async () => {
        const r = await s.pedir('sampling/createMessage', {});
        return r.error ? { detalle: `error ${r.error.code}` } : { estado: 'AVISO', detalle: 'no devolvio error' };
      });
      await h.prueba('Puente ambos', 'resources/list y prompts/list', async () => {
        const a = await s.pedir('resources/list', {}); const b = await s.pedir('prompts/list', {});
        return a.result && b.result ? { detalle: 'listas vacias' } : { estado: 'AVISO', detalle: 'respuesta inesperada' };
      });
    }
    s.cerrar();
  }

  // Degradado: OSM apuntando a un puerto sin servicio
  const d = sesionStdio(PUENTE, { LETXINET_SELECCION: 'ambos', LETXINET_OSM_URL: 'http://127.0.0.1:59999/mcp' });
  await h.prueba('Puente degradado', 'OSM caido: expone solo V11', async () => {
    await iniciarStdio(d);
    const r = await d.pedir('tools/list', {}, 90000);
    const n = r.result.tools.length;
    return n >= 25 && n < 50 ? { detalle: `${n} herramientas (solo V11)` } : { estado: 'FALLA', detalle: `${n} herramientas` };
  });
  await h.prueba('Puente degradado', 'llamar a OSM caido da error claro', async () => {
    const r = await d.pedir('tools/call', { name: 'geo_distance', arguments: {} });
    return r.result && r.result.isError ? { detalle: texto(r).slice(0, 100) } : { estado: 'FALLA', detalle: 'no devolvio error' };
  });
  d.cerrar();

  // Puente de tareas largas
  const j = sesionStdio(JOBS, {});
  await h.prueba('Puente jobs', 'initialize y tools/list', async () => {
    await iniciarStdio(j);
    const r = await j.pedir('tools/list', {});
    h.metrica('puente_jobs_herramientas', r.result.tools.length);
    return { detalle: r.result.tools.map((t) => t.name).join(', ') };
  });
  await h.prueba('Puente jobs', 'letxipu_local_call (directo a V11)', async () => {
    const r = await j.pedir('tools/call', { name: 'letxipu_local_call', arguments: { tool: 'list_sources', arguments: {} } }, 120000);
    if (r.result.isError) throw new Error(texto(r).slice(0, 200));
    return { detalle: `${texto(r).length} caracteres` };
  });
  await h.prueba('Puente jobs', 'gateway_list_tools (necesita el Desktop abierto)', async () => {
    const r = await j.pedir('tools/call', { name: 'gateway_list_tools', arguments: {} }, 60000);
    if (r.result.isError) {
      return /ECONNREFUSED|Desktop/i.test(texto(r)) ? { estado: 'OMITIDA', detalle: 'Desktop cerrado; el mensaje lo explica' } : { estado: 'FALLA', detalle: texto(r).slice(0, 160) };
    }
    return { detalle: `${(texto(r).match(/"name"/g) || []).length} herramientas del gateway` };
  });
  await h.prueba('Puente jobs', 'gateway_call + gateway_poll (tarea en segundo plano)', async () => {
    const r = await j.pedir('tools/call', { name: 'gateway_call', arguments: { tool: 'geo_distance', arguments: { from: { latitude: -9.07, longitude: -78.59 }, to: { latitude: -9.13, longitude: -78.52 } } } }, 120000);
    if (r.result.isError) return /ECONNREFUSED|Desktop/i.test(texto(r)) ? { estado: 'OMITIDA', detalle: 'Desktop cerrado' } : { estado: 'FALLA', detalle: texto(r).slice(0, 160) };
    return { detalle: `respuesta directa: ${texto(r).replace(/\s+/g, ' ').slice(0, 80)}` };
  });
  await h.prueba('Puente jobs', 'tarea larga: letxipu_local_call smart_search + gateway_poll', async () => {
    const r = await j.pedir('tools/call', { name: 'letxipu_local_call', arguments: { tool: 'smart_search', arguments: { query: 'dengue Chimbote', maxResults: 5, fastMode: true } } }, 120000);
    if (r.result.isError) throw new Error(texto(r).slice(0, 200));
    const tarea = (texto(r).match(/task_id"?\s*[:=]\s*"?([\w.-]+)/i) || [])[1];
    if (!tarea) return { detalle: `respondio sin tarea: ${texto(r).replace(/\s+/g, ' ').slice(0, 80)}` };
    for (let i = 0; i < 60; i++) {
      const p = await j.pedir('tools/call', { name: 'gateway_poll', arguments: { task_id: tarea } });
      if (/STATUS=DONE/.test(texto(p))) return { detalle: `tarea completada tras ${i * 3} s de sondeo` };
      if (/STATUS=(ERROR|FAILED)/i.test(texto(p))) throw new Error(texto(p).slice(0, 200));
      await new Promise((x) => setTimeout(x, 3000));
    }
    return { estado: 'AVISO', detalle: `la tarea ${tarea} no termino en 3 minutos` };
  });
  await h.prueba('Puente jobs', 'descripciones al dia (puerto y numero de herramientas)', async () => {
    const r = await j.pedir('tools/list', {});
    const desc = r.result.tools.map((t) => t.description || '').join(' ');
    const viejos = [/127\.0\.0\.1:3000/.test(desc) && 'menciona el puerto 3000', /56 tools/.test(desc) && 'dice 56 herramientas'].filter(Boolean);
    return viejos.length ? { estado: 'AVISO', detalle: `la descripcion que ve la IA esta desactualizada: ${viejos.join(', ')}` } : { detalle: 'descripciones correctas' };
  });
  j.cerrar();
  h.terminar();
})();
