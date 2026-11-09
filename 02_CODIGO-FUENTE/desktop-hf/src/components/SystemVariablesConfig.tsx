import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  Settings, Save, Loader2, RefreshCw, RotateCw,
  ChevronDown, ChevronRight, Lock, Eye, EyeOff,
  CheckCircle2, AlertCircle, ExternalLink, RotateCcw,
  AlertTriangle, FileText, ShieldCheck, Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// VARIANTE C — Variables de Sistema
// Edita visualmente LetXinet-Suite.env (ProgramData) sin Notepad.
// Renderiza dinamicamente las 11 secciones que el backend parsea.
// ---------------------------------------------------------------------------

interface EnvVar {
  key: string;
  value: string;
  line: number;
  comment?: string;
  readOnly: boolean;
}
interface EnvSection {
  id: number;
  title: string;
  readOnlyKeys?: string[];
  variables: EnvVar[];
}
interface SystemVarsResponse {
  ok: boolean;
  notInstalled?: boolean;
  reason?: string;
  sections?: EnvSection[];
  envPath?: string;
  lastModified?: string;
  size?: number;
}

// Metadatos de tipos especiales para inputs.
// El frontend decide el tipo basandose en: override explicito OR convencion de
// nombre (KEY_API_KEY, KEY_TOKEN, KEY_SECRET -> secret; *_PORT, *_TIMEOUT_MS,
// *_MAX_MB, *_CONCURRENCY, *_CAP -> slider o number).
const TYPE_SELECT_OPTIONS: Record<string, string[]> = {
  DESKTOP_ENDPOINT_MODE: ['auto', 'local_only', 'remote_only', 'hf_only'],
  DOC_EXTRACTOR_MODE: ['auto', 'mineru_only', 'markitdown_only', 'pdfparse_only'],
  ALLOW_REMOTE_EXTRACTION: ['true', 'false'],
  MARKITDOWN_ENABLED: ['true', 'false'],
  DESKTOP_HF_ONLY: ['true', 'false'],
  LOG_LEVEL: ['trace', 'debug', 'info', 'warn', 'error'],
};
const TYPE_SLIDER_RANGE: Record<string, [number, number, number]> = {
  // [min, max, step]
  EXTRACTOR_TIMEOUT_MS: [60000, 360000, 10000],
  EXTRACTOR_MAX_MB: [10, 500, 10],
  MAX_BATCH_CONCURRENCY: [1, 16, 1],
  PROVIDER_TIMEOUT_MS: [5000, 600000, 5000],
  PROVIDER_GATE_TTL_MS: [60000, 7200000, 60000],
  RENATI_ATTEMPT_TIMEOUT_MS: [5000, 120000, 5000],
  MINERU_TIMEOUT: [60000, 600000, 10000],
  OPENALEX_DAILY_CAP: [1000, 200000, 1000],
  MARKITDOWN_MAX_PDF_MB: [10, 1000, 10],
};
const TYPE_TEXTAREA_KEYS = new Set(['SCIHUB_MIRRORS']);
const TYPE_SECRET_PATTERN = /(_API_KEY|_TOKEN|_SECRET)$/i;

// Keys que son URLs y validamos con regex simple
const TYPE_URL_KEYS = new Set([
  'LOCAL_MCP_URL', 'LETXIPU_MCP_URL', 'LETXIPU_OSM_MCP_URL', 'LETXINET_MCP_URL',
  'UNPAYWALL_BASE_URL', 'DOI_RESOLVER_URL', 'MINERU_API_URL',
  'MISTRAL_BASE_URL', 'NVIDIA_BASE_URL', 'OPENCODE_BASE_URL',
  'NOMINATIM_URL', 'OVERPASS_URL', 'MARKITDOWN_API_URL',
  'OSM_MCP_URL', 'OPENREVIEW_API_V1', 'OPENREVIEW_API_V2',
]);
const TYPE_EMAIL_KEYS = new Set(['UNPAYWALL_EMAIL', 'OPENALEX_MAILTO']);

// Body de colores del indicador de estado por seccion
function getSectionStatus(vars: EnvVar[]): 'ok' | 'warn' | 'err' {
  const empties = vars.filter((v) => !v.value && !v.readOnly).length;
  const allReadonly = vars.every((v) => v.readOnly);
  if (allReadonly) return 'ok';
  if (empties === vars.filter((v) => !v.readOnly).length) return 'err';
  if (empties > 0) return 'warn';
  return 'ok';
}

