// ============================================================================
// VARIANTE C v1.2 — Sincronizador generico de modelos
// ----------------------------------------------------------------------------
// Unifica los fetches /v1/models del BETAA-SX (que tenia 6 endpoints
// sync-*/route.ts duplicados) en una sola funcion syncProviderModels().
// Cachea el resultado a data/{providerId}_models.json.
// Esta funcion es llamada por server.ts scrapeAndSyncModels() en runtime.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { findProvider } from '../custom-providers';
import type { SyncedModels } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // Non-fatal: caller solo no podra cachear.
  }
}

function cachePath(providerId: string): string {
  return path.join(DATA_DIR, `${providerId}_models.json`);
}

export function readProviderModelsCache(providerId: string): SyncedModels | null {
  try {
    const f = cachePath(providerId);
    if (!fs.existsSync(f)) return null;
    const raw = fs.readFileSync(f, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || !Array.isArray(parsed.models)) return null;
    return parsed as SyncedModels;
  } catch {
    return null;
  }
}

function buildFetchHeaders(providerId: string, apiKey: string): Record<string, string> {
  // Gemini usa ?key=APIKEY en la URL, no header Authorization.
  if (providerId === 'gemini') {
    return { 'Content-Type': 'application/json' };
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function buildFetchUrl(modelsEndpoint: string | null | undefined, apiKey: string): string {
  if (!modelsEndpoint) throw new Error('Provider no expone endpoint /models.');
  // Si el endpoint tiene el placeholder APIKEY, lo sustituimos (caso Gemini).
  if (modelsEndpoint.includes('APIKEY')) {
    return modelsEndpoint.replace('APIKEY', encodeURIComponent(apiKey));
  }
  return modelsEndpoint;
}

/**
 * Sincroniza modelos de un provider via su endpoint /models.
 * Cachea el resultado en data/{providerId}_models.json.
 *
 * @returns modelo SyncedModels con lastSynced timestamp
 * @throws si el provider no expone /models o el fetch falla
 */
export async function syncProviderModels(
  providerId: string,
  apiKey: string
): Promise<SyncedModels> {
  const prov = findProvider(providerId);
  if (!prov) {
    throw new Error(`Provider '${providerId}' no encontrado en catalogo.`);
  }
  if (!prov.modelsEndpoint) {
    throw new Error(
      `${providerId} no expone endpoint /models. ` +
      `Usar highlightedModels del catalogo.`
    );
  }
  if (!apiKey) {
    throw new Error(`API key de '${providerId}' no configurada.`);
  }

  const url = buildFetchUrl(prov.modelsEndpoint, apiKey);
  const headers = buildFetchHeaders(providerId, apiKey);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${providerId} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await res.json();
  // Normalizar: los providers OpenAI-compat retornan { data: [...] } o array plain
  // u ocasionalmente { models: [...] }.
  const rawListRaw = Array.isArray(data) ? data : (data?.data || data?.models || []);
  const rawList = Array.isArray(rawListRaw) ? rawListRaw : [];

  const models = rawList.map((m: any) => {
    const id = typeof m === 'string' ? m : (m.id || m.name || '');
    return {
      id,
      name: typeof m === 'object' ? (m.name || m.id) : id,
      contextLength: typeof m === 'object' ? (m.context_length || m.context_window) : undefined,
    };
  }).filter((m: any) => m.id);

  const out: SyncedModels = {
    lastSynced: new Date().toISOString(),
    models,
  };

  // Persistir cache JSON
  try {
    ensureDataDir();
    fs.writeFileSync(cachePath(providerId), JSON.stringify(out, null, 2), 'utf8');
  } catch {
    // non-fatal: si no podemos cachear, devolvemos igualmente.
  }

  return out;
}
