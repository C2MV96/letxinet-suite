// ============================================================================
// VARIANTE C v1.2 — Modelos custom (sin recompilar)
// ----------------------------------------------------------------------------
// Lee/escribe %APPDATA%\LetXinet Suite\custom-models.json.
// Persiste modelos del operador que no estan en el catalogo built-in ni en
// syncedModelGroups. Cada modelo referencia un provider existente y un
// endpoint override (opcional).
//
// MEJORA vs BETAA-SX: el CustomModelEditor del BETAA-SX persiste en
// localStorage (NO portable entre maquinas ni sobrevive a cambios de
// navegador). Aqui se persiste en disco (APPDATA) bajo ACL del usuario —
// sobrevive reinstalaciones, es leible por el Electron main y por el
// server.cjs en cualquier proceso.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CustomModelData } from './models/types';

const HOMEDIR_APPDATA = process.env.APPDATA ||
  path.join(os.homedir(), 'AppData', 'Roaming');

function getCustomModelsFile(): string {
  // Reusa LETXIPU_DESKTOP_USERDATA si el Electron main lo inyecta;
  // default a %APPDATA%\LetXinet Suite\custom-models.json
  const base = process.env.LETXIPU_DESKTOP_USERDATA ||
    path.join(HOMEDIR_APPDATA, 'LetXinet Suite');
  return path.join(base, 'custom-models.json');
}

export function readCustomModels(): CustomModelData[] {
  try {
    const f = getCustomModelsFile();
    if (!fs.existsSync(f)) return [];
    const raw = fs.readFileSync(f, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return (Array.isArray(parsed) ? parsed : [])
      .filter((m) => m && typeof m.label === 'string' && typeof m.provider === 'string');
  } catch {
    return [];
  }
}

export function writeCustomModels(list: CustomModelData[]): boolean {
  try {
    const f = getCustomModelsFile();
    const dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function getCustomModelsPath(): string {
  return getCustomModelsFile();
}

export function addCustomModel(model: CustomModelData): { ok: boolean; reason?: string } {
  const list = readCustomModels();
  if (list.some((m) => m.value === model.value && m.provider === model.provider)) {
    return { ok: false, reason: 'Ya existe un modelo custom con ese value+provider.' };
  }
  list.push(model);
  return writeCustomModels(list)
    ? { ok: true }
    : { ok: false, reason: 'No se pudo escribir en custom-models.json' };
}

export function deleteCustomModel(value: string, provider: string): boolean {
  const list = readCustomModels();
  const next = list.filter((m) => !(m.value === value && m.provider === provider));
  if (next.length === list.length) return false;
  return writeCustomModels(next);
}

export function toggleCustomModel(value: string, provider: string): boolean {
  const list = readCustomModels();
  const m = list.find((x) => x.value === value && x.provider === provider);
  if (!m) return false;
  m.enabled = !m.enabled;
  return writeCustomModels(list);
}
