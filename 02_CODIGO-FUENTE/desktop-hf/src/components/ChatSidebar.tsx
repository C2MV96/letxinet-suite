/**
 * ChatSidebar (Variante C v1.3 — sidebar chats persistentes)
 * - Lista chats persistidos en disco (%APPDATA%\LetXinet Suite\chats\)
 * - Nuevo chat (+), Renombrar (doble-click), Eliminar (Trash con confirm)
 * - Marca chat activo (resaltado)
 * - Carga metadatos al montar; emite onActiveChat al seleccionar
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, MessageSquare, Pencil, Check, X, RefreshCw, AlertCircle } from 'lucide-react';

export interface ChatMeta {
  uuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider?: string;
  model?: string;
  msgCount: number;
}

interface Props {
  activeChatId: string | null;
  onActiveChat: (uuid: string) => void;
  onNewChat: () => void;
  collapseSignal?: number; // toggle sidebar desde el header del chat
  // Fase H v1.0.11p: signal explicita para forzar refresco de la lista
  // despues de operaciones de App.tsx (crear nuevo chat, borrar, etc).
  // ChatSidebar escuchara cambios en este numero y re-ejecutara fetchChats.
  refreshSignal?: number;
  // Fase H v1.0.11q: movilMode=true quita el 'hidden md:flex' (oculto por defecto
  // en breakpoint movil). Necesario cuando ChatSidebar se monta DENTRO de
  // MobileChatDrawer (contenedor movil nativo) para que el header con el boton
  // "+" sea visible Y clicable en movil. Antes el header estaba hidden en
  // movil Android WebView aunque el MobileChatDrawer lo hiciese visible.
  mobileMode?: boolean;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatSidebar({ activeChatId, onActiveChat, onNewChat, refreshSignal, mobileMode }: Props) {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const fetchChats = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/chats');
      const d = await r.json();
      // Fase H v1.0.11p: tolerar 2 contratos — {ok:true, chats:[...]} (nuevo)
      // o {chats:[...]} (viejo) o {chats:[...]} plano. Cada chat item puede tener
      // uuid o id (homogeneizamos a uuid).
      const rawChats = (d && Array.isArray(d.chats)) ? d.chats : (Array.isArray(d) ? d : []);
      const normalized = rawChats.map((c: any) => ({
        uuid: c.uuid || c.id,
        id: c.id || c.uuid,
        title: c.title || 'Untitled',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        msgCount: c.messageCount || c.msgCount || 0,
      }));
      setChats(normalized);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Refrescar cuando cambie activeChatId (al crear nuevo, forzar reload de la lista)
  useEffect(() => {
    if (activeChatId) fetchChats();
  }, [activeChatId, fetchChats]);

  // Fase H v1.0.11p: refreshSignal explicita desde App.tsx. Se incrementa
  // cuando handleNewChat (o cualquier otra operacion) necesita forzar el
  // reload de la lista SIN depender de activeChatId (que podria no cambiar
  // en algunos edge cases: falla el POST, ID duplicado, race, etc).
  useEffect(() => {
    if (refreshSignal && refreshSignal > 0) fetchChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const doRename = async (uuid: string, title: string) => {
    try {
      const r = await fetch(`/api/chats/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const d = await r.json();
      if (d.ok) {
        setChats((cs) => cs.map((c) => (c.uuid === uuid ? { ...c, title } : c)));
      } else {
        setErr(d.error || 'Error renombrando');
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
    setRenaming(null);
  };

  const doDelete = async (uuid: string) => {
    try {
      const r = await fetch(`/api/chats/${uuid}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.ok) {
        setChats((cs) => cs.filter((c) => c.uuid !== uuid));
        if (activeChatId === uuid) onActiveChat('');
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
    setConfirmDel(null);
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 w-64 shrink-0 ${mobileMode ? '' : 'hidden md:flex'}`}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
          <MessageSquare className="w-3.5 h-3.5" />
          Chats
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchChats}
            className="text-zinc-400 hover:text-indigo-500 p-1 rounded"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNewChat}
            className="text-zinc-400 hover:text-emerald-500 p-1 rounded"
            title="Nuevo chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && chats.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-400">Cargando…</div>
        ) : chats.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-zinc-400">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
            No hay chats.
            <br />
            Pulsa <Plus className="w-3 h-3 inline" /> para crear uno nuevo.
          </div>
        ) : (
          <ul className="space-y-0.5 px-1">
            {chats.map((c) => {
              const isActive = c.uuid === activeChatId;
              const isRenaming = renaming === c.uuid;
              const isConfirming = confirmDel === c.uuid;
              return (
                <li
                  key={c.uuid}
                  className={`group rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {isRenaming ? (
                    // Input inline rename
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') doRename(c.uuid, renameValue);
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        className="flex-1 text-xs px-1.5 py-1 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-900 outline-none"
                      />
                      <button
                        onClick={() => doRename(c.uuid, renameValue)}
                        className="text-emerald-500 hover:text-emerald-600"
                        title="Guardar"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRenaming(null)}
                        className="text-zinc-400 hover:text-red-500"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isConfirming ? (
                    // Confirmación delete
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-red-50 dark:bg-red-900/20">
                      <span className="text-[10px] text-red-600 dark:text-red-400 flex-1">¿Eliminar?</span>
                      <button
                        onClick={() => doDelete(c.uuid)}
                        className="text-red-500 hover:text-red-600 font-bold text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40"
                        title="Confirmar"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className="text-zinc-400 hover:text-zinc-600 text-[10px] px-1.5 py-0.5 rounded"
                        title="Cancelar"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    // Item normal
                    <div
                      onClick={() => onActiveChat(c.uuid)}
                      onDoubleClick={() => {
                        setRenaming(c.uuid);
                        setRenameValue(c.title);
                      }}
                      className="px-2.5 py-2 cursor-pointer flex items-start gap-1.5"
                    >
                      <MessageSquare
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          isActive ? 'text-indigo-500' : 'text-zinc-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{c.title}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                          <span>{fmtDate(c.updatedAt)}</span>
                          <span>·</span>
                          <span>{c.msgCount} msg</span>
                          {c.provider && (
                            <span className="font-mono opacity-60 truncate">· {c.provider}</span>
                          )}
                        </div>
                      </div>
                      {/* Acciones hover */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenaming(c.uuid);
                            setRenameValue(c.title);
                          }}
                          className="text-zinc-400 hover:text-indigo-500 p-0.5"
                          title="Renombrar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDel(c.uuid);
                          }}
                          className="text-zinc-400 hover:text-red-500 p-0.5"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer errores */}
      {err && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] flex items-center gap-1 border-t border-red-100 dark:border-red-900/40">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{err}</span>
        </div>
      )}
      <div className="px-3 py-1.5 text-[10px] text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 font-mono">
        {chats.length} chats · persistido en %APPDATA%\LetXinet Suite\chats\
      </div>
    </div>
  );
}
