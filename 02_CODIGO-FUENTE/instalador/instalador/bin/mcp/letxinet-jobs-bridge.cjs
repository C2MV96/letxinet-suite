#!/usr/bin/env node
// letxinet-jobs-bridge.cjs (LetXinet Suite 1.1.5; antes gateway-mcp-bridge.cjs)
// 1.1.5: las tareas en segundo plano ya no se presentan como OpenCode (V11 las cortaba
// a los 114 s); gateway_poll informa ERROR, LOST, NOT_FOUND e INVALID con isError;
// valida el task_id; borra las tareas de mas de 24 h; gateway_call y gateway_chat
// marcan como error las respuestas fallidas del gateway.
// Puente MCP stdio <-> gateway de LetXinet Desktop (http://127.0.0.1:43123)
//
// - Para tools RAPIDAS: llama sync a /api/mcp/call y devuelve el resultado
// - Para tools LARGAS: lanza job en background (escribe archivo .json), responde inmediatamente
//   con un "task_id" pseudo-error; el agente debe llamar a la tool `gateway_poll` para
//   recuperar el resultado cuando este listo
// - letxipu_local_call va directo a V11 (http://127.0.0.1:4003) y no necesita el Desktop abierto
//
// Se instala en {app}in\mcp\ y lo registra bin\configurar-clientes.ps1. Variables opcionales:
//   GATEWAY_URL (por defecto http://127.0.0.1:43123), LETXIPU_LOCAL_URL (http://127.0.0.1:4003),
//   JOBS_DIR (por defecto %LOCALAPPDATA%\LetXinet\jobs)

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// 1.1.2: el gateway real es el del Desktop (43123); el 3000 era un servidor de desarrollo que ya no existe
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:43123';
const JOBS_DIR = process.env.JOBS_DIR || path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'LetXinet', 'jobs');
const LETXIPU_LOCAL_URL = process.env.LETXIPU_LOCAL_URL || 'http://127.0.0.1:4003';

// 1.1.5: los procesos que ejecutan tareas en segundo plano se identifican como
// letxinet-jobs. Antes decian "opencode/1.0" y V11 les aplicaba el limite de
// OpenCode (114 s), justo lo que el puente debia evitar. V11 1.1.5 trata este
// User-Agent como cliente sin limite corto (600 s); una V11 anterior lo trata
// como desconocido (228 s).
const JOB_USER_AGENT = 'letxinet-jobs-bridge/1.1.6';
// Archivos de tareas: <fecha>_<hora>Z_<azar>_{req.json,out.json,status.txt,runner.cjs,pid.txt}
const TASK_ID_RE = /^\d{4}-\d{2}-\d{2}_\d{9}Z_[a-z0-9]{1,12}$/;
const JOB_FILE_RE = /^(\d{4}-\d{2}-\d{2}_\d{9}Z_[a-z0-9]{1,12})_(req\.json|out\.json|status\.txt|runner\.cjs|pid\.txt)$/;
const JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// El harness de OpenCode corta las llamadas síncronas cerca de 120 s.  search
// puede terminar dentro de esa ventana si dejamos margen; las operaciones que
// expanden consultas se ejecutan como jobs consultables.
const LETXIPU_SYNC_TIMEOUT_MS = 114000;
const LETXIPU_LOCAL_LONG_RUNNING_TOOLS = new Set([
  'smart_search',
  'batch_search',
]);

// Tools del gateway que se consideran LARGAS (>120s del timeout del harness opencode)
const LONG_RUNNING_TOOLS = new Set([
  'extract_tables',
  'extract_formulas',
  'read_pdf',
  'read_pdf_markdown',
  'extract_section',
  'analyze_academic',
  'pdf_smart_summary',
  'batch_search',
  'batch_convert',
  'search_conferences',
  '__chat__', // alias interno para /api/chat
]);

if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

