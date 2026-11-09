import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Key, ShieldCheck, ShieldAlert, Eye, EyeOff, Save, Loader2, RefreshCw,
  GraduationCap, Bot, Mail, CheckCircle2, AlertCircle, ExternalLink, RotateCw,
} from 'lucide-react';

interface ApiKeysConfigForm {
  // IA classicas
  mcpApiKey?: string;
  geminiApiKey?: string;
  mistralApiKey?: string;
  nvidiaApiKey?: string;
  opencodeApiKey?: string;
  // IA additions
  anthropicApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  // Sources academicas
  mineruApiKey?: string;
  hfToken?: string;
  serpApiKey?: string;
  coreApiKey?: string;
  semanticScholarApiKey?: string;
  scopusApiKey?: string;
  redalycToken?: string;
  unpaywallEmail?: string;
  osmUserAgent?: string;
}

interface ApiKeysConfigData extends ApiKeysConfigForm {
  [key: string]: any;
}

// VARIANTE C v1.2 — urls/labels se alimentan del PROVIDERS_CATALOG centralizado
// para los 7 LLMs. Las fuentes academicas (mineru, hf, serp, core, semantic,
// scopus, redalyc, unpaywall, osm) siguen en mapas locales porque NO son
// providers OpenAI-compat (son servicios HTTP ad-hoc que no exponen /models).
import { PROVIDERS_CATALOG } from '../lib/providers-catalog';

const ACADEMIC_URL_FOR: Record<string, string> = {
  mcpApiKey: 'https://huggingface.co/settings/tokens',
  mineruApiKey: 'https://mineru.net',
  hfToken: 'https://huggingface.co/settings/tokens',
  serpApiKey: 'https://serpapi.com',
  coreApiKey: 'https://core.ac.uk/services/api',
  semanticScholarApiKey: 'https://www.semanticscholar.org/product/api',
  scopusApiKey: 'https://dev.elsevier.com',
  redalycToken: 'https://www.redalyc.org',
  unpaywallEmail: 'https://unpaywall.org/products/api',
  osmUserAgent: 'https://operations.osmfoundation.org/policies/nominatim-usage-policy/',
};

const ACADEMIC_LABEL: Record<string, string> = {
  mcpApiKey: 'MCP API Key',
  mineruApiKey: 'MinerU (precision PDFs)',
  hfToken: 'HuggingFace Token',
  serpApiKey: 'SERP API / Google Scholar',
  coreApiKey: 'CORE Academic',
  semanticScholarApiKey: 'Semantic Scholar',
  scopusApiKey: 'Scopus Elsevier',
  redalycToken: 'Redalyc',
  unpaywallEmail: 'Unpaywall email (contacto)',
  osmUserAgent: 'OSM User-Agent (Nominatim)',
};

// Derive URL_FOR y LABEL desde el catalogo (LLM providers) + mapas academicos.
const URL_FOR: Record<string, string> = {
  ...ACADEMIC_URL_FOR,
  ...Object.fromEntries(
    PROVIDERS_CATALOG
      .filter((p) => p.signupUrl)
      .map((p) => [p.keyParam, p.signupUrl as string])
  ),
};

const LABEL: Record<string, string> = {
  ...ACADEMIC_LABEL,
  ...Object.fromEntries(
    PROVIDERS_CATALOG.map((p) => [p.keyParam, p.name])
  ),
};

const HINT: Record<string, string> = {
  unpaywallEmail: 'Email real del operador. Unpaywall exige contacto.',
  osmUserAgent: 'Formato: LetXinet-Suite/1.0 (contacto: admin@tudominio.com)',
  mineruApiKey: 'Sin clave = Flash (20 pag/10MB IP-limited). Con clave = Precision (200 pag, 5000/dia).',
  hfToken: 'Necesario para HF Spaces privados C2MV y modelos gated.',
  scopusApiKey: 'Requiere afiliacion institucional Elsevier.',
  ...Object.fromEntries(
    PROVIDERS_CATALOG
      .filter((p) => p.description)
      .map((p) => [p.keyParam, p.description as string])
  ),
};

// Comentario breve junto a cada clave (requerido / opcional / rate-limit friendly)
const REQUIRED_KEYS = ['unpaywallEmail', 'osmUserAgent'];

function isMasked(v?: string) {
  return !v || (v.includes('***') && v.length > 4);
}

function isUnmaskedAble(fieldName: string) {
  return fieldName === 'unpaywallEmail' || fieldName === 'osmUserAgent';
}

