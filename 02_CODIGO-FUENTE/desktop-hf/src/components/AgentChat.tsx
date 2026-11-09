import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { ChatMessage, ToolCallState, SourceDefinition, SourceGroup, AttachedFile } from '../types';
import AttachmentExtraToolsPanel from './AttachmentExtraToolsPanel';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, RefreshCw, Bot, User, Brain, Terminal, ChevronDown, ChevronRight, ChevronUp, Copy, Check, FileText, Globe, Search, Play, CornerDownRight, Square, Edit2, RotateCcw, X, Trash2, ArrowDown, ArrowUp, Plus, Mic, Activity, Volume2, VolumeX, MicOff, Settings, GripHorizontal, GripVertical, ArrowUpToLine, ArrowDownToLine, Cpu, ShieldCheck, ArrowRight, MessageSquare, Loader2, Clock, Sparkles, Layers } from 'lucide-react';
import { useI18n, getDefaultSkills } from '../lib/i18n';
import { motion, Reorder, useDragControls } from 'motion/react';

interface AgentChatProps {
  chatId?: string | null;
  onAddHistoryRecord: (record: any) => void;
  onToolsUpdateNeeded?: () => void;
  mcpServerSelection: string;
  setMcpServerSelection: (val: string) => void;
  // Variante C v1.4.5 — auto-crear chat al primer prompt cuando chatId===null.
  // Devuelve el nuevo chatId (string) o null si falla. No debe remontar el componente.
  onNewChatAuto?: (title: string) => Promise<string | null>;
  // v1.5.3 — Lift-up de skills activos para mostrarlos en RightNavRail bottom.
  onSkillsChange?: (skills: { name: string; description?: string }[]) => void;
  // v1.5.3 — Acumular tokens IN/OUT por respuesta del agente (footer inferior del main).
  onTokensUsed?: (inputTokens: number, outputTokens: number) => void;
}

const FALLBACK_SOURCE_GROUPS: SourceGroup[] = [
  { id: 'peru', name: 'Perú', count: 3, sources: ['alicia', 'renati', 'peru'] },
  { id: 'latam', name: 'Latinoamérica', count: 1, sources: ['latam'] },
  { id: 'global', name: 'Global', count: 1, sources: ['global'] },
];

const FALLBACK_SOURCES: SourceDefinition[] = [
  { id: 'alicia', name: 'ALICIA (CONCYTEC)', country: 'Perú', category: 'free', keyNeeded: false, description: 'Repositorio nacional peruano.' },
  { id: 'renati', name: 'RENATI', country: 'Perú', category: 'free', keyNeeded: false, description: 'Registro Nacional de Trabajos de Investigación.' },
  { id: 'peru', name: 'Grupo Perú', country: 'Perú', category: 'free', keyNeeded: false, description: 'Fuentes académicas peruanas.' },
  { id: 'latam', name: 'Grupo Latinoamérica', country: 'LatAm', category: 'free', keyNeeded: false, description: 'Fuentes académicas regionales.' },
  { id: 'global', name: 'Grupo Global', country: 'Global', category: 'free', keyNeeded: false, description: 'Índices académicos internacionales.' },
];


const CollapsiblePhase = ({ title, content, isLast }: { title: string, content: string, isLast?: boolean }) => {
  const [isOpen, setIsOpen] = useState(isLast || false);
  
  useEffect(() => {
    setIsOpen(!!isLast);
  }, [isLast]);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl my-4 overflow-hidden bg-white/50 dark:bg-zinc-900/50 shadow-sm">
      <div 
        className="flex justify-between items-center px-4 py-3 cursor-pointer bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{title}</h3>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </div>
      {isOpen && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <div className="markdown-body text-xs md:text-sm prose dark:prose-invert max-w-none leading-relaxed break-words space-y-2 prose-p:my-1 prose-headings:font-display prose-headings:font-semibold prose-headings:text-zinc-900 dark:prose-headings:text-white prose-a:text-indigo-600 dark:prose-a:text-indigo-455 prose-a:underline prose-code:font-mono prose-code:text-[11px] prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ol:list-decimal prose-ul:list-disc pl-1">
            <Markdown 
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </Markdown>
          </div>
        </div>
      )}
    </div>
  )
}

const CollapsibleTable = ({ children, ...props }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl my-4 overflow-hidden bg-white/50 dark:bg-zinc-900/50 shadow-sm">
      <div 
        className="flex justify-between items-center px-4 py-3 cursor-pointer bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="9" x2="9" y1="9" y2="21"/><line x1="15" x2="15" y1="9" y2="21"/></svg>
          Ver Tabla de Datos
        </h3>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </div>
      {isOpen && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-x-auto">
          <table className="w-full text-left border-collapse" {...props}>
            {children}
          </table>
        </div>
      )}
    </div>
  );
};


const markdownComponents = {
  a: ({ href, children, ...props }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  table: (props: any) => <CollapsibleTable {...props} />,
  blockquote: ({ children, ...props }: any) => (
    <div className="my-4 relative bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3">Referencia en el documento:</div>
      <blockquote className="border-l-[3px] border-zinc-300 dark:border-zinc-700 pl-4 py-1 text-[13px] text-zinc-600 dark:text-zinc-400 italic bg-transparent m-0" {...props}>
        {children}
      </blockquote>
    </div>
  )
};

const RenderPhasedMarkdown = ({ content }: { content: string }) => {
  // Strip raw details/summary HTML tags that might be causing rendering issues
  content = content.replace(/<\/?details[^>]*>/g, '').replace(/<\/?summary[^>]*>/g, '');

  const parts = content.split(/^(?:\s*###\s+|\s*\*\*\s*)?((?:Fase|Paso|Etapa)\s+\d+.*?)(?:\*\*|:)?\s*$/im);
  
  if (parts.length <= 1) {
    return (
      <Markdown 
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </Markdown>
    );
  }

  const renderedParts = [];
  
  // First part is before the first phase
  if (parts[0].trim()) {
    renderedParts.push(
      <Markdown 
        key="intro"
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {parts[0]}
      </Markdown>
    );
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i];
    const sectionContent = parts[i + 1] || '';
    const isLast = i === parts.length - 2 || i === parts.length - 1;
    renderedParts.push(
      <CollapsiblePhase key={i} title={title} content={sectionContent} isLast={isLast} />
    );
  }

  return <>{renderedParts}</>;
}

const TimerDisplay = memo(({ startTimestamp, duration, className = "" }: { startTimestamp?: number, duration?: number, className?: string }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (duration !== undefined) {
      return;
    }
    if (!startTimestamp) {
      return;
    }

    const interval = setInterval(() => {
      setElapsed((Date.now() - startTimestamp) / 1000);
    }, 1000);

    setElapsed((Date.now() - startTimestamp) / 1000);

    return () => clearInterval(interval);
  }, [startTimestamp, duration]);

  const displayVal = duration !== undefined ? duration : elapsed;

  if (displayVal <= 0 && duration === undefined) return null;

  return (
    <span className={`font-mono text-[10px] flex items-center gap-1 ${className}`}>
      <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
      <span>{displayVal.toFixed(1)}s</span>
    </span>
  );
});