// 1.1.5: borra los archivos de tareas de mas de 24 h (antes se acumulaban sin limite).
// Solo toca archivos con el nombre exacto que crea este puente.
function limpiarTareasViejas() {
  try {
    const ahora = Date.now();
    for (const nombre of fs.readdirSync(JOBS_DIR)) {
      if (!JOB_FILE_RE.test(nombre)) continue;
      const ruta = path.join(JOBS_DIR, nombre);
      try {
        if (ahora - fs.statSync(ruta).mtimeMs > JOB_MAX_AGE_MS) fs.unlinkSync(ruta);
      } catch (_) { /* archivo en uso o ya borrado */ }
    }
  } catch (_) { /* carpeta no legible: no es critico */ }
}
limpiarTareasViejas();

// ============================================================
// HTTP helpers
// ============================================================
function httpPost(targetPath, bodyObj, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, GATEWAY_URL);
    const bodyStr = JSON.stringify(bodyObj);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        // V11 aplica límites compatibles con OpenCode a este cliente.
        'User-Agent': 'opencode/1.0',
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// POST a una URL arbitraria (no gateway), para llamar al LetXipu V11 local directamente
function httpPostRaw(baseUrl, targetPath, bodyObj, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, baseUrl);
    const bodyStr = JSON.stringify(bodyObj);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpGet(targetPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, GATEWAY_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

// ============================================================
// Job async en background
// ============================================================
function launchLongJob(toolName, argsObj) {
  limpiarTareasViejas();
  const id = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_') + '_' + Math.random().toString(36).slice(2, 8);
  const reqPath = path.join(JOBS_DIR, `${id}_req.json`);
  const outPath = path.join(JOBS_DIR, `${id}_out.json`);
  const statusPath = path.join(JOBS_DIR, `${id}_status.txt`);
  const runnerPath = path.join(JOBS_DIR, `${id}_runner.cjs`);
  const pidPath = path.join(JOBS_DIR, `${id}_pid.txt`);

  fs.writeFileSync(reqPath, JSON.stringify(coerceNumerics({ tool: toolName, arguments: argsObj || {} })));
  fs.writeFileSync(statusPath, 'PENDING', 'ascii');

  const runnerCode = `
const http = require('http');
const fs = require('fs');
const reqPath = ${JSON.stringify(reqPath)};
const outPath = ${JSON.stringify(outPath)};
const statusPath = ${JSON.stringify(statusPath)};
const url = new URL('/api/mcp/call', ${JSON.stringify(GATEWAY_URL)});
const body = fs.readFileSync(reqPath, 'utf8');
const req = http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':${JSON.stringify(JOB_USER_AGENT)}}},(res)=>{
  let d='';res.setEncoding('utf8');res.on('data',c=>d+=c);
  res.on('end',()=>{
    let ok=res.statusCode>=200&&res.statusCode<300;
    try{const j=JSON.parse(d);if(j&&(j.error||(j.response&&j.response.error)||(j.response&&j.response.result&&j.response.result.isError)))ok=false;}catch(_){}
    fs.writeFileSync(outPath,d);fs.writeFileSync(statusPath,ok?'DONE':'ERROR','ascii');process.exit(0);
  });
});
req.on('error',e=>{fs.writeFileSync(outPath,JSON.stringify({error:e.message}));fs.writeFileSync(statusPath,'ERROR','ascii');process.exit(1);});
req.setTimeout(1800000,()=>req.destroy(new Error('timeout 30min')));
req.write(body);req.end();
`;
  fs.writeFileSync(runnerPath, runnerCode);

  const child = spawn(process.execPath, [runnerPath], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.writeFileSync(pidPath, String(child.pid), 'ascii');

  return {
    task_id: id,
    tool: toolName,
    status_path: statusPath,
    out_path: outPath,
    pid: child.pid,
    poll_recommended_after_ms: 30000,
    note: `Tarea larga lanzada en background. Llama a la tool gateway_poll con task_id="${id}" para recuperar el resultado cuando ready.`
  };
}

// Job equivalente para LetXipu V11 local. No pasa por /api/mcp/call del
// gateway remoto: inicializa y llama directamente al MCP que escucha en 4003.
function launchLetxipuLocalJob(toolName, argsObj) {
  limpiarTareasViejas();
  const id = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_') + '_' + Math.random().toString(36).slice(2, 8);
  const reqPath = path.join(JOBS_DIR, `${id}_req.json`);
  const outPath = path.join(JOBS_DIR, `${id}_out.json`);
  const statusPath = path.join(JOBS_DIR, `${id}_status.txt`);
  const runnerPath = path.join(JOBS_DIR, `${id}_runner.cjs`);
  const pidPath = path.join(JOBS_DIR, `${id}_pid.txt`);

  fs.writeFileSync(reqPath, JSON.stringify(coerceNumerics({ tool: toolName, arguments: argsObj || {} })));
  fs.writeFileSync(statusPath, 'PENDING', 'ascii');

  const runnerCode = `
const http = require('http');
const fs = require('fs');
const reqPath = ${JSON.stringify(reqPath)};
const outPath = ${JSON.stringify(outPath)};
const statusPath = ${JSON.stringify(statusPath)};
const baseUrl = ${JSON.stringify(LETXIPU_LOCAL_URL)};
const input = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
function post(payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/mcp', baseUrl);
    const body = JSON.stringify(payload);
    const req = http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':${JSON.stringify(JOB_USER_AGENT)}}}, res => {
      let data=''; res.setEncoding('utf8'); res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({raw:data}); }
        } else reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 200)));
      });
    });
    req.on('error', reject); req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout ' + timeoutMs + 'ms')));
    req.write(body); req.end();
  });
}
(async () => {
  const rpcId = Date.now();
  const init = await post({jsonrpc:'2.0',id:rpcId,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'letxinet-jobs',version:'1.1.5'}}}, 15000);
  if (!init || !init.result) throw new Error('initialize returned no result');
  const result = await post({jsonrpc:'2.0',id:rpcId+1,method:'tools/call',params:{name:input.tool,arguments:input.arguments}}, 1800000);
  const fallo = !!(result && (result.error || (result.result && result.result.isError)));
  fs.writeFileSync(outPath, JSON.stringify(result)); fs.writeFileSync(statusPath, fallo ? 'ERROR' : 'DONE', 'ascii');
})().catch(e => { fs.writeFileSync(outPath, JSON.stringify({error:e.message})); fs.writeFileSync(statusPath, 'ERROR', 'ascii'); process.exitCode=1; });
`;
  fs.writeFileSync(runnerPath, runnerCode);
  const child = spawn(process.execPath, [runnerPath], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.writeFileSync(pidPath, String(child.pid), 'ascii');
  return { task_id: id, tool: toolName, pid: child.pid };
}

// 1.1.5: valida el task_id (antes se podia leer cualquier *_status.txt / *_out.json
// fuera de la carpeta de tareas) y distingue tareas terminadas con error, perdidas
// (el proceso murio sin resultado) e inexistentes.
function procesoVivo(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function mensajeDeError(texto) {
  try {
    const j = JSON.parse(texto);
    const e = j.error || (j.response && j.response.error);
    if (e) return typeof e === 'string' ? e : (e.message || JSON.stringify(e)).toString();
    const r = j.result || (j.response && j.response.result);
    if (r && r.isError) {
      const t = r.content && r.content[0] && r.content[0].text;
      return t ? String(t).substring(0, 1000) : 'la herramienta devolvio isError=true';
    }
  } catch (_) { /* no es JSON */ }
  return texto ? String(texto).substring(0, 1000) : 'sin detalle';
}

function pollJob(taskId) {
  if (!TASK_ID_RE.test(String(taskId))) {
    return { task_id: taskId, status: 'INVALID' };
  }
  const statusPath = path.join(JOBS_DIR, `${taskId}_status.txt`);
  const outPath = path.join(JOBS_DIR, `${taskId}_out.json`);
  const pidPath = path.join(JOBS_DIR, `${taskId}_pid.txt`);
  const reqPath = path.join(JOBS_DIR, `${taskId}_req.json`);

  if (!fs.existsSync(statusPath)) {
    return { task_id: taskId, status: 'NOT_FOUND', exists: false };
  }
  let status = fs.readFileSync(statusPath, 'ascii').trim();
  let result = null;
  let resultLen = 0;
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    result = fs.readFileSync(outPath, 'utf8');
    resultLen = result.length;
  }
  let elapsedMs = null;
  try { elapsedMs = Date.now() - fs.statSync(reqPath).mtimeMs; } catch (_) { /* sin req */ }
  if (status === 'PENDING') {
    let pid = null;
    try { pid = Number(fs.readFileSync(pidPath, 'ascii').trim()); } catch (_) { /* sin pid */ }
    if (pid && !procesoVivo(pid)) {
      // El proceso pudo terminar justo ahora: se vuelve a leer el estado antes de declararla perdida
      status = fs.readFileSync(statusPath, 'ascii').trim();
      if (status === 'PENDING') status = 'LOST';
    }
  }
  // Compatibilidad con tareas lanzadas por puentes anteriores: DONE con error dentro
  if (status === 'DONE' && result) {
    try {
      const j = JSON.parse(result);
      if (j && (j.error || (j.result && j.result.isError) || (j.response && j.response.error))) status = 'ERROR';
    } catch (_) { /* resultado no JSON */ }
  }
  return { task_id: taskId, status, result_len: resultLen, result, elapsed_ms: elapsedMs };
}

// Coerce arguments to numeric when expected (some MCP clients wrap numbers as JSON strings).
// The LetXipu MCP server validates "Invalid input: expected number, received string" on maxSources, maxResults, maxChars, year, yearStart, yearEnd etc.
const NUMERIC_FIELDS = [
  'maxSources','maxResults','limit','radius','maxYearsBack','timeoutSec',
  'max_chars','maxChars','maxTotalChars','maxTotalChar','max_total_chars',
  'yearStart','yearEnd','year','start_year','end_year',
  'interval','duration','durationMs','rows','cols','temperature','topN','max_tool_calls','minRelevanceScore'
];
// Boolean fields: some MCP clients wrap booleans as JSON strings ("true"/"false").
const BOOLEAN_FIELDS = [
  'fastMode','filterFalsePositives','enablePeruWebFallback','disableAtomic',
  'use_cache','fallback','strict','async','skipCache','includeAbstract','includePdf',
  'caseSensitive','wholeWord','decompose','asArray','returnUrl','async_','allowRemote'
];
function coerceFieldValue(k, v) {
  if (v === null || v === undefined) return v;
  if (NUMERIC_FIELDS.includes(k) && typeof v === 'string' && v !== '' && !isNaN(Number(v))) {
    return Number(v);
  }
  if (BOOLEAN_FIELDS.includes(k) && typeof v === 'string' && (v === 'true' || v === 'false')) {
    return v === 'true';
  }
  return v;
}
function unwrapItemWrapper(v) {
  while (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.item)) {
    v = v.item;
  }
  return v;
}
function flattenNestedArrays(v) {
  if (!Array.isArray(v)) return v;
  let out = [];
  for (const el of v) {
    if (Array.isArray(el)) {
      const inner = flattenNestedArrays(el);
      if (Array.isArray(inner)) out = out.concat(inner);
      else out.push(inner);
    } else if (el && typeof el === 'object' && Array.isArray(el.item)) {
      const inner = flattenNestedArrays(el.item);
      if (Array.isArray(inner)) out = out.concat(inner);
      else out.push(inner);
    } else {
      out.push(el);
    }
  }
  return out;
}
function coerceNumerics(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(coerceNumerics);
  }
  const out = {};
  for (const k of Object.keys(obj)) {
    let v = obj[k];
    v = unwrapItemWrapper(v);
    if (Array.isArray(v)) v = flattenNestedArrays(v);
    v = coerceFieldValue(k, v);
    out[k] = (v && typeof v === 'object') ? coerceNumerics(v) : v;
  }
  return out;
}

// ============================================================
// MCP stdio server (línea por línea)
// ============================================================
const TOOLS_SCHEMA = [
  {
    name: 'gateway_call',
    description: 'Invoca cualquier tool del gateway de LetXinet Desktop (http://127.0.0.1:43123; requiere el Desktop abierto). Para tareas largas (extract_tables, read_pdf, batch_search, pdf_smart_summary, analyze_academic, extract_formulas, extract_section, read_pdf_markdown, batch_convert, search_conferences) lanza job en background y devuelve task_id — llama gateway_poll para recuperar el resultado.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Nombre del tool del gateway (ej: search, web_search, extract_tables, geocode_address, resolve_pdf)' },
        arguments: { type: 'object', description: 'Argumentos para el tool' }
      },
      required: ['tool']
    }
  },
  {
    name: 'gateway_poll',
    description: 'Estado y resultado de una tarea larga lanzada por letxipu_local_call o gateway_call. STATUS=PENDING: vuelve a sondear en 30-60 s. STATUS=DONE: trae el resultado. STATUS=ERROR, LOST, NOT_FOUND o INVALID: la tarea fallo o no existe (isError=true); no sigas sondeando.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id']
    }
  },
  {
    name: 'gateway_list_tools',
    description: 'Lista las herramientas disponibles en el gateway de LetXinet Desktop.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'gateway_chat',
    description: 'Invoca el endpoint /api/chat del gateway con streaming LangGraph + Gemini. Responde cuando el flujo agentic termina.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        model: { type: 'string', default: 'gemini-2.5-flash' },
        autoExecuteTools: { type: 'boolean', default: false },
        executionMode: { type: 'string', default: 'langgraph' }
      },
      required: ['message']
    }
  },
  {
    name: 'letxipu_local_call',
    description: 'Invoca un tool del LetXipu V11 LOCAL (http://127.0.0.1:4003/api/mcp). search responde de forma síncrona con margen para OpenCode. smart_search y batch_search se lanzan como tareas y se recuperan con gateway_poll.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Nombre del tool LetXipu local (search, smart_search, batch_search, trending_papers, pdf_smart_summary, analyze_academic, extract_section, etc.)' },
        arguments: { type: 'object', description: 'Argumentos para el tool. Pasan coerceNumerics (aplanado arrays anidados + cast numerics/booleans).' }
      },
      required: ['tool']
    }
  }
];

