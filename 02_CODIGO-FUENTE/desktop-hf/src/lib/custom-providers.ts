// ============================================================================
// VARIANTE C v1.2 — Providers custom (sin recompilar)
// ----------------------------------------------------------------------------
// Lee ~/.letxinet-suite/custom-providers.json. Si no existe, devuelve [].
// Permite al operador AGREGAR un provider nuevo (p.ej. self-hosted vLLM,
// Ollama local, Gateway empresarial) tocando un JSON externo, sin pasar por
// el catalogo built-in.
// El merge runtime con PROVIDERS_CATALOG lo hace getFullProviderCatalog().
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PROVIDERS_CATALOG } from './providers-catalog';
import type { ProviderCatalogEntry } from './models/types';

const CUSTOM_PROVIDERS_PATH = path.join(
  os.homedir(),
  '.letxinet-suite',
  'custom-providers.json'
);

export function readCustomProviders(): ProviderCatalogEntry[] {
  try {
    if (!fs.existsSync(CUSTOM_PROVIDERS_PATH)) return [];
    const raw = fs.readFileSync(CUSTOM_PROVIDERS_PATH, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCustomProviders(list: ProviderCatalogEntry[]): boolean {
  try {
    const dir = path.dirname(CUSTOM_PROVIDERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      CUSTOM_PROVIDERS_PATH,
      JSON.stringify(list, null, 2),
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}

export function getCustomProvidersPath(): string {
  return CUSTOM_PROVIDERS_PATH;
}

/**
 * Catalogo FINAL que ve la app: built-in + custom.
 * Si un custom-provider tiene el mismo `id` que un built-in, custom gana
 * (override). Eso permite al operador sobrescribir highlightedModels o
 * modelsEndpoint de un provider built-in sin editar codigo.
 */
export function getFullProviderCatalog(): ProviderCatalogEntry[] {
  const custom = readCustomProviders();
  const customIds = new Set(custom.map((p) => p.id));
  return [
    ...PROVIDERS_CATALOG.filter((p) => !customIds.has(p.id)),
    ...custom,
  ];
}

export function findProvider(id: string): ProviderCatalogEntry | undefined {
  return getFullProviderCatalog().find((p) => p.id === id);
}
