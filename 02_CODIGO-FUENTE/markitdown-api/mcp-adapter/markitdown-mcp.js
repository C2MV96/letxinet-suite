#!/usr/bin/env node
/**
 * markitdown-mcp.js — Adaptador MCP stdio para MarkItDown API (REST).
 *
 * Expone la API REST de D:\OTROS\markitdown-api (FastAPI + pymupdf4llm)
 * como herramientas MCP via JSON-RPC 2.0 sobre stdin/stdout, para que
 * opencode la use como servidor MCP "local".
 *
 * Env:
 *   MARKITDOWN_API_URL  (default http://127.0.0.1:7860)
 *
 * Tools:
 *   - markitdown_health: estado de la API
 *   - markitdown_convert: convierte un PDF local a Markdown (path, pages)
 */

const fs = require('fs');
const path = require('path');

const API_URL = (process.env.MARKITDOWN_API_URL || 'http://127.0.0.1:7860').replace(/\/$/, '');

const SERVER_INFO = { name: 'markitdown-api', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'markitdown_health',
    description: 'Estado del servicio MarkItDown API local (motor PyMuPDF4LLM para convertir PDF a Markdown).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'markitdown_convert',
    description:
      'Convierte un archivo PDF local a Markdown estructurado usando la MarkItDown API local (PyMuPDF4LLM). ' +
      'Devuelve { success, markdown, chars, lines, total_pages }. Soporta rangos de paginas para PDFs grandes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta absoluta al archivo PDF local.' },
        pages: {
          type: 'string',
          description: "Rango de paginas: 'all' (default), '1-5', 'first5', 'last3', '1,3,5', o un numero '7'.",
          default: 'all',
        },
        maxChars: {
          type: 'number',
          description: 'Recorta el markdown devuelto a este maximo de caracteres (default sin corte).',
        },
      },
      required: ['path'],
    },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

function toolText(text) {
  return { content: [{ type: 'text', text }] };
}

async function handleHealth(id) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_URL}/`, { signal: controller.signal });
    clearTimeout(timer);
    const body = await res.json();
    sendResult(id, toolText(JSON.stringify({ success: true, apiUrl: API_URL, ...body }, null, 2)));
  } catch (e) {
    sendResult(id, toolText(JSON.stringify({ success: false, apiUrl: API_URL, error: e.message }, null, 2)));
  }
}

async function handleConvert(id, args) {
  const pdfPath = args && args.path;
  if (!pdfPath) return sendError(id, -32602, 'Falta parametro requerido: path');
  if (!fs.existsSync(pdfPath)) return sendError(id, -32602, `Archivo no existe: ${pdfPath}`);
  if (!pdfPath.toLowerCase().endsWith('.pdf')) return sendError(id, -32602, 'Solo se aceptan archivos PDF');

  const pages = args.pages || 'all';
  const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0 ? args.maxChars : null;

  try {
    const buffer = fs.readFileSync(pdfPath);
    const filename = path.basename(pdfPath);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
    form.append('pages', String(pages));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000); // 5 min PDFs grandes
    const res = await fetch(`${API_URL}/convert`, { method: 'POST', body: form, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const body = (await res.text()).substring(0, 300);
      throw new Error(`API HTTP ${res.status}: ${body}`);
    }
    const parsed = await res.json();
    if (!parsed.success) throw new Error(parsed.detail || parsed.error || 'conversion failed');

    let markdown = parsed.markdown || '';
    let truncated = false;
    if (maxChars && markdown.length > maxChars) {
      markdown = markdown.substring(0, maxChars) + `\n\n---\n*[Truncado a ${maxChars} chars de ${parsed.chars} totales]*`;
      truncated = true;
    }

    sendResult(id, toolText(JSON.stringify({
      success: true,
      markdown,
      chars: parsed.chars,
      lines: parsed.lines,
      total_pages: parsed.total_pages,
      pages_requested: parsed.pages_requested,
      truncated,
      source_file: filename,
    }, null, 2)));
  } catch (e) {
    sendError(id, -32000, `Error convirtiendo PDF: ${e.message}`);
  }
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return sendResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return; // notification, no response
  }

  if (method === 'ping') {
    return sendResult(id, {});
  }

  if (method === 'tools/list') {
    return sendResult(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    if (name === 'markitdown_health') return handleHealth(id);
    if (name === 'markitdown_convert') return handleConvert(id, args);
    return sendError(id, -32601, `Tool desconocida: ${name}`);
  }

  // Metodo desconocido: solo responder si tiene id (no es notificacion)
  if (id !== undefined && id !== null) {
    return sendError(id, -32601, `Method not found: ${method}`);
  }
}

// --- stdio loop: newline-delimited JSON-RPC ---
// Track pending async requests: no salir en stdin 'end' mientras haya
// conversiones en curso (el pipe de opencode puede cerrar stdin temprano
// en tests manuales; opencode real mantiene stdin abierto).
let pendingRequests = 0;
let stdinEnded = false;

function maybeExit() {
  if (stdinEnded && pendingRequests === 0) process.exit(0);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignorar lineas no-JSON
    }
    pendingRequests++;
    handleMessage(msg)
      .catch((e) => {
        if (msg.id !== undefined && msg.id !== null) {
          sendError(msg.id, -32603, e.message);
        }
      })
      .finally(() => {
        pendingRequests--;
        maybeExit();
      });
  }
});

process.stdin.on('end', () => {
  stdinEnded = true;
  maybeExit();
});
