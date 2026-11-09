// Habla con un servidor MCP por stdio (los puentes de bin\mcp). Envia mensajes en orden y junta las respuestas.
'use strict';
const { spawn } = require('child_process');

function sesionStdio(script, env = {}) {
  const p = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const esperando = new Map();
  const extra = [];
  let resto = '';
  let stderr = '';
  p.stderr.on('data', (d) => { stderr += d; });
  p.stdout.on('data', (d) => {
    resto += d;
    let i;
    while ((i = resto.indexOf('\n')) >= 0) {
      const l = resto.slice(0, i).trim(); resto = resto.slice(i + 1);
      if (!l) continue;
      let m; try { m = JSON.parse(l); } catch { extra.push(l); continue; }
      const w = esperando.get(m.id);
      if (w) { esperando.delete(m.id); w(m); } else extra.push(m);
    }
  });
  let n = 1;
  return {
    pedir(method, params, ms = 120000) {
      const id = n++;
      return new Promise((ok, mal) => {
        const reloj = setTimeout(() => { esperando.delete(id); mal(new Error(`${method} sin respuesta en ${ms / 1000} s`)); }, ms);
        esperando.set(id, (m) => { clearTimeout(reloj); ok(m); });
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    notificar(method, params) { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); },
    crudo(texto) { p.stdin.write(texto + '\n'); },
    extra,
    stderr: () => stderr,
    cerrar() { try { p.stdin.end(); p.kill(); } catch { /* ya cerrado */ } },
  };
}

async function iniciarStdio(s) {
  return s.pedir('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'letxinet-pool', version: '1.1.2' } }, 30000);
}

module.exports = { sesionStdio, iniciarStdio };
