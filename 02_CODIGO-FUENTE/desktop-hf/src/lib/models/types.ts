// ============================================================================
// VARIANTE C v1.2 — Tipos canonicos para providers y modelos
// ----------------------------------------------------------------------------
// A diferencia del BETAA-SX (que tiene `provider` como union type triplicado
// en 3 archivos distintos), aqui `provider` es string abierto. La validacion
// runtime se hace contra PROVIDERS_CATALOG + custom-providers.json via
// getFullProviderCatalog().
// ============================================================================

export interface ModelOption {
  label: string;
  /** Formato "modelId:provider" (p.ej. "mistral-small-2506:mistral") */
  value: string;
  context?: string;
  priceIn?: string;
  priceOut?: string;
  isLive?: boolean;
}

export interface ModelGroup {
  label: string;
  /** Provider id libre (string). Se valida contra catalogo en runtime. */
  provider: string;
  options: ModelOption[];
}

export interface CustomModelData {
  label: string;
  value: string;
  provider: string;
  endpoint?: string;
  /** Nombre de la env var (NO el valor) que aporta la API key del modelo. */
  apiKeyEnvKey?: string;
  contextWindow?: number;
  maxTokens?: number;
  enabled: boolean;
}

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  category: 'primary' | 'secondary' | 'academic';
  /** nombre del campo en secrets.json (p.ej. 'geminiApiKey'). */
  keyParam: string;
  /** variable env (p.ej. 'GEMINI_API_KEY'). */
  keyEnvName: string;
  /** base URL OpenAI-compatible (p.ej. 'https://api.mistral.ai/v1'). */
  apiEndpoint: string;
  /** URL del endpoint /models (null si el provider no expone /models). */
  modelsEndpoint?: string | null;
  signupUrl?: string;
  docsUrl?: string;
  pricingUrl?: string;
  requiresKey: boolean;
  freeModels: boolean;
  /** IDs verificados en docs del provider (no inventados). */
  highlightedModels?: string[];
  description?: string;
  /** El operador puede pulsar "Sincronizar modelos" — solo true si /models funciona. */
  canScrape?: boolean;
}

export interface SyncedModels {
  lastSynced: string;
  models: Array<{
    id: string;
    name?: string;
    contextLength?: number;
  }>;
}

export type ProviderCategory = ProviderCatalogEntry['category'];