function sendJsonRpc(msgObj) {
  process.stdout.write(JSON.stringify(msgObj) + '\n');
}

function listTools() {
  return { tools: TOOLS_SCHEMA.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
}

async function invokeLetxipuLocal(toolName, argsObj) {
  const rpcId = Date.now() + Math.floor(Math.random() * 1000);
  const init = await httpPostRaw(LETXIPU_LOCAL_URL, '/api/mcp', {
    jsonrpc: '2.0', id: rpcId, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'opencode', version: '1.0.0' } }
  }, 15000);
  if (!init || !init.result) {
    throw new Error(`initialize returned no result: ${JSON.stringify(init).substring(0, 400)}`);
  }
  const call = await httpPostRaw(LETXIPU_LOCAL_URL, '/api/mcp', {
    jsonrpc: '2.0', id: rpcId + 1, method: 'tools/call',
    params: { name: toolName, arguments: argsObj }
  }, LETXIPU_SYNC_TIMEOUT_MS);
  if (call && call.error) {
    throw new Error(`LetXipu V11 error [${call.error.code ?? 'unknown'}]: ${call.error.message || JSON.stringify(call.error)}`);
  }
  const text = call && call.result && call.result.content && call.result.content[0] && call.result.content[0].text;
  if (!text) throw new Error(`LetXipu V11 returned no content: ${JSON.stringify(call).substring(0, 1000)}`);
  return text;
}