// v1.5.8 — Field, GroupCard y Stats MOVIDOS FUERA del componente ApiKeysConfig.
// Antes estaban declarados dentro del cuerpo del componente, lo que hacia que
// cada render creara una nueva referencia de funcion. React lo interpretaba
// como un tipo de componente distinto y REMONTABA todos los inputs en cada
// render. El remount reinicializaba el DOM del input y el navegador
// recolocaba el scroll del ancestro overflow-y-auto al inicio — el bug
// "scrollea a top al tocar un input de abajo". Al moverlos a modulo, React
// preserva los nodos DOM entre renders y el scroll se mantiene estable.
interface FieldProps {
  k: string;
  type?: 'secret' | 'text';
  value: string;
  configured: boolean;
  show: boolean;
  hint?: string;
  url?: string;
  required: boolean;
  label: string;
  onChange: (k: string, v: string) => void;
  onToggleShow: (k: string) => void;
}

const Field = ({
  k, type = 'secret', value, configured, show, hint, url, required, label,
  onChange, onToggleShow,
}: FieldProps) => {
  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {configured ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : required ? (
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          )}
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</label>
          {required && (
            <span className="text-[10px] font-bold uppercase text-red-500">req</span>
          )}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
            title={`Obtener en ${url}`}
          >
            <ExternalLink className="w-2.5 h-2.5" />
            obtener
          </a>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          type={type === 'secret' && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(k, e.target.value)}
          placeholder={type === 'secret' ? '••••••••••••' : ''}
          className={`w-full px-2.5 py-1.5 pr-9 text-xs font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          autoComplete="off"
          spellCheck={false}
        />
        {type === 'secret' && (
          <button
            type="button"
            onClick={() => onToggleShow(k)}
            className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title={show ? 'Ocultar' : 'Mostrar'}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">{hint}</p>
      )}
    </div>
  );
};

interface GroupCardProps {
  title: string;
  icon: ReactNode;
  desc?: string;
  children: ReactNode;
}

const GroupCard = ({ title, icon, desc, children }: GroupCardProps) => (
  <section className="flex flex-col gap-3">
    <header className="flex items-center gap-2">
      <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
        {icon}
      </div>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
        {desc && <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>}
      </div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
  </section>
);

interface StatsProps {
  data: ApiKeysConfigData;
}

const Stats = ({ data }: StatsProps) => {
  const total = Object.keys(LABEL).length;
  const configuredCount = Object.values(data).filter(
    (v) => typeof v === 'boolean' && v === true
  ).length;
  const missingRequired = REQUIRED_KEYS.filter((k) => !data[`${k}Configured`]).length;
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
        <span className="font-mono text-emerald-500">{configuredCount}</span>
        <span className="text-zinc-500">/ {total} configuradas</span>
      </div>
      {missingRequired > 0 && (
        <div className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-600 dark:text-red-400">
            {missingRequired} requerida{missingRequired > 1 ? 's' : ''} sin completar
          </span>
        </div>
      )}
    </div>
  );
};

export default function ApiKeysConfig({ onSaved }: { onSaved?: () => void }) {
  const [data, setData] = useState<ApiKeysConfigData>({});
  const [form, setForm] = useState<ApiKeysConfigForm>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        const form: ApiKeysConfigForm = {};
        Object.keys(LABEL).forEach((k) => {
          (form as any)[k] = (d as any)[k] || '';
        });
        setForm(form);
      } else {
        setMsg({ ok: false, text: `No se pudieron cargar las claves (HTTP ${res.status})` });
      }
    } catch (err: any) {
      setMsg({ ok: false, text: `Error de red: ${err?.message || String(err)}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const saveKeys = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload: any = {};
      Object.keys(LABEL).forEach((k) => {
        const v = (form as any)[k] || '';
        // For email/UA values: always submit (no mask pattern concept).
        if (isUnmaskedAble(k)) {
          payload[k] = typeof (form as any)[k] === 'string' ? v : undefined;
        } else {
          // For secrets: submit only if NOT a masked "fetched-from-server" value.
          if (!isMasked(v) || v === '') payload[k] = v;
        }
      });
      // Strip undefined to reduce payload size; only send explicitly-set keys.
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      if (Object.keys(payload).length === 0) {
        setMsg({ ok: true, text: 'Sin cambios detectados.' });
        return;
      }

      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMsg({ ok: true, text: 'Claves guardadas en secrets.json. Ahora puedes reiniciar servicios para aplicarlas al MCP-V11 local.' });
        await fetchKeys();
        // Fase H v1.0.11p: avisar al padre (App.tsx) para que refresque el
        // estado `config` (usado por badges del header). Sin esto, la luz
        // permanece apagada aunque la clave esté guardada en secrets.json.
        if (onSaved) {
          try { onSaved(); } catch (_) { /* noop */ }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: `Error al guardar: ${err.error || res.status}` });
      }
    } catch (err: any) {
      const detail = err?.message || String(err);
      let hint = '';
      if (detail.includes('Failed to fetch') || detail.includes('NetworkError')) {
        hint = ' (backend no responde — quizas este reiniciando)';
      }
      setMsg({ ok: false, text: `Error de red: ${detail}${hint}` });
    } finally {
      setSaving(false);
    }
  };

  const restartServices = async () => {
    setRestarting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/keys/restart-services', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.skipped) {
          setMsg({ ok: true, text: `Modo dev: ${d.reason}` });
        } else if (d.ok) {
          setMsg({ ok: true, text: '3 servicios NSSM reiniciados. Las claves nuevas estan activas en MCP-V11.' });
        } else {
          setMsg({ ok: false, text: `Reinicio parcial: ${JSON.stringify(d.results)}` });
        }
      } else {
        setMsg({ ok: false, text: `Error reinicio: ${d.error || res.status}` });
      }
    } catch (err: any) {
      setMsg({ ok: false, text: `Error de red reiniciando: ${err?.message || String(err)}` });
    } finally {
      setRestarting(false);
    }
  };

  const toggleShow = (k: string) =>
    setShowValues((s) => ({ ...s, [k]: !s[k] }));

  // v1.5.8 — Field, GroupCard y Stats son ahora componentes de módulo
  // (definidos fuera del cuerpo de ApiKeysConfig). Antes eran inline y cada
  // render creaba nuevas referencias → React remontaba todos los inputs →
  // el navegador recolocaba el scroll del ancestro overflow-y-auto al inicio
  // al tocar un input de abajo (bug "scrollea a top"). Al ser del módulo,
  // los nodos DOM del input se preservan entre renders y el scroll queda
  // estable.
  const handleChange = (k: string, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Helper para renderizar un Field con props derivadas (evita pasar 9 props
  // por cada uno de los 17 Fields).
  const renderField = (k: string, type: 'secret' | 'text' = 'secret') => (
    <Field
      key={k}
      k={k}
      type={type}
      value={(form as any)[k] || ''}
      configured={!!data[`${k}Configured`]}
      show={!!showValues[k]}
      hint={HINT[k]}
      url={URL_FOR[k]}
      required={REQUIRED_KEYS.includes(k)}
      label={LABEL[k]}
      onChange={handleChange}
      onToggleShow={toggleShow}
    />
  );

  return (
    <div className="flex flex-col flex-1 gap-4 p-2 md:p-4 min-h-0">
      {/* Header */}
      <header className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-zinc-800 dark:text-zinc-100">
              Configurar API Keys
            </h2>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400">
              Variante B: rellena tus claves y reinicia los servicios del Suite para activarlas en MCP-V11 local.
            </p>
          </div>
        </div>
        <Stats data={data} />
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando estado actual...
        </div>
      )}

      {/* v1.5.6 — Scroll area independiente. El scroller interno mantiene el
          scroll estable cuando un input gana focus; el footer queda FIJO arriba
          del scroller (no sticky dentro de él), evitando saltos. */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      {/* Groups */}
      <GroupCard
        title="Sources Académicas (variante B)"
        icon={<GraduationCap className="w-4 h-4" />}
        desc="Proveedores de búsqueda académica. Vacío = el servicio devuelve 401 para esa fuente, el resto del Suite sigue operando."
      >
        {renderField("mineruApiKey")}
        {renderField("hfToken")}
        {renderField("serpApiKey")}
        {renderField("coreApiKey")}
        {renderField("semanticScholarApiKey")}
        {renderField("scopusApiKey")}
        {renderField("redalycToken")}
      </GroupCard>

      <GroupCard
        title="Contacto + OSM (Requerido)"
        icon={<Mail className="w-4 h-4" />}
        desc="Algunos servicios upstream exigen un contacto real del operador por policies de uso."
      >
        {renderField("unpaywallEmail", "text")}
        {renderField("osmUserAgent", "text")}
      </GroupCard>

      <GroupCard
        title="IA: LLM Chat (opcional)"
        icon={<Bot className="w-4 h-4" />}
        desc="Para paper-summarization y chat IA. Rellena SOLO las que uses; el Suite no las invoca por defecto."
      >
        {renderField("mcpApiKey")}
        {renderField("geminiApiKey")}
        {renderField("mistralApiKey")}
        {renderField("anthropicApiKey")}
        {renderField("openaiApiKey")}
        {renderField("groqApiKey")}
        {renderField("nvidiaApiKey")}
        {renderField("opencodeApiKey")}
      </GroupCard>

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
      </div>

      {/* Footer fijo (no sticky). Sienta al fondo del flex-col; al estar fuera
          del scroller, no compite con scrollIntoView al hacer focus en inputs. */}
      <footer className="flex flex-wrap items-center gap-2 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-sm p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
        <button
          onClick={saveKeys}
          disabled={saving || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar claves
        </button>
        <button
          onClick={restartServices}
          disabled={restarting || saving}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Guardar y reiniciar servicios
        </button>
        <button
          onClick={fetchKeys}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </footer>
    </div>
  );
}
