// h07: configurador de clientes (en un perfil falso) y configuraciones reales de esta PC (solo lectura).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { crearHarness } = require('./lib/comun.cjs');

const APP = process.env.LETXINET_APP || 'C:\\Program Files\\LetXinet Suite';
// LETXINET_CONF permite probar otra copia del configurador (por ejemplo la de 02_CODIGO-FUENTE)
const CONF = process.env.LETXINET_CONF || path.join(APP, 'bin', 'configurar-clientes.cjs');
const NUESTROS = ['letxinet-v11', 'letxinet-osm', 'letxinet-ambos', 'letxinet-markitdown', 'letxinet-jobs'];

function perfilFalso() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'letxinet-perfil-'));
  const ap = path.join(base, 'AppData', 'Roaming');
  const lap = path.join(base, 'AppData', 'Local');
  fs.mkdirSync(path.join(ap, 'Claude'), { recursive: true });
  fs.mkdirSync(path.join(ap, 'OpenCode'), { recursive: true });
  fs.mkdirSync(path.join(base, '.config', 'opencode'), { recursive: true });
  fs.mkdirSync(lap, { recursive: true });
  // configuraciones previas con servidores ajenos y entradas viejas rotas
  fs.writeFileSync(path.join(base, '.claude.json'), JSON.stringify({ numStartups: 7, projects: { x: { a: 1 } }, mcpServers: { otro: { type: 'stdio', command: 'otro.exe' } } }, null, 2));
  fs.writeFileSync(path.join(ap, 'Claude', 'claude_desktop_config.json'), JSON.stringify({ mcpServers: {
    'omni-word-mcp': { command: 'python', args: ['x'] },
    'letxinet-gateway': { command: 'node', args: ['C:\\Program Files\\LetXinet Addon\\mcp-bridge\\mcp-bridge.cjs'] },
    'latex-mcp-local': { command: 'node', args: ['D:\\OTROS\\latex\\dist\\index.js'] },
  } }, null, 2));
  fs.writeFileSync(path.join(base, '.config', 'opencode', 'opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: {
    'letxipu-v11-local': { type: 'local', command: ['node', 'D:/OTROS/LETXIPU/bridge.cjs'], enabled: true },
    'letxinet-gateway': { type: 'remote', url: 'http://127.0.0.1:3000/mcp', enabled: true },
    'ajeno': { type: 'remote', url: 'https://ejemplo.org/mcp', enabled: true },
  } }, null, 2));
  return { base, env: { ...process.env, USERPROFILE: base, HOME: base, APPDATA: ap, LOCALAPPDATA: lap } };
}

const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

