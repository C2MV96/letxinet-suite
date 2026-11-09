/**
 * MobileBottomNav — Barra de navegación inferior fija para móvil (<768px).
 * Sustituye al RightNavRail (que es hidden md:block) en pantallas pequeñas.
 * 5 tabs frecuentes visibles + botón "Más" que abre un sheet con los restantes.
 *
 * v1.0.11-mobile — Añadido para que el usuario pueda navegar entre paneles
 * y configurar API keys desde un celular Android (WebView 43123).
 */
import { useState } from 'react';
import { Brain, Terminal, Lightbulb, Key, MoreHorizontal, Database, Settings, Server, X } from 'lucide-react';
import type { TabId } from './RightNavRail';

interface Props {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  onOpenChatDrawer: () => void;
}

const PRIMARY_TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'chat',       label: 'Chat',     icon: Brain },
  { id: 'playground', label: 'Play',     icon: Terminal },
  { id: 'skills',     label: 'Skills',   icon: Lightbulb },
  { id: 'keys',       label: 'Keys',     icon: Key },
];

const MORE_TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'sources',          label: 'Fuentes',           icon: Database },
  { id: 'system-variables', label: 'Variables Sistema', icon: Settings },
  { id: 'providers',        label: 'Proveedores',      icon: Server },
];

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenChatDrawer }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSelect = (t: TabId) => {
    setActiveTab(t);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Bottom nav fija — solo móvil */}
      <nav
        aria-label="Navegación inferior móvil"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Botón menu chats (hamburguesa) */}
        <button
          type="button"
          onClick={onOpenChatDrawer}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 active:bg-indigo-50 dark:active:bg-indigo-900/20 transition-colors"
          title="Lista de chats"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          <span className="text-[9px] font-bold">Chats</span>
        </button>

        {/* Tabs frecuentes */}
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelect(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 active:bg-indigo-50 dark:active:bg-indigo-900/20'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 active:bg-zinc-100 dark:active:bg-zinc-800/50'
              }`}
              title={tab.label}
              aria-pressed={isActive}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              <span className={`text-[9px] font-bold ${isActive ? 'font-extrabold' : ''}`}>{tab.label}</span>
              {isActive && (
                <span className="absolute -top-px w-8 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-b-full" />
              )}
            </button>
          );
        })}

        {/* Botón Más */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-colors ${
            moreOpen || MORE_TABS.some(t => t.id === activeTab)
              ? 'text-indigo-600 dark:text-indigo-400 active:bg-indigo-50 dark:active:bg-indigo-900/20'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 active:bg-zinc-100 dark:active:bg-zinc-800/50'
          }`}
          title="Más secciones"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[9px] font-bold">Más</span>
        </button>
      </nav>

      {/* Sheet "Más" — modal bottom-up con tabs adicionales */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideInUp 0.18s ease-out' }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                Más secciones
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 pt-1">
              {MORE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelect(tab.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                        : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 active:bg-zinc-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold text-center leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
