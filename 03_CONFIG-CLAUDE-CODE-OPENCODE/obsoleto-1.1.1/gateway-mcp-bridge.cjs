#!/usr/bin/env node
// gateway-mcp-bridge.cjs
// Puente MCP stdio <-> gateway local HTTP (http://127.0.0.1:3000)
//
// - Para tools RÁPIDAS: llama sync a /api/mcp/call y devuelve el resultado
// - Para tools LARGAS: lanza job en background (escribe archivo .json), responde inmediatamente
//   con un "task_id" pseudo-error; el agente debe llamar a la tool `gateway_poll` para
//   recuperar el resultado cuando esté listo
//
// Se registra en opencode.json como:
//   "letxinet-gateway": {
//     "type": "local",
//     "command": ["node", "D:/OTROS/LETXINET-MCP-AGENT-GUI/LETXINET-MCP-AGENT-GUI-V2-main/gateway-mcp-bridge.cjs"],
//     "enabled": true,
//     "environment": { "GATEWAY_URL": "http://127.0.0.1:3000", "JOBS_DIR": "D:/OTROS/LETXINET-MCP-AGENT-GUI/jobs" }
//   }

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const JOBS_DIR = process.env.JOBS_DIR || 'D:/OTROS/LETXINET-MCP-AGENT-GUI/jobs';
const LETXIPU_LOCAL_URL = process.env.LETXIPU_LOCAL_URL || 'http://127.0.0.1:4003';

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
const req = http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},(res)=>{
  let d='';res.setEncoding('utf8');res.on('data',c=>d+=c);
  res.on('end',()=>{fs.writeFileSync(outPath,d);fs.writeFileSync(statusPath,res.statusCode>=200&&res.statusCode<300?'DONE':'ERROR','ascii');process.exit(0);});
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
    const req = http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'opencode/1.0'}}, res => {
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
  const init = await post({jsonrpc:'2.0',id:rpcId,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'opencode',version:'1.0.0'}}}, 15000);
  if (!init || !init.result) throw new Error('initialize returned no result');
  const result = await post({jsonrpc:'2.0',id:rpcId+1,method:'tools/call',params:{name:input.tool,arguments:input.arguments}}, 1800000);
  fs.writeFileSync(outPath, JSON.stringify(result)); fs.writeFileSync(statusPath, 'DONE', 'ascii');
})().catch(e => { fs.writeFileSync(outPath, JSON.stringify({error:e.message})); fs.writeFileSync(statusPath, 'ERROR', 'ascii'); process.exitCode=1; });
`;
  fs.writeFileSync(runnerPath, runnerCode);
  const child = spawn(process.execPath, [runnerPath], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.writeFileSync(pidPath, String(child.pid), 'ascii');
  return { task_id: id, tool: toolName, pid: child.pid };
}

function pollJob(taskId) {
  const jobsDir = JOBS_DIR;
  const statusPath = path.join(jobsDir, `${taskId}_status.txt`);
  const outPath = path.join(jobsDir, `${taskId}_out.json`);
  const pidPath = path.join(jobsDir, `${taskId}_pid.txt`);

  if (!fs.existsSync(statusPath)) {
    return { task_id: taskId, status: 'NOT_FOUND', exists: false };
  }
  const status = fs.readFileSync(statusPath, 'ascii').trim();
  let result = null;
  let resultLen = 0;
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    result = fs.readFileSync(outPath, 'utf8');
    resultLen = result.length;
  }
  return { task_id: taskId, status, result_len: resultLen, result };
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
    description: 'Invoca cualquier tool del gateway LETXINET-MCP-AGENT-GUI local (http://127.0.0.1:3000). Para tareas largas (extract_tables, read_pdf, batch_search, pdf_smart_summary, analyze_academic, extract_formulas, extract_section, read_pdf_markdown, batch_convert, search_conferences) lanza job en background y devuelve task_id — llama gateway_poll para recuperar el resultado.',
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
    description: 'Sondea el estado de un job largo lanzado por gateway_call. Devuelve {status, result} cuando done. Llamar repetidamente cada 30-60s.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id']
    }
  },
  {
    name: 'gateway_list_tools',
    description: 'Lista los 56 tools disponibles en el gateway.',
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
          text: `Gateway tiene ${gatewayTools.length} tools. Wrapper ofrece 4 meta-tools: gateway_call (dispatch), gateway_poll (sondeo jobs largos), gateway_list_tools (este), gateway_chat (LangGraph streaming).\n\nTools gateway remotos:\n${gatewayTools.join('\n')}`
        }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error listando tools: ${e.message}` }], isError: true };
    }
  }

  if (name === 'gateway_poll') {
    const taskId = args.task_id;
    if (!taskId) return { content: [{ type: 'text', text: 'task_id requerido' }], isError: true };
    const job = pollJob(taskId);
    const text = job.status === 'DONE'
      ? `STATUS=DONE\nLEN=${job.result_len}\n\n=== RESULT (JSON) ===\n${job.result || ''}`
      : `STATUS=${job.status}\nresult_len=0 (todavia no listo, sondea en 30s)`;
    return { content: [{ type: 'text', text }] };
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
      return { content: [{ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r).substring(0, 8000) }] };
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
      return { content: [{ type: 'text', text }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `gateway_call error: ${e.message}` }], isError: true };
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
        serverInfo: { name: 'letxinet-gateway-bridge', version: '1.0.0' }
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
