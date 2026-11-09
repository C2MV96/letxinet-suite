// ============================================================================
// VARIANTE C v1.3 — Chats persistentes (sidebar)
// ----------------------------------------------------------------------------
// Persiste cada conversacion como un JSON independiente en disco:
//   %APPDATA%\LetXinet Suite\chats\{uuid}.json
//
// Cada chat guarda: uuid, title, createdAt, updatedAt, provider, model y
// messages[] (historial completo). El frontend carga metadatos al inicio y
// el historial completo on-demand al activar el chat.
//
// MEJORA: no se pierde ningun chat ni su contenido al cerrar la app, al
// reinstalar, ni al cambiar de maquina (si se copia la carpeta chats/).
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const HOMEDIR_APPDATA = process.env.APPDATA ||
  path.join(os.homedir(), 'AppData', 'Roaming');

function getChatsDir(): string {
  const base = process.env.LETXIPU_DESKTOP_USERDATA ||
    path.join(HOMEDIR_APPDATA, 'LetXinet Suite');
  return path.join(base, 'chats');
}

function ensureChatsDir(): void {
  try {
    fs.mkdirSync(getChatsDir(), { recursive: true });
  } catch (_) {}
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  ts?: string;
  toolName?: string;
  toolInput?: string;
}

export interface Chat {
  uuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider?: string;
  model?: string;
  messages: ChatMessage[];
}

export interface ChatMetadata {
  uuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider?: string;
  model?: string;
  msgCount: number;
}

function newUuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- API publica ---

export function listChats(): ChatMetadata[] {
  ensureChatsDir();
  const dir = getChatsDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const chats: ChatMetadata[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const c: Chat = JSON.parse(raw);
      chats.push({
        uuid: c.uuid,
        title: c.title || 'Sin título',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        provider: c.provider,
        model: c.model,
        msgCount: Array.isArray(c.messages) ? c.messages.length : 0,
      });
    } catch (_) {}
  }
  // Ordenar por updatedAt desc (más reciente primero)
  chats.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return chats;
}

export function readChat(uuid: string): Chat | null {
  ensureChatsDir();
  const file = path.join(getChatsDir(), `${uuid}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

export function createChat(opts?: { title?: string; provider?: string; model?: string }): Chat {
  ensureChatsDir();
  const uuid = newUuid();
  const now = nowIso();
  const chat: Chat = {
    uuid,
    title: (opts && opts.title) || 'Nuevo chat',
    createdAt: now,
    updatedAt: now,
    provider: opts?.provider,
    model: opts?.model,
    messages: [],
  };
  persistChat(chat);
  return chat;
}

export function persistChat(chat: Chat): boolean {
  ensureChatsDir();
  chat.updatedAt = nowIso();
  const file = path.join(getChatsDir(), `${chat.uuid}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(chat, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

// Reemplaza el titulo del chat
export function renameChat(uuid: string, title: string): boolean {
  const c = readChat(uuid);
  if (!c) return false;
  c.title = title.trim() || c.title;
  return persistChat(c);
}

// Append de un mensaje al chat. Devuelve el chat actualizado.
export function appendMessage(uuid: string, msg: ChatMessage): Chat | null {
  const c = readChat(uuid);
  if (!c) return null;
  if (!msg.ts) msg.ts = nowIso();
  c.messages.push(msg);
  // Auto-título: si el chat tiene título default y entra un mensaje user, usa su contenido
  if ((c.title === 'Nuevo chat' || !c.title) && msg.role === 'user') {
    c.title = msg.content.slice(0, 60).replace(/\s+/g, ' ').trim() || c.title;
  }
  persistChat(c);
  return c;
}

// Update del último mensaje assistant (uso: persistir el contenido streamed
// al terminar el streaming — el placeholder se persiste vacío al inicio y
// luego se actualiza con el contenido final). VARIANTE C v1.4.2 fix B2.
export function updateLastAssistantMessage(
  uuid: string,
  patch: { content: string; toolName?: string; toolInput?: string }
): Chat | null {
  const c = readChat(uuid);
  if (!c) return null;
  // buscar desde el último hacia atrás el primer msg assistant
  for (let i = c.messages.length - 1; i >= 0; i--) {
    if (c.messages[i].role === 'assistant') {
      c.messages[i] = {
        ...c.messages[i],
        content: patch.content,
        toolName: patch.toolName ?? c.messages[i].toolName,
        toolInput: patch.toolInput ?? c.messages[i].toolInput,
      };
      persistChat(c);
      return c;
    }
  }
  return null;
}

// Sobrescribe todo el array de mensajes (usado al edicion masiva / reset)
export function setMessages(uuid: string, messages: ChatMessage[]): Chat | null {
  const c = readChat(uuid);
  if (!c) return null;
  c.messages = messages;
  persistChat(c);
  return c;
}

export function deleteChat(uuid: string): boolean {
  const file = path.join(getChatsDir(), `${uuid}.json`);
  try {
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  } catch (_) {
    return false;
  }
}

export function getChatsDirPath(): string {
  return getChatsDir();
}
