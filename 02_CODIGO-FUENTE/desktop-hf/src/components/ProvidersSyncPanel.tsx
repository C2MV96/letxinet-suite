/**
 * ProvidersSyncPanel (Variante C v1.2 — God Mode)
 * Patrón basado en OpenRouterSyncPanel del BETAA-SX, generalizado para todos los providers.
 * - Lista Providers catalogados (built-in + custom).
 * - Sync individual por botón → POST/GET a /api/providers/:id/models?live=true
 * - Cache visual (lastSynced, modelos en disco)
 * - Tabla de modelos sincronizados + Custom Models CRUD
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Database, CheckCircle2, AlertCircle, Plus, Trash2, Eye, EyeOff, Clock, ExternalLink } from 'lucide-react';

type ProviderCatalogEntry = {
  id: string;
  name: string;
  category?: string;
  keyParam: string;
  keyEnvName: string;
  apiEndpoint?: string;
  modelsEndpoint?: string;
  signupUrl?: string;
  docsUrl?: string;
  pricingUrl?: string;
  requiresKey: boolean;
  freeModels?: boolean;
  highlightedModels: string[];
  canScrape: boolean;
  description?: string;
};

type SyncedModels = {
  models: Array<{ id: string; name?: string; context?: number; owned_by?: string }>;
  count: number;
  lastSynced: string;
  cached?: boolean;
};

type CustomModel = {
  value: string;
  label: string;
  provider: string;
  enabled: boolean;
};

export default function ProvidersSyncPanel() {
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [caches, setCaches] = useState<Record<string, SyncedModels | null>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newM, setNewM] = useState({ value: '', label: '', provider: '' });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, cmRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/custom-models'),
      ]);
      const pd = await provRes.json();
      const cmd = await cmRes.json();
      if (pd.ok) setProviders(pd.providers || []);
      if (cmd.ok) setCustomModels(cmd.models || []);
      // carga cache de cada provider en paralelo
      const ps: ProviderCatalogEntry[] = pd.providers || [];
      const cacheEntries = await Promise.all(
        ps.map(async (p) => {
          try {
            const r = await fetch(`/api/providers/${p.id}/models`);
            const d = await r.json();
            return [p.id, d.cache || null] as const;
          } catch {
            return [p.id, null] as const;
          }
        })
      );
      const cacheMap: Record<string, SyncedModels | null> = {};
      cacheEntries.forEach(([id, c]) => (cacheMap[id] = c));
      setCaches(cacheMap);
    } catch (e: any) {
      setErrors({ global: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const syncOne = async (p: ProviderCatalogEntry) => {
    setSyncing((s) => ({ ...s, [p.id]: true }));
    setErrors((e) => ({ ...e, [p.id]: '' }));
    try {
      const r = await fetch(`/api/providers/${p.id}/models?live=true`);
      const d = await r.json();
      if (d.ok) {
        setCaches((c) => ({
          ...c,
          [p.id]: {
            models: d.models || [],
            count: d.count || 0,
            lastSynced: d.lastSynced || new Date().toISOString(),
            cached: false,
          },
        }));
      } else {
        setErrors((e) => ({
          ...e,
          [p.id]: d.error || d.reason || `HTTP ${r.status}`,
        }));
      }
    } catch (e: any) {
      setErrors((er) => ({ ...er, [p.id]: e?.message || String(e) }));
    } finally {
      setSyncing((s) => ({ ...s, [p.id]: false }));
    }
  };

  const saveCustomModel = async () => {
    if (!newM.value || !newM.label) return;
    try {
      const r = await fetch('/api/custom-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'add',
          model: {
            value: newM.value,
            label: newM.label,
            provider: newM.provider || 'unknown',
            enabled: true,
          },
        }),
      });
      const d = await r.json();
      if (d.ok) {
        await fetchAll();
        setNewM({ value: '', label: '', provider: '' });
        setShowAdd(false);
      }
    } catch (e: any) {
      setErrors((er) => ({ ...er, global: e?.message || String(e) }));
    }
  };

  const toggleModel = async (value: string, provider: string) => {
    await fetch('/api/custom-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'toggle', model: { value, provider } }),
    });
    await fetchAll();
  };

  const deleteModel = async (value: string, provider: string) => {
    await fetch('/api/custom-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'delete', model: { value, provider } }),
    });
    await fetchAll();
  };

  const fmtLast = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return `hace ${Math.floor(diff)}s`;
      if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
      if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-5 text-sm">
      {/* §[A] Providers catalogados */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
            <Database className="w-4 h-4 text-indigo-500" />
            Proveedores · Sincronización por panel (God Mode)
          </div>
          <button
            onClick={fetchAll}
            className="text-xs px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refrescar catálogo
          </button>
        </header>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {providers.map((p) => {
            const cache = caches[p.id];
            const isSyncing = syncing[p.id];
            const err = errors[p.id];
            return (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                        {p.id}
                      </span>
                      {p.canScrape ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> scrapear /v1/models
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> sin /models
                        </span>
                      )}
                      {p.freeModels && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          FREE tier
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        último sync: {fmtLast(cache?.lastSynced)}
                      </span>
                      <span>· {cache?.count || 0} modelos</span>
                      {p.signupUrl && (
                        <a
                          href={p.signupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 hover:text-indigo-500"
                        >
                          signup <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => syncOne(p)}
                    disabled={isSyncing || !p.canScrape}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      isSyncing
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                        : p.canScrape
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando…' : 'Sincronizar modelos'}
                  </button>
                </div>

                {err && (
                  <div className="mt-2 text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {err}
                  </div>
                )}

                {cache?.models && cache.models.length > 0 && (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline select-none">
                      Ver {cache.models.length} modelos ↓
                    </summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
                      {cache.models.slice(0, 50).map((m) => (
                        <div
                          key={m.id}
                          className="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="truncate">{m.id}</div>
                          {(m.context || m.owned_by) && (
                            <div className="text-[10px] text-zinc-400">
                              {m.context ? `${Math.round(m.context / 1000)}K ctx` : ''}
                              {m.owned_by ? ` · ${m.owned_by}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                      {cache.models.length > 50 && (
                        <div className="col-span-full text-center text-[11px] text-zinc-400 py-1">
                          …y {cache.models.length - 50} más
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {p.highlightedModels.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-zinc-400 hover:underline select-none">
                      Modelos destacados (fallback offline) ↓
                    </summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.highlightedModels.map((m) => (
                        <span
                          key={m}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* §[B] Custom Models CRUD */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
            <Plus className="w-4 h-4 text-emerald-500" />
            Modelos Custom · persistidos en %APPDATA%\LetXinet Suite\custom-models.json
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="text-xs px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Nuevo
          </button>
        </header>

        {showAdd && (
          <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="value (id) · ej: mistral-small-2506"
              value={newM.value}
              onChange={(e) => setNewM({ ...newM, value: e.target.value })}
              className="text-xs px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
            <input
              type="text"
              placeholder="label · ej: Mistral Small 2506"
              value={newM.label}
              onChange={(e) => setNewM({ ...newM, label: e.target.value })}
              className="text-xs px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
            <select
              value={newM.provider}
              onChange={(e) => setNewM({ ...newM, provider: e.target.value })}
              className="text-xs px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <option value="">— provider —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="unknown">unknown</option>
            </select>
            <button
              onClick={saveCustomModel}
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
            >
              Guardar
            </button>
          </div>
        )}

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {customModels.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-zinc-400">
              No hay modelos custom. Añade uno con el botón "Nuevo" ·
              Estos modelos aparecen en el chat además de los sincronizados.
            </div>
          )}
          {customModels.map((m, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3">
              <button
                onClick={() => toggleModel(m.value, m.provider)}
                className="text-zinc-400 hover:text-indigo-500"
                title={m.enabled ? 'Deshabilitar' : 'Habilitar'}
              >
                {m.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200 truncate">
                  {m.value}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {m.label} · <span className="font-mono">{m.provider}</span>
                </div>
              </div>
              <button
                onClick={() => deleteModel(m.value, m.provider)}
                className="text-zinc-400 hover:text-red-500"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {errors.global && (
        <div className="px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {errors.global}
        </div>
      )}
    </div>
  );
}