async function callTool(name, args) {
  if (name === 'gateway_list_tools') {
    try {
      const r = await httpGet('/api/mcp/tools', 10000);
      const gatewayTools = (r.tools || []).map(t => t.name);
      return {
        content: [{
          type: 'text',
          text: `Gateway tiene ${gatewayTools.length} tools. Este puente ofrece 5 herramientas: letxipu_local_call (V11 local, sin Desktop), gateway_call (herramientas del gateway del Desktop), gateway_poll (estado y resultado de tareas largas), gateway_list_tools (esta) y gateway_chat (chat del gateway).\n\nTools del gateway:\n${gatewayTools.join('\n')}`
        }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error listando tools: ${e.message}${/ECONNREFUSED/.test(e.message) ? ' (LetXinet Desktop esta cerrado: abrelo, o usa letxipu_local_call o el servidor letxinet-ambos, que no lo necesitan)' : ''}` }], isError: true };
    }
  }

  if (name === 'gateway_poll') {
    const taskId = args.task_id;
    if (!taskId) return { content: [{ type: 'text', text: 'task_id requerido' }], isError: true };
    const job = pollJob(taskId);
    const seg = job.elapsed_ms != null ? ` (${Math.round(job.elapsed_ms / 1000)} s desde que se lanzo)` : '';
    if (job.status === 'DONE') {
      return { content: [{ type: 'text', text: `STATUS=DONE${seg}\nLEN=${job.result_len}\n\n=== RESULT (JSON) ===\n${job.result || ''}` }] };
    }
    if (job.status === 'PENDING') {
      return { content: [{ type: 'text', text: `STATUS=PENDING${seg}\nTodavia no termina: vuelve a sondear en 30 s.` }] };
    }
    if (job.status === 'ERROR') {
      return { content: [{ type: 'text', text: `STATUS=ERROR${seg}\nLa tarea termino con error: ${mensajeDeError(job.result)}\nNo vuelvas a sondear esta tarea.` }], isError: true };
    }
    if (job.status === 'LOST') {
      return { content: [{ type: 'text', text: `STATUS=LOST${seg}\nEl proceso de la tarea termino sin dejar resultado. Lanzala de nuevo.` }], isError: true };
    }
    if (job.status === 'INVALID') {
      return { content: [{ type: 'text', text: 'STATUS=INVALID\nEl task_id no tiene el formato de este puente (ejemplo: 2026-11-09_140105181Z_g1m224).' }], isError: true };
    }
    return { content: [{ type: 'text', text: `STATUS=NOT_FOUND\nNo existe una tarea con task_id="${taskId}" (o se borro por tener mas de 24 h).` }], isError: true };
  }

  if (name === 'gateway_chat') {
    const message = args.message || '';
    const model = args.model || 'gemini-2.5-flash';
    const payload = {
      message,
      model,
      autoExecuteTools: !!args.autoExecuteTools,
      executionMode: args.executionMode || 'langgraph',
      maxToolCalls: 0
    };
    try {
      const r = await httpPost('/api/chat', payload, 120000);
      const texto = typeof r === 'string' ? r : JSON.stringify(r).substring(0, 8000);
      // 1.1.5: el gateway responde 200 aunque el modelo falle (p. ej. clave no valida)
      const fallo = /"type"\s*:\s*"error"|API key not valid|"error"\s*:\s*\{/i.test(texto);
      return fallo ? { content: [{ type: 'text', text: `chat error: ${texto.substring(0, 2000)}` }], isError: true }
                   : { content: [{ type: 'text', text: texto }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `chat error: ${e.message}` }], isError: true };
    }
  }

  if (name === 'gateway_call') {
    const toolName = args.tool;
    if (!toolName) return { content: [{ type: 'text', text: 'tool name requerido' }], isError: true };
    let argsObj = coerceNumerics(args.arguments || {});
    process.stderr.write(`[bridge DEBUG] tool=${toolName} argsObj=${JSON.stringify(argsObj).substring(0, 600)}\n`);
    // Compatibilidad: gateway_call era la vía ya usada por OpenCode. Estas
    // tres tools pasan directo al V11 local para evitar el timeout/cuerpo
    // vacío del dispatcher HTTP del gateway.
    if (toolName === 'smart_search' || toolName === 'batch_search') {
      const job = launchLetxipuLocalJob(toolName, argsObj);
      return { content: [{ type: 'text', text: `TAREA LARGA LOCAL lanzada en background.\n\nTask ID: ${job.task_id}\nTool: ${job.tool}\nPID: ${job.pid}\n\nLlama la tool \`gateway_poll\` con task_id="${job.task_id}" dentro de 30-60 segundos para recuperar el resultado.` }] };
    }
    if (toolName === 'search') {
      if (argsObj.fastMode === undefined) argsObj.fastMode = true;
      try {
        const text = await invokeLetxipuLocal(toolName, argsObj);
        return { content: [{ type: 'text', text }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `gateway_call search error: ${e.message}` }], isError: true };
      }
    }
    if (LONG_RUNNING_TOOLS.has(toolName)) {
      const job = launchLongJob(toolName, argsObj);
      return { content: [{ type: 'text', text: `TAREA LARGA lanzada en background.\n\nTask ID: ${job.task_id}\nTool: ${job.tool}\nPID: ${job.pid}\n\nLlama la tool \`gateway_poll\` con task_id="${job.task_id}" dentro de 30-60 segundos para recuperar el resultado.` }] };
    }
    try {
      const r = await httpPost('/api/mcp/call', { tool: toolName, arguments: argsObj }, 100000);
      const text = (r && r.response && r.response.result && r.response.result.content && r.response.result.content[0] && r.response.result.content[0].text)
        || JSON.stringify(r);
      // 1.1.5: una herramienta inexistente o un error del gateway se marcan como error
      const fallo = !!(r && (r.error || (r.response && (r.response.error || (r.response.result && r.response.result.isError)))));
      return fallo ? { content: [{ type: 'text', text: `gateway_call error: ${mensajeDeError(JSON.stringify(r))}` }], isError: true }
                   : { content: [{ type: 'text', text }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `gateway_call error: ${e.message}${/ECONNREFUSED/.test(e.message) ? ' (LetXinet Desktop esta cerrado: abrelo, o usa letxipu_local_call o el servidor letxinet-ambos, que no lo necesitan)' : ''}` }], isError: true };
    }
  }

  if (name === 'letxipu_local_call') {
    const toolName = args.tool;
    if (!toolName) return { content: [{ type: 'text', text: 'tool name requerido' }], isError: true };
    let argsObj = coerceNumerics(args.arguments || {});
    if (toolName === 'search' && argsObj.fastMode === undefined) argsObj.fastMode = true;
    process.stderr.write(`[bridge LOCAL] tool=${toolName} args=${JSON.stringify(argsObj).substring(0, 300)}\n`);
    if (LETXIPU_LOCAL_LONG_RUNNING_TOOLS.has(toolName)) {
      const job = launchLetxipuLocalJob(toolName, argsObj);
      return { content: [{ type: 'text', text: `TAREA LARGA LOCAL lanzada en background.\n\nTask ID: ${job.task_id}\nTool: ${job.tool}\nPID: ${job.pid}\n\nLlama la tool \`gateway_poll\` con task_id="${job.task_id}" dentro de 30-60 segundos para recuperar el resultado.` }] };
    }
    try {
      const text = await invokeLetxipuLocal(toolName, argsObj);
      return { content: [{ type: 'text', text }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `letxipu_local_call error: ${e.message}` }], isError: true };
    }
  }

  return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
}

// ============================================================
// Loop principal: leer JSON-RPC de stdin
// ============================================================
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  if (method === 'initialize') {
    sendJsonRpc({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'letxinet-gateway-bridge', version: '1.1.6' }
      }
    });
    return;
  }
  if (method === 'tools/list') {
    sendJsonRpc({ jsonrpc: '2.0', id, result: listTools() });
    return;
  }
  if (method === 'tools/call') {
    const { name, arguments: a } = params || {};
    try {
      const result = await callTool(name, a || {});
      sendJsonRpc({ jsonrpc: '2.0', id, result });
    } catch (e) {
      sendJsonRpc({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
    }
    return;
  }
  sendJsonRpc({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
});

process.stderr.write(`[letxinet-gateway-bridge] ready. Gateway=${GATEWAY_URL} Jobs=${JOBS_DIR}\n`);