const WorkflowTrace = memo(({ toolCalls, isExecuting, t, lang }: any) => {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2 mt-0.5 px-2 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl overflow-x-auto no-scrollbar max-w-full">
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1 flex items-center gap-1 shrink-0">
        <Activity className="w-3 h-3" /> Trace:
      </span>
      {toolCalls.map((call: ToolCallState, idx: number) => (
        <div key={idx} className="flex items-center gap-1.5 shrink-0">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-widest ${
            call.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
            call.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50' :
            call.status === 'pending_approval' ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 animate-pulse' :
            'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
          }`}>
             {call.status === 'calling' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 
              call.status === 'success' ? <Check className="w-2.5 h-2.5" /> :
              call.status === 'failed' ? <X className="w-2.5 h-2.5" /> :
              <Clock className="w-2.5 h-2.5" />}
             {call.name.length > 20 ? call.name.substring(0,20)+'...' : call.name}
          </div>
          {(idx < toolCalls.length - 1 || !isExecuting) && (
             <ArrowRight className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
          )}
        </div>
      ))}
      
      {/* Final Response Step */}
      {!isExecuting && toolCalls.length > 0 && (
         <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] uppercase font-bold tracking-widest shrink-0">
           <MessageSquare className="w-2.5 h-2.5" />
           {lang === 'en' ? 'Final Response' : lang === 'pt' ? 'Resposta Final' : 'Respuesta Final'}
         </div>
      )}
    </div>
  );
});

const ToolCallItem = memo(({ call, msgId, idx, isExpanded, toggleExpandTool, handleApproveTool, handleRejectTool, t }: any) => {
  let statusBadgeColor = "text-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400";
  let statusText = "Conectando...";
  
  if (call.status === 'success') {
    statusBadgeColor = "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 dark:text-emerald-400";
    statusText = t.toolSuccess;
  } else if (call.status === 'failed') {
    statusBadgeColor = "text-red-500 bg-red-50 dark:bg-red-950/25 dark:text-red-400";
    statusText = t.toolFailed;
  } else if (call.status === 'pending_approval') {
    statusBadgeColor = "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold border border-indigo-200/50 dark:border-indigo-800/50 animate-pulse";
    statusText = t.confirmRequired;
  }

  const argsStrHeader = useMemo(() => {
    try {
      const s = JSON.stringify(call.args);
      return s.length > 150 ? s.substring(0, 150) + '...' : s;
    } catch (e) {
      return '';
    }
  }, [call.args]);

  const argsStrFull = useMemo(() => {
    try {
      const s = JSON.stringify(call.args, null, 2);
      return s?.length > 5000 ? s.substring(0, 5000) + '\n\n... [Argumentos truncados por rendimiento]' : s;
    } catch (e) {
      return String(call.args);
    }
  }, [call.args]);

  const resultStrFull = useMemo(() => {
    try {
      const res = typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2);
      return res?.length > 10000 ? res.substring(0, 10000) + '\n\n... [Contenido UI truncado por rendimiento. Resultado real muy extenso]' : res;
    } catch (e) {
      return 'Error al renderizar el resultado.';
    }
  }, [call.result]);

  return (
    <div
      className="border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 shadow-xs rounded-xl overflow-hidden transition"
    >
      <div
        onClick={() => toggleExpandTool(msgId, idx)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 select-none text-[11px]"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
            tool:{call.name}
          </span>
          <span className="text-zinc-400 truncate dark:text-zinc-500 text-[10px]">
            {argsStrHeader}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TimerDisplay startTimestamp={call.startTimestamp} duration={call.duration} className="text-zinc-500 dark:text-zinc-400 mr-1 font-semibold" />
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${statusBadgeColor}`}>
            {statusText}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
        </div>
      </div>
      {(isExpanded || call.status === 'pending_approval') && (
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/45 text-[10px]">
          {call.status === 'pending_approval' && (
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/25 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 space-y-2 mb-2 font-sans select-none">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500 shrink-0 animate-bounce" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {t.requiresApprovalTitle}
                </span>
              </div>
              <p className="text-[10px] text-zinc-550 dark:text-zinc-400 leading-snug">
                {t.requiresApprovalDesc.replace("mcp", `"${call.name}"`)}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproveTool(msgId, idx);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-xs text-[10px] cursor-pointer"
                >
                  {t.toolApproveBtn}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectTool(msgId, idx);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-805 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold transition text-[10px] cursor-pointer"
                >
                  {t.toolRejectBtn}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500 font-semibold mb-1 ml-0.5 mt-1 font-sans">
            <span>{t.mcpArgumentsLabel}</span>
          </div>
          <pre className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded-lg border border-zinc-250 dark:border-zinc-800 font-mono text-zinc-800 dark:text-zinc-300 max-h-[120px] overflow-y-auto mb-2 select-text">
            {argsStrFull}
          </pre>
          {call.status !== 'pending_approval' && (
            <>
              <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500 font-semibold mb-1 ml-0.5 font-sans">
                <span>{t.mcpResultLabel}</span>
              </div>
              <div className="bg-black/90 p-2.5 rounded-lg border border-zinc-800 overflow-y-auto max-h-[220px]">
                {call.status === 'success' || call.status === 'failed' ? (
                  <pre className="font-mono text-[10px] text-green-400/90 whitespace-pre-wrap leading-relaxed select-text font-semibold">
                    {resultStrFull}
                  </pre>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></div>
                    <span className="font-mono ml-1">{t.mcpWaitingLabel}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.call.status === nextProps.call.status &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.call.result === nextProps.call.result &&
    prevProps.call.args === nextProps.call.args
  );
});

export default function AgentChat({ chatId, onAddHistoryRecord, onToolsUpdateNeeded, mcpServerSelection, setMcpServerSelection, onNewChatAuto, onSkillsChange, onTokensUsed }: AgentChatProps) {
  const { lang, t } = useI18n();
  const [nvidiaModels, setNvidiaModels] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchNvidiaModels = async () => {
      try {
        const res = await fetch('/api/nvidia-models');
        if (res.ok) {
          const data = await res.json();
          if (data && data.data) {
            setNvidiaModels(data.data);
          }
        }
      } catch (e) {
        console.error("Failed to fetch NVIDIA models:", e);
      }
    };
    fetchNvidiaModels();
  }, []);

  // VARIANTE C v1.3 — Initial friendly greeting message (se sustituye si hay chatId)
  const INITIAL_MSG: ChatMessage = {
    id: 'initial',
    role: 'assistant',
    content: `¡Hola! Soy tu **Asistente Científico y de Investigación**. \n\nHe inicializado el entorno MCP y tengo acceso a diversas herramientas de recuperación y análisis de datos.\n\nPuedo ayudarte con búsquedas, estructuración de información, resolución de dudas o redacción de contenido especializado.\n\n¿Qué tarea realizamos hoy? Haz clic en las sugerencias de abajo o escribe tu consulta directamente.`,
    timestamp: new Date().toLocaleTimeString()
  };

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MSG]);
  const [chatLoaded, setChatLoaded] = useState(false);

  // Cargar mensajes persistidos al montar / cambiar chatId
  // Fase H v1.0.11n: tolerar 2 formatos del backend:
  //   - Nuevo (v1.0.11n+): { ok: true, chat: { id, uuid, messages, ... } }
  //   - Viejo (<= v1.0.11m): { id, messages, ... } (chat plano)
  // El backend Desktop también habia usado { ok, chat: { uuid } } pero el
  // Android devolvía chat plano → nunca matcheaba → chats nunca se cargaban.
  useEffect(() => {
    let cancelled = false;
    const loadChat = async () => {
      if (!chatId) {
        setMessages([INITIAL_MSG]);
        setChatLoaded(false);
        persistedIdsRef.current = new Set();
        return;
      }
      try {
        const r = await fetch(`/api/chats/${chatId}`);
        const d = await r.json();
        if (cancelled) return;
        // Tolerar ambos contratos
        const chatObj = (d && d.ok && d.chat) ? d.chat : (d && d.id ? d : null);
        if (chatObj && Array.isArray(chatObj.messages) && chatObj.messages.length > 0) {
          // Mapear mensajes persistidos al shape ChatMessage
          const restored: ChatMessage[] = chatObj.messages.map((m: any, i: number) => ({
            id: m.id || `restored-${i}-${Date.now()}`,
            role: m.role,
            content: m.content,
            timestamp: m.ts ? new Date(m.ts).toLocaleTimeString() : '',
            toolName: m.toolName,
            toolInput: m.toolInput,
          }));
          // Registrar IDs restaurados como ya persistidos (fix bug 9a: evitar doble persistencia)
          restored.forEach((m) => persistedIdsRef.current.add(m.id));
          setMessages(restored);
        } else {
          // Chat vacío: empezar con greeting
          setMessages([INITIAL_MSG]);
        }
        setChatLoaded(true);
      } catch (e) {
        console.error('loadChat', e);
        setMessages([INITIAL_MSG]);
        setChatLoaded(true);
      }
    };
    loadChat();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // VARIANTE C v1.4 — Persistencia robusta (fix bugs 9a, 9c, 9d)
  // Estrategia: trackeo IDs ya persistidos via ref Set. Cada vez que messages cambia,
  // comparo IDs actuales vs persistedIdsRef. Los nuevos (no en el set) se persisten.
  // Esto es seguro para restored msgs (ya están en el set al cargar) y para race conditions
  // (los IDs son únicos y no se re-persisten aunque el componente se remonte).
  const persistedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Variante C v1.4.5: usa chatIdRef.current (override local al auto-crear chat)
    const effectiveChatId = chatIdRef.current || chatId;
    if (!effectiveChatId || !chatLoaded) return;
    const persisted = persistedIdsRef.current;
    const newMsgs = messages.filter((m) => m.id !== 'initial' && !persisted.has(m.id));
    if (newMsgs.length === 0) return;
    newMsgs.forEach((m) => {
      persisted.add(m.id);
      const body: any = {
        role: m.role,
        content: m.content,
        ts: new Date().toISOString(),
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        body.toolName = m.toolCalls.map((tc) => tc.name).filter(Boolean).join(',');
        body.toolInput = JSON.stringify(m.toolCalls);
      }
      fetch(`/api/chats/${effectiveChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((e) => console.error('persistNew', e));
    });
  }, [messages, chatId, chatLoaded]);


  const [inputMessage, setInputMessage] = useState('');
  // Fase P10 Attachment / Extra Tools — estado de archivos adjuntos del prompt actual.
  // Cada adjunto tiene { path (absoluto vía Electron), name, ext, size, format }.
  // Se pasan al backend como `attachedFilePaths: string[]` en el body del POST /api/chat.
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  // Fase H v1.0.11n: panel desplegable de resultados de filtro clickeables.
  // El <select> nativo no soporta "click en option filtrada para seleccionar"
  // — al escribir en el filtro, el usuario esperaba poder clicar el resultado.
  // Ahora mostramos un panel flotante con la lista filtrada cuando hay texto
  // y el input tiene foco. Clic en un item → setSelectedModel + limpiar filtro.
  const [modelFilterFocus, setModelFilterFocus] = useState(false);

  // Dynamic Synced Model Groups State & Live Status
  const [syncedModelGroups, setSyncedModelGroups] = useState<any[]>([]);
  const [isSyncingModels, setIsSyncingModels] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [modelStatus, setModelStatus] = useState<{ isLive: boolean; latencyMs?: number; isChecking: boolean; lastChecked?: string }>({
    isLive: true,
    isChecking: false
  });

  // Sync Models function (Auto & Manual Scraper) — Fase H v1.0.11k: ahora hace
  // sync REAL a cada endpoint del provider en paralelo en el backend. El backend
  // demora la respuesta hasta tener todas las respuestas (timeout 15s/provider).
  // Si tarda mucho, mostramos unProgressFeedback al usuario.
  const [syncProgress, setSyncProgress] = useState<string>('');

  const syncModels = async (isManual = false) => {
    setIsSyncingModels(true);
    setSyncProgress(isManual ? 'Iniciando sincronización real con APIs…' : '');
    // Timeout watchdog: si a los 3s no hay respuesta, mostramos msg de "largo sync"
    const watchdog = setTimeout(() => {
      setSyncProgress(prev => prev || 'Consultando APIs de Gemini, Mistral, NVIDIA, Groq…');
    }, 3000);
    try {
      const res = await fetch('/api/models/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.modelGroups && Array.isArray(data.modelGroups)) {
          setSyncedModelGroups(data.modelGroups);
          setLastSyncTime(new Date().toLocaleTimeString());
          // Feedback de cuántos modelos vivos detectó
          const live = data.liveModels ?? data.modelGroups.reduce((s: number, g: any) => s + (g.items || []).filter((i: any) => i.isLive).length, 0);
          const total = data.totalModels ?? data.modelGroups.reduce((s: number, g: any) => s + (g.items || []).length, 0);
          const provsOK = data.syncReport
            ? Object.entries(data.syncReport.perProvider).filter(([, v]: any) => v.ok).length
            : 0;
          setSyncProgress(isManual
            ? `Sincronizado: ${live} vivos / ${total} total — ${provsOK}/10 proveedores OK`
            : '');
          if (isManual) {
            setTimeout(() => setSyncProgress(''), 6000);
          }
        }
      }
    } catch (e) {
      console.error("Error syncing models:", e);
      setSyncProgress('Error de sincronización: ' + (e as Error).message);
    } finally {
      clearTimeout(watchdog);
      setIsSyncingModels(false);
    }
  };

  // Check Current Model Live Status
  const checkCurrentModelStatus = async (modelName: string) => {
    if (!modelName) return;
    setModelStatus(prev => ({ ...prev, isChecking: true }));
    try {
      const res = await fetch(`/api/model/status?model=${encodeURIComponent(modelName)}`);
      if (res.ok) {
        const data = await res.json();
        setModelStatus({
          isLive: !!data.isLive,
          latencyMs: data.latencyMs,
          isChecking: false,
          lastChecked: new Date().toLocaleTimeString()
        });
      } else {
        setModelStatus({ isLive: false, isChecking: false, lastChecked: new Date().toLocaleTimeString() });
      }
    } catch (e) {
      setModelStatus({ isLive: false, isChecking: false, lastChecked: new Date().toLocaleTimeString() });
    }
  };

  // Initial Auto-Sync
  useEffect(() => {
    syncModels();
  }, []);

  const modelGroups = useMemo(() => {
    const q = modelSearchQuery.toLowerCase();
    const filterFn = (items: {value: string, label: string; isLive?: boolean}[]) => items.filter(i => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));

    // VARIANTE C v1.2 — los modelos ya NO estan hardcoded en el frontend.
    // Si el scraper o el catalogo devolvio algo, se usa; si no, se muestra
    // un grupo vacio para que el operador pulse "Sync modelos" arriba.
    // Antes: 35 modelos literales inventados (gemini-3.5-flash, gpt-5.5, etc.)
    // que no correspondian a APIs reales.
    // que no correspondian a APIs reales.
    const sourceGroups = syncedModelGroups.length > 0
      ? syncedModelGroups
      : [{
          label: lang === 'en' ? "No models synced — click Sync above"
             : lang === 'pt' ? "Sem modelos sincronizados — clique Sync acima"
             : "Sin modelos sincronizados — pulsa Sync arriba",
          provider: 'none',
          items: []
        }];

    return sourceGroups.map(group => ({
      label: group.label,
      items: filterFn(group.items || [])
    })).filter(g => g.items.length > 0);
  }, [modelSearchQuery, nvidiaModels, syncedModelGroups]);

  // Fase H v1.0.11n: flat list de modelos filtrados para el panel flotante.
  // Quando o usuário digita no filtro, mostrar lista clicável abaixo. Ele pode
  // clicar em qualquer item para setSelectedModel — o <select> nativo só permite
  // selecionar via onChange do próprio dropdown, que não reage ao filtro.
  const flatFilteredModels = useMemo(() => {
    const out: { value: string; label: string; isLive?: boolean; groupLabel: string }[] = [];
    modelGroups.forEach(g => {
      g.items.forEach(it => out.push({ ...it, groupLabel: g.label }));
    });
    // Limitar a 50 para no degradar el rendimiento con syncs grandes (NVIDIA → 100+)
    return out.slice(0, 50);
  }, [modelGroups]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('letsxinet-selected-model') || 'gemini-2.5-flash';
    }
    return 'gemini-2.5-flash';
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('letsxinet-selected-model', selectedModel);
    }
    checkCurrentModelStatus(selectedModel);
    const interval = setInterval(() => {
      checkCurrentModelStatus(selectedModel);
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedModel]);

  const [streaming, setStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedToolIndex, setExpandedToolIndex] = useState<Record<string, boolean>>({});
  
  // Message edit state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');

  const tokenMetrics = useMemo(() => {
    let inputChars = 0;
    let outputChars = 0;

    for (const m of messages) {
      if (m.role === 'assistant') {
        outputChars += m.content?.length || 0;
      } else {
        inputChars += m.content?.length || 0;
      }

      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          const callText = JSON.stringify(tc.args || {});
          inputChars += callText.length;
          if (tc.result) {
            const resultText = typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result);
            inputChars += resultText.length;
          }
        }
      }
    }

    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    const totalTokens = inputTokens + outputTokens;

    return {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    };
  }, [messages]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Variante C v1.4.5 — ref sincronizado con chatId prop. handleSendPrompt puede
  // crear un chat on-the-fly al primer prompt (cuando chatId===null) y hacer override
  // local sin esperar re-render del padre. Permite persistir mensajes del nuevo chat
  // dentro del mismo ciclo de streaming.
  const chatIdRef = useRef<string | null>(chatId ?? null);
  useEffect(() => { chatIdRef.current = chatId ?? null; }, [chatId]);

  // VARIANTE C v1.4 — Cancela stream pendiente al desmontar (fix bug 9c)
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [loadedSkills, setLoadedSkills] = useState<any[]>([]);
  const [autoExecuteTools, setAutoExecuteTools] = useState<boolean>(true);
  const [temperature, setTemperature] = useState<number>(0.0);
  const [maxTokens, setMaxTokens] = useState<number>(8000);
  const [maxToolCalls, setMaxToolCalls] = useState<number>(25);
  const [selectedSources, setSelectedSources] = useState<string[]>(["alicia", "renati", "peru"]);
  const [autoSources, setAutoSources] = useState<boolean>(true);
  const [catalogSources, setCatalogSources] = useState<SourceDefinition[]>(FALLBACK_SOURCES);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>(FALLBACK_SOURCE_GROUPS);
  const [expandedSourceGroups, setExpandedSourceGroups] = useState<Record<string, boolean>>({ peru: true });
  const searchSources = selectedSources.join(", ");
  const [searchMaxResults, setSearchMaxResults] = useState<number>(20);
  const [autoMaxResults, setAutoMaxResults] = useState<boolean>(true);
  const [searchYearStart, setSearchYearStart] = useState<string>('');
  const [searchYearEnd, setSearchYearEnd] = useState<string>('');
  const [searchFastMode, setSearchFastMode] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/sources', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('source catalog unavailable')))
      .then((catalog) => {
        if (Array.isArray(catalog.sources) && catalog.sources.length) setCatalogSources(catalog.sources);
        if (Array.isArray(catalog.groups) && catalog.groups.length) setSourceGroups(catalog.groups);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.warn('Using local source catalog fallback:', error.message);
      });
    return () => controller.abort();
  }, []);

  const sourceById = useMemo(() => new Map(catalogSources.map((source) => [source.id, source])), [catalogSources]);
  const toggleSource = (sourceId: string) => {
    setSelectedSources((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId]);
  };
  const toggleSourceGroup = (sourceIds: string[]) => {
    const ids = sourceIds.filter((id) => sourceById.has(id) || id.length > 0);
    const isComplete = ids.length > 0 && ids.every((id) => selectedSources.includes(id));
    setSelectedSources((current) => isComplete
      ? current.filter((id) => !ids.includes(id))
      : Array.from(new Set([...current, ...ids])));
  };
  const [isSmartPhase, setIsSmartPhase] = useState<boolean>(true);
  const [strictGuardrails, setStrictGuardrails] = useState<boolean>(false);
  const [antiHallucination, setAntiHallucination] = useState<boolean>(true);
  const [enableWebSearch, setEnableWebSearch] = useState<boolean>(true);
  const [enableWebTools, setEnableWebTools] = useState<boolean>(true);
  const [enablePeruWebFallback, setEnablePeruWebFallback] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('letsxinet-peru-web-fallback') === 'true';
    }
    return false; // Disabled by default
  });
  const [enableModelFallback, setEnableModelFallback] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('letsxinet-enable-model-fallback') === 'true';
    }
    return false; // Disabled by default
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('letsxinet-peru-web-fallback', String(enablePeruWebFallback));
    }
  }, [enablePeruWebFallback]);
  const [fallbackModel, setFallbackModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('letsxinet-fallback-model') || 'gemini-2.5-flash';
    }
    return 'gemini-2.5-flash';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('letsxinet-enable-model-fallback', String(enableModelFallback));
    }
  }, [enableModelFallback]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('letsxinet-fallback-model', fallbackModel);
    }
  }, [fallbackModel]);

  const [executionMode, setExecutionMode] = useState<'linear' | 'langgraph'>('langgraph');
  // v1.5.0 — Modo de búsqueda preferido. "auto" deja que la IA decida.
  // search (rápido) es el default; smart search (refinado) y batch search (profundo).
  const [searchTools, setSearchTools] = useState<string[]>(['search', 'smart_search', 'batch_search']); // v1.5.5 — tools de búsqueda activas (multi-selección); default = las 3 activas (Auto)
  const [searchAuto, setSearchAuto] = useState<boolean>(true); // v1.5.5 — modo auto ACTIVADO por defecto: la IA decide qué tools usar según el prompt
  const [parallelToolExecution, setParallelToolExecution] = useState<boolean>(true); // v1.5.2 — ejecutar tools en paralelo o secuencial
  const [activeGraphNode, setActiveGraphNode] = useState<string | null>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const dragControls = useDragControls();
  
  const [toolExecutionOrder, setToolExecutionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('letsxinet-tool-execution-order');
    const defaults = ['letxipu_osm', 'letxipu', 'anti_hallucination', 'web_search', 'letxinet', 'web_tools'];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(item => defaults.includes(item));
          defaults.forEach(item => {
            if (!filtered.includes(item)) {
              filtered.push(item);
            }
          });
          return filtered;
        }
      } catch (e) {}
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('letsxinet-tool-execution-order', JSON.stringify(toolExecutionOrder));
  }, [toolExecutionOrder]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const moveCapabilityUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...toolExecutionOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    setToolExecutionOrder(newOrder);
  };

  const moveCapabilityDown = (index: number) => {
    if (index === toolExecutionOrder.length - 1) return;
    const newOrder = [...toolExecutionOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    setToolExecutionOrder(newOrder);
  };

  const moveCapabilityToTop = (index: number) => {
    if (index === 0) return;
    const newOrder = [...toolExecutionOrder];
    const item = newOrder.splice(index, 1)[0];
    newOrder.unshift(item);
    setToolExecutionOrder(newOrder);
  };

  const moveCapabilityToBottom = (index: number) => {
    if (index === toolExecutionOrder.length - 1) return;
    const newOrder = [...toolExecutionOrder];
    const item = newOrder.splice(index, 1)[0];
    newOrder.push(item);
    setToolExecutionOrder(newOrder);
  };

  const resetToolOrder = () => {
    setToolExecutionOrder(['letxipu_osm', 'letxipu', 'anti_hallucination', 'web_search', 'letxinet', 'web_tools']);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...toolExecutionOrder];
    const item = newOrder.splice(draggedIdx, 1)[0];
    newOrder.splice(dropIndex, 0, item);
    setToolExecutionOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };
  
  const selectedMcps = mcpServerSelection.split(',').map(s => s.trim());
  const allMcps = ['letxipu_osm', 'letxipu', 'letxinet'];
  const handleMcpToggle = (server: string) => {
    const isMcpBoth = selectedMcps.includes('both');
    const currentActive = allMcps.filter(s => isMcpBoth || selectedMcps.includes(s));

    let newActive: string[];
    if (currentActive.includes(server)) {
      newActive = currentActive.filter(s => s !== server);
    } else {
      newActive = [...currentActive, server];
    }

    if (newActive.length === allMcps.length) {
      setMcpServerSelection('both');
    } else if (newActive.length === 0) {
      setMcpServerSelection('none');
    } else {
      setMcpServerSelection(newActive.join(','));
    }
  };

  const capabilitiesMetadata: Record<string, { name: string, desc: string, icon: any }> = {
    letxipu: {
      name: lang === 'en' ? "Academic Search (LetXipu)" : lang === 'pt' ? "Busca Acadêmica (LetXipu)" : "Búsqueda Académica (LetXipu)",
      desc: lang === 'en' ? "Deep science search, DOI resolution & PDF intelligence." : lang === 'pt' ? "Busca científica profunda e análise de PDF." : "Búsqueda científica profunda, resolución DOI e inteligencia de PDFs.",
      icon: Brain
    },
    letxipu_osm: {
      name: lang === 'en' ? "Geo OSM (LetXipu OSM)" : lang === 'pt' ? "Geo OSM (LetXipu OSM)" : "Geo OSM (LetXipu OSM)",
      desc: lang === 'en' ? "OpenStreetMap maps, routing, address geocoding & nearby places." : lang === 'pt' ? "Mapas OpenStreetMap, rotas, geocodificação e locais próximos." : "Mapas OpenStreetMap, rutas, geocodificación y lugares cercanos.",
      icon: Globe
    },
    letxinet: {
      name: "LetXinet Services",
      desc: lang === 'en' ? "Custom network integrations and tools proxy." : lang === 'pt' ? "Integrações personalizadas e proxy de ferramentas." : "Integraciones de red personalizadas y proxy de herramientas.",
      icon: Cpu
    },
    web_tools: {
      name: lang === 'en' ? "Webwright & Scrapers" : lang === 'pt' ? "Webwright e Scrapers" : "Webwright y Scrapers",
      desc: lang === 'en' ? "Live webpage scraping & anti-hallucination verification." : lang === 'pt' ? "Scraping de páginas web e verificação anti-alucinação." : "Lectura manual de URLs y verificación anti-alucinación de datos.",
      icon: FileText
    },
    web_search: {
      name: lang === 'en' ? "Web Search (Google/Bing)" : lang === 'pt' ? "Busca Web (Google/Bing)" : "Búsqueda Web (Google/Bing)",
      desc: lang === 'en' ? "General internet queries for current year facts & fallbacks." : lang === 'pt' ? "Consultas gerais na internet para dados recentes e fallback." : "Consultas generales de internet para hechos recientes o rescate.",
      icon: Search
    },
    anti_hallucination: {
      name: lang === 'en' ? "Anti-Hallucination Guard" : lang === 'pt' ? "Guarda Anti-Alucinação" : "Verificación Antialucinación",
      desc: lang === 'en' ? "Enforces rigorous facts and statistics verification with automated PDF/web source comparison." : lang === 'pt' ? "Força verificação rigorosa de fatos e estatísticas com comparação automatizada de PDF/web." : "Verificación y contraste estricto de afirmaciones, números y años contra fuentes fácticas de PDF y web.",
      icon: ShieldCheck
    }
  };

  // Voice & Dictation Integration
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [speakResponses, setSpeakResponses] = useState<boolean>(() => {
    return localStorage.getItem('letsxinet-speak-responses') === 'true';
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    return localStorage.getItem('letsxinet-voice-name') || '';
  });
  const [currentlyPlayingMessageId, setCurrentlyPlayingMessageId] = useState<string | null>(null);
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const langCode = lang === 'en' ? 'en' : lang === 'pt' ? 'pt' : 'es';
        const sortedVoices = [...voices].sort((a, b) => {
          const aMatch = a.lang.toLowerCase().startsWith(langCode) ? 1 : 0;
          const bMatch = b.lang.toLowerCase().startsWith(langCode) ? 1 : 0;
          return bMatch - aMatch;
        });
        setAvailableVoices(sortedVoices);
        
        const savedVoice = localStorage.getItem('letsxinet-voice-name');
        if (savedVoice && sortedVoices.some(v => v.name === savedVoice)) {
          setSelectedVoiceName(savedVoice);
        } else if (sortedVoices.length > 0) {
          const firstMatch = sortedVoices.find(v => v.lang.toLowerCase().startsWith(langCode));
          const initialVoice = firstMatch ? firstMatch.name : sortedVoices[0].name;
          setSelectedVoiceName(initialVoice);
          localStorage.setItem('letsxinet-voice-name', initialVoice);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current.onvoiceschanged = null;
      }
    };
  }, [lang]);

  const speakText = (text: string, messageId: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();

    if (currentlyPlayingMessageId === messageId) {
      setCurrentlyPlayingMessageId(null);
      return;
    }

    // Clean up markdown so it reads naturally
    const cleanText = text
      .replace(/[*#`_\-]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .slice(0, 1000);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    if (selectedVoiceName) {
      const voice = availableVoices.find(v => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const langCode = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'es-ES';
      utterance.lang = langCode;
    }

    utterance.onend = () => {
      setCurrentlyPlayingMessageId(null);
    };

    utterance.onerror = () => {
      setCurrentlyPlayingMessageId(null);
    };

    setCurrentlyPlayingMessageId(messageId);
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setCurrentlyPlayingMessageId(null);
  };

  const startListening = async () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'en' 
        ? "Your browser does not support Speech Recognition. Try Chrome or Safari." 
        : lang === 'pt' 
          ? "O seu navegador não suporta Reconhecimento de Voz." 
          : "Tu navegador no soporta Dictado por voz (Reconocimiento del habla)."
      );
      return;
    }

    // Explicitly request microphone access first via getUserMedia to unlock permission in the iframe
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close the stream immediately, as SpeechRecognition will handle the recording session
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (micErr: any) {
      console.error("Microphone access error via getUserMedia:", micErr);
      const isDenied = micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError';
      alert(isDenied
        ? (lang === 'en' 
            ? "Microphone access was denied. Please allow microphone access in your browser settings or click on the lock/info icon next to the URL, or open the app in a new tab."
            : lang === 'pt'
              ? "Acesso ao microfone negado. Por favor, ative a permissão de áudio nas configurações do seu navegador ou abra o app em uma nova guia."
              : "Acceso al micrófono denegado. Por favor, permite el acceso al micrófono en la barra de direcciones, dale permisos en la configuración del navegador, o abre la aplicación en una nueva pestaña si estás en un marco (iframe).")
        : (lang === 'en'
            ? `Microphone error: ${micErr.message || 'Could not access audio device.'}`
            : lang === 'pt'
              ? `Erro no microfone: ${micErr.message || 'Não foi possível acessar o dispositivo de áudio.'}`
              : `Error del micrófono: ${micErr.message || 'No se pudo acceder al dispositivo de audio.'}`)
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'es-ES';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setInputMessage(prev => prev ? prev.trim() + " " + text : text);
        }
      };

      recognition.onerror = (e: any) => {
        console.error("SpeechRecognition error:", e);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          alert(lang === 'en'
            ? "Microphone access was denied. Make sure to click 'Allow' on the microphone prompt, or open the application in a new tab!"
            : lang === 'pt'
              ? "Acesso ao microfone negado. Certifique-se de permitir o acesso nas configurações ou abra o aplicativo em uma nova guia!"
              : "Acceso al micrófono denegado. Asegúrate de hacer clic en 'Permitir' cuando el navegador te lo solicite, o abre el aplicativo en una pestaña nueva si el marco del navegador bloquea el micrófono."
          );
        } else if (e.error && e.error !== 'no-speech') {
          alert(lang === 'en'
            ? `Speech Recognition Error: ${e.error}`
            : lang === 'pt'
              ? `Erro no reconhecimento: ${e.error}`
              : `Error del dictado de voz: ${e.error}`
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setIsListening(false);
  };

  const handleToggleSpeakResponses = () => {
    const nextVal = !speakResponses;
    setSpeakResponses(nextVal);
    localStorage.setItem('letsxinet-speak-responses', String(nextVal));
    if (!nextVal) {
      stopSpeaking();
    }
  };

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    localStorage.setItem('letsxinet-voice-name', voiceName);
    if (currentlyPlayingMessageId) {
      const msg = messages.find(m => m.id === currentlyPlayingMessageId);
      if (msg) {
        speakText(msg.content, msg.id);
      }
    }
  };

  useEffect(() => {
    // Dynamic greeting update
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'initial') {
        const greetingES = `¡Hola! Soy tu **Asistente Científico y de Investigación**. \n\nHe inicializado el entorno MCP y tengo acceso a diversas herramientas de recuperación y análisis de datos.\n\nPuedo ayudarte con búsquedas, estructuración de información, resolución de dudas o redacción de contenido especializado.\n\n¿Qué tarea realizamos hoy? Haz clic en las sugerencias de abajo o escribe tu consulta directamente.`;
        
        const greetingEN = `Hello! I am your **Scientific & Research Assistant**. \n\nI have initialized the MCP environment and have access to various data retrieval and analysis tools.\n\nI can help you with searches, structuring information, answering questions, or writing specialized content.\n\nWhat task shall we perform today? Click on the suggestions below or write your query directly.`;
        
        const greetingPT = `Olá! Sou o seu **Assistente Científico e de Pesquisa**. \n\nInicializei o ambiente MCP e tenho acesso a várias ferramentas de recuperação e análise de dados.\n\nPosso ajudar você com pesquisas, estruturação de informações, resposta a perguntas ou redação de conteúdo especializado.\n\nQual tarefa realizamos hoje? Clique nas sugestões abaixo ou digite sua consulta diretamente.`;

        const finalGreeting = lang === 'en' ? greetingEN : lang === 'pt' ? greetingPT : greetingES;
        return [
          {
            ...prev[0],
            content: finalGreeting
          }
        ];
      }
      return prev;
    });
  }, [lang]);

  useEffect(() => {
    const loadSuggestions = () => {
      const saved = localStorage.getItem('letsxinet-skills');
      const defaultSkills = getDefaultSkills(lang);
      if (saved) {
        try {
          const skills: any[] = JSON.parse(saved);
          let hasChanges = false;
          let updated = [...skills];
          
          // Migration to disable Letxipu V5 (id: '6') by default once
          const hasMigratedV5 = localStorage.getItem('letsxinet-skills-v5-default-disabled-v2');
          if (!hasMigratedV5) {
            updated = updated.map(s => {
              if (s.id === '6' || s.name?.includes('Letxipu V5')) {
                return { ...s, isActive: false };
              }
              return s;
            });
            localStorage.setItem('letsxinet-skills-v5-default-disabled-v2', 'true');
            hasChanges = true;
          }

          // Migration to deactivate all skills except 'Antecedentes APA 7' (id: '5') and 'LETXIPU DEEP SEARCH V12' (id: '7')
          const hasMigrated5And7Only = localStorage.getItem('letsxinet-skills-only-5-and-7-active-v1');
          if (!hasMigrated5And7Only) {
            updated = updated.map(s => {
              if (s.id === '5' || s.id === '7') {
                return { ...s, isActive: true };
              } else if (['1', '2', '3', '4', '6'].includes(s.id)) {
                return { ...s, isActive: false };
              }
              return s;
            });
            localStorage.setItem('letsxinet-skills-only-5-and-7-active-v1', 'true');
            hasChanges = true;
          }

          // Migration to update APA 7 (id: '5') prompt to be dynamic and depend on user input years
          const hasMigrated5DynamicYears = localStorage.getItem('letsxinet-skills-5-dynamic-years-v2');
          if (!hasMigrated5DynamicYears) {
            updated = updated.map(s => {
              if (s.id === '5') {
                const defSkill = defaultSkills.find(d => d.id === '5');
                if (defSkill) {
                  return {
                    ...s,
                    description: defSkill.description,
                    prompt: defSkill.prompt
                  };
                }
              }
              return s;
            });
            localStorage.setItem('letsxinet-skills-5-dynamic-years-v2', 'true');
            hasChanges = true;
          }

          // Migration for LetXipu V9 to deactivate all skills and enforce ONLY skill ID '7' with updated prompt
          const hasMigratedV9Only = localStorage.getItem('letsxinet-skills-only-7-active-v9');
          if (!hasMigratedV9Only) {
            updated = updated.map(s => {
              if (s.id === '7') {
                const defSkill = defaultSkills.find(d => d.id === '7');
                if (defSkill) {
                  return {
                    ...s,
                    name: defSkill.name,
                    description: defSkill.description,
                    prompt: defSkill.prompt,
                    isActive: true
                  };
                }
              }
              return { ...s, isActive: false };
            });
            localStorage.setItem('letsxinet-skills-only-7-active-v9', 'true');
            hasChanges = true;
          }

          defaultSkills.forEach(def => {
            if (!updated.some(s => s.id === def.id || s.name === def.name)) {
              updated.push(def);
              hasChanges = true;
            }
          });
          if (hasChanges) {
            localStorage.setItem('letsxinet-skills', JSON.stringify(updated));
            setLoadedSkills(updated);
          } else {
            setLoadedSkills(skills);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        // Automatically initialize default skills based on language selector
        try {
          localStorage.setItem('letsxinet-skills', JSON.stringify(defaultSkills));
          setLoadedSkills(defaultSkills);
          window.dispatchEvent(new Event('skills-updated'));
        } catch (err) {
          console.error(err);
        }
      }
    };

    loadSuggestions();
    window.addEventListener('skills-updated', loadSuggestions);
    return () => window.removeEventListener('skills-updated', loadSuggestions);
  }, [lang]);

  // v1.5.3 — Lift-up: propagar skills activos al padre (App.tsx) para que RightNavRail
  // los muestre en el bloque "SKILLS ACTIVOS" debajo de las secciones.
  useEffect(() => {
    if (!onSkillsChange) return;
    const active = loadedSkills
      .filter(s => s.isActive !== false)
      .map(s => ({ name: s.name, description: s.description }));
    onSkillsChange(active);
  }, [loadedSkills, onSkillsChange]);

  useEffect(() => {
    if (streaming) return;

    if (messages.length <= 1) {
      // v1.5.0 — Sugerencias de inicio autónomo: solo 3 plantillas pequeñas
      // para que el usuario pegue en el chat y edite (NO se ejecutan solas).
      // Cubren los 3 modos de búsqueda principal del LetXipu MCP.
      const initialCards = [
        lang === 'en' ? "search: <query>" : lang === 'pt' ? "search: <consulta>" : "search: <consulta>",
        lang === 'en' ? "smart search: <query>" : lang === 'pt' ? "smart search: <consulta>" : "smart search: <consulta>",
        lang === 'en' ? "batch search: <query>" : lang === 'pt' ? "batch search: <consulta>" : "batch search: <consulta>"
      ];
      setActiveSuggestions(initialCards);
    } else {
      const followupCards = [
        lang === 'en' ? "Extract specific PDF sections (pdf_sections / extract_section)" : lang === 'pt' ? "Extrair seções específicas do PDF (pdf_sections / extract_section)" : "Extraer secciones específicas del PDF (pdf_sections / extract_section)",
        lang === 'en' ? "Generate token-efficient summary (pdf_smart_summary)" : lang === 'pt' ? "Gerar resumo eficiente em tokens (pdf_smart_summary)" : "Generar resumen token-eficiente (pdf_smart_summary)",
        lang === 'en' ? "Search web for current stats/context (web_search)" : lang === 'pt' ? "Buscar na web por estatísticas/contexto atual (web_search)" : "Buscar estadísticas/contexto actual en la web (web_search)",
        lang === 'en' ? "Read full document (read_pdf_markdown)" : lang === 'pt' ? "Ler documento completo (read_pdf_markdown)" : "Leer documento completo (read_pdf_markdown)",
        lang === 'en' ? "Extract tables or formulas" : lang === 'pt' ? "Extrair tabelas ou fórmulas" : "Extraer tablas o fórmulas (extract_tables / extract_formulas)",
        lang === 'en' ? "Verify and correct AI hallucinations (verify_antihallucination_data)" : lang === 'pt' ? "Verificar e corrigir alucinações de IA (verify_antihallucination_data)" : "Verificar y corregir alucinaciones (verify_antihallucination_data)"
      ];
      const selected = [...followupCards].sort(() => 0.5 - Math.random()).slice(0, 3);
      const specialCard = "MUESTRA LA TABLA COMPLETA COMPARATIVA CON LINKS Y REFERENCIAA BIBLIOGRAFICA APA";
      setActiveSuggestions([specialCard, ...selected]);
    }
  }, [messages.length, streaming, lang]);

  const checkScrollState = () => {
    if (!scrollContainerRef.current) return;
    const target = scrollContainerRef.current;
    const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    const isNearTop = target.scrollTop <= 150;
    
    setShowScrollBottom(!isNearBottom);
    setShowScrollTop(!isNearTop && target.scrollTop > 300);
  };

  const handleScroll = () => {
    checkScrollState();
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Only auto-scroll on initial load or if user is near bottom already when message arrives
  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom();
    }
    // Give DOM time to update for new content, then recalibrate scroll buttons
    setTimeout(checkScrollState, 150);
  }, [messages]);

  const toggleExpandTool = (msgId: string, idx: number) => {
    const key = `${msgId}-${idx}`;
    setExpandedToolIndex((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'initial',
        role: 'assistant',
        content: `¡Hola! He reiniciado la sesión. ¿En qué tema de investigación científica avanzamos hoy?`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleEditMessage = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditBuffer(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditBuffer('');
  };

  const handleSaveEditAndResubmit = (msgId: string) => {
    if (!editBuffer.trim() || streaming) return;
    
    // Find index of the edited message
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    
    // Truncate history before this message
    const customHistory = messages.slice(0, msgIndex);
    const newContent = editBuffer.trim();
    
    setEditingMsgId(null);
    setEditBuffer('');
    handleSendPrompt(newContent, customHistory);
  };

  const handleResendFromPoint = (msgId: string) => {
    if (streaming) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    
    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'user') return;

    const customHistory = messages.slice(0, msgIndex);
    handleSendPrompt(targetMsg.content, customHistory);
  };

  const handleDeleteMessage = (msgId: string) => {
    if (streaming) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    
    // Deletes the user message and the subsequent AI response(s) 
    // Simply truncate exactly at that message and leave the history as is.
    const newMessages = messages.slice(0, msgIndex);
    setMessages(newMessages);
  };

  const handleApproveTool = async (msgId: string, toolIdx: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.toolCalls) return;
    const toolCall = msg.toolCalls[toolIdx];
    if (!toolCall) return;

    // Set tool call status to 'calling' in state
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const tCalls = [...(m.toolCalls || [])];
      tCalls[toolIdx] = { ...tCalls[toolIdx], status: 'calling' };
      return { ...m, toolCalls: tCalls };
    }));
    setStreaming(true);

    try {
      // Execute '/api/mcp/call' to run the tool live
      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: toolCall.name,
          arguments: toolCall.args
        })
      });

      const data = await res.json();
      let success = res.ok && !data.error;
      let finalResult = data.error ? data.error : (data.result !== undefined ? data.result : data);

      // Update state with tool result
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const tCalls = [...(m.toolCalls || [])];
        tCalls[toolIdx] = { 
          ...tCalls[toolIdx], 
          status: success ? 'success' : 'failed',
          result: finalResult
        };
        return { ...m, toolCalls: tCalls };
      }));

      // Log to workspace history
      onAddHistoryRecord({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        toolName: toolCall.name,
        args: toolCall.args || {},
        duration: 1.0,
        status: success ? 'success' : 'failed',
        response: finalResult
      });

      if (onToolsUpdateNeeded) {
        onToolsUpdateNeeded();
      }

      // Convert tool result to a readable string
      const serializedResult = typeof finalResult === 'object' ? JSON.stringify(finalResult, null, 2) : String(finalResult);

      const msgIndex = messages.findIndex(m => m.id === msgId);
      const customHistory = messages.slice(0, msgIndex + 1).map(m => {
        if (m.id === msgId) {
          const nextTCalls = [...(m.toolCalls || [])];
          nextTCalls[toolIdx] = {
            ...nextTCalls[toolIdx],
            status: success ? 'success' : 'failed',
            result: finalResult
          };
          return { ...m, toolCalls: nextTCalls };
        }
        return m;
      });

      setStreaming(false); // reset so the next send is allowed
      
      const promptText = lang === 'en' 
        ? `Manual authorization approved. Here is the final result of executing the mcp tool "${toolCall.name}" with the provided arguments:\n\n\`\`\`json\n${serializedResult}\n\`\`\`\n\nPlease continue with your analysis or generate the next response based on this information.`
        : lang === 'pt'
        ? `Autorização aprovada manualmente. Aqui está o resultado final da execução da ferramenta mcp "${toolCall.name}" com os argumentos fornecidos:\n\n\`\`\`json\n${serializedResult}\n\`\`\`\n\nPor favor, continue com sua análise ou gere a próxima resposta com base nessas informações.`
        : `Autorización aprobada de forma manual. Aquí tienes el resultado final de ejecutar la herramienta mcp "${toolCall.name}" con los argumentos provistos:\n\n\`\`\`json\n${serializedResult}\n\`\`\`\n\nPor favor, continúa con tu análisis o genera la siguiente respuesta según esta información.`;
      
      handleSendPrompt(promptText, customHistory);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const tCalls = [...(m.toolCalls || [])];
        tCalls[toolIdx] = { 
          ...tCalls[toolIdx], 
          status: 'failed',
          result: { error: err.message || String(err) }
        };
        return { ...m, toolCalls: tCalls };
      }));
      setStreaming(false);
    }
  };

  const handleRejectTool = (msgId: string, toolIdx: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.toolCalls) return;
    const toolCall = msg.toolCalls[toolIdx];
    if (!toolCall) return;

    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const tCalls = [...(m.toolCalls || [])];
      tCalls[toolIdx] = { 
        ...tCalls[toolIdx], 
        status: 'failed',
        result: { error: "Ejecución cancelada por el usuario de forma manual." }
      };
      return { ...m, toolCalls: tCalls };
    }));

    const msgIndex = messages.findIndex(m => m.id === msgId);
    const customHistory = messages.slice(0, msgIndex + 1);

    const promptText = `Se ha rechazado manualmente la ejecución de la herramienta "${toolCall.name}". Por favor, no intentes ejecutarla nuevamente y genera tu respuesta final o busca alternativas.`;
    handleSendPrompt(promptText, customHistory);
  };

  const handleSendPrompt = async (promptText: string, customHistory?: ChatMessage[]) => {
    if (!promptText.trim() || streaming) return;

    // Variante C v1.4.5 — Auto-crear chat al primer prompt si chatId es null.
    // Genera título a partir del prompt (primeras 50 chars), llama onNewChatAuto,
    // y actualiza chatIdRef localmente para persistir dentro de este mismo stream.
    if (!chatIdRef.current && onNewChatAuto) {
      const autoTitle = promptText.trim().slice(0, 50) + (promptText.length > 50 ? '…' : '');
      try {
        const newId = await onNewChatAuto(autoTitle);
        if (newId) {
          chatIdRef.current = newId;
          // Marcar chat como "loaded" para que el useEffect persistidor dispare
          setChatLoaded(true);
        }
      } catch (e) {
        console.error('onNewChatAuto', e);
      }
    }

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create unique user message ID
    const userMsgId = Math.random().toString(36).substr(2, 9);
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString()
    };

    // Create placeholder AI message
    const aiMsgId = Math.random().toString(36).substr(2, 9);
    const initialAiMessage: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      toolCalls: [],
      startTimestamp: Date.now()
    };

    // Append both to chat lists
    const baseMessages = customHistory ?? messages;
    const updatedMessages = [...baseMessages, userMessage, initialAiMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setStreaming(true);

    try {
      // Setup payload history mapped roles for backend endpoint
      // We filter out initial greeting to reduce token usage and save context space
      // Also clean up error messages or fallback warnings
      const historyPayload = updatedMessages
        .slice(0, updatedMessages.length - 2)
        .filter(m => m.id !== 'initial')
        .map(m => {
          let cleanContent = m.content
            .replace(/⚠️ \*\*Error de Ejecución:\*\* \*.+?\*/g, '')
            .replace(/⚠️ \*Nota:\* El modelo seleccionado.+?\.\.\. \n\n/g, '')
            .trim();
            
          let compactToolCalls = undefined;
          if (m.toolCalls && m.toolCalls.length > 0) {
            const compressContext = (obj: any, maxStrLen = 200): any => {
              if (typeof obj === 'string') {
                return obj.length > maxStrLen ? obj.substring(0, maxStrLen) + '...[trunc]' : obj;
              }
              if (Array.isArray(obj)) {
                // Keep max 3 items in history arrays
                const truncated = obj.slice(0, 3).map(item => compressContext(item, maxStrLen));
                if (obj.length > 3) truncated.push(`...[${obj.length - 3} items omitidos]`);
                return truncated;
              }
              if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const key in obj) {
                  if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    newObj[key] = compressContext(obj[key], maxStrLen);
                  }
                }
                return newObj;
              }
              return obj;
            };

            compactToolCalls = m.toolCalls.map(tc => {
              let compactResult = tc.result;
              if (compactResult) {
                try {
                  compactResult = compressContext(compactResult);
                } catch (e) {
                  const resStr = typeof compactResult === 'string' ? compactResult : JSON.stringify(compactResult);
                  if (resStr.length > 1000) {
                    compactResult = resStr.substring(0, 1000) + '... (resultado truncado por tamaño)';
                  }
                }
              }
              return {
                ...tc,
                result: compactResult
              };
            });
          }

          return {
            role: m.role,
            content: cleanContent || (m.toolCalls && m.toolCalls.length > 0 ? '(Ejecutó herramientas)' : (m.role === 'assistant' ? '(Error en respuesta)' : '(Mensaje vacío)')),
            toolCalls: compactToolCalls
          };
        });

      // Call streaming chat API with robust automatic retry logic on network and transient errors
      let response: Response | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 1000;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              message: promptText,
              history: historyPayload,
              model: selectedModel,
              autoExecuteTools,
              temperature,
              maxTokens,
              maxToolCalls,
              searchSources,
              autoSources,
              searchMaxResults,
              autoMaxResults,
              searchYearStart,
              searchYearEnd,
              searchFastMode,
              isSmartPhase,
              strictGuardrails,
              antiHallucination,
              mcpServerSelection,
              enableWebSearch,
              enableWebTools,
              enablePeruWebFallback,
              enableModelFallback,
              fallbackModel,
              toolExecutionOrder,
              executionMode,
              searchTools: searchAuto ? ['search', 'smart_search', 'batch_search'] : searchTools, // v1.5.2 — tools de búsqueda permitidas (multi)
              searchAuto, // v1.5.2 — modo auto: la IA decide
              parallelToolExecution, // v1.5.2 — paralelo (true) o secuencial (false)
              // Fase P10 Attachment / Extra Tools — paths absolutos de archivos adjuntos.
              // El backend los inyecta como system message del atacante para que el LLM
              // vea la matriz MCP×formato y decida qué tool llamar (o ninguna).
              attachedFilePaths: attachedFiles.map((f) => f.path),
              activeSkills: loadedSkills.filter(s => s.isActive !== false).map(s => ({
                name: s.name,
                description: s.description,
                prompt: s.prompt
              }))
            })
          });

          if (response.ok) {
            break; // Connection succeeded!
          }

          // If the server returns a transient/rate-limiting/proxy status code like 429, 502, 503, 504
          if (response.status === 429 || response.status >= 500) {
            if (attempts < maxAttempts) {
              setMessages((currentMsgs) =>
                currentMsgs.map((msg) => {
                  if (msg.id !== aiMsgId) return msg;
                  return {
                    ...msg,
                    content: `⚠️ Error transitorio del servidor (HTTP ${response?.status}). Reintentando conexión de forma automática (intento ${attempts + 1}/${maxAttempts})...`
                  };
                })
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay *= 1.5;
              continue;
            }
          }

          // Non-retryable error, parse and throw
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: Error de comunicación con el backend.`);

        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            throw fetchError; // user explicitly cancelled
          }

          if (attempts < maxAttempts) {
            console.warn(`Intento ${attempts} de ${maxAttempts} falló. Error de red/conexión:`, fetchError);
            setMessages((currentMsgs) =>
              currentMsgs.map((msg) => {
                if (msg.id !== aiMsgId) return msg;
                return {
                  ...msg,
                  content: `⚠️ Error de conexión/red detectado (${fetchError.message || fetchError}). Reintentando conexión de forma automática (intento ${attempts + 1}/${maxAttempts})...`
                };
              })
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 1.5;
          } else {
            throw fetchError; // Rethrow on the last retry attempt
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(`No se pudo establecer conexión después de ${maxAttempts} intentos.`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo iniciar el flujo de lectura (Response Reader).");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // Stream parsing loop with connection resilience
      while (true) {
        let value: Uint8Array | undefined;
        let done = false;

        try {
          const result = await reader.read();
          value = result.value;
          done = result.done;
        } catch (streamError: any) {
          console.error("Error durante la lectura activa del streaming:", streamError);
          setMessages((currentMsgs) =>
            currentMsgs.map((msg) => {
              if (msg.id !== aiMsgId) return msg;
              const suffix = `\n\n⚠️ *La conexión del streaming se interrumpió de forma inesperada (error de red durante transmisión). El contenido recibido hasta ahora se muestra arriba.*`;
              return {
                ...msg,
                content: msg.content ? msg.content + suffix : suffix
              };
            })
          );
          break;
        }

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE messages are separated by double newline \n\n
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // keep incomplete final packet in buffer

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;

          if (line === "data: [DONE]") {
            continue;
          }

          if (line.startsWith("data: ")) {
            const rawJson = line.substring(6);
            try {
              const event = JSON.parse(rawJson);

              if (event.type === "node_active") {
                setActiveGraphNode(event.node);
              }

              // Execute parent side-effects outside of the local React state updater to avoid rendering warnings
              if (event.type === "tool_result") {
                onAddHistoryRecord({
                  id: Math.random().toString(36).substr(2, 9),
                  timestamp: new Date().toLocaleTimeString(),
                  toolName: event.name,
                  args: event.args || {},
                  duration: 1.0, // estimation for general streams
                  status: event.success ? 'success' : 'failed',
                  response: event.result
                });

                if (onToolsUpdateNeeded) {
                  onToolsUpdateNeeded();
                }
              }

              // Update AI message state based on streaming event types
              setMessages((currentMsgs) => {
                return currentMsgs.map((msg) => {
                  if (msg.id !== aiMsgId) return msg;

                  const nextMessage = { ...msg };

                  if (event.type === "text") {
                    nextMessage.content += event.text;
                  } 
                  
                  else if (event.type === "tool_call") {
                    const nextCalls = [...(nextMessage.toolCalls || [])];
                    const existingIdx = nextCalls.findIndex(c => c.name === event.name && (c.status === 'calling' || c.status === 'pending_approval'));
                    
                    if (existingIdx === -1) {
                      nextCalls.push({
                        name: event.name,
                        args: event.args,
                        status: event.requireApproval ? 'pending_approval' : 'calling',
                        startTimestamp: Date.now()
                      });
                    }
                    nextMessage.toolCalls = nextCalls;
                  } 
                  
                  else if (event.type === "tool_result") {
                    const nextCalls = [...(nextMessage.toolCalls || [])];
                    const callIdx = nextCalls.findIndex(c => c.name === event.name && (c.status === 'calling' || c.status === 'pending_approval'));
                    
                    if (callIdx !== -1) {
                      const start = nextCalls[callIdx].startTimestamp || Date.now();
                      const duration = (Date.now() - start) / 1000;
                      nextCalls[callIdx] = {
                        ...nextCalls[callIdx],
                        status: event.success ? 'success' : 'failed',
                        result: event.result,
                        duration
                      };
                    } else {
                      nextCalls.push({
                        name: event.name,
                        args: event.args || {},
                        status: event.success ? 'success' : 'failed',
                        result: event.result,
                        duration: 1.0
                      });
                    }
                    nextMessage.toolCalls = nextCalls;
                  } 
                  
                  else if (event.type === "error") {
                    nextMessage.content = nextMessage.content 
                      ? nextMessage.content + `\n\n⚠️ **Error de Ejecución:** *${event.error}*`
                      : `⚠️ **Error de Ejecución:** *${event.error}*`;
                  }

                  return nextMessage;
                });
              });

            } catch (err) {
              console.warn("Falla parseando SSE packet:", rawJson, err);
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Chat streaming aborted by user.");
        return;
      }
      console.error("Chat streaming failure:", error);
      setMessages((currentMsgs) =>
        currentMsgs.map((msg) => {
          if (msg.id !== aiMsgId) return msg;
          return {
            ...msg,
            content: msg.content ? msg.content : "⚠️ No se recibió respuesta o la conexión se interrumpió."
          };
        })
      );
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      // Fase P10 — limpiar adjuntos tras enviar el prompt (consumidos por backend).
      setAttachedFiles([]);

      // VARIANTE C v1.4.2 fix B2 — Persistir el contenido final del assistant
      // al terminar el streaming. El placeholder se persistió vacío al inicio
      // (useEffect línea 444) y el streaming hace .map() updates que el
      // useEffect no detecta como "nuevos" (mismo id). Por eso aquí forzamos
      // el PATCH al backend con el contenido final acumulado.
      setMessages((currentMsgs) => {
        const finalMsg = currentMsgs.find(m => m.id === aiMsgId);
        // Variante C v1.4.5: usa chatIdRef.current (override local al auto-crear)
        const effChatId = chatIdRef.current || chatId;
        if (finalMsg && finalMsg.content && effChatId) {
          const toolName = finalMsg.toolCalls && finalMsg.toolCalls.length > 0
            ? finalMsg.toolCalls.map((tc) => tc.name).filter(Boolean).join(',')
            : undefined;
          const toolInput = finalMsg.toolCalls && finalMsg.toolCalls.length > 0
            ? JSON.stringify(finalMsg.toolCalls)
            : undefined;
          fetch(`/api/chats/${effChatId}/messages/last-assistant`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: finalMsg.content,
              toolName,
              toolInput,
            }),
          }).catch((e) => console.error('patchLastAssistant', e));

          // v1.5.3 — Acumular tokens IN/OUT en el footer (estimación ~4 chars/token).
          // Input = prompt del usuario + system prompt aproximado (ya viene "calentito" en la sesión).
          // Output = contenido final del assistant (incluye síntesis final, no tools).
          if (onTokensUsed) {
            const outTokens = Math.ceil((finalMsg.content.length || 0) / 4);
            // Input aprox: prompt del usuario del estado + history reciente (1 turno atrás).
            // Estimación barata: prompt ~ 60 tokens base + 0.25 por char del último user msg.
            const lastUserMsg = currentMsgs.filter(m => m.role === 'user').pop();
            const inTokens = 60 + Math.ceil(((lastUserMsg?.content?.length || 0) / 4));
            onTokensUsed(inTokens, outTokens);
          }
        }
        return currentMsgs.map((msg) => {
          if (msg.id !== aiMsgId) return msg;
          const start = msg.startTimestamp || Date.now();
          return {
            ...msg,
            duration: msg.duration || (Date.now() - start) / 1000
          };
        });
      });
      
      if (speakResponses) {
        setTimeout(() => {
          setMessages((currentMsgs) => {
            const finishedMsg = currentMsgs.find(m => m.id === aiMsgId);
            if (finishedMsg && finishedMsg.content) {
              speakText(finishedMsg.content, aiMsgId);
            }
            return currentMsgs;
          });
        }, 150);
      }
      setActiveGraphNode(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt(inputMessage);
    }
  };

  return (
    <div id="mcp-chatbot-panel" className="relative flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      
      {/* PANEL CONTROL HEADER */}
      <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 shrink-0 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500 animate-pulse" />
            <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{lang === 'en' ? "Active Skills:" : lang === 'pt' ? "Skills Ativos:" : "Skills Activos:"}</span>
            <div className="flex flex-wrap gap-1.5 items-center ml-1">
              {loadedSkills.filter(s => s.isActive !== false).length > 0 ? (
                loadedSkills.filter(s => s.isActive !== false).map((s, idx) => (
                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 shadow-3xs select-none">
                    ⚡ {s.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-400 italic font-medium">{lang === 'en' ? "None" : lang === 'pt' ? "Nenhum" : "Ninguno"}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 shadow-3xs select-none">
            <div className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-sans font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tokens:
              </span>
            </div>
            
            <div className="h-3 w-[1px] bg-zinc-300 dark:bg-zinc-700" />
            
            <div className="flex items-center gap-1" title={lang === 'en' ? "Input tokens (User & Tools)" : lang === 'pt' ? "Tokens de entrada (Usuário e Ferramentas)" : "Tokens de Entrada (Usuario y Herramientas)"}>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">In:</span>
              <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                {tokenMetrics.input.toLocaleString()}
              </span>
            </div>

            <div className="h-3 w-[1px] bg-zinc-300 dark:bg-zinc-700" />

            <div className="flex items-center gap-1" title={lang === 'en' ? "Output tokens (AI responses)" : lang === 'pt' ? "Tokens de saída (Respostas da IA)" : "Tokens de Salida (Respuestas de la IA)"}>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Out:</span>
              <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                {tokenMetrics.output.toLocaleString()}
              </span>
            </div>

            <div className="h-3 w-[1px] bg-zinc-300 dark:bg-zinc-700" />

            <div className="flex items-center gap-1" title={lang === 'en' ? "Total token sum" : lang === 'pt' ? "Soma total de tokens" : "Soma total de tokens"}>
              <span className="text-[9px] font-extrabold text-indigo-500 uppercase">Total:</span>
              <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                {tokenMetrics.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN BODY AREA WITH OPTIONAL SIDEBAR */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* LEFT SIDE: CHAT AREA */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">

          {/* LIVE AGENT PIPELINE NODE STATE DISPLAY */}
          {streaming && activeGraphNode && (
            <div className="mx-5 my-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-center justify-between gap-4 shadow-sm z-10">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </div>
                <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-sans">
                  {executionMode === 'langgraph' 
                    ? (lang === 'en' ? "LangGraph Active:" : lang === 'pt' ? "LangGraph Ativo:" : "LangGraph Activo:")
                    : (lang === 'en' ? "Canonical ReAct Active:" : lang === 'pt' ? "Canônica ReAct Ativa:" : "Canónica ReAct Activa:")
                  }
                </span>
              </div>
              
              <div className="flex items-center gap-1 text-[10px] font-sans overflow-x-auto py-0.5">
                {[
                  { id: 'start', label: lang === 'en' ? 'Start' : lang === 'pt' ? 'Início' : 'Inicio', icon: '🚀' },
                  { id: 'guardrail', label: 'Guardrail', icon: '🛡️' },
                  { id: 'agent_plan', label: lang === 'en' ? 'Plan' : lang === 'pt' ? 'Planear' : 'Pensar', icon: '🧠' },
                  { id: 'tools', label: lang === 'en' ? 'Tools' : lang === 'pt' ? 'Ferramentas' : 'Herramientas', icon: '🛠️' },
                  { id: 'verify', label: lang === 'en' ? 'Verify' : lang === 'pt' ? 'Validação' : 'Validar', icon: '🔍' },
                  { id: 'synthesis', label: lang === 'en' ? 'Synthesis' : lang === 'pt' ? 'Síntese' : 'Síntesis', icon: '✨' }
                ].map((node, idx) => {
                  const isActive = activeGraphNode === node.id;
                  return (
                    <div key={node.id} className="flex items-center gap-1">
                      {idx > 0 && <span className="text-zinc-300 dark:text-zinc-800 text-[9px] mx-0.5">➔</span>}
                      <div className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all duration-300 ${
                        isActive 
                          ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 scale-105 animate-pulse'
                          : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400/70 border border-zinc-200/50 dark:border-zinc-800/40'
                      }`}>
                        <span>{node.icon}</span>
                        <span>{node.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CHAT MESSAGES DISPLAY — Variante C v1.4.4 (patrón BETAA-SX):
              Scroll container con flex-1. El input es SIBLING shrink-0 (no dentro).
              Ya NO se solapa → no hace falta pb-56. El scroll natural del último
              mensaje queda visible justo sobre el input fijo. */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-zinc-50/40 dark:bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
          >
        <div ref={messagesStartRef} />
        
        {messages.map((msg) => {
          const isAi = msg.role === 'assistant';
          
          const isExecuting = isAi && (
            !!msg.toolCalls?.some(call => call.status === 'calling' || call.status === 'pending_approval') ||
            (streaming && messages[messages.length - 1]?.id === msg.id)
          );

          const toolCallsElement = isAi && msg.toolCalls && msg.toolCalls.length > 0 ? (
            <div className="space-y-1.5 pl-1.5 pb-1">
              <WorkflowTrace toolCalls={msg.toolCalls} isExecuting={isExecuting} t={t} lang={lang} />
              {msg.toolCalls.map((call, idx) => {
                const callKey = `${msg.id}-${idx}`;
                const isExpanded = !!expandedToolIndex[callKey];
                
                return (
                  <ToolCallItem
                    key={idx}
                    call={call}
                    msgId={msg.id}
                    idx={idx}
                    isExpanded={isExpanded}
                    toggleExpandTool={toggleExpandTool}
                    handleApproveTool={handleApproveTool}
                    handleRejectTool={handleRejectTool}
                    t={t}
                  />
                );
              })}
            </div>
          ) : null;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isAi 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/40' 
                  : 'bg-zinc-900 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 shadow-sm'
              }`}>
                {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Msg Content Box */}
              <div className="flex flex-col space-y-1.5 max-w-[85%] md:max-w-[78%]">
                {/* Header info */}
                <div className={`flex items-center gap-1.5 px-1 text-[10px] text-zinc-400 dark:text-zinc-500 select-none ${isAi ? '' : 'justify-end'}`}>
                  <span className="font-extrabold text-zinc-650 dark:text-zinc-300">
                    {isAi ? "LetXinet AI" : "Tú"}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                  {isAi && (msg.startTimestamp || msg.duration) && (
                    <>
                      <span>•</span>
                      <TimerDisplay startTimestamp={msg.startTimestamp} duration={msg.duration} className="text-indigo-500 dark:text-indigo-400 font-semibold" />
                    </>
                  )}
                </div>

                {/* Completed tools: show at the top of the message */}
                {!isExecuting && toolCallsElement}

                {(msg.content !== '' || editingMsgId === msg.id || streaming) && (
                                <div className={`p-4 rounded-2xl border transition-all overflow-x-auto ${
                    isAi
                      ? 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 text-zinc-800 dark:text-zinc-100 shadow-sm'
                      : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent shadow-sm rounded-tr-none'
                  }`}>
                    
                    {/* Markdown content parser or Edit Mode */}
                    {editingMsgId === msg.id ? (
                      <div className="flex flex-col gap-2"> 
                         <textarea
                           value={editBuffer}
                           onChange={(e) => setEditBuffer(e.target.value)}
                           spellCheck={false}
                           className="w-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950 rounded-lg p-2 text-sm border-none focus:ring-1 focus:ring-indigo-400 min-h-[80px]"
                         />
                         <div className="flex justify-end gap-2">
                           <button onClick={handleCancelEdit} className="text-zinc-300 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-900 text-xs px-2 py-1">
                             {t.cancelBtn}
                           </button>
                           <button onClick={() => handleSaveEditAndResubmit(msg.id)} className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md font-medium shadow-sm transition">
                             {lang === 'en' ? "Save and Send" : lang === 'pt' ? "Salvar e Enviar" : "Guardar y Enviar"}
                           </button>
                         </div>
                      </div>
                    ) : msg.content === '' && streaming ? (
                      <div className="flex items-center gap-2 py-2 px-3 -mx-2 my-1 rounded-lg bg-indigo-50/60 dark:bg-indigo-900/15 border border-indigo-200/40 dark:border-indigo-800/30">
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">{lang === 'en' ? "Processing & querying tools..." : lang === 'pt' ? "Processando e consultando ferramentas..." : "Procesando y consultando herramientas..."}</span>
                      </div>
                    ) : msg.content !== '' ? (
                    <div className="markdown-body text-xs md:text-sm prose dark:prose-invert max-w-none leading-relaxed break-words space-y-2 prose-p:my-1 prose-headings:font-display prose-headings:font-semibold prose-headings:text-zinc-900 dark:prose-headings:text-white prose-a:text-indigo-600 dark:prose-a:text-indigo-455 prose-a:underline prose-code:font-mono prose-code:text-[11px] prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ol:list-decimal prose-ul:list-disc pl-1">
                      <RenderPhasedMarkdown content={msg.content} />
                    </div>
                  ) : null}

                  {/* Actions Bar inside content card */}
                  {msg.content !== '' && editingMsgId !== msg.id && (
                    <div className={`flex flex-wrap items-center justify-end gap-1 mt-3 pt-2 ${isAi ? 'border-t border-zinc-100 dark:border-zinc-800' : 'border-t border-zinc-700 dark:border-zinc-300'}`}>
                      {!isAi && !streaming && (
                        <>
                          <button
                            onClick={() => handleEditMessage(msg)}
                            className="p-1 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-zinc-300 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 cursor-pointer transition"
                            title={lang === 'en' ? "Edit message and resubmit" : lang === 'pt' ? "Editar mensagem e reenviar" : "Editar mensaje y reenviar"}
                          >
                            <Edit2 className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">{lang === 'en' ? "Edit" : lang === 'pt' ? "Editar" : "Editar"}</span>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-600 cursor-pointer transition"
                            title={lang === 'en' ? "Delete this message and subsequent" : lang === 'pt' ? "Excluir esta mensagem e respostas" : "Eliminar este mensaje y respuestas"}
                          >
                            <Trash2 className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">{lang === 'en' ? "Undo" : lang === 'pt' ? "Desfazer" : "Deshacer"}</span>
                          </button>
                          
                          <button
                            onClick={() => handleResendFromPoint(msg.id)}
                            className="p-1 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-zinc-300 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 cursor-pointer transition mx-1"
                            title={lang === 'en' ? "Delete all subsequent and evaluate again" : lang === 'pt' ? "Remover posterior e redefinir" : "Eliminar todo lo posterior y reevaluar"}
                          >
                            <RotateCcw className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">{lang === 'en' ? "Resend" : lang === 'pt' ? "Mandar de novo" : "Mandar otra vez"}</span>
                          </button>
                        </>
                      )}
                      
                      {/* Speech synthesis play/stop control */}
                      <button
                        onClick={() => speakText(msg.content, msg.id)}
                        className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                          isAi ? 'text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400' : 'text-zinc-300 hover:text-white dark:text-zinc-650 dark:hover:text-zinc-950 dark:hover:bg-zinc-300 hover:bg-zinc-705'
                        } cursor-pointer transition`}
                        title={lang === 'en' ? "Read aloud / Stop" : lang === 'pt' ? "Ler em voz alta / Parar" : "Leer en voz alta / Detener"}
                      >
                        {currentlyPlayingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
                            <span className="text-rose-500 font-bold whitespace-nowrap">{lang === 'en' ? "Stop" : lang === 'pt' ? "Parar" : "Detener"}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-455 shrink-0" />
                            <span className="whitespace-nowrap">{lang === 'en' ? "Speak" : lang === 'pt' ? "Ouvir" : "Escuchar"}</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyText(msg.content, msg.id)}
                        className={`p-1 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                          isAi ? 'text-zinc-400 hover:text-zinc-650' : 'text-zinc-300 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 dark:hover:bg-zinc-300 hover:bg-zinc-700'
                        } cursor-pointer transition`}
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-emerald-500 whitespace-nowrap">{t.copySuccess}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">{t.copyBtn}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
              </div>
                )}

                {/* Actively executing tools: shown at the bottom of the message */}
                {isExecuting && toolCallsElement}
              </div>
            </div>
          );
        })}

        {/* SUGERENCIAS — al final del flujo de mensajes (DENTRO del scroll)
            Variante C v1.4.4: scrollea junto con el contenido, no compite con el input
            (que ahora es sibling fijo abajo). Patrón BETAA-SX. */}
        {!streaming && activeSuggestions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 max-w-4xl mx-auto w-full">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 px-1">{t.suggestionsTitle}</p>
            <div className="flex flex-row overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
              {activeSuggestions.map((sug, i) => {
                const isSpecial = sug === "MUESTRA LA TABLA COMPLETA COMPARATIVA CON LINKS Y REFERENCIAA BIBLIOGRAFICA APA";
                return (
                  <button
                    key={i}
                    type="button"
                    title={sug}
                    onClick={() => {
                      // v1.5.0 — Solo llena el input; NO se ejecuta automáticamente.
                      // El usuario puede editar el prompt antes de enviar (Enter o botón Send).
                      setInputMessage(sug);
                      const ta = document.querySelector('textarea');
                      if (ta) { ta.focus(); if (ta.value) { ta.setSelectionRange(ta.value.length, ta.value.length); } }
                    }}
                    disabled={streaming}
                    className={
                      isSpecial
                        ? "flex-shrink-0 w-[280px] sm:w-[320px] text-[11px] leading-relaxed select-none text-left p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 hover:bg-amber-100/90 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-300 transition-all duration-300 cursor-pointer flex flex-col gap-1.5 group font-bold shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                        : "flex-shrink-0 w-[240px] text-[11px] leading-relaxed select-none text-left p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-all duration-300 cursor-pointer flex flex-col gap-1.5 group font-medium hover:w-[340px]"
                    }
                  >
                    <div className="flex items-start gap-1.5 w-full">
                      {isSpecial ? (
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500 animate-pulse mt-0.5" />
                      ) : (
                        <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 opacity-60 group-hover:opacity-100 transition-colors mt-0.5" />
                      )}
                      <span className={isSpecial ? "break-words text-amber-850 dark:text-amber-200" : "line-clamp-2 group-hover:line-clamp-none transition-all duration-300 break-words"}>
                        {sug}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* FLOATING SCROLL BUTTONS — v1.4.9 P3 fix:
          Posicionados sobre el panel izquierdo (NO del scroll), JUSTO encima
          del input sticky (bottom-52 = 208px, alto suficiente para no chocar
          con el input que mide ~120-180px según altura del textarea auto).
          Orden visual: ↓ arriba (ir abajo cuando estás scroll-up),
          ↑ abajo (ir arriba cuando estás al fondo). Convención Claude/ChatGPT. */}
      <div className="absolute right-6 bottom-52 md:right-8 flex flex-col gap-2 z-30 pointer-events-none">
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg pointer-events-auto transition-transform hover:scale-105 active:scale-95 animate-fade-in"
            title={t.scrollBottomTitle || "Scroll to bottom"}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg pointer-events-auto transition-transform hover:scale-105 active:scale-95 animate-fade-in"
            title={t.scrollTopTitle || "Scroll to top"}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* INPUT CONTAINER — Variante C v1.4.4 (patrón BETAA-SX chat IA):
          SIBLING del scroll container, NO dentro. shrink-0 para que no crece con flex,
          y el scroll se lleva todo el flex-1. Así es un hermano permanente al pie
          del panel. z-40 sobre el scroll, backdrop-blur. */}
      <div className="shrink-0 relative z-40 px-4 pb-4 pt-3 bg-white dark:bg-zinc-900 border-t border-zinc-100/50 dark:border-zinc-800/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputMessage);
          }}
          className="relative w-full max-w-4xl mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl md:rounded-3xl p-3 shadow-2xl shadow-indigo-950/10 dark:shadow-black/80 focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500/80 transition-all duration-200 flex flex-col gap-2.5 pointer-events-auto"
        >
          {/* BADGE STREAMING INLINE — Variante C v1.4 (fix bug 4: footer streaming reemplazaba input)
              Aparece como badge flotante en la esquina superior derecha de la caja cuando streaming.
              NO reemplaza la caja, coexiste con el input. */}
          {streaming && (
            <div className="absolute -top-2.5 right-3 flex items-center gap-1.5 bg-indigo-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md animate-fade-in pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {lang === 'en' ? "Streaming active" : lang === 'pt' ? "Streaming ativo" : "Streaming activo"}
            </div>
          )}
          <textarea
            id="mcp-chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? (lang === 'en' ? "Waiting for response..." : lang === 'pt' ? "Aguardando resposta..." : "Esperando respuesta...") : (lang === 'en' ? "Write a message..." : lang === 'pt' ? "Digite uma mensagem..." : "Escribe un mensaje...")}
            disabled={streaming}
            rows={1}
            spellCheck={false}
            style={{ caretColor: 'currentColor' }}
            className="w-full p-1.5 text-xs md:text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none font-sans disabled:opacity-60 disabled:cursor-not-allowed leading-snug max-h-7 overflow-y-auto scrollbar-thin"
          />

          <div className="flex flex-col gap-2.5 pt-2 px-1 border-t border-zinc-100/90 dark:border-zinc-800/50">
            
            {/* ACTION BUTTONS Row */}
            <div className="flex items-center justify-between pt-1 gap-1 sm:gap-2 w-full">
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <AttachmentExtraToolsPanel
                  attachedFiles={attachedFiles}
                  setAttachedFiles={setAttachedFiles}
                  onProcede={() => { /* el botón Procede cierra el panel e inserta el query; integración real en handleSendPrompt */ }}
                  setInputMessage={setInputMessage}
                  i18n={{
                    title: lang === 'en' ? 'Attachment / Extra Tools' : lang === 'pt' ? 'Anexo / Ferramentas Extra' : 'Adjuntos / Herramientas Extra',
                    elegir: lang === 'en' ? 'Choose files' : lang === 'pt' ? 'Escolher arquivos' : 'Elegir archivos',
                    close: lang === 'en' ? 'Close' : lang === 'pt' ? 'Fechar' : 'Cerrar',
                    procede: lang === 'en' ? 'Proceed to send' : lang === 'pt' ? 'Prosseguir' : 'Proceder a enviar',
                    noKey: lang === 'en' ? 'Locked — API key required' : lang === 'pt' ? 'Bloqueado — chave API exigida' : 'Bloqueado — API key requerida',
                    noFormat: lang === 'en' ? 'Not supported: invalid format' : lang === 'pt' ? 'Não suportado: formato inválido' : 'No soportado: formato inválido',
                    markitdownOffline: lang === 'en' ? 'MarkItDown local API offline' : lang === 'pt' ? 'MarkItDown local offline' : 'MarkItDown local offline',
                    matrixTitle: lang === 'en' ? 'Full matrix (MCP × format)' : lang === 'pt' ? 'Matriz completa (MCP × formato)' : 'Matriz completa (MCP × formato)',
                    filesTitle: lang === 'en' ? 'Attached files' : lang === 'pt' ? 'Arquivos anexados' : 'Archivos adjuntos',
                    keysStatus: lang === 'en' ? 'Keys status' : lang === 'pt' ? 'Status chaves' : 'Estado de keys',
                    remove: lang === 'en' ? 'Remove' : lang === 'pt' ? 'Remover' : 'Quitar',
                    preview: lang === 'en' ? 'System message preview' : lang === 'pt' ? 'Prévia msg sistema' : 'Vista previa msg sistema',
                    noFiles: lang === 'en' ? 'No files attached.' : lang === 'pt' ? 'Nenhum arquivo anexado.' : 'Sin archivos adjuntos.',
                    selectTool: lang === 'en' ? 'Click to select' : lang === 'pt' ? 'Clique para selecionar' : 'Click para seleccionar',
                    selectAll: lang === 'en' ? 'ALL' : lang === 'pt' ? 'TODOS' : 'TODOS',
                    deselectAll: lang === 'en' ? 'NONE' : lang === 'pt' ? 'NENHUM' : 'NINGUNO',
                    selectedCount: lang === 'en' ? 'selected' : lang === 'pt' ? 'selecionadas' : 'seleccionados',
                  }}
                />

                <button
                  type="button"
                  onClick={clearChat}
                  disabled={streaming}
                  className="p-2 sm:p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title={lang === 'en' ? "Clear Chat" : lang === 'pt' ? "Limpar Chat" : "Limpiar Chat"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1.5 select-none overflow-x-auto no-scrollbar scroll-smooth flex-nowrap min-w-0 pr-1">
                {/* Real voice dictation (microphone) */}
                <button
                  type="button"
                  onClick={startListening}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${
                    isListening
                      ? "bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={
                    isListening
                      ? (lang === 'en' ? "Stop recording..." : lang === 'pt' ? "Parar de gravar..." : "Detener grabación...")
                      : (lang === 'en' ? "Dictate (Speech to Text)" : lang === 'pt' ? "Ditado por voz" : "Ditado por voz")
                  }
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                {/* Text-to-Speech Toggle */}
                <button
                  type="button"
                  onClick={handleToggleSpeakResponses}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${
                    speakResponses
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                      : "text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={
                    speakResponses
                      ? (lang === 'en' ? "Auto-Voice response ON" : lang === 'pt' ? "Voz de resposta automática ATIVADA" : "Auto-respuesta de voz ACTIVADA")
                      : (lang === 'en' ? "Auto-Voice response OFF" : lang === 'pt' ? "Voz de resposta automática DESATIVADA" : "Auto-respuesta de voz DESACTIVADA")
                  }
                >
                  {speakResponses ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>

                {/* Settings Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${
                    showSettingsPopover
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={lang === 'en' ? "Voice & AI Settings" : lang === 'pt' ? "Configurações de Voz e IA" : "Ajustes de Voz y Modelo"}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Live/Off Pulsing Status Badge Button */}
                <button
                  type="button"
                  onClick={() => checkCurrentModelStatus(selectedModel)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-xl border text-[9px] sm:text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                    modelStatus.isChecking
                      ? "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : modelStatus.isLive
                      ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                  }`}
                  title={
                    modelStatus.isChecking
                      ? "Verificando disponibilidad de modelo..."
                      : modelStatus.isLive
                      ? `Modelo en línea (${modelStatus.latencyMs ? `${modelStatus.latencyMs}ms` : 'OK'}). Haz clic para probar estado.`
                      : "Modelo fuera de línea o inalcanzable. Haz clic para probar estado."
                  }
                >
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      modelStatus.isChecking ? 'bg-amber-400' : modelStatus.isLive ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      modelStatus.isChecking ? 'bg-amber-500' : modelStatus.isLive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}></span>
                  </span>
                  <span className="uppercase tracking-wider font-extrabold hidden xs:inline sm:inline">
                    {modelStatus.isChecking ? 'CHK' : modelStatus.isLive ? 'LIVE' : 'OFF'}
                  </span>
                  {modelStatus.isLive && modelStatus.latencyMs !== undefined && (
                    <span className="text-[8px] opacity-80 hidden lg:inline">{modelStatus.latencyMs}ms</span>
                  )}
                </button>

                {/* Model Sync Button (Auto / Manual) */}
                <button
                  type="button"
                  onClick={() => syncModels(true)}
                  disabled={isSyncingModels}
                  className="p-1.5 sm:p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0 cursor-pointer"
                  title={lastSyncTime ? `Modelos Sincronizados (${lastSyncTime}). Clic para re-escaniar modelos.` : "Sincronizar y Escanear Modelos"}
                >
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSyncingModels ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
                </button>

                {/* Sync progress indicator — Fase H v1.0.11k */}
                {syncProgress && (
                  <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-[280px] w-max text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 shadow-lg whitespace-normal text-center pointer-events-none animate-fade-in">
                    {syncProgress}
                  </div>
                )}

                {/* Model Selector / Search Box */}
                {/* Fase H v1.0.11n: el filtro ahora interactúa con el selection.
                    - Input de filtro con panel desplegable clickeable (resultados filtrados).
                    - Al clicar un resultado → setSelectedModel + limpiar filtro + cerrar panel.
                    - El <select> sigue funcionando como fallback para navegación por grupos. */}
                <div className="flex items-center gap-1 sm:gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl px-1.5 sm:px-2 py-1 ml-0.5 sm:ml-1 border border-zinc-200 dark:border-zinc-700/50 h-8 sm:h-9 relative shrink-0">
                  <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 shrink-0 hidden sm:block" />
                  <input
                    type="text"
                    value={modelSearchQuery}
                    onChange={(e) => { setModelSearchQuery(e.target.value); setModelFilterFocus(true); }}
                    onFocus={() => setModelFilterFocus(true)}
                    onBlur={() => setTimeout(() => setModelFilterFocus(false), 200)}
                    placeholder={lang === 'en' ? "Filter..." : lang === 'pt' ? "Filtrar..." : "Filtrar..."}
                    className="w-16 sm:w-20 lg:w-28 bg-transparent text-[9px] sm:text-[10px] sm:text-xs text-zinc-700 dark:text-zinc-200 border-none focus:ring-0 outline-none p-0 font-sans placeholder-zinc-400"
                  />
                  <div className="w-[1px] h-3 sm:h-4 bg-zinc-300 dark:bg-zinc-600 mx-0.5"></div>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    title={selectedModel}
                    className="w-[82px] sm:w-24 max-w-[130px] bg-zinc-100 dark:bg-zinc-800/60 text-[9px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border-none focus:ring-0 outline-none cursor-pointer truncate p-0 appearance-none pr-3 sm:pr-4"
                  >
                     {modelGroups.map((group, i) => (
                        <optgroup key={i} label={`${group.label}${group.items.some((it: any) => it.isLive) ? '' : ' (sin API key)'}`} className="bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold">
                          {group.items.map((item: any) => (
                            <option key={item.value} value={item.value} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                              {item.isLive === false ? '⚠ ' : ''}{item.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-400 pointer-events-none" />

                  {/* Fase H v1.0.11n: Panel flotante de resultados filtrados */}
                  {modelFilterFocus && modelSearchQuery.trim() && flatFilteredModels.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-[280px] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 min-w-[260px]" style={{ minWidth: '260px' }}>
                      {flatFilteredModels.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedModel(m.value);
                            setModelSearchQuery('');
                            setModelFilterFocus(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-[10px] border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition flex items-center gap-1.5 ${m.value === selectedModel ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                        >
                          {(m.isLive === false) && <span className="text-amber-500">⚠</span>}
                          <span className="font-bold truncate flex-1">{m.label}</span>
                          <span className="text-[8px] text-zinc-400 truncate max-w-[100px]">{m.groupLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Feedback cuando el filtro no produce resultados */}
                  {modelFilterFocus && modelSearchQuery.trim() && flatFilteredModels.length === 0 && (
                    <div className="absolute top-full left-0 mt-1 px-2.5 py-1.5 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg shadow-xl z-50" style={{ minWidth: '200px' }}>
                      {lang === 'en' ? 'No models match filter' : lang === 'pt' ? 'Nenhum modelo encontrado' : 'Ningún modelo coincide con el filtro'}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                {streaming ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="p-2 sm:p-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1 sm:gap-1.5 transition cursor-pointer text-white bg-red-500 hover:bg-red-600 active:scale-95 shadow shadow-red-500/20 shrink-0 font-semibold text-[10px] sm:text-xs ml-0.5 sm:ml-1"
                    title={lang === 'en' ? "Stop" : lang === 'pt' ? "Parar" : "Detener"}
                  >
                    <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white fill-current" />
                    <span className="hidden sm:inline">{lang === 'en' ? "Stop" : lang === 'pt' ? "Interromper" : "Detener"}</span>
                  </button>
                ) : (
                  <button
                    id="mcp-chat-submit-btn"
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className={`p-2 sm:p-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1 sm:gap-1.5 transition cursor-pointer text-white shadow shadow-indigo-500/20 shrink-0 text-[10px] sm:text-xs font-semibold ml-0.5 sm:ml-1 ${
                      !inputMessage.trim()
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 active:scale-95'
                    }`}
                    aria-label="Send message"
                  >
                    <span className="hidden sm:inline">{lang === 'en' ? "Send" : lang === 'pt' ? "Enviar" : "Enviar"}</span>
                    <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white fill-current" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      </div>

        {/* RIGHT SIDE: TOOL SETTINGS SIDEBAR */}
        {showSettingsPopover && (
          <div className="w-full lg:w-80 max-h-[60vh] lg:max-h-full lg:h-full border-t lg:border-t-0 lg:border-l border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0 lg:shrink-0 flex flex-col min-h-0 overflow-y-auto p-4 select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-150 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  {lang === 'en' ? "Agent Control Tower" : lang === 'pt' ? "Painel de Controle" : "Panel de Control"}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowSettingsPopover(false)}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition"
                title="Cerrar panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* SECTION 1: Tool Settings & Execution Order */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <h4 className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                      {lang === 'en' ? "Tool priority & order" : lang === 'pt' ? "Prioridade de Ferramentas" : "Prioridad y Orden de Herramientas"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={resetToolOrder}
                    className="p-1 rounded text-[9px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1"
                    title={lang === 'en' ? "Reset tool order" : "Restablecer orden"}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                </div>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mb-3 leading-normal">
                  {lang === 'en' 
                    ? "Drag items or use buttons to reorder priority. Upper tools execute first." 
                    : lang === 'pt' 
                    ? "Arraste ou use botões para reordenar. Ferramentas no topo têm prioridade." 
                    : "Arrastra elementos o usa las flechas para cambiar la prioridad. La #1 se ejecuta primero."}
                </p>

                {/* Capability Cards List */}
                <Reorder.Group 
                  axis="y" 
                  values={toolExecutionOrder} 
                  onReorder={setToolExecutionOrder} 
                  className="space-y-2 list-none p-0 m-0"
                >
                  {toolExecutionOrder.map((capId, index) => {
                    const meta = capabilitiesMetadata[capId];
                    if (!meta) return null;
                    const IconComp = meta.icon;

                    // Compute current enabled status & toggle function
                    let isEnabled = false;
                    let toggleFn = () => {};

                    const isMcpBoth = selectedMcps.includes("both");

                    if (capId === "letxipu") {
                      isEnabled = isMcpBoth || selectedMcps.includes("letxipu");
                      toggleFn = () => handleMcpToggle("letxipu");
                    } else if (capId === "letxipu_osm") {
                      isEnabled = isMcpBoth || selectedMcps.includes("letxipu_osm");
                      toggleFn = () => handleMcpToggle("letxipu_osm");
                    } else if (capId === "letxinet") {
                      isEnabled = isMcpBoth || selectedMcps.includes("letxinet");
                      toggleFn = () => handleMcpToggle("letxinet");
                    } else if (capId === "web_tools") {
                      isEnabled = enableWebTools;
                      toggleFn = () => setEnableWebTools(!enableWebTools);
                    } else if (capId === "web_search") {
                      isEnabled = enableWebSearch;
                      toggleFn = () => setEnableWebSearch(!enableWebSearch);
                    } else if (capId === "anti_hallucination") {
                      isEnabled = antiHallucination;
                      toggleFn = () => setAntiHallucination(!antiHallucination);
                    }

                    return (
                      <Reorder.Item 
                        key={capId} 
                        value={capId}
                        className={`p-2 rounded-xl border transition-colors duration-150 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing select-none ${
                          isEnabled 
                            ? 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-3xs hover:border-indigo-300 dark:hover:border-indigo-800' 
                            : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Drag Handle Icon */}
                            <GripVertical className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0 hover:text-indigo-500 transition cursor-grab active:cursor-grabbing" />

                            {/* Priority Rank Tag */}
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-tight ${
                              index === 0 
                                ? 'bg-indigo-600 text-white dark:bg-indigo-500' 
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              {index === 0 ? '🥇 #1' : `#${index + 1}`}
                            </span>

                            <IconComp className={`w-3.5 h-3.5 shrink-0 ${isEnabled ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400'}`} />
                            <span className={`text-[11px] font-bold truncate ${isEnabled ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 line-through decoration-zinc-300'}`}>
                              {meta.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                            {/* Priority Action Buttons */}
                            <div className="flex items-center bg-zinc-100/80 dark:bg-zinc-800/60 rounded-lg p-0.5 border border-zinc-200/50 dark:border-zinc-700/50">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveCapabilityToTop(index)}
                                className={`p-1 rounded transition ${
                                  index === 0 ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed" : "text-zinc-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-700"
                                }`}
                                title="Enviar al Puesto #1 (Top)"
                              >
                                <ArrowUpToLine className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveCapabilityUp(index)}
                                className={`p-1 rounded transition ${
                                  index === 0 ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed" : "text-zinc-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-700"
                                }`}
                                title="Subir un puesto"
                              >
                                <ChevronUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === toolExecutionOrder.length - 1}
                                onClick={() => moveCapabilityDown(index)}
                                className={`p-1 rounded transition ${
                                  index === toolExecutionOrder.length - 1 ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed" : "text-zinc-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-700"
                                }`}
                                title="Bajar un puesto"
                              >
                                <ChevronDown className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === toolExecutionOrder.length - 1}
                                onClick={() => moveCapabilityToBottom(index)}
                                className={`p-1 rounded transition ${
                                  index === toolExecutionOrder.length - 1 ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed" : "text-zinc-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-700"
                                }`}
                                title="Enviar al Final"
                              >
                                <ArrowDownToLine className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {/* Switch/Toggle */}
                            <label className="relative inline-flex items-center cursor-pointer select-none ml-1">
                              <input 
                                type="checkbox" 
                                checked={isEnabled} 
                                onChange={toggleFn} 
                                className="sr-only peer" 
                              />
                              <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                            </label>
                          </div>
                        </div>
                        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 pl-5 leading-relaxed">
                          {meta.desc}
                        </p>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>

                {/* Dynamic Scraped Models & Live Health Status Panel */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                        Sincronización de Modelos
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => syncModels(true)}
                      disabled={isSyncingModels}
                      className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingModels ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  </div>

                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Estado de Modelo ({selectedModel.slice(0, 14)}...):</span>
                      <span className={`font-extrabold px-1.5 py-0.5 rounded ${
                        modelStatus.isChecking ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        modelStatus.isLive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {modelStatus.isChecking ? 'CHK' : modelStatus.isLive ? `LIVE (${modelStatus.latencyMs || 0}ms)` : 'OFF'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[8px] text-zinc-400">
                      <span>Última Sincronización Auto:</span>
                      <span>{lastSyncTime || 'Al Iniciar'}</span>
                    </div>
                  </div>
                </div>

              {/* SECTION 2: AI Pipeline & Model Config */}
              <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800/50 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                  <h4 className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                    {lang === 'en' ? "AI Prompt & Tuning" : lang === 'pt' ? "Ajustes de IA e Modelo" : "Ajustes de IA y Modelo"}
                  </h4>
                </div>

                {/* Smart Phase / Output Mode */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Output Mode:" : lang === 'pt' ? "Modo de Saída:" : "Modo de Salida:"}
                  </span>
                  <div className="relative shrink-0">
                    <select
                      value={isSmartPhase ? "smart" : "verbose"}
                      onChange={(e) => setIsSmartPhase(e.target.value === "smart")}
                      className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4"
                    >
                      <option value="smart">Smart Phase</option>
                      <option value="verbose">Verbose Phase</option>
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Orchestration Engine / Execution Mode */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Orchestration:" : lang === 'pt' ? "Orquestração:" : "Motor de Agente:"}
                  </span>
                  <div className="relative shrink-0">
                    <select
                      value={executionMode}
                      onChange={(e) => setExecutionMode(e.target.value as 'linear' | 'langgraph')}
                      className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4"
                    >
                      <option value="langgraph">
                        {lang === 'en' ? "🕸️ LangGraph (StateGraph)" : lang === 'pt' ? "🕸️ LangGraph (StateGraph Multi-Nó)" : "🕸️ LangGraph (StateGraph Multi-Nodo)"}
                      </option>
                      <option value="linear">
                        {lang === 'en' ? "🏛️ Canonical Direct (Sequential ReAct)" : lang === 'pt' ? "🏛️ Canônica Direta (ReAct Sequencial)" : "🏛️ Canónica Directa (ReAct Secuencial)"}
                      </option>
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* v1.5.2 — Tools de Búsqueda activas (multi-selección con checkboxes).
                    Por defecto solo 'search' (más rápido) está activo. Usuario puede activar
                    smart_search y/o batch_search (1, 2 o las 3 juntas). Si 'Auto' está
                    activado, todas disponibles y la IA decide según el prompt. */}
                <div className="py-2 border-t border-zinc-100 dark:border-zinc-800/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                      <Search className="w-2.5 h-2.5" />
                      {lang === 'en' ? "Active Search Tools:" : lang === 'pt' ? "Ferramentas de Busca Ativas:" : "Tools de Búsqueda Activas:"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchAuto(!searchAuto);
                        if (!searchAuto) setSearchTools(['search', 'smart_search', 'batch_search']);
                        else setSearchTools(['search']);
                      }}
                      className="flex items-center gap-1 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-0"
                      title={lang === 'en' ? "AI decides which tools to use" : lang === 'pt' ? "IA decide que tools usar" : "IA decide qué tools usar"}
                    >
                      <span className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center transition-colors ${searchAuto ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
                        {searchAuto && <Check className="w-2 h-2 text-white" />}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                        {lang === 'en' ? "Auto (AI)" : lang === 'pt' ? "Auto (IA)" : "Auto (IA)"}
                      </span>
                    </button>
                  </div>
                  <div className={`grid grid-cols-3 gap-1 ${searchAuto ? 'opacity-40 pointer-events-none' : ''}`}>
                    {([
                      { id: 'search', icon: '⚡', label: lang === 'en' ? 'Search' : 'Search', hint: lang === 'en' ? 'fast' : 'rápida' },
                      { id: 'smart_search', icon: '🎯', label: 'Smart', hint: lang === 'en' ? 'refined' : 'refinada' },
                      { id: 'batch_search', icon: '💎', label: 'Batch', hint: lang === 'en' ? 'deep' : 'profunda' },
                    ] as const).map(tool => {
                      const checked = searchTools.includes(tool.id);
                      return (
                        <button
                          type="button"
                          key={tool.id}
                          onClick={() => {
                            if (searchAuto) return;
                            if (checked) {
                              const next = searchTools.filter(t => t !== tool.id);
                              setSearchTools(next.length === 0 ? ['search'] : next);
                            } else {
                              setSearchTools(prev => prev.includes(tool.id) ? prev : [...prev, tool.id]);
                            }
                          }}
                          disabled={searchAuto}
                          className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-md border ${searchAuto ? 'cursor-not-allowed' : 'cursor-pointer'} text-center transition-colors focus:outline-none focus-visible:ring-0
                            ${checked
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'}`}
                          title={`${tool.label} (${tool.hint})`}
                        >
                          <span className="text-[10px] leading-none">{tool.icon}</span>
                          <span className="text-[8px] font-bold leading-none">{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[8px] text-zinc-400 dark:text-zinc-500 leading-tight px-1">
                    {searchAuto
                      ? (lang === 'en' ? "Auto: IA decides which tools to use based on prompt complexity." : "Auto: IA decide qué tools usar según el prompt.")
                      : (lang === 'en'
                        ? `Active: ${searchTools.join(', ')}. Select 1, 2 or all 3. Default = Search (fastest).`
                        : `Activas: ${searchTools.join(', ')}. Selecciona 1, 2 o las 3. Por defecto = Search (más rápida).`)}
                  </p>
                </div>

                {/* v1.5.2 — Modo de ejecución de tools (Paralelo/Secuencial) — solo relevante en LangGraph */}
                <div className="flex items-center justify-between text-xs py-1.5 border-t border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5" />
                    {lang === 'en' ? "Tool Execution:" : lang === 'pt' ? "Execução:" : "Ejecución:"}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setParallelToolExecution(true)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors
                        ${parallelToolExecution
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/50'}`}
                      title={lang === 'en' ? "Run multiple tools at the same time (faster)" : "Ejecuta múltiples tools simultáneamente (más rápido)"}
                    >
                      {lang === 'en' ? "∥ Parallel" : "∥ Paralelo"}
                    </button>
                    <button
                      onClick={() => setParallelToolExecution(false)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors
                        ${!parallelToolExecution
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/50'}`}
                      title={lang === 'en' ? "Run tools one by one (more thorough)" : "Ejecuta tools una por una (más riguroso)"}
                    >
                      {lang === 'en' ? "→ Seq" : "→ Secuenc."}
                    </button>
                  </div>
                </div>

                {/* Temperature slider */}
                <div className="space-y-1 py-1">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    <span>{lang === 'en' ? "Temperature (Creative):" : lang === 'pt' ? "Temperatura:" : "Temperatura:"}</span>
                    <span className="font-mono text-indigo-500">{temperature.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" 
                    value={temperature} 
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Tokens slider */}
                <div className="space-y-1 py-1">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    <span>{lang === 'en' ? "Max Output Tokens:" : lang === 'pt' ? "Tokens Máx:" : "Tokens Máx:"}</span>
                    <span className="font-mono text-indigo-500">{maxTokens}</span>
                  </div>
                  <input 
                    type="range" min="100" max="8192" step="100" 
                    value={maxTokens} 
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Max Loops Selector */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Max Loops:" : lang === 'pt' ? "Loops Máximos:" : "Llamadas Máx:"}
                  </span>
                  <div className="relative shrink-0">
                    <select
                      value={maxToolCalls}
                      onChange={(e) => setMaxToolCalls(parseInt(e.target.value))}
                      className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                      <option value={25}>25</option>
                      <option value={30}>30</option>
                      <option value={40}>40</option>
                      <option value={50}>50</option>
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Auto Execute Switch */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Auto Execute Tools:" : lang === 'pt' ? "Auto Executar:" : "Auto-ejecutar herramientas:"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={autoExecuteTools} 
                      onChange={(e) => setAutoExecuteTools(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

              {/* SECTION 3: Academic Search Options */}
              <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800/50 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <h4 className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                    {lang === 'en' ? "Academic Search Filters" : lang === 'pt' ? "Filtros Acadêmicos" : "Filtros de Búsqueda"}
                  </h4>
                </div>

                {/* Automatic Sources Toggle */}
                <div className="flex items-center justify-between py-0.5 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Auto Source Selection (AI):" : "Elegir Fuentes Automático (IA):"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={autoSources} 
                      onChange={(e) => setAutoSources(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Sources Selection Checkboxes */}
                <div className={`space-y-1.5 py-1 transition-all duration-200 ${autoSources ? "opacity-45 pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">
                      {lang === 'en' ? "Search Sources:" : "Repositorios y Fuentes:"}
                    </label>
                    {autoSources && (
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                        {lang === 'en' ? "AI Selects" : "Selección por IA"}
                      </span>
                    )}
                  </div>
                  <div className="hidden">
                    {[
                      { id: "alicia", label: "Alicia (Concytec)" },
                      { id: "renati", label: "Renati" },
                      { id: "peru", label: "Perú" },
                      { id: "latam", label: "Latam" },
                      { id: "global", label: "Global / World" }
                    ].map((srcItem) => {
                      const isChecked = selectedSources.includes(srcItem.id);
                      return (
                        <label 
                          key={srcItem.id} 
                          className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition-all duration-150 ${
                            isChecked 
                              ? "bg-white dark:bg-zinc-950 border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 font-semibold" 
                              : "bg-transparent border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={autoSources}
                            onChange={() => {
                              setSelectedSources(prev =>
                                prev.includes(srcItem.id)
                                  ? prev.filter(s => s !== srcItem.id)
                                  : [...prev, srcItem.id]
                              );
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 cursor-pointer"
                          />
                          <span className="text-[10px] leading-none truncate">
                            {srcItem.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-zinc-100/45 dark:border-zinc-800/70 dark:bg-zinc-800/25">
                    <div className="flex items-center justify-between border-b border-zinc-200/60 px-2.5 py-2 dark:border-zinc-800/70">
                      <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">{selectedSources.length} seleccionada{selectedSources.length === 1 ? '' : 's'} de {catalogSources.length}</span>
                      <button type="button" onClick={() => setSelectedSources([])} disabled={!selectedSources.length} className="text-[9px] font-bold text-indigo-600 disabled:opacity-30 dark:text-indigo-400">Limpiar</button>
                    </div>
                    <div className="max-h-52 divide-y divide-zinc-200/60 overflow-y-auto dark:divide-zinc-800/70">
                      {sourceGroups.map((group) => {
                        const groupSources = group.sources.map((id) => sourceById.get(id) || { id, name: id, country: '', category: 'free', keyNeeded: false, description: '' });
                        const selectedInGroup = groupSources.filter((source) => selectedSources.includes(source.id)).length;
                        const expanded = expandedSourceGroups[group.id] === true;
                        return (
                          <div key={group.id}>
                            <div className="flex items-center gap-1 px-2 py-1.5">
                              <button type="button" onClick={() => setExpandedSourceGroups((current) => ({ ...current, [group.id]: !expanded }))} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                                {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />}
                                <span className="truncate text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{group.name}</span>
                                <span className="text-[9px] text-zinc-400">{selectedInGroup}/{groupSources.length}</span>
                              </button>
                              <button type="button" onClick={() => toggleSourceGroup(group.sources)} className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30">
                                {selectedInGroup === groupSources.length && groupSources.length ? 'Quitar' : 'Todo'}
                              </button>
                            </div>
                            {expanded && (
                              <div className="grid grid-cols-1 gap-1 px-2 pb-2 sm:grid-cols-2">
                                {groupSources.map((source) => {
                                  const checked = selectedSources.includes(source.id);
                                  return (
                                    <label key={source.id} className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-[10px] transition ${checked ? 'border-indigo-200 bg-white text-indigo-700 dark:border-indigo-800/70 dark:bg-zinc-950 dark:text-indigo-300' : 'border-transparent text-zinc-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70'}`}>
                                      <input type="checkbox" checked={checked} disabled={autoSources} onChange={() => toggleSource(source.id)} className="h-3.5 w-3.5 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700" />
                                      <span className="min-w-0 truncate" title={`${source.name} (${source.id})`}>{source.name}</span>
                                      {source.keyNeeded && <span className="ml-auto text-[8px] text-amber-500">KEY</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Automatic Max Results Toggle */}
                <div className="flex items-center justify-between py-0.5 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Auto Max Results (AI):" : "Resultados Máx Automático (IA):"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={autoMaxResults} 
                      onChange={(e) => setAutoMaxResults(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Search Max Results Selector */}
                <div className={`flex items-center justify-between text-xs py-1 transition-all duration-200 ${autoMaxResults ? "opacity-45 pointer-events-none" : ""}`}>
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Max Results:" : "Resultados Máx:"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {autoMaxResults ? (
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                        {lang === 'en' ? "Dynamic" : "Optimizado"}
                      </span>
                    ) : (
                      <div className="relative shrink-0">
                        <select
                          value={searchMaxResults}
                          disabled={autoMaxResults}
                          onChange={(e) => setSearchMaxResults(parseInt(e.target.value))}
                          className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Year Range Inputs */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Year Filters (Start - End):" : "Años (Inicio - Fin):"}
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50">
                    <input
                      type="text"
                      value={searchYearStart}
                      onChange={(e) => setSearchYearStart(e.target.value)}
                      placeholder="2020"
                      className="bg-transparent text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 border-none focus:ring-0 outline-none p-0 w-8 text-center placeholder:text-zinc-400/50"
                      maxLength={4}
                    />
                    <span className="text-[10px] text-zinc-400">-</span>
                    <input
                      type="text"
                      value={searchYearEnd}
                      onChange={(e) => setSearchYearEnd(e.target.value)}
                      placeholder="2026"
                      className="bg-transparent text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 border-none focus:ring-0 outline-none p-0 w-8 text-center placeholder:text-zinc-400/50"
                      maxLength={4}
                    />
                  </div>
                </div>

                {/* Fast Mode Toggle */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Fast Mode (Omit Enrichment):" : "Modo Rápido (Omitir Enriquecimento):"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={searchFastMode} 
                      onChange={(e) => setSearchFastMode(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Guardrails Toggle */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                    {lang === 'en' ? "Academic Guardrails:" : "Restringir a Academia (Guardrails):"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={strictGuardrails} 
                      onChange={(e) => setStrictGuardrails(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Anti-hallucination Toggle */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                    {lang === 'en' ? "Anti-Hallucination Guard:" : "Verificación Antialucinación:"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={antiHallucination} 
                      onChange={(e) => setAntiHallucination(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Peru Web Fallback Toggle */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex flex-col pr-2">
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                      {lang === 'en' ? "Peru Web Fallback (peru_web_fallback):" : "Rescate Web Peruano (peru_web_fallback):"}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-sans">
                      {lang === 'en' ? "Off by default. Scrapes .edu.pe if national repos return 0 results." : lang === 'pt' ? "Desativado por padrão. Scrape .edu.pe se repositórios nacionais retornarem 0 resultados." : "Desactivado por defecto. Realiza scraping a dominios .edu.pe si repositorios no traen hallazgos."}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 ml-1">
                    <input 
                      type="checkbox" 
                      checked={enablePeruWebFallback} 
                      onChange={(e) => setEnablePeruWebFallback(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Model Fallback Controls */}
                <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-2">
                  <div className="flex items-center justify-between py-1 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                        {lang === 'en' ? "Model Fallback on Error:" : lang === 'pt' ? "Fallback de Modelo em Erro:" : "Conmutación por Error (Fallback):"}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-sans">
                        {lang === 'en' ? "Off by default. Reports errors directly without switching models." : lang === 'pt' ? "Desativado por padrão. Reporta erros diretamente sem alterar modelo." : "Desactivado por defecto. Reporta errores directamente sin cambiar de modelo."}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 ml-2">
                      <input 
                        type="checkbox" 
                        checked={enableModelFallback} 
                        onChange={(e) => setEnableModelFallback(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  <div className={`flex items-center justify-between py-1 text-xs transition-opacity ${enableModelFallback ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                      {lang === 'en' ? "Select Fallback Model:" : lang === 'pt' ? "Modelo de Fallback:" : "Modelo de Reserva (Fallback):"}
                    </span>
                    <div className="relative inline-block">
                      <select
                        value={fallbackModel}
                        onChange={(e) => setFallbackModel(e.target.value)}
                        disabled={!enableModelFallback}
                        className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4 max-w-[150px] truncate"
                      >
                        {modelGroups.length === 0 ? (
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (default)</option>
                        ) : modelGroups.map(g => (
                          <optgroup key={g.label} label={g.label}>
                            {g.items.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Voice Responses & Voice Synth */}
              <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800/50 space-y-3">
                <div className="flex items-center gap-1.5">
                  {speakResponses ? <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-400" />}
                  <h4 className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                    {lang === 'en' ? "Voice & Audio Synthesizer" : "Voz y Sintetizador de Audio"}
                  </h4>
                </div>

                {/* Speak Responses Toggle */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {lang === 'en' ? "Auto-Speak Responses:" : "Reproducir Respuestas Automáticamente:"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input 
                      type="checkbox" 
                      checked={speakResponses} 
                      onChange={() => handleToggleSpeakResponses()} 
                      className="sr-only peer" 
                    />
                    <div className="w-7 h-4 bg-zinc-200 dark:bg-zinc-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-650 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                  </label>
                </div>

                {/* Voice Selection */}
                {availableVoices.length > 0 && (
                  <div className="flex items-center justify-between py-1 text-xs">
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                      {lang === 'en' ? "Voice Pitch:" : "Sintetizador / Voz:"}
                    </span>
                    <div className="relative shrink-0">
                      <select
                        value={selectedVoiceName}
                        onChange={(e) => handleVoiceChange(e.target.value)}
                        className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-0.5 border border-zinc-200 dark:border-zinc-700/50 outline-none cursor-pointer appearance-none pr-4 max-w-[130px] truncate"
                      >
                        {availableVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>{voice.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
