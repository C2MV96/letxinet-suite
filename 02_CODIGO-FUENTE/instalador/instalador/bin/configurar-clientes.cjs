#!/usr/bin/env node
// configurar-clientes.cjs (LetXinet Suite 1.1.5)
// Configura LetXinet Suite en Claude Code, Claude Desktop y OpenCode para el usuario actual.
//
// Uso:  node configurar-clientes.cjs [--modo separados|juntos|ambos] [--clientes claude-code,claude-desktop,opencode]
//                                    [--silencioso] [--sin-skills] [--mantener-addon] [--prueba]
//   separados (por defecto): letxinet-v11 y letxinet-osm por separado, mas letxinet-markitdown y letxinet-jobs
//   juntos:   un solo servidor letxinet-ambos (V11 + OSM), mas letxinet-markitdown y letxinet-jobs
//   ambos:    los dos estilos a la vez
// Sin --clientes, configura los clientes que encuentre instalados. Cada archivo se respalda antes de cambiarlo
// (.bak-letxinet-FECHA). Solo toca los servidores de LetXinet; el resto de la configuracion queda igual.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync, spawn } = require('child_process');
const readline = require('readline');

const APP = path.resolve(__dirname, '..');
const HOME = os.homedir();
const APPDATA = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const SELLO = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const barra = (p) => p.replace(/\\/g, '/');

const MCP = path.join(APP, 'bin', 'mcp');
const PUENTE = barra(path.join(MCP, 'letxinet-mcp-bridge.cjs'));
const TAREAS = barra(path.join(MCP, 'letxinet-jobs-bridge.cjs'));
const MARKITDOWN = barra(path.join(APP, 'MarkItDown', 'API', 'mcp-adapter', 'markitdown-mcp.js'));
const LATEX_ADDON = barra(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'LetXinet Addon', 'latex-mcp-local', 'dist', 'index.js'));
const NUESTROS = ['letxinet-v11', 'letxinet-osm', 'letxinet-ambos', 'letxinet-markitdown', 'letxinet-jobs'];

// ---------- argumentos ----------
const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || '') : null; };
const bandera = (n) => args.includes(n);
let modo = (opcion('--modo') || '').toLowerCase();
const silencioso = bandera('--silencioso');

function log(m) { console.log(m); }
function aviso(m) { console.log('AVISO ' + m); }