function validateValue(key: string, value: string): string | null {
  if (TYPE_URL_KEYS.has(key) && value) {
    if (!/^https?:\/\/.+/.test(value)) return 'Invalid URL (must start with http:// or https://)';
  }
  if (TYPE_EMAIL_KEYS.has(key) && value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
  }
  if (TYPE_SLIDER_RANGE[key]) {
    const n = Number(value);
    const [min, max] = TYPE_SLIDER_RANGE[key];
    if (Number.isNaN(n) || n < min || n > max) return `Must be between ${min} and ${max}`;
  }
  return null;
}

// ===========================================================================
// COMPONENT
// ===========================================================================
export default function SystemVariablesConfig() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [sections, setSections] = useState<EnvSection[]>([]);
  const [envPath, setEnvPath] = useState('');
  const [lastModified, setLastModified] = useState('');
  const [notInstalled, setNotInstalled] = useState(false);
  const [reason, setReason] = useState('');
  // dirtyValues: solo las keys modificadas (para POST no enviar todo)
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<number | string, boolean>>({ 1: true, 5: true });
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchVars = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/system-variables');
      const d: SystemVarsResponse = await res.json();
      if (d.ok) {
        setSections(d.sections || []);
        setEnvPath(d.envPath || '');
        setLastModified(d.lastModified || '');
        setNotInstalled(false);
        setReason('');
        // Preserva expanded state, solo setea defaults si no hay
        setExpanded((prev) => {
          const next = { ...prev };
          (d.sections || []).forEach((s) => {
            if (next[s.id] === undefined) {
              next[s.id] = s.id === 1 || s.id === 5; // default: solo [1] y [5] abiertas
            }
          });
          return next;
        });
      } else if (d.notInstalled) {
        setNotInstalled(true);
        setReason(d.reason || 'Suite no instalado.');
      } else {
        setMsg({ ok: false, text: d.reason || `HTTP ${res.status}` });
      }
    } catch (err: any) {
      setMsg({ ok: false, text: `Error de red: ${err?.message || String(err)}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const dirtyCount = Object.keys(dirty).length;

  const setVar = (key: string, value: string) => {
    setDirty((d) => ({ ...d, [key]: value }));
  };

  const saveChanges = async () => {
    if (dirtyCount === 0) {
      setMsg({ ok: true, text: 'Sin cambios para guardar.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/system-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars: dirty }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        const elevatedNote = d.elevated ? ' (vía UAC elevado)' : '';
        let rejectedNote = '';
        if (d.rejected?.length) {
          if (d.rejectedApiKeys?.length === d.rejected.length) {
            // Todas las rechazadas eran API keys de providers LLM
            rejectedNote = ` ${d.rejectedApiKeys.length} API keys rechazadas (van en pestaña API Keys).`;
          } else {
            rejectedNote = ` ${d.rejected.length} keys rechazadas (read-only o inválidas).`;
          }
        }
        setMsg({
          ok: true,
          text: `${d.updated.length} variables actualizadas en LetXinet-Suite.env${elevatedNote}.${rejectedNote} Reinicia servicios para aplicar.`,
        });
        setDirty({});
        await fetchVars();
      } else {
        const apiKeyHint = d.apiKeyHint ? ` ${d.apiKeyHint}` : '';
        const hint = d.hint ? ` ${d.hint}` : '';
        const reason = d.reason ? ` ${d.reason}` : '';
        setMsg({ ok: false, text: `Error al guardar: ${d.error || res.status || reason}.${apiKeyHint || hint}` });
      }
    } catch (err: any) {
      const detail = err?.message || String(err);
      let hint = '';
      if (detail.includes('Failed to fetch') || detail.includes('NetworkError')) {
        hint = ' (backend no responde)';
      }
      setMsg({ ok: false, text: `Error de red: ${detail}${hint}` });
    } finally {
      setSaving(false);
    }
  };

  const saveAndRestart = async () => {
    if (dirtyCount === 0) {
      setMsg({ ok: false, text: 'No hay cambios que guardar. Edita algo antes de reiniciar.' });
      return;
    }
    setSaving(true);
    setRestarting(true);
    setMsg(null);
    try {
      const saveRes = await fetch('/api/system-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars: dirty }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !saveData.ok) {
        const apiKeyHint = saveData.apiKeyHint ? ` ${saveData.apiKeyHint}` : '';
        const hint = saveData.hint ? ` ${saveData.hint}` : '';
        const reason = saveData.reason ? ` ${saveData.reason}` : '';
        setMsg({ ok: false, text: `Guardado falló: ${saveData.error || saveRes.status || reason}.${apiKeyHint || hint}` });
        return;
      }
      setDirty({});
      // Ahora reinicia servicios (reusa endpoint /api/keys/restart-services)
      const restartRes = await fetch('/api/keys/restart-services', { method: 'POST' });
      const restartData = await restartRes.json().catch(() => ({}));
      // Construir nota de API keys rechazadas si las hubo
      let apiKeyNote = '';
      if (saveData.rejectedApiKeys?.length) {
        apiKeyNote = ` ${saveData.rejectedApiKeys.length} API keys rechazadas (van en pestaña API Keys).`;
      }
      if (restartRes.ok) {
        if (restartData.skipped) {
          setMsg({ ok: true, text: `Guardado OK. Reinicio skipeado: ${restartData.reason}${apiKeyNote}` });
        } else if (restartData.ok) {
          setMsg({ ok: true, text: `Guardado OK. 3 servicios NSSM reiniciados. Variables activas ahora.${apiKeyNote}` });
        } else if (restartData.elevated) {
          setMsg({ ok: true, text: `Guardado OK. Reinicio elevado lanzado (UAC). Aplica en segundos.${apiKeyNote}` });
        } else {
          setMsg({ ok: false, text: `Guardado OK. Reinicio parcial: ${JSON.stringify(restartData.results)}${apiKeyNote}` });
        }
      } else {
        setMsg({ ok: false, text: `Guardado OK. Error reinicio: ${restartData.error || restartRes.status}${apiKeyNote}` });
      }
      await fetchVars();
    } catch (err: any) {
      setMsg({ ok: false, text: `Error: ${err?.message || String(err)}` });
    } finally {
      setSaving(false);
      setRestarting(false);
    }
  };

  const discardChanges = () => {
    setConfirmDiscard(false);
    setDirty({});
    setMsg({ ok: true, text: 'Cambios descartados.' });
  };

  const toggleExpand = (id: number | string) =>
    setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // ========================================================================
  // RENDER de cada VAR segun su tipo
  // ========================================================================
  const renderVar = (v: EnvVar) => {
    const dirtyValue = dirty[v.key];
    const isDirty = dirtyValue !== undefined;
    const currentValue = isDirty ? dirtyValue : v.value;
    const validationError = validateValue(v.key, currentValue);
    // Determine input kind
    let kind: 'readonly' | 'select' | 'slider' | 'textarea' | 'secret' | 'url' | 'email' | 'text' = 'text';
    if (v.readOnly) kind = 'readonly';
    else if (TYPE_SELECT_OPTIONS[v.key]) kind = 'select';
    else if (TYPE_SLIDER_RANGE[v.key]) kind = 'slider';
    else if (TYPE_TEXTAREA_KEYS.has(v.key)) kind = 'textarea';
    else if (TYPE_SECRET_PATTERN.test(v.key) || /MINERU_API_KEY|HF_TOKEN|SERP_API_KEY|SERPAPI_KEY|CORE_API_KEY|SEMANTIC_SCHOLAR_API_KEY|SCOPUS_API_KEY|REDALYC_TOKEN|ANTHROPIC|OPENAI|GROQ|GEMINI|NVIDIA|OPENCODE|MISTRAL/.test(v.key)) kind = 'secret';
    else if (TYPE_URL_KEYS.has(v.key)) kind = 'url';
    else if (TYPE_EMAIL_KEYS.has(v.key)) kind = 'email';

    const show = showSecret[v.key];
    const toggleShow = () => setShowSecret((s) => ({ ...s, [v.key]: !s[v.key] }));

    // Wrapper para comentario + label
    const label = (
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-200">{v.key}</label>
        {v.readOnly && (
          <Lock className="w-3 h-3 text-zinc-400" aria-label="read-only" />
        )}
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Modificado" />
        )}
      </div>
    );

    return (
      <div key={v.key} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
        {label}
        {/* Input body segun kind */}
        {kind === 'readonly' && (
          <input
            type="text"
            value={currentValue}
            disabled
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
            spellCheck={false}
          />
        )}
        {kind === 'select' && (
          <select
            value={currentValue}
            onChange={(e) => setVar(v.key, e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TYPE_SELECT_OPTIONS[v.key].map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
        {kind === 'slider' && (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={TYPE_SLIDER_RANGE[v.key][0]}
              max={TYPE_SLIDER_RANGE[v.key][1]}
              step={TYPE_SLIDER_RANGE[v.key][2]}
              value={Number(currentValue) || TYPE_SLIDER_RANGE[v.key][0]}
              onChange={(e) => setVar(v.key, e.target.value)}
              className="flex-1 accent-indigo-500"
            />
            <input
              type="number"
              value={currentValue}
              onChange={(e) => setVar(v.key, e.target.value)}
              className="w-24 px-2 py-1 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        {kind === 'textarea' && (
          <textarea
            value={currentValue}
            onChange={(e) => setVar(v.key, e.target.value)}
            rows={3}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            spellCheck={false}
          />
        )}
        {kind === 'secret' && (
          <div className="relative flex items-center">
            <input
              type={show ? 'text' : 'password'}
              value={currentValue}
              onChange={(e) => setVar(v.key, e.target.value)}
              placeholder="••••••••"
              className="w-full px-2.5 py-1.5 pr-9 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={toggleShow}
              className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              title={show ? 'Ocultar' : 'Mostrar'}
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        {(kind === 'url' || kind === 'email' || kind === 'text') && (
          <input
            type={kind === 'email' ? 'email' : 'text'}
            value={currentValue}
            onChange={(e) => setVar(v.key, e.target.value)}
            placeholder={kind === 'url' ? 'https://...' : kind === 'email' ? 'admin@tudominio.com' : ''}
            className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border ${
              validationError ? 'border-amber-400 dark:border-amber-600' : 'border-zinc-200 dark:border-zinc-700'
            } text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            spellCheck={false}
            autoComplete="off"
          />
        )}
        {/* Comment / hint */}
        {v.comment && (
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic leading-tight whitespace-pre-wrap">
            {v.comment.split('\n')[0]}
          </p>
        )}
        {/* Validation error */}
        {validationError && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            {validationError}
          </p>
        )}
      </div>
    );
  };

  // ========================================================================
  // RENDER de cada seccion colapsable
  // ========================================================================
  // VARIANTE C v1.4 — Agrupación de la sección [8] por provider (fix bugs 10a-10f)
  // Mapa de key-prefix → grupo de provider. Cada grupo renderiza colapsable con API_KEY+BASE_URL juntos.
  const PROVIDER_GROUPS_8: Array<{ id: string; name: string; keys: string[]; description?: string; signupUrl?: string; docsUrl?: string }> = [
    { id: 'gemini', name: 'Google Gemini', keys: ['GEMINI_API_KEY'], description: 'Modelos multimodales de Google. Tier free.', signupUrl: 'https://aistudio.google.com/apikey' },
    { id: 'anthropic', name: 'Anthropic Claude', keys: ['ANTHROPIC_API_KEY', 'ANTHROPIC_TOKEN'], description: 'Claude (Sonnet, Opus, Haiku). Alias ANTHROPIC_TOKEN = misma key.', signupUrl: 'https://console.anthropic.com/' },
    { id: 'openai', name: 'OpenAI', keys: ['OPENAI_API_KEY', 'OPENAI_TOKEN'], description: 'GPT-4o, o1, etc. Alias OPENAI_TOKEN = misma key.', signupUrl: 'https://platform.openai.com/api-keys' },
    { id: 'groq', name: 'Groq (Ultra-fast)', keys: ['GROQ_API_KEY', 'GROQ_TOKEN'], description: 'LPU hardware. Llama/Mixtral modelos open-source. Tier free.', signupUrl: 'https://console.groq.com/keys' },
    { id: 'mistral', name: 'Mistral AI', keys: ['MISTRAL_API_KEY', 'MISTRAL_BASE_URL'], description: 'Lab francés. GDPR. Codestral/Pixtral. BASE_URL opcional para proxy.', signupUrl: 'https://console.mistral.ai/' },
    { id: 'nvidia', name: 'NVIDIA NIM', keys: ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL'], description: 'NIM self-hosted o cloud. BASE_URL opcional para NIM local.', signupUrl: 'https://build.nvidia.com/' },
    { id: 'opencode', name: 'OpenCode Cloud (Gateway)', keys: ['OPENCODE_API_KEY', 'OPENCODE_BASE_URL'], description: 'Gateway multi-modelos (GPT/Claude/Qwen/Deepseek). BASE_URL para backend alt.', signupUrl: 'https://opencode.ai/' },
  ];

  // FIX bug "No disponible": como el backend ahora marca *_API_KEY como
  // readOnly=true, los inputs se renderizan bloqueados automaticamente con
  // icono Lock. El warning amarillo se elimina; en su lugar mostramos un info
  // banner verde permanentemente (cuando el grupo tiene *_API_KEY) con el
  // mensaje "Configura tu API key en la pestana API Keys".
  // Solo *_BASE_URL sigue siendo editable aqui (para NIM/proxy self-hosted).
  const PROVIDER_APIKEY_WARNING_KEYS = new Set([
    'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_TOKEN',
    'OPENAI_API_KEY', 'OPENAI_TOKEN', 'GROQ_API_KEY', 'GROQ_TOKEN',
    'MISTRAL_API_KEY', 'NVIDIA_API_KEY', 'OPENCODE_API_KEY',
    'NEBIUS_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY',
  ]);

  const renderSection = (s: EnvSection) => {
    const isOpen = !!expanded[s.id];
    const status = getSectionStatus(s.variables);
    const dirtyInSec = s.variables.filter((v) => dirty[v.key] !== undefined).length;
    const statusColor = status === 'ok' ? 'emerald' : status === 'warn' ? 'amber' : 'red';
    const StatusIcon = status === 'ok' ? ShieldCheck : status === 'warn' ? AlertTriangle : AlertCircle;
    return (
      <section
        key={s.id}
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Header (click para expandir/colapsar) */}
        <button
          type="button"
          onClick={() => toggleExpand(s.id)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            )}
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate">
              [{s.id}] {s.title}
            </span>
            {dirtyInSec > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                {dirtyInSec} edit
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusIcon className={`w-3.5 h-3.5 text-${statusColor}-500`} />
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
              {s.variables.length}
            </span>
          </div>
        </button>
        {/* Body */}
        {isOpen && s.id === 8 ? (
          // VARIANTE C v1.4 — Sección [8] renderizada agrupada por provider (fix bugs 10a-10f)
          <div className="p-3 bg-white dark:bg-zinc-950/40 space-y-3">
            {PROVIDER_GROUPS_8.map((group) => {
              const groupVars = group.keys
                .map((k) => s.variables.find((v) => v.key === k))
                .filter(Boolean) as EnvVar[];
              if (groupVars.length === 0) return null;
              const filledCount = groupVars.filter((v) => v.value && v.value.trim()).length;
              const groupId = `prov-${group.id}`;
              const isGroupOpen = expanded[groupId] !== false; // default open
              return (
                <div key={group.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(groupId)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isGroupOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">{group.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{group.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        filledCount === groupVars.length
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : filledCount > 0
                            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                      }`}>
                        {filledCount}/{groupVars.length} ✓
                      </span>
                    </div>
                  </button>
                  {isGroupOpen && (
                    <div className="p-3 bg-white dark:bg-zinc-950/40 space-y-2.5">
                      {group.description && (
                        <div className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 pb-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="flex-1">{group.description}</span>
                          {group.signupUrl && (
                            <a href={group.signupUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline shrink-0">signup ↗</a>
                          )}
                        </div>
                      )}
                      {/* FIX bug "No disponible": info banner permanente cuando
                          el grupo LLM tiene *_API_KEY — ahora el backend las
                          marca readOnly, los inputs salen blocked con Lock,
                          pero el usuario necesita saber por que no puede
                          escribir alli. El banner explica: ir a pestaña API
                          Keys. Solo *_BASE_URL es editable en este panel
                          (para NIM/proxy self-hosted). */}
                      {groupVars.some((v) => PROVIDER_APIKEY_WARNING_KEYS.has(v.key)) && (
                        <div className="flex items-start gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 rounded-lg px-2 py-1.5">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="flex-1">
                            Las <code className="font-mono">*_API_KEY</code> / <code className="font-mono">*_TOKEN</code> de
                            proveedores LLM van bloqueadas aqui — se configuran en la pestaña
                            <strong> API Keys </strong> (secrets.json). En este panel solo <code className="font-mono">*_BASE_URL</code>
                            es editable, util para NIM/proxy self-hosted.
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {groupVars.map(renderVar)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Variables no clasificadas en ningún grupo (ej: opciones futuras) */}
            {s.variables.filter((v) => !PROVIDER_GROUPS_8.some((g) => g.keys.includes(v.key))).length > 0 && (
              <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-2">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Otros</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {s.variables.filter((v) => !PROVIDER_GROUPS_8.some((g) => g.keys.includes(v.key))).map(renderVar)}
                </div>
              </div>
            )}
          </div>
        ) : isOpen && (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-white dark:bg-zinc-950/40">
            {s.variables.map(renderVar)}
            {s.variables.length === 0 && (
              <p className="col-span-full text-xs text-zinc-400 italic px-2 py-3">
                No hay variables activas en esta seccion (todas comentadas).
              </p>
            )}
          </div>
        )}
      </section>
    );
  };

  // ========================================================================
  // RENDER Principal
  // ========================================================================
  return (
    <div className="flex flex-col flex-1 gap-4 p-2 md:p-4">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 text-white shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-bold text-zinc-800 dark:text-zinc-100">
              Variables de Sistema
            </h2>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 truncate">
              Letxinet-Suite v1.1 (Variante C) — Edita `LetXinet-Suite.env` visualmente sin Notepad.
            </p>
          </div>
        </div>

        {/* Stats inline */}
        <div className="flex flex-wrap gap-2 text-xs">
          {sections.length > 0 && (
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-500">{sections.length} secciones</span>
            </div>
          )}
          {dirtyCount > 0 && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">{dirtyCount} cambios sin guardar</span>
            </div>
          )}
          {envPath && (
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-500 font-mono truncate max-w-md" title={envPath}>
                {envPath}
              </span>
            </div>
          )}
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando LetXinet-Suite.env desde ProgramData...
        </div>
      )}

      {/* Not installed warning */}
      {notInstalled && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Suite no detectado</p>
            <p className="text-xs mt-1">{reason}</p>
            <p className="text-xs mt-1">
              Esta pestaña solo funciona cuando el Suite está instalado en
              <code className="mx-1 px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded font-mono">C:\Program Files\LetXinet Suite\</code>
            </p>
          </div>
        </div>
      )}

      {/* Sections list */}
      {sections.length > 0 && (
        <div ref={scrollRef} className="flex flex-col gap-3 overflow-y-auto">
          {sections.map(renderSection)}
        </div>
      )}

      {/* Mensaje feedback */}
      {msg && (
        <div
          className={`flex items-start gap-2 px-3 py-2 rounded-xl text-sm border ${
            msg.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{msg.text}</span>
        </div>
      )}

      {/* Confirm modal discard */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
              ¿Descartar cambios?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Tienes <span className="font-mono font-semibold text-amber-600">{dirtyCount}</span> cambios sin guardar.
              Si descartas, perderas las ediciones no guardadas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={discardChanges}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer sticky */}
      <footer className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-sm p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-auto">
        <button
          onClick={saveChanges}
          disabled={saving || loading || dirtyCount === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
        </button>
        <button
          onClick={saveAndRestart}
          disabled={restarting || saving || loading || dirtyCount === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Guardar y reiniciar
        </button>
        <button
          onClick={fetchVars}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
        {dirtyCount > 0 && (
          <button
            onClick={() => setConfirmDiscard(true)}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Descartar
          </button>
        )}
        <div className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">
          {dirtyCount > 0 ? `⚠ ${dirtyCount} sin guardar` : '✓ guardado'}
          {lastModified && (
            <span className="ml-2 opacity-70">
              · última sync: {new Date(lastModified).toLocaleString()}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