(async () => {
  const h = crearHarness('h07', 'Configurador de clientes');
  const pf = perfilFalso();
  const f = {
    cc: path.join(pf.base, '.claude.json'),
    cd: path.join(pf.base, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    oc: path.join(pf.base, '.config', 'opencode', 'opencode.json'),
  };
  const correr = (args) => spawnSync(process.execPath, [CONF, ...args, '--silencioso'], { env: pf.env, encoding: 'utf8', timeout: 120000 });

  for (const modo of ['separados', 'juntos', 'ambos']) {
    await h.prueba(`Modo ${modo}`, 'ejecucion', async () => {
      const r = correr(['--modo', modo]);
      if (r.status !== 0) throw new Error(`codigo ${r.status}: ${(r.stderr || r.stdout).slice(0, 200)}`);
      return { detalle: 'codigo 0' };
    });
    await h.prueba(`Modo ${modo}`, 'Claude Code', async () => {
      const j = leer(f.cc);
      const s = Object.keys(j.mcpServers || {});
      if (!s.includes('otro') || j.numStartups !== 7 || !j.projects) throw new Error('borro datos ajenos de .claude.json');
      const esperados = modo === 'separados' ? ['letxinet-v11', 'letxinet-osm'] : modo === 'juntos' ? ['letxinet-ambos'] : ['letxinet-v11', 'letxinet-osm', 'letxinet-ambos'];
      const faltan = esperados.filter((e) => !s.includes(e));
      const sobran = modo === 'separados' ? s.filter((e) => e === 'letxinet-ambos') : modo === 'juntos' ? s.filter((e) => e === 'letxinet-v11' || e === 'letxinet-osm') : [];
      if (faltan.length || sobran.length) throw new Error(`faltan ${faltan.join(',') || '-'}; sobran ${sobran.join(',') || '-'}`);
      return { detalle: s.join(', ') };
    });
    await h.prueba(`Modo ${modo}`, 'Claude Desktop', async () => {
      const j = leer(f.cd);
      const s = Object.keys(j.mcpServers || {});
      if (s.includes('letxinet-gateway')) throw new Error('no quito el puente del Addon');
      if (!s.includes('omni-word-mcp')) throw new Error('borro un servidor ajeno');
      const latex = JSON.stringify(j.mcpServers['latex-mcp-local'] || {});
      if (/OTROS/.test(latex)) {
        const addon = fs.existsSync(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'LetXinet Addon', 'latex-mcp-local', 'dist', 'index.js'));
        if (addon) return { estado: 'AVISO', detalle: 'latex-mcp-local sigue en D:\\OTROS aunque el Addon esta instalado (no reconoce la ruta con barras invertidas)' };
        return { detalle: `${s.join(', ')} (latex sin cambiar: el Addon no esta instalado)` };
      }
      for (const [k, v] of Object.entries(j.mcpServers)) if (NUESTROS.includes(k) && v.command && v.type && v.type !== 'stdio') throw new Error(`${k} no es stdio`);
      return { detalle: s.join(', ') };
    });
    await h.prueba(`Modo ${modo}`, 'OpenCode', async () => {
      const j = leer(f.oc);
      const mcp = j.mcp.servers || j.mcp;
      const s = Object.keys(mcp);
      if (s.includes('letxipu-v11-local') || s.includes('letxinet-gateway')) throw new Error('quedaron entradas viejas rotas');
      if (!s.includes('ajeno')) throw new Error('borro un servidor ajeno');
      return { detalle: s.join(', ') };
    });
  }
  await h.prueba('Idempotencia', 'segunda ejecucion sin cambios', async () => {
    const antes = [f.cc, f.cd, f.oc].map((x) => fs.readFileSync(x, 'utf8'));
    const r = correr(['--modo', 'ambos']);
    if (r.status !== 0) throw new Error(`codigo ${r.status}`);
    const despues = [f.cc, f.cd, f.oc].map((x) => fs.readFileSync(x, 'utf8'));
    const cambiados = antes.filter((a, i) => a !== despues[i]).length;
    return cambiados ? { estado: 'AVISO', detalle: `${cambiados} archivos cambiaron sin motivo` } : { detalle: 'no reescribe si no hay cambios' };
  });
  await h.prueba('Respaldos', 'crea .bak-letxinet', async () => {
    const baks = [path.dirname(f.cc), path.dirname(f.cd), path.dirname(f.oc)].flatMap((d) => fs.readdirSync(d).filter((x) => x.includes('.bak-letxinet-')));
    return baks.length >= 3 ? { detalle: `${baks.length} respaldos` } : { estado: 'AVISO', detalle: `${baks.length} respaldos` };
  });
  await h.prueba('Opciones', '--clientes claude-code solo toca Claude Code', async () => {
    const antes = fs.readFileSync(f.cd, 'utf8');
    const r = correr(['--modo', 'separados', '--clientes', 'claude-code']);
    if (r.status !== 0) throw new Error(`codigo ${r.status}`);
    return fs.readFileSync(f.cd, 'utf8') === antes ? { detalle: 'Claude Desktop intacto' } : { estado: 'FALLA', detalle: 'cambio Claude Desktop' };
  });
  await h.prueba('Opciones', 'modo invalido', async () => {
    const r = correr(['--modo', 'xyz']);
    return r.status !== 0 ? { detalle: `rechazado con codigo ${r.status}` } : { estado: 'AVISO', detalle: 'acepto un modo invalido' };
  });
  try { fs.rmSync(pf.base, { recursive: true, force: true }); } catch { /* temporal */ }

  // Configuraciones reales de esta PC (solo lectura)
  const home = os.homedir();
  const reales = [
    ['Claude Code', path.join(home, '.claude.json'), (j) => j.mcpServers],
    ['Claude Desktop', path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json'), (j) => j.mcpServers],
    ['OpenCode', path.join(home, '.config', 'opencode', 'opencode.json'), (j) => j.mcp && (j.mcp.servers || j.mcp)],
    ['OpenCode Desktop', path.join(process.env.APPDATA, 'OpenCode', 'opencode.json'), (j) => j.mcp && (j.mcp.servers || j.mcp)],
  ];
  for (const [nombre, archivo, servidores] of reales) {
    await h.prueba('Esta PC', nombre, async () => {
      if (!fs.existsSync(archivo)) return { estado: 'OMITIDA', detalle: 'no instalado' };
      const j = leer(archivo);
      const s = servidores(j) || {};
      const nuestros = Object.entries(s).filter(([k]) => NUESTROS.includes(k));
      const rotos = [];
      for (const [k, v] of nuestros) {
        const txt = JSON.stringify(v);
        if (/OTROS|:3000/.test(txt)) rotos.push(`${k}: ruta vieja`);
        const archivos = (txt.match(/[A-Z]:\\\\[^"]+?\.(?:cjs|js)/gi) || []).map((x) => x.replace(/\\\\/g, '\\'));
        for (const a of archivos) if (!fs.existsSync(a)) rotos.push(`${k}: no existe ${a}`);
      }
      if (rotos.length) throw new Error(rotos.join('; '));
      return { detalle: `${nuestros.length} servidores de LetXinet: ${nuestros.map(([k]) => k).join(', ')}` };
    });
  }
  h.terminar();
})();