// ---------- utilidades de archivos ----------
function leerJson(p, porDefecto) {
  if (!fs.existsSync(p)) return porDefecto;
  const t = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  if (!t.trim()) return porDefecto;
  try { return JSON.parse(t); } catch {
    // opencode admite JSONC: se quitan comentarios de linea y comas finales
    return JSON.parse(t.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
  }
}
function guardarJson(p, datos) {
  const nuevo = JSON.stringify(datos, null, 2) + '\n';
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '') === nuevo) return false;
    fs.copyFileSync(p, `${p}.bak-letxinet-${SELLO}`);
  } else {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }
  fs.writeFileSync(p, nuevo, 'utf8');
  return true;
}
function copiarCarpeta(origen, destino) {
  if (!fs.existsSync(origen)) return 0;
  let n = 0;
  for (const d of fs.readdirSync(origen, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    fs.cpSync(path.join(origen, d.name), path.join(destino, d.name), { recursive: true, force: true });
    n++;
  }
  return n;
}

// ---------- definiciones de servidores ----------
function servidoresDeseados(estilo) {
  // estilo: 'claude-code' (http + stdio), 'claude-desktop' (solo stdio), 'opencode'
  const nodeStdio = (archivo, env) => ({ type: 'stdio', command: 'node', args: [archivo], env: env || {} });
  const s = {};
  const separados = modo === 'separados' || modo === 'ambos';
  const juntos = modo === 'juntos' || modo === 'ambos';
  if (separados) {
    if (estilo === 'claude-desktop') {
      s['letxinet-v11'] = nodeStdio(PUENTE, { LETXINET_SELECCION: 'v11' });
      s['letxinet-osm'] = nodeStdio(PUENTE, { LETXINET_SELECCION: 'osm' });
    } else {
      s['letxinet-v11'] = { type: 'http', url: 'http://127.0.0.1:4003/api/mcp' };
      s['letxinet-osm'] = { type: 'http', url: 'http://127.0.0.1:7082/mcp' };
    }
  }
  if (juntos) s['letxinet-ambos'] = nodeStdio(PUENTE, { LETXINET_SELECCION: 'ambos' });
  s['letxinet-markitdown'] = nodeStdio(MARKITDOWN, { MARKITDOWN_API_URL: 'http://127.0.0.1:7860' });
  s['letxinet-jobs'] = nodeStdio(TAREAS, { GATEWAY_URL: 'http://127.0.0.1:43123', LETXIPU_LOCAL_URL: 'http://127.0.0.1:4003' });
  return s;
}

function aplicarServidores(mapa, deseados, formato) {
  // formato: 'claude' (type http/stdio), 'claude-desktop' (command/args/env), 'opencode-v1', 'opencode-v2'
  for (const n of NUESTROS) if (!(n in deseados)) delete mapa[n];
  for (const [n, d] of Object.entries(deseados)) {
    if (formato === 'claude') mapa[n] = d.type === 'http' ? { type: 'http', url: d.url } : { type: 'stdio', command: d.command, args: d.args, env: d.env };
    else if (formato === 'claude-desktop') mapa[n] = { command: d.command, args: d.args, env: d.env };
    else {
      const e = d.type === 'http' ? { type: 'remote', url: d.url } : { type: 'local', command: [d.command, ...d.args], environment: d.env };
      if (formato === 'opencode-v1') e.enabled = true;
      mapa[n] = e;
    }
  }
}

// ---------- Claude Code ----------
function claudeCode() {
  const cj = path.join(HOME, '.claude.json');
  const cfg = leerJson(cj, {});
  cfg.mcpServers = cfg.mcpServers || {};
  aplicarServidores(cfg.mcpServers, servidoresDeseados('claude-code'), 'claude');
  const c1 = guardarJson(cj, cfg);
  const st = path.join(HOME, '.claude', 'settings.json');
  const s = leerJson(st, {});
  s.env = s.env || {};
  if (!s.env.MCP_TOOL_TIMEOUT || Number(s.env.MCP_TOOL_TIMEOUT) < 300000) s.env.MCP_TOOL_TIMEOUT = '300000';
  const c2 = guardarJson(st, s);
  let sk = 0;
  if (!bandera('--sin-skills')) sk = copiarCarpeta(path.join(__dirname, 'clientes', 'skills'), path.join(HOME, '.claude', 'skills'));
  log(`OK  Claude Code: ${Object.keys(servidoresDeseados('claude-code')).join(', ')}${c1 || c2 ? '' : ' (sin cambios)'}; skills: ${sk}; MCP_TOOL_TIMEOUT=300000`);
}

// ---------- Claude Desktop ----------
function claudeDesktop() {
  const p = path.join(APPDATA, 'Claude', 'claude_desktop_config.json');
  const cfg = leerJson(p, {});
  cfg.mcpServers = cfg.mcpServers || {};
  const deseados = servidoresDeseados('claude-desktop');
  const notas = [];
  if (!bandera('--mantener-addon')) {
    // El puente del Addon (letxinet-gateway) depende del Desktop abierto y tarda unos 30 s por llamada;
    // markitdown-api duplica letxinet-markitdown. Se reemplazan por los de la Suite.
    for (const viejo of ['letxinet-gateway', 'markitdown-api']) {
      const v = cfg.mcpServers[viejo];
      if (v && JSON.stringify(v).match(/mcp-bridge\.cjs|markitdown-mcp\.js/)) { delete cfg.mcpServers[viejo]; notas.push(`quitado ${viejo}`); }
    }
  }
  aplicarServidores(cfg.mcpServers, deseados, 'claude-desktop');
  const lat = cfg.mcpServers['latex-mcp-local'];
  if (lat && /D:[\\/]+OTROS/i.test(JSON.stringify(lat)) && fs.existsSync(LATEX_ADDON)) { lat.args = [LATEX_ADDON]; notas.push('latex-mcp-local apunta al Addon'); }
  const c = guardarJson(p, cfg);
  log(`OK  Claude Desktop: ${Object.keys(deseados).join(', ')}${notas.length ? ' (' + notas.join('; ') + ')' : ''}${c ? '' : ' (sin cambios)'}. Reinicia Claude Desktop.`);
}

// ---------- OpenCode ----------
function versionOpenCode() {
  try { return execSync('opencode --version', { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* sin CLI */ }
  const exe = path.join(LOCALAPPDATA, 'Programs', '@opencode-aidesktop', 'OpenCode.exe');
  if (fs.existsSync(exe)) {
    try {
      return execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${exe}').VersionInfo.ProductVersion`], { encoding: 'utf8', timeout: 20000 }).trim();
    } catch { /* sin version */ }
  }
  return '';
}
function opencode() {
  const ver = versionOpenCode();
  const mayor = parseInt((ver.match(/\d+/) || ['1'])[0], 10);
  const formato = mayor >= 2 ? 'opencode-v2' : 'opencode-v1';
  const destinos = [path.join(HOME, '.config', 'opencode', 'opencode.json')];
  const desktop = path.join(APPDATA, 'OpenCode', 'opencode.json');
  if (fs.existsSync(desktop)) destinos.push(desktop);
  for (const p of destinos) {
    const cfg = leerJson(p, { $schema: 'https://opencode.ai/config.json' });
    cfg.mcp = cfg.mcp || {};
    const mapa = formato === 'opencode-v2' ? (cfg.mcp.servers = cfg.mcp.servers || {}) : cfg.mcp;
    // nombres antiguos que apuntaban a rutas de desarrollo en D: o al puerto 3000
    for (const viejo of ['letxipu-v11-local', 'letxinet-gateway']) {
      const v = mapa[viejo];
      if (v && JSON.stringify(v).match(/D:[\\/]+OTROS|127\.0\.0\.1:4003|:3000/)) delete mapa[viejo];
    }
    const lat = mapa['latex-mcp-local'];
    if (lat && /D:[\\/]+OTROS/i.test(JSON.stringify(lat)) && fs.existsSync(LATEX_ADDON)) lat.command = ['node', LATEX_ADDON];
    aplicarServidores(mapa, servidoresDeseados('opencode'), formato);
    const c = guardarJson(p, cfg);
    log(`OK  OpenCode ${ver || '(version no detectada)'} [${formato === 'opencode-v2' ? 'formato V2: mcp.servers' : 'formato V1: mcp'}]: ${p}${c ? '' : ' (sin cambios)'}`);
  }
  let sk = 0;
  if (!bandera('--sin-skills')) sk = copiarCarpeta(path.join(__dirname, 'clientes', 'opencode-skills'), path.join(HOME, '.config', 'opencode', 'skills'));
  log(`    skills de OpenCode: ${sk} (OpenCode tambien lee las de ~/.claude/skills). Reinicia OpenCode.`);
  if (fs.existsSync(path.join(HOME, '.opencode.json'))) aviso('~/.opencode.json es del formato antiguo de OpenCode (servidor V3 en Hugging Face); OpenCode actual no lo usa.');
}

// ---------- comprobacion ----------
async function comprobar() {
  const urls = [['V11', 'http://127.0.0.1:4003/health'], ['OSM', 'http://127.0.0.1:7082/'], ['MarkItDown', 'http://127.0.0.1:7860/'], ['Desktop (opcional)', 'http://127.0.0.1:43123/health']];
  for (const [n, u] of urls) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(5000) }); log(`    ${n}: ${r.ok ? 'responde' : 'HTTP ' + r.status}`); } catch { log(`    ${n}: no responde`); }
  }
  for (const sel of ['ambos']) {
    const n = await new Promise((res) => {
      const p = spawn(process.execPath, [PUENTE.replace(/\//g, path.sep)], { env: { ...process.env, LETXINET_SELECCION: sel } });
      let buf = '';
      const fin = setTimeout(() => { p.kill(); res(-1); }, 20000);
      p.stdout.on('data', (d) => {
        buf += d;
        const linea = buf.split('\n').find((l) => l.includes('"id":2'));
        if (linea) { clearTimeout(fin); p.kill(); try { res(JSON.parse(linea).result.tools.length); } catch { res(-1); } }
      });
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    });
    log(`    puente letxinet-ambos: ${n >= 0 ? n + ' herramientas' : 'no respondio'}`);
  }
}

async function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = await new Promise((res) => rl.question(texto, res));
  rl.close();
  return r.trim();
}

(async () => {
  log(`LetXinet Suite: configuracion de clientes (instalacion en ${APP})`);
  if (!fs.existsSync(PUENTE)) { aviso(`no se encuentra ${PUENTE}; instala o repara LetXinet Suite 1.1.5`); process.exit(1); }
  if (modo && !['separados', 'juntos', 'ambos'].includes(modo)) {
    aviso(`modo no valido: "${modo}" (usa separados, juntos o ambos)`);
    process.exit(2);
  }
  if (!modo) {
    if (silencioso || !process.stdin.isTTY) modo = 'separados';
    else {
      const r = await preguntar('Modo: 1 = separados (V11 y OSM aparte, recomendado), 2 = juntos (un solo servidor), 3 = ambos [1]: ');
      modo = r === '2' ? 'juntos' : r === '3' ? 'ambos' : 'separados';
    }
  }
  const pedidos = (opcion('--clientes') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hay = {
    'claude-code': fs.existsSync(path.join(HOME, '.claude.json')) || fs.existsSync(path.join(HOME, '.claude')),
    'claude-desktop': fs.existsSync(path.join(APPDATA, 'Claude')),
    opencode: fs.existsSync(path.join(LOCALAPPDATA, 'Programs', '@opencode-aidesktop')) || fs.existsSync(path.join(HOME, '.config', 'opencode')) || fs.existsSync(path.join(APPDATA, 'OpenCode')),
  };
  const clientes = pedidos.length ? pedidos : Object.keys(hay).filter((k) => hay[k]);
  log(`Modo: ${modo}. Clientes: ${clientes.join(', ') || 'ninguno encontrado'}`);
  const acciones = { 'claude-code': claudeCode, 'claude-desktop': claudeDesktop, opencode };
  let fallos = 0;
  for (const c of clientes) {
    if (!acciones[c]) { aviso(`cliente desconocido: ${c}`); continue; }
    try { acciones[c](); } catch (e) { fallos++; aviso(`${c}: ${e.message}`); }
  }
  log('Comprobacion rapida:');
  await comprobar();
  log(fallos ? `Terminado con ${fallos} error(es).` : 'Listo. Reinicia los clientes para que tomen la configuracion.');
  if (!silencioso && process.stdin.isTTY) await preguntar('Pulsa Enter para cerrar...');
  process.exit(fallos ? 1 : 0);
})();
