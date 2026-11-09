import { useState, useEffect, useCallback, useRef } from 'react';
import { ConfigStatus, ToolDefinition, ExecutionRecord } from './types';
import ThemeToggle from './components/ThemeToggle';
import ActiveToolsList from './components/ActiveToolsList';
import ConsolePlayground from './components/ConsolePlayground';
import AgentChat from './components/AgentChat';
import SkillsGallery from './components/SkillsGallery';
import SourcesCatalog from './components/SourcesCatalog';
import ApiKeysConfig from './components/ApiKeysConfig';
import RightNavRail, { TabId, ActiveSkillInfo } from './components/RightNavRail';
import MobileBottomNav from './components/MobileBottomNav';
import MobileChatDrawer from './components/MobileChatDrawer';
import SystemVariablesConfig from './components/SystemVariablesConfig';
import ProvidersSyncPanel from './components/ProvidersSyncPanel';
import ChatSidebar from './components/ChatSidebar';
import TokenFooter from './components/TokenFooter';
import { useTokenUsage } from './lib/tokenUsage';
import { Brain, Terminal, Server, HelpCircle, GraduationCap, Box, ShieldCheck, ShieldAlert, Key, Settings, Activity, Lightbulb, ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCw, Database, X, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { useI18n, Language } from './lib/i18n';

// VARIANTE C v1.5.3 — Single source of truth para versión (header + document.title).
// Bumpear aquí al cambiar la versión oficial de release.
const APP_VERSION = '1.5.8';

// v1.5.3 — Layout persistence (sidebar widths + collapse state).
const LAYOUT_STORAGE_KEY = 'letxinet:layout-v1';
const DEFAULT_LEFT_WIDTH = 280;
const DEFAULT_RIGHT_WIDTH = 224;
const MIN_LEFT = 200;
const MAX_LEFT = 420;
const MIN_RIGHT = 180;
const MAX_RIGHT = 360;

interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutState>;
      return {
        leftWidth: typeof parsed.leftWidth === 'number' ? parsed.leftWidth : DEFAULT_LEFT_WIDTH,
        rightWidth: typeof parsed.rightWidth === 'number' ? parsed.rightWidth : DEFAULT_RIGHT_WIDTH,
        leftCollapsed: !!parsed.leftCollapsed,
        rightCollapsed: !!parsed.rightCollapsed,
      };
    }
  } catch {}
  return { leftWidth: DEFAULT_LEFT_WIDTH, rightWidth: DEFAULT_RIGHT_WIDTH, leftCollapsed: false, rightCollapsed: false };
}

function persistLayout(state: LayoutState) {
  try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export default function App() {
  const { lang, setLanguage, t } = useI18n();
  // VARIANTE C v1.4.2 — Branding dinámico del <title> (fix bug: "My Google AI Studio App")
  useEffect(() => {
    document.title = `Letxinet Suite v${APP_VERSION}`;
  }, []);
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  // VARIANTE C v1.3 — chats persistentes
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatPanelKey, setChatPanelKey] = useState(0); // fuerza remount/load al crear nuevo
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [selectedToolName, setSelectedToolName] = useState<string>('search');
  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);

  const [mcpServerSelection, setMcpServerSelection] = useState<string>('both');

  // v1.0.11-mobile — Drawer móvil para el historial de chats.
  // En desktop el sidebar izquierdo es fijo (leftCollapsed layout); en móvil
  // se reemplaza por este overlay deslizable desde la izquierda.
  const [mobileChatDrawerOpen, setMobileChatDrawerOpen] = useState(false);

  // Fase H v1.0.11p: refreshSignal para forzar reload de la lista de chats
  // en ChatSidebar despues de operaciones que NO cambian activeChatId
  // (o que lo cambian a un valor identico al previo por alguna raza).
  // ChatSidebar escuchara este numero y re-ejecutara fetchChats.
  const [chatListRefreshSignal, setChatListRefreshSignal] = useState(0);

  // v1.5.3 — Layout persistente (sidebar widths + collapse state).
  const [layout, setLayout] = useState<LayoutState>(() => loadLayout());
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  const toggleLeftPanel = useCallback(() => {
    setLayout(prev => {
      const next = { ...prev, leftCollapsed: !prev.leftCollapsed };
      persistLayout(next);
      return next;
    });
  }, []);
  const toggleRightPanel = useCallback(() => {
    setLayout(prev => {
      const next = { ...prev, rightCollapsed: !prev.rightCollapsed };
      persistLayout(next);
      return next;
    });
  }, []);
  const updateLeftWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_LEFT, Math.min(MAX_LEFT, w));
    setLayout(prev => {
      const next = { ...prev, leftWidth: clamped };
      persistLayout(next);
      return next;
    });
  }, []);
  const updateRightWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, w));
    setLayout(prev => {
      const next = { ...prev, rightWidth: clamped };
      persistLayout(next);
      return next;
    });
  }, []);

  // v1.5.3 — Skills activos lifted de AgentChat para mostrarlos en RightNavRail.
  const [activeSkillsList, setActiveSkillsList] = useState<ActiveSkillInfo[]>([]);

  // v1.5.3 — Token usage por chat activo (footer inferior).
  const { addTokens, resetChat: resetChatTokens, getForChat } = useTokenUsage();
  const tokenUsage = getForChat(activeChatId);

  // v1.5.8 (optim CPU) — Wrap con useCallback para estabilizar la referencia.
  // Si pasamos una función inline nueva por render a AgentChat, su useEffect
  // [loadedSkills, onSkillsChange] re-fire en cada render de App y queda en loop.
  const handleSkillsChange = useCallback((skills: ActiveSkillInfo[]) => {
    setActiveSkillsList(skills);
  }, []);
  const handleTokensUsed = useCallback((inT: number, outT: number) => {
    if (!activeChatId) return;
    addTokens(activeChatId, inT, outT);
  }, [activeChatId, addTokens]);

  // Drag handlers para resize handles (delegan a refs para evitar re-renders).
  const dragModeRef = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragModeRef.current) return;
      if (dragModeRef.current === 'left') {
        // Ancho izquierdo = distancia desde borde izq de la ventana hasta el cursor
        const newWidth = e.clientX - 16;
        updateLeftWidth(newWidth);
      } else if (dragModeRef.current === 'right') {
        // Ancho derecho = distancia desde cursor hasta borde der de la ventana
        const newWidth = window.innerWidth - e.clientX - 16;
        updateRightWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      if (dragModeRef.current) {
        dragModeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateLeftWidth, updateRightWidth]);

  const startLeftDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragModeRef.current = 'left';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);
  const startRightDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragModeRef.current = 'right';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Fetch configuration and keys availability
  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setConfig(data);
        } else {
          console.warn("Express backend returned non-JSON for config (possibly still starting).");
        }
      }
    } catch (err) {
      console.error("No se pudo obtener la configuración del backend Express:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch tools listed from LetXinet MCP Server
  const fetchTools = async (serverSelection: string = mcpServerSelection, refresh: boolean = false) => {
    setLoadingTools(true);
    try {
      const url = `/api/mcp/tools?server=${serverSelection}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setTools(data.tools || []);
          if (data.tools && data.tools.length > 0) {
            // pre-select search if available
            const hasSearch = data.tools.some((t: any) => t.name === 'search');
            setSelectedToolName(prev => {
              if (prev && data.tools.some((t: any) => t.name === prev)) return prev;
              return hasSearch ? 'search' : data.tools[0].name;
            });
          }
        } else {
           console.warn("Express backend returned non-JSON for tools (possibly still starting).");
        }
      }
    } catch (err) {
      console.error("No se pudo obtener la lista de herramientas MCP del backend:", err);
    } finally {
      setLoadingTools(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchTools(mcpServerSelection);
  }, [mcpServerSelection]);

  // Probe the gateway /health endpoint to detect whether the local MCP-V11-Local
  // portable is the active backend (preferred for LatAm sources) or we fell back
  // to the remote HF Space MCP (no LatAm access from HF datacenter IPs).
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const probeHealth = async () => {
      try {
        const res = await fetch('/health', { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setMcpBackend(data.mcpBackend === 'local' ? 'local' : data.mcpBackend === 'remote' ? 'remote' : 'unknown');
          }
        }
      } catch {
        // Backend still starting.
      }
    };
    probeHealth();
    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(async () => {
        await probeHealth();
        scheduleNext();
      }, 60000);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  const handleSelectToolFromList = (toolName: string) => {
    setSelectedToolName(toolName);
    setActiveTab('playground');
  };

  const handleAddHistoryRecord = (record: ExecutionRecord) => {
    setExecutionHistory((prev) => [record, ...prev]);
  };

  const handleClearHistory = () => {
    setExecutionHistory([]);
  };

  const handleMcpRefreshNeeded = () => {
    fetchConfig();
    fetchTools(mcpServerSelection, true);
  };

  // VARIANTE C v1.3 — chats persistentes handlers
  const handleNewChat = async () => {
    try {
      const r = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nuevo chat' }),
      });
      const d = await r.json();
      // Fase H v1.0.11n: tolerar contrato nuevo {ok, chat:{uuid,id}} y viejo {id}
      const newChatId = d?.chat?.uuid || d?.chat?.id || d?.uuid || d?.id || null;
      if (newChatId) {
        setActiveChatId(newChatId);
        setChatPanelKey((k) => k + 1); // fuerza remount del AgentChat para que cargue el chat nuevo vacío
        // Fase H v1.0.11p: forzar reload de la lista en ChatSidebar aunque el
        // useEffect de activeChatId no dispare (edge cases race cond, etc).
        setChatListRefreshSignal((n) => n + 1);
      } else {
        console.error('handleNewChat: respuesta sin newChatId', d);
      }
    } catch (e) {
      console.error('handleNewChat', e);
    }
  };

  const handleActiveChat = (uuid: string) => {
    setActiveChatId(uuid || null);
    setChatPanelKey((k) => k + 1);
    // Fase H v1.0.11p: refrescar la lista tambien al cambiar de chat activo
    // (para que msgCount / updatedAt se actualicen).
    setChatListRefreshSignal((n) => n + 1);
  };

  // VARIANTE C v1.4.5 — Auto-crear chat al primer prompt (cuando no hay chat activo).
  // Creates chat server-side with a real title (no generic "Nuevo chat"),
  // sets activeChatId, and returns the new uuid to AgentChat so it can persist
  // messages within the SAME streaming cycle (no remount — key stays stable).
  const handleNewChatAuto = async (title: string): Promise<string | null> => {
    try {
      const r = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.slice(0, 120) || 'Nuevo chat' }),
      });
      const d = await r.json();
      // Fase H v1.0.11n: tolerar contrato nuevo {ok, chat:{uuid,id}} y viejo {id}
      const newChatId = d?.chat?.uuid || d?.chat?.id || d?.uuid || d?.id || null;
      if (newChatId) {
        setActiveChatId(newChatId);
        // NO incrementamos chatPanelKey: AgentChat usa chatIdRef para persistir
        // el nuevo chat dentro del mismo ciclo sin necesidad de remontar.
        // Fase H v1.0.11p: forzar reload de la lista para que el nuevo chat
        // aparezca en el sidebar (era el bug reportado: "+" no lo mostraba).
        setChatListRefreshSignal((n) => n + 1);
        return newChatId as string;
      }
      console.error('handleNewChatAuto: respuesta sin newChatId', d);
      return null;
    } catch (e) {
      console.error('handleNewChatAuto', e);
      return null;
    }
  };

  const handleGlobalTotalSync = async () => {
    setLoadingTools(true);
    try {
      await Promise.all([
        fetchConfig(),
        fetchTools(mcpServerSelection, true)
      ]);
    } catch (err) {
      console.error("Error durante la Sincronización Total:", err);
    } finally {
      setLoadingTools(false);
    }
  };

  // v1.5.8 (optim CPU) — Wrap con useCallback para estabilizar referencias pasadas a AgentChat/ConsolePlayground.
  const handleToolsUpdateNeeded = useCallback(() => {
    fetchTools(mcpServerSelection);
  }, [mcpServerSelection]);
  const handleRefreshTools = useCallback(async (server?: string) => {
    await fetchTools(server || mcpServerSelection, true);
  }, [mcpServerSelection]);

  // ----------------------------------------------------------------------
  // API Keys tab now defined in components/ApiKeysConfig.tsx.
  // Header badges route to setActiveTab('keys') instead of opening the old modal.
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // MCP backend badge state (local portable vs remote HF Space).
  // ----------------------------------------------------------------------
  const [mcpBackend, setMcpBackend] = useState<'local' | 'remote' | 'unknown'>('unknown');

  const mcpOk = config?.mcpApiKeyConfigured;
  const letxinetOk = config?.letxinetOk;
  const letxipuOk = config?.letxipuOk;
  const letxipuOsmOk = config?.letxipuOsmOk;
  const geminiOk = config?.geminiApiKeyConfigured;
  const mistralOk = config?.mistralApiKeyConfigured;

  const selectedMcps = mcpServerSelection.split(',').map(s => s.trim());
  const isBothSelected = selectedMcps.includes('both');
  const letxinetActive = (isBothSelected || selectedMcps.includes('letxinet')) && (!!letxinetOk || tools.some(t => t.serverName === 'letxinet'));
  const letxipuActive = (isBothSelected || selectedMcps.includes('letxipu')) && (!!letxipuOk || tools.some(t => t.serverName === 'letxipu'));
  const letxipuOsmActive = (isBothSelected || selectedMcps.includes('letxipu_osm')) && (!!letxipuOsmOk || tools.some(t => t.serverName === 'letxipu_osm'));

  return (
    <div className="h-screen flex flex-col bg-[#F9FAFB] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200 selection:bg-indigo-505 selection:text-white font-sans antialiased overflow-hidden">
      
      {/* 1. TOP HEADER NAVIGATION RAIL */}
      <nav className="w-full border-b border-zinc-200/60 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 md:px-8 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <div className="p-2 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <img
                src="/LETXIPU.svg"
                alt="LetXinet"
                className="w-7 h-7 md:w-8 md:h-8 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-display font-extrabold text-base md:text-xl text-zinc-950 dark:text-white tracking-tight leading-none mb-1">
                LetXinet Suite <span className="text-indigo-600 dark:text-indigo-400">v{APP_VERSION}</span>
              </h1>
              {!loadingConfig && (
                <div className="flex flex-nowrap md:flex-wrap items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar md:overflow-visible">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] md:text-xs font-mono font-semibold max-w-min whitespace-nowrap shrink-0 ${letxinetActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                    ● LetXinet {letxinetActive ? 'ON' : 'OFF'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] md:text-xs font-mono font-semibold max-w-min whitespace-nowrap shrink-0 ${letxipuActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                    ● LetXipu {letxipuActive ? 'ON' : 'OFF'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] md:text-xs font-mono font-semibold max-w-min whitespace-nowrap shrink-0 ${letxipuOsmActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                    ● OSM {letxipuOsmActive ? 'ON' : 'OFF'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] md:text-xs font-mono font-semibold max-w-min whitespace-nowrap shrink-0 ${mcpBackend === 'local' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : mcpBackend === 'remote' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'}`}
                    title={mcpBackend === 'local' ? 'MCP-V11-Local portable detectado y activo: búsquedas LatAm (ALICIA, RENATI, CONAHCyT, etc.) usan tu IP residencial' : mcpBackend === 'remote' ? 'MCP remoto HF Space en uso: las fuentes LatAm gubernamentales (.gob.pe) probablemente fallan por bloqueo GeIP/WAF de HF. Instala MCP-V11-Local para habilitarlas.' : 'Backend MCP no detectado todavía'}
                  >
                    <Server className="w-2.5 h-2.5" />
                    MCP: {mcpBackend === 'local' ? 'Local' : mcpBackend === 'remote' ? 'Remoto HF' : '…'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* v1.4.8 — Row 1 eliminada (badges MCP/Gemini/Mistral/Pendiente).
                Ya existe el tab "API Keys" con el estado completo de cada credential. */}

            {/* Row 2: Sincronización Total, Language & Mode */}
            <div className="flex items-center gap-2.5 justify-end">
              <button
                onClick={handleGlobalTotalSync}
                disabled={loadingTools}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl shadow-xs transition-all duration-150 flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Re-consultar todos los servidores MCP y actualizar simultáneamente las herramientas en el Playground"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTools ? 'animate-spin' : ''}`} />
                <span>
                  {loadingTools 
                    ? (lang === 'en' ? 'Syncing MCPs...' : lang === 'pt' ? 'Sincronizando...' : 'Sincronizando MCPs...') 
                    : (lang === 'en' ? 'Total Sync' : lang === 'pt' ? 'Sincronização Total' : 'Sincronización Total')}
                </span>
              </button>

              {/* Selector de idioma */}
              <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-2xs gap-0.5 h-[32px]">
                <span className="text-[10px] pl-2 font-bold text-zinc-400 dark:text-zinc-500 uppercase select-none">🌐</span>
                <select
                  value={lang}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="bg-transparent text-[11px] font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-0 cursor-pointer border-none pl-1.5 pr-7 py-1 appearance-none z-10 font-sans"
                  title="Workspace language"
                >
                  <option value="es" className="bg-white dark:bg-zinc-900 dark:text-zinc-200">ESP</option>
                  <option value="en" className="bg-white dark:bg-zinc-900 dark:text-zinc-200">ENG</option>
                  <option value="pt" className="bg-white dark:bg-zinc-900 dark:text-zinc-200">POR</option>
                </select>
                <ChevronDown className="absolute right-2 w-3 h-3 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
              </div>

              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* 2. MAIN WORKSPACE CONTAINER v1.5.3 — paneles plegables + resize handles + footer tokens */}
      {/* v1.0.11-mobile — pb-14 md:pb-0 deja espacio para la bottom-nav fija en móvil */}
      <main className="w-full flex-1 flex flex-col transition-all duration-300 min-h-0 overflow-hidden pb-14 md:pb-0">

        {/* 2b. Content Columns Area — v1.4.4: min-h-0 overflow-hidden CRÍTICO
            Sin min-h-0, este flex-1 crece con el contenido del chat y rompe
            toda la cadena de overflow-y-auto de los children (input se va al fondo). */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">

          {/* Main Area: Tabbed Workspace — v1.5.0 P1 refactor + v1.5.3 paneles plegables+resize.
              - Layout flex-row: panel de contenido (centro, flex-1) + rail derecha (w-14/lg:w-56 o colapsada).
              - Resize handles entre paneles (drag para ajustar ancho). */}
          <section className="w-full flex-1 flex flex-row min-h-0 overflow-hidden">

            {/* CONTENIDO: panel del tab activo ocupa la zona central */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">

            {/* TAB PANELS ACTIVE RENDER */}
            <div className="transition-all duration-300 relative flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className={activeTab === 'chat' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}>
                <div className="w-full flex flex-col flex-1 min-h-0 md:flex-row">

                  {/* v1.5.3 — Sidebar izquierdo (Chats): plegable + ancho persistente.
                      En mobile (<md): no se aplica width dinámico (es full overlay). */}
                  {!layout.leftCollapsed && (
                    <>
                      <div
                        className="hidden md:block shrink-0 overflow-hidden h-full"
                        style={{ width: `${layout.leftWidth}px` }}
                      >
                        <ChatSidebar
                          activeChatId={activeChatId}
                          onActiveChat={handleActiveChat}
                          onNewChat={handleNewChat}
                          refreshSignal={chatListRefreshSignal}
                        />
                      </div>
                      {/* Resize handle izquierdo (drag horizontal) */}
                      <div
                        onMouseDown={startLeftDrag}
                        className="hidden md:block w-1 cursor-col-resize bg-zinc-200/60 dark:bg-zinc-800/60 hover:bg-indigo-500 hover:w-1.5 transition-all shrink-0"
                        title="Arrastra para redimensionar el panel de chats"
                      />
                    </>
                  )}
                  {/* Toggle panel izquierdo (mostrar/ocultar) */}
                  <button
                    onClick={toggleLeftPanel}
                    className="hidden md:flex shrink-0 w-5 h-full items-center justify-center bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200/60 dark:border-zinc-800/60 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    title={layout.leftCollapsed
                      ? (lang === 'en' ? 'Show chats panel' : 'Mostrar panel de chats')
                      : (lang === 'en' ? 'Hide chats panel' : 'Ocultar panel de chats')}
                  >
                    {layout.leftCollapsed
                      ? <PanelLeftOpen className="w-3.5 h-3.5" />
                      : <PanelLeftClose className="w-3.5 h-3.5" />}
                  </button>

                  <div className="w-full flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
                    <AgentChat
                      key={chatPanelKey}
                      chatId={activeChatId}
                      onAddHistoryRecord={handleAddHistoryRecord}
                      onToolsUpdateNeeded={handleToolsUpdateNeeded}
                      mcpServerSelection={mcpServerSelection}
                      setMcpServerSelection={setMcpServerSelection}
                      onNewChatAuto={handleNewChatAuto}
                      onSkillsChange={handleSkillsChange}
                      onTokensUsed={handleTokensUsed}
                    />
                  </div>
                </div>
              </div>
              <div className={activeTab === 'playground' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
                <ConsolePlayground
                  tools={tools}
                  selectedToolName={selectedToolName}
                  onSelectToolName={setSelectedToolName}
                  history={executionHistory}
                  onAddHistory={handleAddHistoryRecord}
                  onClearHistory={handleClearHistory}
                  loadingTools={loadingTools}
                  onRefreshTools={handleRefreshTools}
                />
              </div>
              <div className={activeTab === 'skills' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
                <SkillsGallery />
              </div>
              <div className={activeTab === 'sources' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
                <SourcesCatalog />
              </div>
              <div className={activeTab === 'keys' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
                <ApiKeysConfig onSaved={fetchConfig} />
              </div>
              <div className={activeTab === 'system-variables' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
                <SystemVariablesConfig />
              </div>
              <div className={activeTab === 'providers' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
                <div className="max-w-5xl mx-auto w-full p-4 md:p-6">
                  <ProvidersSyncPanel />
                </div>
              </div>
            </div>

            {/* Cierre del div "contenido" (panel de tabs + sus panels anidados) */}
            </div>

            {/* v1.5.3 — Toggle panel derecho (mostrar/ocultar) antes del rail */}
            <button
              onClick={toggleRightPanel}
              className="hidden md:flex shrink-0 w-5 h-full items-center justify-center bg-zinc-50 dark:bg-zinc-900 border-l border-zinc-200/60 dark:border-zinc-800/60 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              title={layout.rightCollapsed
                ? (lang === 'en' ? 'Show sections panel' : 'Mostrar panel de secciones')
                : (lang === 'en' ? 'Hide sections panel' : 'Ocultar panel de secciones')}
            >
              {layout.rightCollapsed
                ? <PanelRightOpen className="w-3.5 h-3.5" />
                : <PanelRightClose className="w-3.5 h-3.5" />}
            </button>

            {/* v1.5.3 — Resize handle derecho (entre main y RightNavRail) */}
            {!layout.rightCollapsed && (
              <div
                onMouseDown={startRightDrag}
                className="hidden md:block w-1 cursor-col-resize bg-zinc-200/60 dark:bg-zinc-800/60 hover:bg-indigo-500 hover:w-1.5 transition-all shrink-0"
                title="Arrastra para redimensionar el panel de secciones"
              />
            )}

            {/* v1.5.0 P1 — Sidebar vertical derecho de navegación. v1.5.3: pasa activeSkills. */}
            {!layout.rightCollapsed && (
              <div
                className="hidden md:block shrink-0 h-full overflow-hidden"
                style={{ width: `${layout.rightWidth}px` }}
              >
                <RightNavRail
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  activeSkills={activeSkillsList}
                />
              </div>
            )}

          </section>

        </div>
      </main>

      {/* (Footer viejo eliminado en v1.4.5 — ganamos espacio vertical para el chat panel) */}

      {/* 4. (Eliminado) El modal de API Keys fue reemplazado por el tab
            'keys' en el navegador superior. Ver components/ApiKeysConfig.tsx */}

      {/* v1.0.11-mobile — Navegación inferior + drawer de chats solo en móvil (<768px) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenChatDrawer={() => setMobileChatDrawerOpen(true)}
      />
      <MobileChatDrawer
        open={mobileChatDrawerOpen}
        onClose={() => setMobileChatDrawerOpen(false)}
      >
        <ChatSidebar
          activeChatId={activeChatId}
          onActiveChat={(id) => { handleActiveChat(id); setMobileChatDrawerOpen(false); }}
          onNewChat={() => { handleNewChat(); }}
          refreshSignal={chatListRefreshSignal}
          mobileMode={true}
        />
      </MobileChatDrawer>

    </div>
  );
}
